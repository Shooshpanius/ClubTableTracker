import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { isTokenExpired } from '../utils/auth'

interface ChatSummary {
  id: number
  isGroup: boolean
  isPublic: boolean
  clubId?: number
  name: string
  lastMessage?: { text: string; sentAt: string }
  unreadCount: number
}

interface Message {
  id: number
  chatId: number
  text: string
  sentAt: string
  sender: { id: string; name: string }
}

interface ClubMember {
  id: string
  name: string
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

const CHAT_NAME_MAX_LENGTH = 100

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
  const [newChatMode, setNewChatMode] = useState<'choose' | 'direct' | 'group'>('choose')
  const [groupName, setGroupName] = useState('')
  const [groupIsPublic, setGroupIsPublic] = useState(true)
  const [groupClubId, setGroupClubId] = useState<number | null>(null)
  const [groupSelectedMembers, setGroupSelectedMembers] = useState<Set<string>>(new Set())
  const [myClubs, setMyClubs] = useState<Club[]>([])
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
      // Сбрасываем счётчик только если накопились непрочитанные
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
      loadChats()
    }
  }

  const openNewChat = async () => {
    setShowNewChat(true)
    setNewChatMode('choose')
    setGroupName('')
    setGroupIsPublic(true)
    setGroupSelectedMembers(new Set())
    setGroupClubId(null)
    setLoadingMembers(false)
    setClubMembers([])
    const msRes = await fetch('/api/club/my-memberships', { headers: { Authorization: `Bearer ${token}` } })
    if (!msRes.ok) return
    const memberships: Membership[] = await msRes.json()
    const approved = memberships.filter(m => m.status === 'Approved')
    setMyClubs(approved.map(m => m.club))
  }

  const openDirectMode = async () => {
    setNewChatMode('direct')
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

  const loadClubMembersForGroup = async (clubId: number) => {
    setGroupClubId(clubId)
    setLoadingMembers(true)
    setClubMembers([])
    setGroupSelectedMembers(new Set())
    const res = await fetch(`/api/club/${clubId}/members`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) { setLoadingMembers(false); return }
    const members: ClubMember[] = await res.json()
    setClubMembers(members.filter(m => !m.id.startsWith('manual:') && m.id !== myId))
    setLoadingMembers(false)
  }

  const toggleGroupMember = (id: string) => {
    setGroupSelectedMembers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const createGroupChat = async () => {
    if (!groupName.trim() || !groupClubId) return
    const res = await fetch('/api/messenger/chats/group', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: groupName.trim(),
        clubId: groupClubId,
        isPublic: groupIsPublic,
        memberIds: groupIsPublic ? null : Array.from(groupSelectedMembers)
      })
    })
    if (res.ok) {
      const data = await res.json()
      setShowNewChat(false)
      await loadChats()
      setActiveChatId(data.id)
    }
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
    }
  }

  const activeChat = chats.find(c => c.id === activeChatId)

  const s: Record<string, React.CSSProperties> = {
    container: { display: 'flex', height: 'calc(100vh - 0px)', fontFamily: 'Arial, sans-serif', background: '#1a1a2e', color: '#eee' },
    sidebar: { width: '280px', minWidth: '220px', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', background: '#16213e' },
    sideHeader: { padding: '16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    newBtn: { background: '#4a9eff', border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' },
    chatList: { flex: 1, overflowY: 'auto' },
    chatItem: { padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #222' },
    chatItemActive: { padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #222', background: '#0f3460' },
    chatName: { fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    chatPreview: { fontSize: '12px', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    main: { flex: 1, display: 'flex', flexDirection: 'column' },
    chatHeader: { padding: '16px', borderBottom: '1px solid #333', background: '#16213e', fontWeight: 'bold', fontSize: '16px' },
    messages: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' },
    msgBubbleMe: { alignSelf: 'flex-end', background: '#0f3460', borderRadius: '12px 12px 2px 12px', padding: '8px 14px', maxWidth: '60%' },
    msgBubbleOther: { alignSelf: 'flex-start', background: '#1a1a2e', border: '1px solid #333', borderRadius: '12px 12px 12px 2px', padding: '8px 14px', maxWidth: '60%' },
    msgSender: { fontSize: '11px', color: '#aaa', marginBottom: '2px' },
    msgText: { fontSize: '14px', wordBreak: 'break-word' },
    msgTime: { fontSize: '10px', color: '#888', marginTop: '2px', textAlign: 'right' },
    inputArea: { padding: '12px 16px', borderTop: '1px solid #333', display: 'flex', gap: '8px', background: '#16213e' },
    input: { flex: 1, background: '#0f1b2d', border: '1px solid #444', borderRadius: '6px', color: '#eee', padding: '8px 12px', fontSize: '14px', outline: 'none' },
    sendBtn: { background: '#4a9eff', border: 'none', color: '#fff', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', fontWeight: 'bold' },
    empty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '16px' },
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: '#16213e', borderRadius: '10px', padding: '24px', minWidth: '320px', maxWidth: '480px', width: '90%', maxHeight: '70vh', display: 'flex', flexDirection: 'column' },
    modalTitle: { fontWeight: 'bold', fontSize: '16px', marginBottom: '16px' },
    memberList: { overflowY: 'auto', flex: 1 },
    memberItem: { padding: '10px 12px', cursor: 'pointer', borderRadius: '6px', marginBottom: '4px' },
    backBtn: { background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', fontSize: '14px', padding: '4px 0', marginBottom: '12px' },
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return formatTime(iso)
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div style={s.container}>
      {/* Боковая панель */}
      <div style={s.sidebar}>
        <div style={s.sideHeader}>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Сообщения</span>
          <button style={s.newBtn} onClick={openNewChat}>+ Новый</button>
        </div>
        <div style={s.chatList}>
          {chats.length === 0 && (
            <div style={{ padding: '16px', color: '#555', fontSize: '13px' }}>Нет чатов</div>
          )}
          {chats.map(c => (
            <div
              key={c.id}
              style={c.id === activeChatId ? s.chatItemActive : s.chatItem}
              onClick={() => selectChat(c.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={s.chatName}>
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
                <div style={s.chatPreview}>
                  {c.lastMessage.text.length > 40 ? c.lastMessage.text.slice(0, 40) + '…' : c.lastMessage.text}
                  <span style={{ float: 'right', fontSize: '10px', color: '#666' }}>{formatDate(c.lastMessage.sentAt)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #333' }}>
          <button
            style={{ background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', fontSize: '13px' }}
            onClick={() => navigate('/')}
          >← На главную</button>
        </div>
      </div>

      {/* Основная область */}
      <div style={s.main}>
        {activeChatId == null ? (
          <div style={s.empty}>Выберите чат или начните новый</div>
        ) : (
          <>
            <div style={s.chatHeader}>
              {activeChat?.isGroup && <span style={{ marginRight: '6px' }}>{activeChat.isPublic ? '🌐' : '🔒'}</span>}
              {activeChat?.name ?? 'Чат'}
            </div>
            <div style={s.messages}>
              {messages.map(m => {
                const isMe = m.sender.id === myId
                return (
                  <div key={m.id} style={isMe ? s.msgBubbleMe : s.msgBubbleOther}>
                    {!isMe && <div style={s.msgSender}>{m.sender.name}</div>}
                    <div style={s.msgText}>{m.text}</div>
                    <div style={s.msgTime}>{formatTime(m.sentAt)}</div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
            <div style={s.inputArea}>
              <input
                style={s.input}
                placeholder="Написать сообщение..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                maxLength={4000}
              />
              <button style={s.sendBtn} onClick={sendMessage} disabled={sending || !inputText.trim()}>
                {sending ? '...' : 'Отправить'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Модальное окно нового чата */}
      {showNewChat && (
        <div style={s.overlay} onClick={() => setShowNewChat(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            {newChatMode === 'choose' && (
              <>
                <div style={s.modalTitle}>Новый чат</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    style={{ ...s.newBtn, padding: '12px', fontSize: '14px', textAlign: 'left' }}
                    onClick={openDirectMode}
                  >💬 Личный чат</button>
                  <button
                    style={{ ...s.newBtn, padding: '12px', fontSize: '14px', textAlign: 'left', background: '#2a6e2a' }}
                    onClick={() => setNewChatMode('group')}
                  >👥 Групповой чат</button>
                </div>
                <button style={{ ...s.backBtn, marginTop: '16px' }} onClick={() => setShowNewChat(false)}>Закрыть</button>
              </>
            )}
            {newChatMode === 'direct' && (
              <>
                <div style={s.modalTitle}>Личное сообщение</div>
                <button style={s.backBtn} onClick={() => setNewChatMode('choose')}>← Назад</button>
                {loadingMembers ? (
                  <div style={{ color: '#aaa' }}>Загрузка участников...</div>
                ) : clubMembers.length === 0 ? (
                  <div style={{ color: '#aaa' }}>Нет доступных участников</div>
                ) : (
                  <div style={s.memberList}>
                    {clubMembers.map(m => (
                      <div
                        key={m.id}
                        style={s.memberItem}
                        onMouseEnter={e => (e.currentTarget.style.background = '#0f3460')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => startDirectChat(m.id)}
                      >
                        {m.name}
                      </div>
                    ))}
                  </div>
                )}
                <button style={{ ...s.backBtn, marginTop: '16px' }} onClick={() => setShowNewChat(false)}>Закрыть</button>
              </>
            )}
            {newChatMode === 'group' && (
              <>
                <div style={s.modalTitle}>Групповой чат</div>
                <button style={s.backBtn} onClick={() => setNewChatMode('choose')}>← Назад</button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                  <input
                    style={s.input}
                    placeholder="Название чата"
                    value={groupName}
                    maxLength={CHAT_NAME_MAX_LENGTH}
                    onChange={e => setGroupName(e.target.value)}
                  />
                  <select
                    style={{ ...s.input, cursor: 'pointer' }}
                    value={groupClubId ?? ''}
                    onChange={e => { const v = Number(e.target.value); if (v) loadClubMembersForGroup(v) }}
                  >
                    <option value="">— Выберите клуб —</option>
                    {myClubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="radio" checked={groupIsPublic} onChange={() => setGroupIsPublic(true)} />
                      <span>🌐 Публичный</span>
                    </label>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="radio" checked={!groupIsPublic} onChange={() => setGroupIsPublic(false)} />
                      <span>🔒 Приватный</span>
                    </label>
                  </div>
                  {!groupIsPublic && groupClubId && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>Участники (отметьте нужных):</div>
                      {loadingMembers ? (
                        <div style={{ color: '#aaa', fontSize: '13px' }}>Загрузка...</div>
                      ) : (
                        <div style={{ ...s.memberList, maxHeight: '160px' }}>
                          {clubMembers.map(m => (
                            <label
                              key={m.id}
                              style={{ ...s.memberItem, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            >
                              <input
                                type="checkbox"
                                checked={groupSelectedMembers.has(m.id)}
                                onChange={() => toggleGroupMember(m.id)}
                              />
                              {m.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  style={{ ...s.newBtn, width: '100%', padding: '10px', opacity: (!groupName.trim() || !groupClubId) ? 0.5 : 1 }}
                  disabled={!groupName.trim() || !groupClubId}
                  onClick={createGroupChat}
                >Создать чат</button>
                <button style={{ ...s.backBtn, marginTop: '8px' }} onClick={() => setShowNewChat(false)}>Закрыть</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
