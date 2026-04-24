import { useState, useEffect } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import { isGoogleConfigured } from '../googleConfig'
import { LAST_PR_NUMBER, LAST_PR_DATE } from '../version'
import useIsMobile from '../utils/useIsMobile'

interface User { id: string; email: string; name: string; displayName?: string }
interface Club {
  id: number; name: string; description: string; openTime: string; closeTime: string; logoUrl?: string;
}
interface Membership { id: number; status: string; club: Club }
interface ClubEventItem { id: number; title: string; startTime: string; endTime: string; maxParticipants: number; eventType: string; gameSystem?: string; tableIds?: string; description?: string; regulationUrl?: string; regulationUrl2?: string; missionMapUrl?: string; gameMasterId?: string; gameMasterName?: string; participants: { id: string; name: string }[] }

export default function HomePage() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [clubs, setClubs] = useState<Club[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [clubEventsMap, setClubEventsMap] = useState<Record<number, ClubEventItem[]>>({})

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
        .then(r => r.json())
        .then(data => {
          if (!isCurrent) return
          setUser(u => ({ ...(u ?? baseUser), displayName: data.displayName || undefined }))
        })
        .catch(err => {
          console.error('Failed to load user profile:', err)
          if (!isCurrent) return
          setUser(u => u ?? baseUser)
        })
      fetch('/api/club/my-memberships', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (isCurrent) setMemberships(data) })
        .catch(err => console.error('Failed to load memberships:', err))
    }
    return () => {
      isCurrent = false
    }
  }, [token])

  const handleGoogleLogin = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: credentialResponse.credential })
    })
    if (res.ok) {
      const data = await res.json()
      localStorage.setItem('token', data.token)
      setToken(data.token)
      setUser(data.user)
    }
  }

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

  const cardStyle: React.CSSProperties = { background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: 16, marginBottom: 16 }
  const btnStyle: React.CSSProperties = { background: '#533483', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', marginRight: 8 }
  const warnStyle: React.CSSProperties = { color: '#ffc107', fontSize: 14 }

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
    const events = clubEventsMap[club.id] ?? []
    const activeEvents = events.filter(ev =>
      new Date(ev.startTime) <= now && now <= new Date(ev.endTime)
    )
    const upcomingEvents = events
      .filter(ev => new Date(ev.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 3)
    const borderColor = isApproved ? '#4caf50'
      : isPending ? '#ffc107'
      : (isRejected || isKicked) ? '#e94560'
      : '#0f3460'

    return (
      <div
        key={club.id}
        style={{
          background: '#16213e',
          border: `2px solid ${borderColor}`,
          borderRadius: 8,
          overflow: 'hidden',
          cursor: isApproved ? 'pointer' : 'default'
        }}
        onClick={() => { if (isApproved) navigate(`/club/${club.id}`) }}
      >
        {/* Верхняя часть: логотип + события */}
        <div style={{ display: 'flex', minHeight: 110 }}>

          {/* Левая колонка: логотип (~1/3) */}
          <div style={{
            width: '30%', flexShrink: 0,
            background: '#0f1e3d', overflow: 'hidden',
            position: 'relative', minHeight: 110
          }}>
            {club.logoUrl
              ? <img src={club.logoUrl} alt="Лого" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><span style={{ fontSize: 32 }}>🎲</span></div>
            }
          </div>

          {/* Средняя колонка: активные события */}
          <div style={{ flex: 1, padding: '10px 12px', borderLeft: '1px solid #1a2a50', borderRight: '1px solid #1a2a50' }}>
            <div style={{ color: '#ffc107', fontSize: 10, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Сейчас</div>
            {activeEvents.length === 0
              ? <div style={{ color: '#555', fontSize: 12 }}>Нет активных событий</div>
              : activeEvents.map(ev => (
                <div key={ev.id} style={{ marginBottom: 3 }}>
                  <div style={{ color: '#eee', fontSize: 12, fontWeight: 600 }}>{ev.title}</div>
                  <div style={{ color: '#888', fontSize: 11 }}>{ev.eventType}</div>
                </div>
              ))
            }
          </div>

          {/* Правая колонка: ближайшие события */}
          <div style={{ flex: 1, padding: '10px 12px' }}>
            <div style={{ color: '#7eb8f7', fontSize: 10, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Ближайшие события</div>
            {upcomingEvents.length === 0
              ? <div style={{ color: '#555', fontSize: 12 }}>Нет предстоящих событий</div>
              : upcomingEvents.map(ev => (
                <div key={ev.id} style={{ marginBottom: 3 }}>
                  <div style={{ color: '#eee', fontSize: 11 }}>
                    {new Date(ev.startTime).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} {ev.title}
                  </div>
                  <div style={{ color: '#888', fontSize: 11 }}>{ev.eventType}</div>
                </div>
              ))
            }
          </div>

        </div>

        {/* Нижняя панель: название, описание, статус, кнопка */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid #1a2a50', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 'bold', fontSize: 14, color: '#eee' }}>{club.name}</div>
            <div style={{ color: '#aaa', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club.description}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {user && (!membership || isKicked) && (
              <button
                style={{ ...btnStyle, fontSize: 12, padding: '4px 10px' }}
                onClick={e => { e.stopPropagation(); applyToClub(club.id) }}
              >
                Подать заявку
              </button>
            )}
            {isApproved && <span title="Одобрено">✅</span>}
            {isPending && <span title="На рассмотрении">⏳</span>}
            {isRejected && <span title="Отклонено">❌</span>}
            {isKicked && <span title="Исключён">🚫</span>}
            {isApproved && <span style={{ color: '#888', fontSize: 13 }}>→</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: isMobile ? 16 : 40 }}>

      {/* Шапка */}
      <div style={{ borderBottom: '1px solid #e94560', paddingBottom: 20, marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ color: '#e94560', margin: 0, fontSize: isMobile ? 22 : 32, whiteSpace: 'nowrap' }}>
              🎲 Club Table Tracker
            </h1>
            <div style={{ color: '#aaa', fontSize: 13, marginTop: 4 }}>
              Бронирование игровых столов для варгеймерских клубов
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{
                background: '#0f3460', color: '#7eb8f7', fontSize: 11,
                padding: '2px 8px', borderRadius: 12, fontWeight: 600
              }}>
                Beta v0.0.{LAST_PR_NUMBER} от {LAST_PR_DATE}
              </span>
            </div>
          </div>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, flexWrap: 'wrap' }}>
              <span style={{ color: '#aaa', fontSize: isMobile ? 13 : 14 }}>👤 {user.displayName || user.name}</span>
              <button style={{ ...btnStyle, background: '#0f3460' }} onClick={() => navigate('/settings')}>⚙️</button>
              <button style={{ ...btnStyle, background: '#555' }} onClick={logout}>Выйти</button>
            </div>
          ) : (
            isGoogleConfigured
              ? <GoogleLogin onSuccess={handleGoogleLogin} onError={() => console.log('Login Failed')} />
              : <span style={{ ...warnStyle, fontSize: isMobile ? 12 : 14 }}>⚠️ Google login is not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> in your <code>.env</code> file.</span>
          )}
        </div>
      </div>

      {/* Приветствие для незарегистрированных */}
      {!user && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h2>Welcome to ClubTableTracker</h2>
          <p style={{ color: '#aaa' }}>Track gaming tables at your local Warhammer and Games Workshop club. Sign in with Google to apply for club membership and book tables.</p>
        </div>
      )}

      {/* Секция "Мои клубы" (только одобренные) */}
      {memberClubs.length > 0 && (
        <>
          <div style={{ borderBottom: '2px solid #e94560', marginBottom: 16, paddingBottom: 6 }}>
            <h2 style={{ color: '#e94560', margin: 0, fontSize: 18 }}>Мои клубы</h2>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: 16,
            marginBottom: 32
          }}>
            {memberClubs.map(c => renderClubCard(c))}
          </div>
        </>
      )}

      {/* Секция "Все клубы" */}
      <div style={{ borderBottom: '2px solid #0f3460', marginBottom: 16, paddingBottom: 6 }}>
        <h2 style={{ color: '#aaa', margin: 0, fontSize: 18 }}>Все клубы</h2>
      </div>
      {otherClubs.length === 0 && memberClubs.length > 0 && (
        <p style={{ color: '#555', fontSize: 14 }}>Все доступные клубы уже в разделе «Мои клубы».</p>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: 16
      }}>
        {otherClubs.map(c => renderClubCard(c))}
      </div>

    </div>
  )
}
