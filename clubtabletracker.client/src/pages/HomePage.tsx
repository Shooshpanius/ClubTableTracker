import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LAST_PR_NUMBER, LAST_PR_DATE } from '../version'
import useIsMobile from '../utils/useIsMobile'
import { isTokenExpired } from '../utils/auth'
import { Button, GothicDivider } from '../components/ui'

interface User { id: string; email: string; name: string; displayName?: string }
interface Club {
  id: number; name: string; description: string; openTime: string; closeTime: string; logoUrl?: string;
}
interface Membership { id: number; status: string; club: Club }
interface ClubEventItem { id: number; title: string; startTime: string; endTime: string; maxParticipants: number; eventType: string; gameSystem?: string; tableIds?: string; description?: string; regulationUrl?: string; regulationUrl2?: string; missionMapUrl?: string; gameMasterId?: string; gameMasterName?: string; status?: string | null; participants: { id: string; name: string }[] }

export default function HomePage() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem('token') || ''
    if (stored && isTokenExpired(stored)) {
      localStorage.removeItem('token')
      return ''
    }
    return stored
  })
  const [clubs, setClubs] = useState<Club[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [clubEventsMap, setClubEventsMap] = useState<Record<number, ClubEventItem[]>>({})
  const [totalUnread, setTotalUnread] = useState(0)

  useEffect(() => {
    let isCurrent = true
    fetch('/api/club')
      .then(r => r.json())
      .then(data => {
        if (!isCurrent) return
        setClubs(data)
        // Загружаем события всех клубов для превью карточек
        data.forEach((c: Club) => {
          const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
          fetch(`/api/event/club/${c.id}`, { headers })
            .then(r => r.ok ? r.json() : [])
            .then((evs: ClubEventItem[]) =>
              setClubEventsMap(prev => ({ ...prev, [c.id]: evs }))
            )
            .catch(() => {})
        })
      })
      .catch(err => console.error('Failed to load clubs:', err))
    if (token) {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
      )
      const payload = JSON.parse(jsonPayload)
      const baseUser = {
        id: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'],
        email: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
        name: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
      }
      fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => {
          if (r.status === 401) {
            localStorage.removeItem('token')
            if (isCurrent) { setToken(''); setUser(null); setMemberships([]) }
            return null
          }
          return r.json()
        })
        .then(data => {
          if (!data || !isCurrent) return
          setUser(u => ({ ...(u ?? baseUser), displayName: data.displayName || undefined }))
        })
        .catch(err => {
          console.error('Failed to load user profile:', err)
          if (!isCurrent) return
          setUser(u => u ?? baseUser)
        })
      fetch('/api/club/my-memberships', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => {
          if (r.status === 401) {
            localStorage.removeItem('token')
            if (isCurrent) { setToken(''); setUser(null); setMemberships([]) }
            return null
          }
          return r.json()
        })
        .then(data => { if (data && isCurrent) setMemberships(data) })
        .catch(err => console.error('Failed to load memberships:', err))
    }
    return () => {
      isCurrent = false
    }
  }, [token])

  // Polling непрочитанных сообщений
  useEffect(() => {
    if (!token || isTokenExpired(token)) return
    const fetchUnread = () => {
      fetch('/api/messenger/chats', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then((chats: { unreadCount: number }[]) => {
          setTotalUnread(chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0))
        })
        .catch(() => {})
    }
    fetchUnread()
    const id = setInterval(fetchUnread, 15000)
    return () => clearInterval(id)
  }, [token])

  const logout = () => {
    localStorage.removeItem('token')
    setToken('')
    setUser(null)
    setMemberships([])
  }

  const applyToClub = async (clubId: number) => {
    const res = await fetch(`/api/club/${clubId}/apply`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      const club = clubs.find(c => c.id === clubId)!
      const existing = memberships.find(m => m.club.id === clubId)
      if (existing) {
        setMemberships(memberships.map(m => m.club.id === clubId ? { ...m, id: data.id, status: data.status } : m))
      } else {
        setMemberships([...memberships, { id: data.id, status: data.status, club }])
      }
    } else {
      const text = await res.text()
      alert(text || 'Failed to apply')
    }
  }

  // Вычисляем наборы клубов
  const now = new Date()
  const memberClubs = clubs.filter(c => memberships.some(m => m.club.id === c.id && m.status === 'Approved'))
  const otherClubs = clubs.filter(c => !memberships.some(m => m.club.id === c.id && m.status === 'Approved'))

  // Функция рендера одной карточки клуба
  const renderClubCard = (club: Club) => {
    const membership = memberships.find(m => m.club.id === club.id)
    const isApproved = membership?.status === 'Approved'
    const isPending = membership?.status === 'Pending'
    const isRejected = membership?.status === 'Rejected'
    const isKicked = membership?.status === 'Kicked'
    const events = (clubEventsMap[club.id] ?? []).filter(ev => ev.status !== 'Archived')
    const activeEvents = events.filter(ev =>
      new Date(ev.startTime) <= now && now <= new Date(ev.endTime)
    )
    const upcomingEvents = events
      .filter(ev => new Date(ev.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 3)
    const cardClass = isApproved ? 'gd-home-club-card approved'
      : isPending ? 'gd-home-club-card pending'
      : (isRejected || isKicked) ? 'gd-home-club-card rejected'
      : 'gd-home-club-card'

    return (
      <div
        key={club.id}
        className={cardClass}
        style={{ cursor: isApproved ? 'pointer' : 'default' }}
        onClick={() => { if (isApproved) navigate(`/club/${club.id}`) }}
      >
        {/* Верхняя часть: логотип + события */}
        <div className="gd-home-club-top">
          {/* Левая колонка: логотип (~1/3) */}
          <div className="gd-home-club-logo">
            {club.logoUrl
              ? <img src={club.logoUrl} alt="Лого" className="gd-home-logo-img" />
              : <div className="gd-home-logo-placeholder"><span style={{ fontSize: 32 }}>🎲</span></div>
            }
          </div>

          {/* Средняя колонка: активные события */}
          <div className="gd-home-club-col">
            <div className="gd-home-col-label" style={{ color: 'var(--gd-warn)' }}>Сейчас</div>
            {activeEvents.length === 0
              ? <div className="gd-home-col-empty">Нет активных событий</div>
              : activeEvents.map(ev => (
                <div key={ev.id} style={{ marginBottom: 3 }}>
                  <div className="gd-home-event-title">{ev.title}</div>
                  <div className="gd-home-event-sub">{ev.eventType}</div>
                </div>
              ))
            }
          </div>

          {/* Правая колонка: ближайшие события */}
          <div className="gd-home-club-col">
            <div className="gd-home-col-label" style={{ color: 'var(--gd-brass)' }}>Ближайшие события</div>
            {upcomingEvents.length === 0
              ? <div className="gd-home-col-empty">Нет предстоящих событий</div>
              : upcomingEvents.map(ev => (
                <div key={ev.id} style={{ marginBottom: 3 }}>
                  <div className="gd-home-event-upcoming">
                    {new Date(ev.startTime).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} {ev.title}
                  </div>
                  <div className="gd-home-event-sub">{ev.eventType}</div>
                </div>
              ))
            }
          </div>

        </div>

        {/* Нижняя панель: название, описание, статус, кнопка */}
        <div className="gd-home-club-footer">
          <div style={{ minWidth: 0 }}>
            <div className="gd-home-club-name">{club.name}</div>
            <div className="gd-home-club-desc">{club.description}</div>
          </div>
          <div className="gd-flex-row" style={{ gap: 'var(--gd-s2)', flexShrink: 0 }}>
            {user && (!membership || isKicked) && (
              <Button variant="primary" size="xs" onClick={e => { e.stopPropagation(); applyToClub(club.id) }}>
                Подать заявку
              </Button>
            )}
            {isApproved && <span title="Одобрено">✅</span>}
            {isPending && <span title="На рассмотрении">⏳</span>}
            {isRejected && <span title="Отклонено">❌</span>}
            {isKicked && <span title="Исключён">🚫</span>}
            {isApproved && <span style={{ color: 'var(--gd-fg-muted)', fontSize: 13 }}>→</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="gd-app" style={{ minHeight: '100vh', padding: isMobile ? 'var(--gd-s4)' : 'var(--gd-s8)' }}>

      {/* Шапка */}
      <div style={{ borderBottom: '1px solid var(--gd-blood-red)', paddingBottom: 'var(--gd-s6)', marginBottom: 'var(--gd-s8)' }}>
        <div className="gd-flex-between" style={{ flexWrap: 'wrap', gap: 'var(--gd-s3)' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ color: 'var(--gd-blood-red)', margin: 0, fontSize: isMobile ? 22 : 32, fontFamily: 'var(--gd-font-display)', whiteSpace: 'nowrap' }}>
              🎲 Club Table Tracker
            </h1>
            <div style={{ color: 'var(--gd-fg-secondary)', fontSize: 13, marginTop: 4 }}>
              Бронирование игровых столов для варгеймерских клубов
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span className="gd-home-version-badge">
                Beta v0.0.{LAST_PR_NUMBER} от {LAST_PR_DATE}
              </span>
              <a
                href="https://www.rustore.ru/catalog/app/com.example.club_table_tracker"
                target="_blank"
                rel="noopener noreferrer"
                className="gd-home-rustore"
              >
                📱 Скачать в RuStore
              </a>
            </div>
          </div>
          {user ? (
            <div className="gd-flex-row" style={{ gap: isMobile ? 'var(--gd-s2)' : 'var(--gd-s4)', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--gd-fg-secondary)', fontSize: isMobile ? 13 : 14 }}>👤 {user.displayName || user.name}</span>
              <Button variant="secondary" size="sm" onClick={() => navigate('/settings')}>⚙️</Button>
              <Button variant="brass" size="sm" onClick={() => navigate('/messages')} style={{ position: 'relative' }}>
                💬{totalUnread > 0 && (
                  <span className="gd-home-unread-badge">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={logout}>Выйти</Button>
            </div>
          ) : (
            <div className="gd-flex-row" style={{ gap: 'var(--gd-s2)', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-end' }}>
              <Button variant="primary" onClick={() => navigate('/login')}>
                <span aria-hidden>🔐</span> Войти
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Приветствие для незарегистрированных */}
      {!user && (
        <div className="gd-home-welcome" style={{ marginBottom: 'var(--gd-s6)' }}>
          <h2 style={{ fontFamily: 'var(--gd-font-display)', color: 'var(--gd-brass)' }}>Welcome to ClubTableTracker</h2>
          <p style={{ color: 'var(--gd-fg-secondary)' }}>Track gaming tables at your local Warhammer and Games Workshop club. Sign in to apply for club membership and book tables.</p>
        </div>
      )}

      {/* Секция "Мои клубы" (только одобренные) */}
      {memberClubs.length > 0 && (
        <>
          <div style={{ borderBottom: '2px solid var(--gd-blood-red)', marginBottom: 'var(--gd-s4)', paddingBottom: 6 }}>
            <h2 style={{ color: 'var(--gd-blood-red)', margin: 0, fontSize: 18, fontFamily: 'var(--gd-font-display)' }}>Мои клубы</h2>
          </div>
          <div className="gd-home-grid">
            {memberClubs.map(c => renderClubCard(c))}
          </div>
          <div style={{ marginBottom: 'var(--gd-s6)' }}>
            <GothicDivider />
          </div>
        </>
      )}

      {/* Секция "Все клубы" */}
      <div style={{ borderBottom: '2px solid var(--gd-border)', marginBottom: 'var(--gd-s4)', paddingBottom: 6 }}>
        <h2 style={{ color: 'var(--gd-fg-muted)', margin: 0, fontSize: 18, fontFamily: 'var(--gd-font-display)' }}>Все клубы</h2>
      </div>
      {otherClubs.length === 0 && memberClubs.length > 0 && (
        <p style={{ color: 'var(--gd-fg-muted)', fontSize: 14 }}>Все доступные клубы уже в разделе «Мои клубы».</p>
      )}
      <div className="gd-home-grid">
        {otherClubs.map(c => renderClubCard(c))}
      </div>

    </div>
  )
}
