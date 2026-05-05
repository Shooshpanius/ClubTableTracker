import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { isTokenExpired } from '../utils/auth'

interface ChatSummary {
  id: number
  isGroup: boolean
  isPublic: boolean
  clubId?: number
  name: string
  avatarUrl?: string
  lastMessage?: { text: string; sentAt: string }
  unreadCount: number
}

interface Message {
  id: number
  chatId: number
  text: string
  sentAt: string
  sender: { id: string; name: string; avatarUrl?: string }
}

interface ClubMember {
  id: string
  name: string
  avatarUrl?: string
}

interface Club {
  id: number
  name: string
}

interface Membership {
  id: number
  status: string
  club: Club
}

function parseToken(token: string): { id: string } | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(atob(base64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''))
    const payload = JSON.parse(json)
    return { id: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] }
  } catch {
    return null
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function Avatar({ name, url, size = 36 }: { name: string; url?: string; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const avatarColors = ['#4a9eff', '#e94560', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4']
  const colorIdx = name.charCodeAt(0) % avatarColors.length
  const bg = avatarColors[colorIdx]
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: Math.round(size * 0.38), fontWeight: 'bold', color: '#fff',
    background: bg, overflow: 'hidden', userSelect: 'none',
  }
  if (url && !imgError) {
    return (
      <div style={style}>
        <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgError(true)} />
      </div>
    )
  }
  return <div style={style}>{getInitials(name)}</div>
}

const MAX_TEXTAREA_HEIGHT = 120

export default function MessengerPage() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token') || ''
  const myId = token ? parseToken(token)?.id ?? '' : ''

  const [chats, setChats] = useState<ChatSummary[]>([])
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [viewportOffset, setViewportOffset] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    let prevHeight = vv.height
    const handler = () => {
      const offset = Math.max(0, window.innerHeight - vv.height)
      setViewportOffset(offset)
      if (vv.height < prevHeight) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
      prevHeight = vv.height
    }
    vv.addEventListener('resize', handler)
    vv.addEventListener('scroll', handler)
    return () => {
      vv.removeEventListener('resize', handler)
      vv.removeEventListener('scroll', handler)
    }
  }, [])

  const isMobile = windowWidth < 640

  useEffect(() => {
    if (!token || isTokenExpired(token)) { navigate('/'); return }
  }, [token, navigate])

  const loadChats = useCallback(async () => {
    const res = await fetch('/api/messenger/chats', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setChats(await res.json())
  }, [token])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadChats()
  }, [loadChats])

  const loadMessages = useCallback(async (chatId: number) => {
    const res = await fetch(`/api/messenger/chats/${chatId}/messages`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const data: Message[] = await res.json()
      setMessages(data)
    }
  }, [token])

  const markAsRead = useCallback((chatId: number) => {
    fetch(`/api/messenger/chats/${chatId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }).then(() => {
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, unreadCount: 0 } : c))
    }).catch(() => {})
  }, [token])

  useEffect(() => {
    if (activeChatId == null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMessages(activeChatId)
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      await loadMessages(activeChatId)
      await loadChats()
      setChats(prev => {
        const chat = prev.find(c => c.id === activeChatId)
        if (chat && chat.unreadCount > 0) markAsRead(activeChatId)
        return prev
      })
    }, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [activeChatId, loadMessages, loadChats, markAsRead])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectChat = (chatId: number) => {
    setActiveChatId(chatId)
    setMessages([])
    markAsRead(chatId)
    if (isMobile) setMobileView('chat')
  }

  const resizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px'
  }

  const sendMessage = async () => {
    if (!inputText.trim() || activeChatId == null || sending) return
    setSending(true)
    const res = await fetch(`/api/messenger/chats/${activeChatId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: inputText.trim() })
    })
    setSending(false)
    if (res.ok) {
      const msg: Message = await res.json()
      setMessages(prev => [...prev, msg])
      setInputText('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      loadChats()
    }
  }

  const openNewChat = async () => {
    setShowNewChat(true)
    setLoadingMembers(true)
    setClubMembers([])
    const msRes = await fetch('/api/club/my-memberships', { headers: { Authorization: `Bearer ${token}` } })
    if (!msRes.ok) { setLoadingMembers(false); return }
    const memberships: Membership[] = await msRes.json()
    const approved = memberships.filter(m => m.status === 'Approved')
    const allMembers: ClubMember[] = []
    const seen = new Set<string>()
    await Promise.all(approved.map(async ms => {
      const res = await fetch(`/api/club/${ms.club.id}/members`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const members: ClubMember[] = await res.json()
      members.forEach(m => {
        if (!m.id.startsWith('manual:') && m.id !== myId && !seen.has(m.id)) {
          seen.add(m.id)
          allMembers.push(m)
        }
      })
    }))
    setClubMembers(allMembers)
    setLoadingMembers(false)
  }

  const startDirectChat = async (otherUserId: string) => {
    setShowNewChat(false)
    const res = await fetch('/api/messenger/chats/direct', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ otherUserId })
    })
    if (res.ok) {
      const data = await res.json()
      await loadChats()
      setActiveChatId(data.id)
      if (isMobile) setMobileView('chat')
    }
  }

  const activeChat = chats.find(c => c.id === activeChatId)

  const parseUtc = (iso: string) => new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z')

  const formatTime = (iso: string) => {
    const d = parseUtc(iso)
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (iso: string) => {
    const d = parseUtc(iso)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return formatTime(iso)
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex', position: 'fixed', top: 0, left: 0, right: 0, bottom: viewportOffset,
    fontFamily: 'Arial, sans-serif', background: '#1a1a2e', color: '#eee', overflow: 'hidden',
  }

  const sidebarStyle: React.CSSProperties = {
    width: isMobile ? '100%' : '280px',
    minWidth: isMobile ? undefined : '220px',
    borderRight: isMobile ? 'none' : '1px solid #333',
    display: isMobile && mobileView === 'chat' ? 'none' : 'flex',
    flexDirection: 'column',
    background: '#16213e',
    flexShrink: 0,
  }

  const mainStyle: React.CSSProperties = {
    flex: 1, display: isMobile && mobileView === 'list' ? 'none' : 'flex',
    flexDirection: 'column', minWidth: 0,
  }

  return (
    <div style={containerStyle}>
      {/* Боковая панель */}
      <div style={sidebarStyle}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Сообщения</span>
          <button
            style={{ background: '#4a9eff', border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
            onClick={openNewChat}
          >+ Новый</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {chats.length === 0 && (
            <div style={{ padding: '16px', color: '#555', fontSize: '13px' }}>Нет чатов</div>
          )}
          {chats.map(c => (
            <div
              key={c.id}
              style={{
                padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #222',
                display: 'flex', alignItems: 'center', gap: '10px',
                background: c.id === activeChatId ? '#0f3460' : 'transparent',
              }}
              onClick={() => selectChat(c.id)}
            >
              <Avatar name={c.name} url={c.avatarUrl} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.isGroup && <span style={{ marginRight: '4px' }}>{c.isPublic ? '🌐' : '🔒'}</span>}
                    {c.name}
                  </div>
                  {c.unreadCount > 0 && (
                    <span style={{ background: '#4a9eff', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 'bold', flexShrink: 0, marginLeft: '6px' }}>
                      {c.unreadCount > 99 ? '99+' : c.unreadCount}
                    </span>
                  )}
                </div>
                {c.lastMessage && (
                  <div style={{ fontSize: '12px', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.lastMessage.text.length > 35 ? c.lastMessage.text.slice(0, 35) + '…' : c.lastMessage.text}
                    <span style={{ float: 'right', fontSize: '10px', color: '#666' }}>{formatDate(c.lastMessage.sentAt)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #333' }}>
          <button
            style={{ background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', fontSize: '13px' }}
            onClick={() => navigate('/')}
          >← На главную</button>
        </div>
      </div>

      {/* Основная область */}
      <div style={mainStyle}>
        {activeChatId == null ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '16px', textAlign: 'center', padding: '16px' }}>
            Выберите чат или начните новый
          </div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #333', background: '#16213e', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isMobile && (
                <button
                  style={{ background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', fontSize: '22px', padding: '0 6px 0 0', lineHeight: 1, flexShrink: 0 }}
                  onClick={() => setMobileView('list')}
                >‹</button>
              )}
              <Avatar name={activeChat?.name ?? 'Чат'} url={activeChat?.avatarUrl} size={34} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeChat?.isGroup && <span style={{ marginRight: '6px' }}>{activeChat.isPublic ? '🌐' : '🔒'}</span>}
                {activeChat?.name ?? 'Чат'}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {messages.map(m => {
                const isMe = m.sender.id === myId
                if (isMe) {
                  return (
                    <div key={m.id} style={{ alignSelf: 'flex-end', background: '#0f3460', borderRadius: '12px 12px 2px 12px', padding: '8px 14px', maxWidth: '70%', wordBreak: 'break-word' }}>
                      <div style={{ fontSize: '14px' }}>{m.text}</div>
                      <div style={{ fontSize: '10px', color: '#888', marginTop: '2px', textAlign: 'right' }}>{formatTime(m.sentAt)}</div>
                    </div>
                  )
                }
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                    <Avatar name={m.sender.name} url={m.sender.avatarUrl} size={28} />
                    <div style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: '12px 12px 12px 2px', padding: '8px 14px', maxWidth: '70%', wordBreak: 'break-word' }}>
                      <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>{m.sender.name}</div>
                      <div style={{ fontSize: '14px' }}>{m.text}</div>
                      <div style={{ fontSize: '10px', color: '#888', marginTop: '2px', textAlign: 'right' }}>{formatTime(m.sentAt)}</div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid #333', display: 'flex', gap: '8px', background: '#16213e', alignItems: 'flex-end' }}>
              <textarea
                ref={textareaRef}
                style={{ flex: 1, background: '#0f1b2d', border: '1px solid #444', borderRadius: '6px', color: '#eee', padding: '8px 12px', fontSize: '14px', outline: 'none', resize: 'none', overflowY: 'auto', lineHeight: '1.4', minHeight: '36px', maxHeight: MAX_TEXTAREA_HEIGHT + 'px', fontFamily: 'inherit' }}
                placeholder="Написать сообщение..."
                value={inputText}
                rows={1}
                onChange={e => { setInputText(e.target.value); resizeTextarea() }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                maxLength={4000}
              />
              <button
                style={{ background: sending || !inputText.trim() ? '#2a4a6a' : '#4a9eff', border: 'none', color: '#fff', borderRadius: '6px', padding: '8px 14px', cursor: sending || !inputText.trim() ? 'default' : 'pointer', fontWeight: 'bold', fontSize: '16px', flexShrink: 0, alignSelf: 'flex-end' }}
                onClick={sendMessage}
                disabled={sending || !inputText.trim()}
              >
                {sending ? '…' : '▶'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Модальное окно нового чата */}
      {showNewChat && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowNewChat(false)}
        >
          <div
            style={{ background: '#16213e', borderRadius: '10px', padding: '20px', minWidth: '280px', maxWidth: '480px', width: '90%', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '16px' }}>Личное сообщение</div>
            {loadingMembers ? (
              <div style={{ color: '#aaa' }}>Загрузка участников...</div>
            ) : clubMembers.length === 0 ? (
              <div style={{ color: '#aaa' }}>Нет доступных участников</div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {clubMembers.map(m => (
                  <div
                    key={m.id}
                    style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: '6px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#0f3460')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => startDirectChat(m.id)}
                  >
                    <Avatar name={m.name} url={m.avatarUrl} size={32} />
                    <span>{m.name}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              style={{ background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', fontSize: '14px', padding: '4px 0', marginTop: '16px' }}
              onClick={() => setShowNewChat(false)}
            >Закрыть</button>
          </div>
        </div>
      )}
    </div>
  )
}
