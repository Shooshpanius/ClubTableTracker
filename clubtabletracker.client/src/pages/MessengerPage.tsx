import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { isTokenExpired } from '../utils/auth'
import { Button } from '../components/ui'

interface ChatSummary {
  id: number
  isGroup: boolean
  isPublic: boolean
  clubId?: number
  name: string
  avatarUrl?: string
  clubShortName?: string
  clubBadgeColor?: string
  lastMessage?: { text: string; sentAt: string }
  unreadCount: number
}

interface ReplyInfo {
  id: number
  text: string
  senderName: string
}

interface Message {
  id: number
  chatId: number
  text: string
  sentAt: string
  sender: { id: string; name: string; avatarUrl?: string }
  replyTo?: ReplyInfo
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

interface ContextMenu {
  messageId: number
  text: string
  isMe: boolean
  senderName: string
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

function Avatar({ name, url, size = 36, isGroup = false }: { name: string; url?: string; size?: number; isGroup?: boolean }) {
  const [imgError, setImgError] = useState(false)
  const avatarColors = ['#c4283b', '#c4a35a', '#3a8a4a', '#c49030', '#7b4fa3', '#1a6e8a']
  const colorIdx = name.charCodeAt(0) % avatarColors.length
  const bg = avatarColors[colorIdx]
  const style: React.CSSProperties = {
    width: size, height: size, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: Math.round(size * 0.34), fontWeight: 'bold',
    color: 'var(--gd-brass)', background: bg, overflow: 'hidden', userSelect: 'none',
    fontFamily: 'var(--gd-font-display)',
    clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  }
  if (url && !imgError) {
    return (
      <div style={style}>
        <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgError(true)} />
      </div>
    )
  }
  return <div style={style}>{isGroup ? '✠' : getInitials(name)}</div>
}

const MAX_TEXTAREA_HEIGHT = 120

export default function MessengerPage() {
  const navigate = useNavigate()
  const location = useLocation()
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
  const [vpHeight, setVpHeight] = useState(window.visualViewport?.height ?? window.innerHeight)
  const [vpTop, setVpTop] = useState(window.visualViewport?.offsetTop ?? 0)

  // Контекстное меню (long press)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  // Ответ на сообщение
  const [replyTo, setReplyTo] = useState<ReplyInfo | null>(null)
  // Пересылка сообщения
  const [forwardText, setForwardText] = useState<string | null>(null)
  // Toast «Скопировано»
  const [copyToast, setCopyToast] = useState(false)
  // Toast ошибки
  const [errorToast, setErrorToast] = useState<string | null>(null)
  // Удаление одного сообщения
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [deletingMessage, setDeletingMessage] = useState(false)

  // Выделение сообщений (только десктоп)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<number>>(new Set())
  const [deleteSelectedConfirm, setDeleteSelectedConfirm] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const scrollToBottomRef = useRef(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressStart = useRef<{ x: number; y: number } | null>(null)
  const longPressTriggered = useRef(false)

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) {
      const fallback = () => { setVpHeight(window.innerHeight); setVpTop(0) }
      window.addEventListener('resize', fallback)
      return () => window.removeEventListener('resize', fallback)
    }
    let prevHeight = vv.height
    const handler = () => {
      setVpHeight(vv.height)
      setVpTop(vv.offsetTop)
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
  const isSelectionMode = !isMobile && selectedMessageIds.size > 0

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

  // Автооткрытие личного чата если переходим с другой страницы (state.openDirectWithUserId)
  const pendingDirectUserRef = useRef<string | null>(
    (location.state as { openDirectWithUserId?: string } | null)?.openDirectWithUserId ?? null
  )
  useEffect(() => {
    if (!pendingDirectUserRef.current) return
    const userId = pendingDirectUserRef.current
    pendingDirectUserRef.current = null
    // Очищаем state чтобы при повторном визите не открывалось снова
    window.history.replaceState({}, '')
    void (async () => {
      const res = await fetch('/api/messenger/chats/direct', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId: userId })
      })
      if (res.ok) {
        const data = await res.json()
        await loadChats()
        setActiveChatId(data.id)
        if (window.innerWidth < 640) setMobileView('chat')
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loadChats])

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
    scrollToBottomRef.current = true
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
    if (messages.length === 0) return
    const container = messagesContainerRef.current
    if (!container) return
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    if (scrollToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
    } else if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    scrollToBottomRef.current = false
  }, [messages])

  useEffect(() => {
    if (replyTo != null) textareaRef.current?.focus()
  }, [replyTo])

  const selectChat = (chatId: number) => {
    setActiveChatId(chatId)
    setMessages([])
    setContextMenu(null)
    setReplyTo(null)
    setSelectedMessageIds(new Set())
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
    const body: { text: string; replyToId?: number } = { text: inputText.trim() }
    if (replyTo) body.replyToId = replyTo.id
    const res = await fetch(`/api/messenger/chats/${activeChatId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    setSending(false)
    if (res.ok) {
      const msg: Message = await res.json()
      scrollToBottomRef.current = true
      setMessages(prev => [...prev, msg])
      setInputText('')
      setReplyTo(null)
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      loadChats()
    }
  }

  const deleteMessage = async (messageId: number) => {
    if (activeChatId == null || deletingMessage) return
    setDeletingMessage(true)
    await fetch(`/api/messenger/chats/${activeChatId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    setMessages(prev => prev.filter(m => m.id !== messageId))
    setDeletingMessage(false)
    setDeleteTargetId(null)
    loadChats()
  }

  // Long press логика
  const startLongPress = (msg: Message, x: number, y: number) => {
    longPressStart.current = { x, y }
    longPressTriggered.current = false
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      setContextMenu({
        messageId: msg.id,
        text: msg.text,
        isMe: msg.sender.id === myId,
        senderName: msg.sender.name,
      })
      longPressTimer.current = null
    }, 400)
  }

  const cancelLongPress = () => {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    longPressStart.current = null
  }

  const handleMessagePointerDown = (e: React.PointerEvent, msg: Message) => {
    startLongPress(msg, e.clientX, e.clientY)
  }

  const handleMessagePointerMove = (e: React.PointerEvent) => {
    if (longPressStart.current == null) return
    const dx = e.clientX - longPressStart.current.x
    const dy = e.clientY - longPressStart.current.y
    if (Math.sqrt(dx * dx + dy * dy) > 8) cancelLongPress()
  }

  const handleMessagePointerUp = () => {
    cancelLongPress()
    longPressTriggered.current = false
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

  const showError = (msg: string) => {
    setErrorToast(msg)
    setTimeout(() => setErrorToast(null), 3000)
  }

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopyToast(true)
      setTimeout(() => setCopyToast(false), 2000)
    }).catch(() => {
      showError('Не удалось скопировать текст')
    })
    setContextMenu(null)
  }

  const handleReply = (cm: ContextMenu) => {
    setReplyTo({ id: cm.messageId, text: cm.text, senderName: cm.senderName })
    setContextMenu(null)
  }

  const handleForward = (text: string) => {
    setForwardText(text)
    setContextMenu(null)
  }

  const toggleMessageSelection = (msgId: number) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }

  const handleCopySelected = () => {
    const text = messages.filter(m => selectedMessageIds.has(m.id)).map(m => m.text).join('\n')
    void navigator.clipboard.writeText(text).then(() => {
      setCopyToast(true)
      setTimeout(() => setCopyToast(false), 2000)
      setSelectedMessageIds(new Set())
    }).catch(() => showError('Не удалось скопировать текст'))
  }

  const deleteSelectedMessages = async () => {
    if (activeChatId == null || deletingMessage) return
    setDeletingMessage(true)
    const ids = Array.from(selectedMessageIds)
    const results = await Promise.all(ids.map(id =>
      fetch(`/api/messenger/chats/${activeChatId}/messages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => ({ id, ok: res.ok })).catch(() => ({ id, ok: false }))
    ))
    const deletedIds = new Set(results.filter(r => r.ok).map(r => r.id))
    const failedCount = results.length - deletedIds.size
    setMessages(prev => prev.filter(m => !deletedIds.has(m.id)))
    setDeletingMessage(false)
    setDeleteSelectedConfirm(false)
    setSelectedMessageIds(new Set())
    if (failedCount > 0) showError(`Не удалось удалить ${failedCount} ${failedCount === 1 ? 'сообщение' : 'сообщений'}`)
    loadChats()
  }

  const forwardToChat = async (targetChatId: number) => {
    if (!forwardText) return
    const res = await fetch(`/api/messenger/chats/${targetChatId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: forwardText })
    })
    if (!res.ok) {
      showError('Не удалось переслать сообщение')
      return
    }
    setForwardText(null)
    if (targetChatId === activeChatId) {
      void loadMessages(activeChatId)
    }
    void loadChats()
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

  const getDateLabel = (iso: string) => {
    const d = parseUtc(iso)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Сегодня'
    if (d.toDateString() === yesterday.toDateString()) return 'Вчера'
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const isSameDay = (a: string, b: string) =>
    parseUtc(a).toDateString() === parseUtc(b).toDateString()

  const truncateReply = (text: string, max = 60) =>
    text.length > max ? text.slice(0, max) + '…' : text

  return (
    <div className="gd-app gd-msg-app" style={{ position: 'fixed', top: vpTop, left: 0, right: 0, height: vpHeight }}>
      {/* ── Боковая панель ── */}
      <div className={['gd-msg-sidebar', isMobile && mobileView === 'chat' ? 'gd-msg-hidden' : ''].filter(Boolean).join(' ')}>
        <div className="gd-msg-sidebar-header">
          <h2>Вокс-канал</h2>
          <Button size="sm" variant="primary" onClick={openNewChat}>+ Новый чат</Button>
        </div>
        <div className="gd-msg-items">
          {chats.length === 0 && (
            <div className="gd-empty" style={{ padding: 'var(--gd-s8) var(--gd-s4)' }}>
              <h3>Вокс-канал тих</h3>
              <p className="gd-text-xs">Нет активных чатов</p>
            </div>
          )}
          {chats.map(c => (
            <div
              key={c.id}
              className={['gd-msg-chat-item', c.id === activeChatId ? 'active' : ''].filter(Boolean).join(' ')}
              onClick={() => selectChat(c.id)}
            >
              <Avatar name={c.name} url={c.avatarUrl} size={42} isGroup={c.isGroup} />
              <div className="gd-msg-chat-info">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span className="gd-msg-chat-name">
                    {c.isGroup && <span style={{ marginRight: '4px' }}>{c.isPublic ? '🌐' : '🔒'}</span>}
                    {c.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gd-s1)', flexShrink: 0, marginLeft: 'var(--gd-s1)' }}>
                    {c.isGroup && c.clubShortName && (
                      <span className="gd-msg-club-badge" style={{ background: c.clubBadgeColor || 'var(--gd-brass)' }}>
                        {c.clubShortName}
                      </span>
                    )}
                    {c.unreadCount > 0 && (
                      <span className="gd-msg-unread">{c.unreadCount > 99 ? '99+' : c.unreadCount}</span>
                    )}
                  </div>
                </div>
                {c.lastMessage && (
                  <div className="gd-msg-chat-preview">
                    {c.lastMessage.text.length > 40 ? c.lastMessage.text.slice(0, 40) + '…' : c.lastMessage.text}
                    <span className="gd-msg-chat-time" style={{ float: 'right', marginLeft: 'var(--gd-s2)' }}>{formatDate(c.lastMessage.sentAt)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="gd-msg-sidebar-footer">
          <button className="gd-btn gd-btn-ghost gd-btn-sm gd-btn-block" onClick={() => navigate('/')}>← На главную</button>
        </div>
      </div>

      {/* ── Основная область ── */}
      <div className={['gd-msg-main', isMobile && mobileView === 'chat' ? 'gd-msg-open' : ''].filter(Boolean).join(' ')}>
        {activeChatId == null ? (
          <div className="gd-msg-empty">
            <div style={{ fontSize: '3rem', opacity: 0.2, marginBottom: 'var(--gd-s4)' }}>✠</div>
            <h3>Вокс-канал тих</h3>
            <p className="gd-text-xs">Выберите чат слева или начните новый диалог</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="gd-msg-chat-header">
              {isMobile && (
                <button
                  className="gd-btn gd-btn-ghost gd-btn-sm"
                  onClick={() => { setMobileView('list'); setContextMenu(null); setReplyTo(null); setSelectedMessageIds(new Set()) }}
                >‹</button>
              )}
              <Avatar name={activeChat?.name ?? 'Чат'} url={activeChat?.avatarUrl} size={36} isGroup={activeChat?.isGroup} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cv-name">
                  {activeChat?.isGroup && <span style={{ marginRight: '6px' }}>{activeChat.isPublic ? '🌐' : '🔒'}</span>}
                  {activeChat?.name ?? 'Чат'}
                </div>
              </div>
              {activeChat?.isGroup && activeChat.clubShortName && (
                <span className="gd-msg-club-badge" style={{ background: activeChat.clubBadgeColor || 'var(--gd-brass)', padding: '2px 7px', flexShrink: 0 }}>
                  {activeChat.clubShortName}
                </span>
              )}
            </div>

            {/* Selection toolbar (desktop only) */}
            {isSelectionMode && (
              <div className="gd-msg-sel-bar">
                <span className="gd-text-sm" style={{ flex: 1, color: 'var(--gd-fg-secondary)' }}>
                  {selectedMessageIds.size} {selectedMessageIds.size === 1 ? 'сообщение' : selectedMessageIds.size < 5 ? 'сообщения' : 'сообщений'} выбрано
                </span>
                {selectedMessageIds.size === 1 && (() => {
                  const selMsg = messages.find(m => selectedMessageIds.has(m.id))
                  if (!selMsg) return null
                  return (
                    <>
                      <Button size="xs" variant="secondary" onClick={() => { handleReply({ messageId: selMsg.id, text: selMsg.text, isMe: selMsg.sender.id === myId, senderName: selMsg.sender.name }); setSelectedMessageIds(new Set()) }}>↩ Ответить</Button>
                      <Button size="xs" variant="secondary" onClick={() => { handleForward(selMsg.text); setSelectedMessageIds(new Set()) }}>↪ Переслать</Button>
                    </>
                  )
                })()}
                <Button size="xs" variant="secondary" onClick={handleCopySelected}>⧉ Копировать</Button>
                {messages.filter(m => selectedMessageIds.has(m.id)).every(m => m.sender.id === myId) && (
                  <Button size="xs" variant="danger" onClick={() => setDeleteSelectedConfirm(true)}>✕ Удалить</Button>
                )}
                <button
                  className="gd-btn gd-btn-ghost"
                  style={{ fontSize: '1rem', padding: '2px 8px', lineHeight: 1 }}
                  onClick={() => setSelectedMessageIds(new Set())}
                >✕</button>
              </div>
            )}

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="gd-msg-messages"
              onClick={() => { setContextMenu(null); if (!isMobile) setSelectedMessageIds(new Set()) }}
            >
              {messages.map((m, idx) => {
                const isMe = m.sender.id === myId
                const isSelected = selectedMessageIds.has(m.id)
                const msgHandlers = {
                  onClick: !isMobile ? (e: React.MouseEvent) => { e.stopPropagation(); toggleMessageSelection(m.id) } : undefined,
                  onPointerDown: isMobile ? (e: React.PointerEvent) => { e.stopPropagation(); handleMessagePointerDown(e, m) } : undefined,
                  onPointerMove: isMobile ? handleMessagePointerMove : undefined,
                  onPointerUp: isMobile ? (e: React.PointerEvent) => { e.stopPropagation(); handleMessagePointerUp() } : undefined,
                  onPointerCancel: isMobile ? cancelLongPress : undefined,
                  onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
                }
                const selectionCheckbox = isSelectionMode ? (
                  <div style={{
                    width: 20, height: 20, flexShrink: 0,
                    border: '2px solid var(--gd-brass)',
                    background: isSelected ? 'var(--gd-brass)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: 'var(--gd-brass-on)',
                    clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                  }}>
                    {isSelected && '✓'}
                  </div>
                ) : null
                const showDateSep = idx === 0 || !isSameDay(messages[idx - 1].sentAt, m.sentAt)
                const dateSeparator = showDateSep ? (
                  <div className="gd-msg-date-sep">
                    <span>{getDateLabel(m.sentAt)}</span>
                  </div>
                ) : null
                if (isMe) {
                  return (
                    <Fragment key={m.id}>
                      {dateSeparator}
                      <div
                        className={['gd-msg-row', 'mine', isSelectionMode ? 'gd-msg-sel-mode' : ''].filter(Boolean).join(' ')}
                        style={isSelectionMode ? { alignSelf: 'stretch', cursor: 'pointer', background: isSelected ? 'var(--gd-blood-subtle)' : 'transparent', borderRadius: 3, padding: '2px 4px' } : undefined}
                        {...msgHandlers}
                      >
                        {selectionCheckbox}
                        <div style={{ flex: isSelectionMode ? 1 : undefined }}>
                          <div className="gd-msg-bubble">
                            {m.replyTo && (
                              <div className="gd-msg-reply-quote">
                                <div className="rq-name">{m.replyTo.senderName}</div>
                                <div className="rq-text">{truncateReply(m.replyTo.text)}</div>
                              </div>
                            )}
                            <div>{m.text}</div>
                          </div>
                          <div className="gd-msg-meta"><span>{formatTime(m.sentAt)}</span></div>
                        </div>
                      </div>
                    </Fragment>
                  )
                }
                return (
                  <Fragment key={m.id}>
                    {dateSeparator}
                    <div
                      className={['gd-msg-row', 'theirs', isSelectionMode ? 'gd-msg-sel-mode' : ''].filter(Boolean).join(' ')}
                      style={isSelectionMode ? { alignSelf: 'stretch', cursor: 'pointer', background: isSelected ? 'var(--gd-blood-subtle)' : 'transparent', borderRadius: 3, padding: '2px 4px', alignItems: 'center' } : undefined}
                      {...msgHandlers}
                    >
                      {selectionCheckbox}
                      <Avatar name={m.sender.name} url={m.sender.avatarUrl} size={28} />
                      <div>
                        <div className="gd-msg-sender-name">{m.sender.name}</div>
                        <div className="gd-msg-bubble">
                          {m.replyTo && (
                            <div className="gd-msg-reply-quote">
                              <div className="rq-name">{m.replyTo.senderName}</div>
                              <div className="rq-text">{truncateReply(m.replyTo.text)}</div>
                            </div>
                          )}
                          <div>{m.text}</div>
                        </div>
                        <div className="gd-msg-meta"><span>{formatTime(m.sentAt)}</span></div>
                      </div>
                    </div>
                  </Fragment>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply preview */}
            {replyTo && (
              <div className="gd-msg-reply-preview">
                <div className="rp-inner">
                  <div className="rp-name">{replyTo.senderName}</div>
                  <div className="rp-text">{truncateReply(replyTo.text)}</div>
                </div>
                <button
                  className="gd-btn gd-btn-ghost gd-btn-xs"
                  onClick={() => setReplyTo(null)}
                >✕</button>
              </div>
            )}

            {/* Input area */}
            <div className="gd-msg-input-area">
              <textarea
                ref={textareaRef}
                placeholder="Вокс-сообщение…"
                value={inputText}
                rows={1}
                style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
                onChange={e => { setInputText(e.target.value); resizeTextarea() }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }}
                maxLength={4000}
              />
              <button
                className="gd-msg-send-btn"
                onClick={() => void sendMessage()}
                disabled={sending || !inputText.trim()}
              >
                {sending ? '…' : '✠'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Context menu (bottom sheet) ── */}
      {contextMenu && (
        <div className="gd-msg-ctx-overlay" onClick={() => setContextMenu(null)}>
          <div className="gd-msg-ctx-sheet" onClick={e => e.stopPropagation()}>
            <div className="gd-msg-ctx-preview">
              {contextMenu.text.length > 80 ? contextMenu.text.slice(0, 80) + '…' : contextMenu.text}
            </div>
            {[
              { label: '↩ Ответить', action: () => handleReply(contextMenu) },
              { label: '↪ Переслать', action: () => handleForward(contextMenu.text) },
              { label: '⧉ Копировать', action: () => handleCopy(contextMenu.text) },
              ...(contextMenu.isMe
                ? [{ label: '✕ Удалить', action: () => { setDeleteTargetId(contextMenu.messageId); setContextMenu(null) }, danger: true }]
                : []),
            ].map(item => (
              <button
                key={item.label}
                className={['gd-msg-ctx-btn', (item as { danger?: boolean }).danger ? 'danger' : ''].filter(Boolean).join(' ')}
                onClick={item.action}
              >{item.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal: new chat ── */}
      {showNewChat && (
        <div className="gd-msg-modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="gd-msg-modal" onClick={e => e.stopPropagation()}>
            <h3>Личное сообщение</h3>
            {loadingMembers ? (
              <div className="gd-text-secondary gd-text-sm">Загрузка участников…</div>
            ) : clubMembers.length === 0 ? (
              <div className="gd-text-muted gd-text-sm">Нет доступных участников</div>
            ) : (
              <div className="gd-msg-modal-list">
                {clubMembers.map(m => (
                  <div key={m.id} className="gd-msg-modal-item" onClick={() => void startDirectChat(m.id)}>
                    <Avatar name={m.name} url={m.avatarUrl} size={32} />
                    <span className="gd-text-sm">{m.name}</span>
                  </div>
                ))}
              </div>
            )}
            <Button variant="secondary" size="sm" block onClick={() => setShowNewChat(false)} className="gd-mt-4">Закрыть</Button>
          </div>
        </div>
      )}

      {/* ── Modal: forward ── */}
      {forwardText !== null && (
        <div className="gd-msg-modal-overlay" onClick={() => setForwardText(null)}>
          <div className="gd-msg-modal" onClick={e => e.stopPropagation()}>
            <h3>Переслать в чат</h3>
            <div className="gd-text-xs gd-text-muted gd-mb-2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              «{forwardText.length > 60 ? forwardText.slice(0, 60) + '…' : forwardText}»
            </div>
            {chats.length === 0 ? (
              <div className="gd-text-muted gd-text-sm">Нет доступных чатов</div>
            ) : (
              <div className="gd-msg-modal-list">
                {chats.map(c => (
                  <div key={c.id} className="gd-msg-modal-item" onClick={() => { void forwardToChat(c.id) }}>
                    <Avatar name={c.name} url={c.avatarUrl} size={32} isGroup={c.isGroup} />
                    <span className="gd-text-sm">
                      {c.isGroup && <span style={{ marginRight: '4px' }}>{c.isPublic ? '🌐' : '🔒'}</span>}
                      {c.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Button variant="secondary" size="sm" block onClick={() => setForwardText(null)} className="gd-mt-4">Отмена</Button>
          </div>
        </div>
      )}

      {/* ── Modal: delete confirm ── */}
      {deleteTargetId !== null && (
        <div className="gd-msg-modal-overlay" onClick={() => setDeleteTargetId(null)}>
          <div className="gd-msg-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3>Удалить сообщение</h3>
            <p className="gd-text-sm gd-text-secondary gd-mb-4">Удалить сообщение? Это действие нельзя отменить.</p>
            <div style={{ display: 'flex', gap: 'var(--gd-s2)', justifyContent: 'flex-end' }}>
              <Button variant="secondary" size="sm" disabled={deletingMessage} onClick={() => setDeleteTargetId(null)}>Отмена</Button>
              <Button variant="danger" size="sm" disabled={deletingMessage} onClick={() => { void deleteMessage(deleteTargetId) }}>
                {deletingMessage ? 'Удаление…' : 'Удалить'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: delete selected confirm ── */}
      {deleteSelectedConfirm && (
        <div className="gd-msg-modal-overlay" onClick={() => setDeleteSelectedConfirm(false)}>
          <div className="gd-msg-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3>Удалить сообщения</h3>
            <p className="gd-text-sm gd-text-secondary gd-mb-4">
              Удалить {selectedMessageIds.size} {selectedMessageIds.size === 1 ? 'сообщение' : selectedMessageIds.size < 5 ? 'сообщения' : 'сообщений'}? Это действие нельзя отменить.
            </p>
            <div style={{ display: 'flex', gap: 'var(--gd-s2)', justifyContent: 'flex-end' }}>
              <Button variant="secondary" size="sm" disabled={deletingMessage} onClick={() => setDeleteSelectedConfirm(false)}>Отмена</Button>
              <Button variant="danger" size="sm" disabled={deletingMessage} onClick={() => { void deleteSelectedMessages() }}>
                {deletingMessage ? 'Удаление…' : 'Удалить'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      {copyToast && <div className="gd-msg-toast info">Скопировано</div>}
      {errorToast && <div className="gd-msg-toast error">{errorToast}</div>}
    </div>
  )
}
