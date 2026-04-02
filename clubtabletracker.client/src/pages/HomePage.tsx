import { useState, useEffect, useMemo } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import BookingForm from '../components/BookingForm'
import TableTimeline from '../components/TableTimeline'
import BookingCalendar from '../components/BookingCalendar'
import ClubMap from '../components/ClubMap'
import { isGoogleConfigured } from '../googleConfig'
import { LAST_PR_NUMBER, LAST_PR_DATE } from '../version'
import { DEFAULT_BOOKING_COLORS } from '../constants'
import type { BookingColors } from '../constants'

function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return isMobile
}


interface User { id: string; email: string; name: string; displayName?: string }
interface Club { id: number; name: string; description: string; openTime: string; closeTime: string }
interface Membership { id: number; status: string; club: Club }
interface GameTable { id: number; number: string; size: string; supportedGames: string; x: number; y: number; width: number; height: number; eventsOnly?: boolean }
interface BookingBase { id: number; user: { id: string; name: string }; participants: { id: string; name: string; status?: string }[]; isDoubles?: boolean }
interface Booking extends BookingBase { tableId: number; startTime: string; endTime: string; gameSystem?: string }
interface UpcomingBooking extends BookingBase { tableId: number; tableNumber: string; clubName: string; clubId: number; startTime: string; endTime: string; gameSystem?: string }
interface ActivityLogEntry { id: number; timestamp: string; action: string; userName: string; tableNumber: string; clubId: number; bookingStartTime: string; bookingEndTime: string }
interface ClubMember { id: string; name: string; enabledGameSystems?: string; registrationName: string; displayName?: string; bio?: string; joinedAt: string; isModerator?: boolean }
interface ClubEventItem { id: number; title: string; date: string; maxParticipants: number; eventType: string; gameSystem?: string; tableIds?: string; participants: { id: string; name: string }[] }
interface ClubDecoration { id: number; type: 'wall' | 'window' | 'door'; x: number; y: number; width: number; height: number }

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function getLocalMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function isSameLocalDay(date: Date, ref: Date): boolean {
  return date.getFullYear() === ref.getFullYear() &&
    date.getMonth() === ref.getMonth() &&
    date.getDate() === ref.getDate()
}

function toDatetimeLocal(date: Date, totalMinutes: number): string {
  const d = new Date(date)
  d.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${mins}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

const MAX_BOOKING_PLAYERS = 2

const LOG_ACTION_LABEL: Record<string, string> = {
  Booked: 'зарезервировал',
  Joined: 'присоединился к',
  Left: 'вышел из',
  Cancelled: 'отменил'
}
const LOG_ACTION_COLOR: Record<string, string> = {
  Booked: '#4caf50',
  Joined: '#2196f3',
  Left: '#ffc107',
  Cancelled: '#e94560'
}

export default function HomePage() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [clubs, setClubs] = useState<Club[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [selectedClub, setSelectedClub] = useState<Club | null>(null)
  const [tables, setTables] = useState<GameTable[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [members, setMembers] = useState<ClubMember[]>([])
  const [playerSystemsModal, setPlayerSystemsModal] = useState<ClubMember | null>(null)
  const [moderatorBookingModal, setModeratorBookingModal] = useState<Booking | null>(null)
  const [selectedTable, setSelectedTable] = useState<GameTable | null>(null)
  const [bookingStart, setBookingStart] = useState('')
  const [bookingEnd, setBookingEnd] = useState('')
  const [bookingColors, setBookingColors] = useState<BookingColors>(() => {
    try {
      const stored = localStorage.getItem('bookingColors')
      if (stored) return { ...DEFAULT_BOOKING_COLORS, ...JSON.parse(stored) }
    } catch { /* ignore */ }
    return DEFAULT_BOOKING_COLORS
  })
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  useEffect(() => {
    fetch('/api/club').then(r => r.json()).then(setClubs).catch(err => console.error('Failed to load clubs:', err))
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
      setUser(baseUser)
      fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          setUser(u => u ? { ...u, displayName: data.displayName || undefined } : u)
          if (data.bookingColors) {
            try {
              const c = { ...DEFAULT_BOOKING_COLORS, ...JSON.parse(data.bookingColors) }
              setBookingColors(c)
              localStorage.setItem('bookingColors', JSON.stringify(c))
            } catch { /* ignore */ }
          }
        })
        .catch(err => console.error('Failed to load user profile:', err))
      fetch('/api/club/my-memberships', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(setMemberships).catch(err => console.error('Failed to load memberships:', err))
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
    setSelectedClub(null)
    setUpcomingMyBookings([])
    setUpcomingAllBookings([])
    setActivityLog([])
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

  const selectClub = async (club: Club) => {
    setSelectedClub(club)
    setSelectedTable(null)
    setClubEvents([])
    setDecorations([])
    setExpandedTableId(null)
    setDesktopTab('booking')
    setMobileTab('tables')
    setModeratorBookingModal(null)
    const [tablesRes, bookingsRes, membersRes, eventsRes, decorationsRes] = await Promise.all([
      fetch(`/api/club/${club.id}/tables`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/booking/club/${club.id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/club/${club.id}/members`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/event/club/${club.id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/club/${club.id}/decorations`, { headers: { Authorization: `Bearer ${token}` } })
    ])
    if (tablesRes.ok) setTables(await tablesRes.json())
    if (bookingsRes.ok) setBookings(await bookingsRes.json())
    if (membersRes.ok) setMembers(await membersRes.json())
    if (eventsRes.ok) setClubEvents(await eventsRes.json())
    if (decorationsRes.ok) setDecorations(await decorationsRes.json())
  }

  const registerEvent = async (eventId: number) => {
    const res = await fetch(`/api/event/${eventId}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      if (!selectedClub) return
      const evRes = await fetch(`/api/event/club/${selectedClub.id}`, { headers: { Authorization: `Bearer ${token}` } })
      if (evRes.ok) setClubEvents(await evRes.json())
    } else {
      const text = await res.text()
      alert(text || 'Не удалось записаться на событие')
    }
  }

  const unregisterEvent = async (eventId: number) => {
    if (!confirm('Отменить запись на событие?')) return
    const res = await fetch(`/api/event/${eventId}/unregister`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      if (!selectedClub) return
      const evRes = await fetch(`/api/event/club/${selectedClub.id}`, { headers: { Authorization: `Bearer ${token}` } })
      if (evRes.ok) setClubEvents(await evRes.json())
    } else {
      const text = await res.text()
      alert(text || 'Не удалось отменить запись')
    }
  }

  const onBookingCreated = async () => {
    if (!selectedClub) return
    const res = await fetch(`/api/booking/club/${selectedClub.id}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setBookings(await res.json())
    setSelectedTable(null)
    await loadUpcoming()
  }

  const loadUpcoming = async () => {
    const [myRes, allRes] = await Promise.all([
      fetch('/api/booking/my-upcoming', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/booking/upcoming-all', { headers: { Authorization: `Bearer ${token}` } })
    ])
    if (myRes.ok) setUpcomingMyBookings(await myRes.json())
    if (allRes.ok) setUpcomingAllBookings(await allRes.json())
  }

  const loadActivityLog = async () => {
    const res = await fetch('/api/booking/activity-log', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setActivityLog(await res.json())
  }

  const leaveBooking = async (booking: BookingBase) => {
    if (!confirm(`Выйти из игры ${booking.user.name}?`)) return
    const res = await fetch(`/api/booking/${booking.id}/leave`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      onBookingCreated()
    } else {
      const text = await res.text()
      alert(text || 'Не удалось выйти из игры')
    }
  }

  const cancelBooking = async (booking: BookingBase) => {
    const acceptedParticipants = booking.participants.filter(p => p.status !== 'Invited')
    const msg = acceptedParticipants.length > 0
      ? `Покинуть игру? Бронь будет передана игроку ${acceptedParticipants[0].name}.`
      : 'Покинуть бронирование? (других участников нет, бронь будет отменена)'
    if (!confirm(msg)) return
    const res = await fetch(`/api/booking/${booking.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      onBookingCreated()
    } else {
      const text = await res.text()
      alert(text || 'Ошибка при отмене бронирования')
    }
  }

  const annulBooking = async (booking: BookingBase) => {
    if (!confirm('Аннулировать игру? Бронирование и все приглашения будут удалены.')) return
    const res = await fetch(`/api/booking/${booking.id}/annul`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      onBookingCreated()
    } else {
      const text = await res.text()
      alert(text || 'Ошибка при аннулировании бронирования')
    }
  }

  const acceptInvite = async (booking: BookingBase) => {
    const res = await fetch(`/api/booking/${booking.id}/accept-invite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      await loadUpcoming()
    } else {
      const text = await res.text()
      alert(text || 'Не удалось принять приглашение')
    }
  }

  const declineInvite = async (booking: BookingBase) => {
    if (!confirm('Отклонить приглашение?')) return
    const res = await fetch(`/api/booking/${booking.id}/decline-invite`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      await loadUpcoming()
    } else {
      const text = await res.text()
      alert(text || 'Не удалось отклонить приглашение')
    }
  }

  const joinBooking = async (booking: Booking) => {
    if (!user) return
    if (isModerator) {
      setModeratorBookingModal(booking)
      return
    }
    if (booking.user.id === user.id) {
      await cancelBooking(booking)
      return
    }
    if (booking.participants.some(p => p.id === user.id)) {
      await leaveBooking(booking)
      return
    }
    const acceptedCount = booking.participants.filter(p => p.status !== 'Invited').length
    const maxPlayers = booking.isDoubles ? 4 : MAX_BOOKING_PLAYERS
    if (acceptedCount >= maxPlayers - 1) return
    if (!confirm(`Присоединиться к игре ${booking.user.name}?`)) return
    const res = await fetch(`/api/booking/${booking.id}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      onBookingCreated()
    } else {
      const text = await res.text()
      alert(text || 'Не удалось присоединиться')
    }
  }

  const handleSlotClick = (table: GameTable, startMin: number, endMin: number) => {
    setSelectedTable(table)
    setBookingStart(toDatetimeLocal(selectedDate, startMin))
    setBookingEnd(toDatetimeLocal(selectedDate, endMin))
  }

  const handleTableHeaderClick = (table: GameTable) => {
    setSelectedTable(table)
    setBookingStart('')
    setBookingEnd('')
  }

  const [expandedTableId, setExpandedTableId] = useState<number | null>(null)
  const [upcomingMyBookings, setUpcomingMyBookings] = useState<UpcomingBooking[]>([])
  const [upcomingAllBookings, setUpcomingAllBookings] = useState<UpcomingBooking[]>([])
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [upcomingTab, setUpcomingTab] = useState<'my' | 'all'>('my')
  const [clubEvents, setClubEvents] = useState<ClubEventItem[]>([])
  const [decorations, setDecorations] = useState<ClubDecoration[]>([])
  const [mobileTab, setMobileTab] = useState<'tables' | 'games' | 'events' | 'log' | 'players' | 'map'>('tables')
  const [desktopTab, setDesktopTab] = useState<'booking' | 'upcoming' | 'events' | 'log' | 'players' | 'map'>('booking')
  const cardStyle: React.CSSProperties = { background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: 16, marginBottom: 16 }
  const btnStyle: React.CSSProperties = { background: '#533483', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', marginRight: 8 }
  const warnStyle: React.CSSProperties = { color: '#ffc107', fontSize: 14 }

  const isModerator = useMemo(() => user != null && members.some(m => m.id === user.id && m.isModerator), [members, user])

  const kickPlayerFromBooking = async (booking: Booking, targetId: string) => {
    const targetName = booking.user.id === targetId
      ? booking.user.name
      : booking.participants.find(p => p.id === targetId)?.name ?? targetId
    if (!confirm(`Удалить ${targetName} из игры?`)) return
    const res = await fetch(`/api/booking/${booking.id}/kick-player/${encodeURIComponent(targetId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      setModeratorBookingModal(null)
      onBookingCreated()
    } else {
      const text = await res.text()
      alert(text || 'Ошибка при удалении игрока')
    }
  }

  const RECT_HEIGHT = 360

  // Determine which tables are involved in events on the selected date
  const { eventTableIds, userEventTableIds, eventTableGameSystems } = useMemo(() => {
    const eventsOnSelectedDate = clubEvents.filter(ev => {
      const evDate = new Date(ev.date)
      return evDate.getFullYear() === selectedDate.getFullYear() &&
        evDate.getMonth() === selectedDate.getMonth() &&
        evDate.getDate() === selectedDate.getDate()
    })
    const eventTableIds = new Set<number>()
    const userEventTableIds = new Set<number>()
    const eventTableGameSystems = new Map<number, string>()
    for (const ev of eventsOnSelectedDate) {
      if (ev.tableIds) {
        const ids = ev.tableIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        for (const id of ids) {
          eventTableIds.add(id)
          if (ev.gameSystem && !eventTableGameSystems.has(id)) {
            eventTableGameSystems.set(id, ev.gameSystem)
          }
          if (user && ev.participants.some(p => p.id === user.id)) {
            userEventTableIds.add(id)
          }
        }
      }
    }
    return { eventTableIds, userEventTableIds, eventTableGameSystems }
  }, [clubEvents, selectedDate, user])

  return (
    <>
    <div style={{ padding: isMobile ? 16 : 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ color: '#e94560', margin: 0, fontSize: isMobile ? 22 : 32, whiteSpace: 'nowrap' }}>🎲 ClubTableTracker</h1>
          <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>Beta v0.0.{LAST_PR_NUMBER} от {LAST_PR_DATE}</div>
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

      {!user && (
        <div style={cardStyle}>
          <h2>Welcome to ClubTableTracker</h2>
          <p style={{ color: '#aaa' }}>Track gaming tables at your local Warhammer and Games Workshop club. Sign in with Google to apply for club membership and book tables.</p>
        </div>
      )}

      <h2>Клубы</h2>
      {clubs.map(club => {
        const membership = memberships.find(m => m.club.id === club.id)
        const isApproved = membership?.status === 'Approved'
        const isPending = membership?.status === 'Pending'
        const isRejected = membership?.status === 'Rejected'
        const isKicked = membership?.status === 'Kicked'
        const isExpanded = selectedClub?.id === club.id
        const borderColor = isExpanded
          ? '#e94560'
          : isApproved
            ? '#4caf50'
            : isPending
              ? '#ffc107'
              : isRejected || isKicked
                ? '#e94560'
                : '#0f3460'
        const clubOpenMin = parseHHMM(club.openTime)
        const clubCloseMin = parseHHMM(club.closeTime)
        const clubTotalHours = Math.ceil((clubCloseMin - clubOpenMin) / 60)
        const clubOpenHour = Math.floor(clubOpenMin / 60)
        return (
          <div key={club.id} style={{ ...cardStyle, padding: 0, overflow: 'hidden', border: `2px solid ${borderColor}` }}>
            {/* Accordion header */}
            <div
              style={{ padding: '12px 16px', cursor: isApproved ? 'pointer' : 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: isExpanded ? '#1a2a50' : 'transparent' }}
              onClick={() => {
                if (!isApproved) return
                if (isExpanded) { setSelectedClub(null) } else { selectClub(club) }
              }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 2, color: '#eee' }}>{club.name}</div>
                <div style={{ color: '#aaa', fontSize: 14 }}>{club.description}</div>
              </div>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {user && (!membership || isKicked) && <button style={btnStyle} onClick={e => { e.stopPropagation(); applyToClub(club.id) }}>Подать заявку</button>}
                {isApproved && <span style={{ fontSize: 22 }} title="Одобрено">✅</span>}
                {isPending && <span style={{ fontSize: 22 }} title="На рассмотрении">⏳</span>}
                {isRejected && <span style={{ fontSize: 22 }} title="Отклонено">❌</span>}
                {isKicked && <span style={{ fontSize: 22 }} title="Исключён">🚫</span>}
                {isApproved && <span style={{ fontSize: 18, color: '#888', marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>}
              </div>
            </div>

            {/* Accordion body */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid #0f3460' }}>
                {isMobile ? (
                  /* ===== MOBILE accordion body ===== */
                  <div>
                    {/* Mobile tab bar */}
                    <div style={{ display: "flex", borderBottom: "2px solid #0f3460" }}>
                      {(["tables", "games", "events", "log", "players", "map"] as const).map((tab, i) => {
                        const labels = ["Столы", "Игры", "События", "Журнал", "👥", "🗺️"]
                        return (
                          <button
                            key={tab}
                            style={{
                              flex: 1,
                              background: mobileTab === tab ? "#e94560" : "#0f3460",
                              color: "#fff",
                              border: "none",
                              borderRadius: tab === "tables" ? "4px 0 0 0" : tab === "map" ? "0 4px 0 0" : 0,
                              padding: "9px 4px",
                              cursor: "pointer",
                              fontSize: 13,
                              fontWeight: mobileTab === tab ? "bold" : "normal",
                            }}
                            onClick={async () => {
                              setMobileTab(tab)
                              if (tab === "games") await loadUpcoming()
                              else if (tab === "log") await loadActivityLog()
                            }}>
                            {labels[i]}
                          </button>
                        )
                      })}
                    </div>

                    <div style={{ padding: 16 }}>

                    {/* Tab: Столы */}
                    {mobileTab === "tables" && (
                      <>
                        {/* Calendar */}
                        <div style={{ marginBottom: 16 }}>
                          <BookingCalendar
                            bookings={bookings}
                            selectedDate={selectedDate}
                            onSelectDate={date => { setSelectedDate(date); setSelectedTable(null) }}
                          />
                        </div>

                        {/* Legend */}
                        <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 13, flexWrap: "wrap" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 20, height: 14, background: bookingColors.freeSlot, display: "inline-block", borderRadius: 2, border: "1px solid #555" }} />
                            Свободно
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 20, height: 14, background: bookingColors.eventFreeSlot, display: "inline-block", borderRadius: 2, border: "1px solid #ffff00" }} />
                            Свободно (событие)
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 20, height: 14, background: bookingColors.othersBooking, display: "inline-block", borderRadius: 2, border: "1px solid #555" }} />
                            Занято
                          </span>
                          {user && <span style={{ color: "#aaa" }}>Нажмите на свободный слот для бронирования</span>}
                        </div>

                        {/* Table accordions */}
                        {tables.length === 0 && <p style={{ color: "#aaa" }}>Столы не настроены администратором клуба.</p>}
                        {tables.map(table => {
                          const isTableExpanded = expandedTableId === table.id
                          const isTableSelected = selectedTable?.id === table.id
                          return (
                            <div key={table.id} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                              <button
                                onClick={() => {
                                  const expanding = !isTableExpanded
                                  setExpandedTableId(expanding ? table.id : null)
                                  if (expanding) handleTableHeaderClick(table)
                                }}
                                style={{
                                  width: "100%", background: isTableExpanded ? "#1a2a50" : "#16213e",
                                  border: "none", borderBottom: isTableExpanded ? "1px solid #0f3460" : "none",
                                  color: isTableSelected ? "#e94560" : "#eee",
                                  padding: "12px 16px", textAlign: "left", cursor: "pointer",
                                  display: "flex", justifyContent: "space-between", alignItems: "center",
                                  fontSize: 15, fontWeight: "bold"
                                }}>
                                <span>Стол {table.number}</span>
                                <span style={{ fontSize: 12, color: "#aaa", fontWeight: "normal" }}>{table.size}</span>
                                <span style={{ fontSize: 18, color: "#888", marginLeft: 8 }}>{isTableExpanded ? "▲" : "▼"}</span>
                              </button>

                              {/* Occupancy bar */}
                              {(() => {
                                const isEventTable = eventTableIds.has(table.id)
                                const tableBookings = bookings
                                  .filter(b => b.tableId === table.id && isSameLocalDay(new Date(b.startTime), selectedDate))
                                  .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                                const segments: { type: string; startMin: number; endMin: number; booking?: Booking }[] = []
                                let cursor = clubOpenMin
                                for (const booking of tableBookings) {
                                  const bStart = Math.max(getLocalMinutes(new Date(booking.startTime)), clubOpenMin)
                                  const bEnd = Math.min(getLocalMinutes(new Date(booking.endTime)), clubCloseMin)
                                  if (bStart > cursor) segments.push({ type: "free", startMin: cursor, endMin: bStart })
                                  if (bEnd > bStart) segments.push({ type: "booked", startMin: bStart, endMin: bEnd, booking })
                                  cursor = Math.max(cursor, bEnd)
                                }
                                if (cursor < clubCloseMin) segments.push({ type: "free", startMin: cursor, endMin: clubCloseMin })
                                const userId = user?.id
                                const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
                                return (
                                  <div style={{ display: "flex", height: 6, width: "100%" }}>
                                    {segments.map((seg, i) => {
                                      const isFree = seg.type === "free"
                                      const isUserBooking = !isFree && seg.booking != null && userId != null &&
                                        (seg.booking.user.id === userId || seg.booking.participants.some(p => p.id === userId))
                                      const bg = isFree ? (isEventTable ? bookingColors.eventFreeSlot : bookingColors.freeSlot) : isUserBooking ? bookingColors.myBooking : bookingColors.othersBooking
                                      const label = isFree
                                        ? `Свободно ${fmt(seg.startMin)}–${fmt(seg.endMin)}`
                                        : `Занято ${fmt(seg.startMin)}–${fmt(seg.endMin)}`
                                      return <div key={i} title={label} aria-label={label} style={{ flex: seg.endMin - seg.startMin, background: bg }} />
                                    })}
                                  </div>
                                )
                              })()}

                              {isTableExpanded && (
                                <div style={{ padding: 16 }}>
                                  <div style={{ display: "flex", alignItems: "flex-start" }}>
                                    <div style={{ width: 44, flexShrink: 0, position: "relative", height: RECT_HEIGHT + 28, marginRight: 4 }}>
                                      {Array.from({ length: clubTotalHours + 1 }, (_, i) => {
                                        const hour = clubOpenHour + i
                                        const top = (i / clubTotalHours) * RECT_HEIGHT + 28
                                        return (
                                          <div key={hour} style={{ position: "absolute", top, right: 0, fontSize: 11, color: "#888", whiteSpace: "nowrap", transform: "translateY(-30%)" }}>
                                            {String(hour).padStart(2, "0")}:00
                                          </div>
                                        )
                                      })}
                                    </div>
                                    <TableTimeline
                                      table={table}
                                      bookings={bookings}
                                      openTime={club.openTime}
                                      closeTime={club.closeTime}
                                      selectedDate={selectedDate}
                                      currentUserId={user?.id}
                                      onSlotClick={user && (!eventTableIds.has(table.id) || userEventTableIds.has(table.id)) ? handleSlotClick : undefined}
                                      onBookingClick={user ? joinBooking : undefined}
                                      isSelected={isTableSelected}
                                      isEventTable={eventTableIds.has(table.id)}
                                      colors={bookingColors}
                                    />
                                  </div>
                                  {isTableSelected && user && (
                                    <div style={{ ...cardStyle, border: "1px solid #e94560", marginTop: 16 }}>
                                      <BookingForm
                                        key={`${table.id}-${bookingStart}-${bookingEnd}`}
                                        table={table}
                                        token={token}
                                        onBooked={onBookingCreated}
                                        onCancel={() => setSelectedTable(null)}
                                        selectedDate={selectedDate}
                                        initialStartTime={bookingStart}
                                        initialEndTime={bookingEnd}
                                        openTime={club.openTime}
                                        closeTime={club.closeTime}
                                        members={members.filter(m => m.id !== user?.id)}
                                        tournamentGameSystem={eventTableGameSystems.get(table.id)}
                                        clubName={club.name}
                                        tableBookings={bookings
                                          .filter(b => b.tableId === table.id && isSameLocalDay(new Date(b.startTime), selectedDate))
                                          .map(b => ({ startTime: b.startTime, endTime: b.endTime, userName: b.user.name, participants: b.participants.filter(p => p.status !== 'Invited').map(p => ({ name: p.name })), gameSystem: b.gameSystem }))}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </>
                    )}

                    {/* Tab: Игры (предстоящие) */}
                    {mobileTab === "games" && (
                      <div>
                        {!user ? (
                          <p style={{ color: "#aaa" }}>Войдите, чтобы видеть предстоящие игры.</p>
                        ) : (
                          <>
                            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                              <button style={{ ...btnStyle, background: upcomingTab === "my" ? "#e94560" : "#0f3460", marginRight: 0 }} onClick={() => setUpcomingTab("my")}>Мои игры</button>
                              <button style={{ ...btnStyle, background: upcomingTab === "all" ? "#e94560" : "#0f3460", marginRight: 0 }} onClick={() => setUpcomingTab("all")}>Все игры</button>
                            </div>
                            {(() => {
                              const list = upcomingTab === "my" ? upcomingMyBookings : upcomingAllBookings
                              if (list.length === 0) return <p style={{ color: "#aaa", margin: 0 }}>Нет предстоящих игр</p>
                              const grouped: Record<string, UpcomingBooking[]> = {}
                              for (const b of list) {
                                const d = new Date(b.startTime)
                                const key = d.toLocaleDateString("ru-RU", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
                                if (!grouped[key]) grouped[key] = []
                                grouped[key].push(b)
                              }
                              return Object.entries(grouped).map(([dateLabel, items]) => (
                                <div key={dateLabel} style={{ marginBottom: 16 }}>
                                  <div style={{ color: "#ffc107", fontWeight: "bold", marginBottom: 6, textTransform: "capitalize" }}>{dateLabel}</div>
                                  {items.map(b => {
                                    const start = new Date(b.startTime)
                                    const end = new Date(b.endTime)
                                    const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
                                    const isOwner = b.user.id === user.id
                                    const myParticipant = b.participants.find(p => p.id === user.id)
                                    const isInvited = myParticipant?.status === "Invited"
                                    const isAcceptedParticipant = myParticipant && !isInvited
                                    const acceptedCount = b.participants.filter(p => p.status !== "Invited").length
                                    const maxPlayers = b.isDoubles ? 4 : MAX_BOOKING_PLAYERS
                                    const canJoin = !isOwner && !myParticipant && acceptedCount < maxPlayers - 1
                                    return (
                                      <div key={b.id} style={{ background: isInvited ? "#1a1a3d" : "#0f1e3d", borderRadius: 6, padding: "8px 12px", marginBottom: 6, border: isInvited ? "1px solid #7b2fff" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                        <div>
                                          <span style={{ color: "#eee", fontWeight: "bold" }}>Стол {b.tableNumber}</span>
                                          <span style={{ color: "#aaa", marginLeft: 8, fontSize: 13 }}>{b.clubName}</span>
                                          <span style={{ color: "#4caf50", marginLeft: 8, fontSize: 13 }}>{fmt(start)}–{fmt(end)}</span>
                                          {b.gameSystem && <span style={{ color: "#888", marginLeft: 8, fontSize: 12, fontStyle: "italic" }}>{b.gameSystem}</span>}
                                          {b.isDoubles && <span style={{ color: "#7b2fff", marginLeft: 8, fontSize: 12, fontWeight: "bold" }}>2×2</span>}
                                          <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
                                            {b.user.name}{b.participants.length > 0 && ` + ${b.participants.map(p => (p.status === "Invited" ? "(i) " : "") + p.name).join(", ")}`}
                                            {isOwner && <span style={{ color: "#ff8c00", marginLeft: 6 }}>(организатор)</span>}
                                            {isAcceptedParticipant && <span style={{ color: "#4caf50", marginLeft: 6 }}>(участник)</span>}
                                            {isInvited && <span style={{ color: "#7b2fff", marginLeft: 6 }}>📩 приглашение</span>}
                                          </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                          {canJoin && (
                                            <button style={{ ...btnStyle, background: "#1565c0", fontSize: 12, padding: "4px 10px", marginRight: 0 }} onClick={() => joinBooking(b)}>Присоединиться</button>
                                          )}
                                          {isInvited && (
                                            <>
                                              <button style={{ ...btnStyle, background: "#28a745", fontSize: 12, padding: "4px 10px", marginRight: 0 }} onClick={() => acceptInvite(b)}>✓ Принять</button>
                                              <button style={{ ...btnStyle, background: "#c0392b", fontSize: 12, padding: "4px 10px", marginRight: 0 }} onClick={() => declineInvite(b)}>✗ Отклонить</button>
                                            </>
                                          )}
                                          {isOwner && (
                                            <>
                                              <button style={{ ...btnStyle, background: "#e67e22", fontSize: 12, padding: "4px 10px", marginRight: 0 }} onClick={() => cancelBooking(b)}>Покинуть</button>
                                              <button style={{ ...btnStyle, background: "#c0392b", fontSize: 12, padding: "4px 10px", marginRight: 0 }} onClick={() => annulBooking(b)}>Аннулировать</button>
                                            </>
                                          )}
                                          {isAcceptedParticipant && (
                                            <button style={{ ...btnStyle, background: "#c0392b", fontSize: 12, padding: "4px 10px", marginRight: 0 }} onClick={() => leaveBooking(b)}>Выйти</button>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              ))
                            })()}
                          </>
                        )}
                      </div>
                    )}

                    {/* Tab: События */}
                    {mobileTab === "events" && (
                      <div>
                        {clubEvents.length === 0 ? (
                          <p style={{ color: "#aaa" }}>События отсутствуют.</p>
                        ) : (
                          clubEvents.map(ev => {
                            const isRegistered = user ? ev.participants.some(p => p.id === user.id) : false
                            const isFull = ev.participants.length >= ev.maxParticipants
                            return (
                              <div key={ev.id} style={{ background: "#0f1e3d", borderRadius: 6, padding: "10px 14px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                <div>
                                  <span style={{ color: "#eee", fontWeight: "bold" }}>{ev.title}</span>
                                  <span style={{ marginLeft: 8, color: "#ffc107", fontSize: 12 }}>{ev.eventType}</span>
                                  {ev.gameSystem && <span style={{ marginLeft: 8, color: "#888", fontSize: 12, fontStyle: "italic" }}>{ev.gameSystem}</span>}
                                  <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
                                    📅 {new Date(ev.date).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    &nbsp;·&nbsp;👥 {ev.participants.length}/{ev.maxParticipants}
                                    {isRegistered && <span style={{ color: "#4caf50", marginLeft: 8 }}>✓ вы записаны</span>}
                                  </div>
                                  {ev.participants.length > 0 && (
                                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                                      {ev.participants.map(p => p.name).join(", ")}
                                    </div>
                                  )}
                                </div>
                                {user && (
                                  isRegistered
                                    ? <button style={{ ...btnStyle, background: "#c0392b", fontSize: 12, padding: "4px 10px", marginRight: 0 }} onClick={() => unregisterEvent(ev.id)}>Отменить запись</button>
                                    : <button style={{ ...btnStyle, background: isFull ? "#555" : "#28a745", fontSize: 12, padding: "4px 10px", marginRight: 0 }} onClick={() => !isFull && registerEvent(ev.id)} disabled={isFull}>{isFull ? "Мест нет" : "Записаться"}</button>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}

                    {/* Tab: Журнал */}
                    {mobileTab === "log" && (
                      <div>
                        {!user ? (
                          <p style={{ color: "#aaa" }}>Войдите, чтобы видеть журнал действий.</p>
                        ) : (
                          <>
                            <h3 style={{ margin: "0 0 12px 0", fontSize: 15 }}>Журнал за последний месяц</h3>
                            {activityLog.length === 0 ? (
                              <p style={{ color: "#aaa", margin: 0 }}>Нет записей за последний месяц</p>
                            ) : (
                              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                                {activityLog.map(entry => {
                                  const ts = new Date(entry.timestamp)
                                  const start = new Date(entry.bookingStartTime)
                                  const end = new Date(entry.bookingEndTime)
                                  const fmtDt = (d: Date) => d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                                  const fmtTime = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
                                  return (
                                    <div key={entry.id} style={{ fontSize: 13, padding: "5px 0", borderBottom: "1px solid #1a2a4a", color: "#ccc" }}>
                                      <span style={{ color: "#666", marginRight: 8 }}>{fmtDt(ts)}</span>
                                      <span style={{ color: "#eee", fontWeight: "bold" }}>{entry.userName}</span>
                                      {" "}
                                      <span style={{ color: LOG_ACTION_COLOR[entry.action] || "#aaa" }}>{LOG_ACTION_LABEL[entry.action] || entry.action}</span>
                                      {" резерв стола "}
                                      <span style={{ color: "#ffc107" }}>{entry.tableNumber}</span>
                                      {" на "}
                                      <span style={{ color: "#4caf50" }}>{fmtDt(start).split(",")[0]} {fmtTime(start)}–{fmtTime(end)}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Tab: Игроки клуба */}
                    {mobileTab === "players" && (
                      <div>
                        <h3 style={{ margin: "0 0 12px 0", fontSize: 15 }}>Игроки клуба</h3>
                        {members.length === 0 ? (
                          <p style={{ color: "#aaa", margin: 0 }}>Нет принятых игроков</p>
                        ) : (
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "#ccc" }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid #0f3460", color: "#aaa" }}>
                                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>Имя регистрации</th>
                                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>Имя для отображения</th>
                                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>Дата вступления</th>
                                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>Информация</th>
                                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>Системы</th>
                                </tr>
                              </thead>
                              <tbody>
                                {members.map(m => (
                                  <tr key={m.id} style={{ borderBottom: "1px solid #1a2a4a" }}>
                                    <td style={{ padding: "6px 8px" }}>{m.registrationName}</td>
                                    <td style={{ padding: "6px 8px" }}>{m.displayName || <span style={{ color: "#666" }}>—</span>}</td>
                                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{new Date(m.joinedAt).toLocaleDateString("ru-RU")}</td>
                                    <td style={{ padding: "6px 8px" }}>{m.bio || <span style={{ color: "#666" }}>—</span>}</td>
                                    <td style={{ padding: "6px 8px" }}>
                                      <button
                                        onClick={() => setPlayerSystemsModal(m)}
                                        style={{ background: "#0f3460", color: "#ccc", border: "1px solid #1a4a8a", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}
                                      >
                                        Системы
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab: Схема клуба (mobile) */}
                    {mobileTab === "map" && (
                      <div>
                        <h3 style={{ margin: "0 0 12px 0", fontSize: 15 }}>Схема клуба</h3>
                        <ClubMap
                          tables={tables}
                          bookings={bookings}
                          decorations={decorations}
                          onTableClick={() => {}}
                        />
                      </div>
                    )}

                    </div>
                  </div>
                ) : (
                  /* ===== DESKTOP accordion body with tabs ===== */
                  <div style={{ padding: '0 16px 16px 16px' }}>
                    {/* Tab bar */}
                    <div style={{ display: 'flex', gap: 4, paddingTop: 12, marginBottom: 16, flexWrap: 'wrap', borderBottom: '1px solid #0f3460' }}>
                      {([
                        ['booking', '🎲 Бронирование столов'],
                        ['upcoming', '📅 Предстоящие игры'],
                        ['events', '🏆 События клуба'],
                        ['log', '📋 Журнал действий'],
                        ['players', '👥 Игроки клуба'],
                        ['map', '🗺️ Схема клуба'],
                      ] as [string, string][]).map(([tab, label]) => (
                        <button
                          key={tab}
                          style={{ ...btnStyle, background: desktopTab === tab ? '#e94560' : '#0f3460', marginBottom: 0, marginRight: 0, borderRadius: '4px 4px 0 0' }}
                          onClick={async () => {
                            if (tab === 'upcoming') await loadUpcoming()
                            else if (tab === 'log') await loadActivityLog()
                            setDesktopTab(tab as typeof desktopTab)
                          }}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Tab: Бронирование столов */}
                    {desktopTab === 'booking' && (
                      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, overflowX: 'auto' }}>
                          <div style={{ marginBottom: 12, color: '#ffc107', fontSize: 15, fontWeight: 'bold', textTransform: 'capitalize' }}>
                            {formatDate(selectedDate)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                            <div style={{ width: 44, flexShrink: 0, position: 'relative', height: RECT_HEIGHT + 28, marginRight: 4 }}>
                              {Array.from({ length: clubTotalHours + 1 }, (_, i) => {
                                const hour = clubOpenHour + i
                                const top = (i / clubTotalHours) * RECT_HEIGHT + 28
                                return (
                                  <div key={hour} style={{ position: 'absolute', top, right: 0, fontSize: 11, color: '#888', whiteSpace: 'nowrap', transform: 'translateY(-30%)' }}>
                                    {String(hour).padStart(2, '0')}:00
                                  </div>
                                )
                              })}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', whiteSpace: 'nowrap' }}>
                              {tables.map(table => (
                                <div key={table.id} onClick={() => handleTableHeaderClick(table)} style={{ cursor: 'pointer' }}>
                                  <TableTimeline
                                    table={table}
                                    bookings={bookings}
                                    openTime={club.openTime}
                                    closeTime={club.closeTime}
                                    selectedDate={selectedDate}
                                    currentUserId={user?.id}
                                    onSlotClick={user && (!eventTableIds.has(table.id) || userEventTableIds.has(table.id)) ? handleSlotClick : undefined}
                                    onBookingClick={user ? joinBooking : undefined}
                                    isSelected={selectedTable?.id === table.id}
                                    isEventTable={eventTableIds.has(table.id)}
                                    colors={bookingColors}
                                  />
                                </div>
                              ))}
                              {tables.length === 0 && <p style={{ color: '#aaa', marginLeft: 8 }}>Столы не настроены администратором клуба.</p>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13, flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 20, height: 14, background: bookingColors.freeSlot, display: 'inline-block', borderRadius: 2, border: '1px solid #555' }} />
                              Свободно
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 20, height: 14, background: bookingColors.eventFreeSlot, display: 'inline-block', borderRadius: 2, border: '1px solid #ffff00' }} />
                              Свободно (событие)
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 20, height: 14, background: bookingColors.othersBooking, display: 'inline-block', borderRadius: 2, border: '1px solid #555' }} />
                              Занято
                            </span>
                            {user && <span style={{ color: '#aaa' }}>Нажмите на свободный слот для бронирования</span>}
                          </div>
                          {selectedTable && user && (
                            <div style={{ ...cardStyle, border: '1px solid #e94560', marginTop: 20, whiteSpace: 'normal' }}>
                              <BookingForm
                                key={`${selectedTable.id}-${bookingStart}-${bookingEnd}`}
                                table={selectedTable}
                                token={token}
                                onBooked={onBookingCreated}
                                onCancel={() => setSelectedTable(null)}
                                selectedDate={selectedDate}
                                initialStartTime={bookingStart}
                                initialEndTime={bookingEnd}
                                openTime={club.openTime}
                                closeTime={club.closeTime}
                                members={members.filter(m => m.id !== user?.id)}
                                tournamentGameSystem={eventTableGameSystems.get(selectedTable.id)}
                                clubName={club.name}
                                tableBookings={bookings
                                  .filter(b => b.tableId === selectedTable.id && isSameLocalDay(new Date(b.startTime), selectedDate))
                                  .map(b => ({ startTime: b.startTime, endTime: b.endTime, userName: b.user.name, participants: b.participants.filter(p => p.status !== 'Invited').map(p => ({ name: p.name })), gameSystem: b.gameSystem }))}
                              />
                            </div>
                          )}
                        </div>
                        <div style={{ width: 220, flexShrink: 0 }}>
                          <BookingCalendar
                            bookings={bookings}
                            selectedDate={selectedDate}
                            onSelectDate={date => { setSelectedDate(date); setSelectedTable(null) }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Tab: Предстоящие игры */}
                    {desktopTab === 'upcoming' && (
                      <div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                          <button style={{ ...btnStyle, background: upcomingTab === 'my' ? '#e94560' : '#0f3460', marginRight: 0 }} onClick={() => setUpcomingTab('my')}>Мои игры</button>
                          <button style={{ ...btnStyle, background: upcomingTab === 'all' ? '#e94560' : '#0f3460', marginRight: 0 }} onClick={() => setUpcomingTab('all')}>Все игры</button>
                        </div>
                        {(() => {
                          const list = upcomingTab === 'my' ? upcomingMyBookings : upcomingAllBookings
                          if (list.length === 0) return <p style={{ color: '#aaa', margin: 0 }}>Нет предстоящих игр</p>
                          const grouped: Record<string, UpcomingBooking[]> = {}
                          for (const b of list) {
                            const d = new Date(b.startTime)
                            const key = d.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                            if (!grouped[key]) grouped[key] = []
                            grouped[key].push(b)
                          }
                          return Object.entries(grouped).map(([dateLabel, items]) => (
                            <div key={dateLabel} style={{ marginBottom: 16 }}>
                              <div style={{ color: '#ffc107', fontWeight: 'bold', marginBottom: 6, textTransform: 'capitalize' }}>{dateLabel}</div>
                              {items.map(b => {
                                const start = new Date(b.startTime)
                                const end = new Date(b.endTime)
                                const fmt = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                                const isOwner = b.user.id === user?.id
                                const myParticipant = b.participants.find(p => p.id === user?.id)
                                const isInvited = myParticipant?.status === 'Invited'
                                const isAcceptedParticipant = myParticipant && !isInvited
                                const acceptedCount = b.participants.filter(p => p.status !== 'Invited').length
                                const maxPlayers = b.isDoubles ? 4 : MAX_BOOKING_PLAYERS
                                const canJoin = !isOwner && !myParticipant && acceptedCount < maxPlayers - 1
                                return (
                                  <div key={b.id} style={{ background: isInvited ? '#1a1a3d' : '#0f1e3d', borderRadius: 6, padding: '8px 12px', marginBottom: 6, border: isInvited ? '1px solid #7b2fff' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                    <div>
                                      <span style={{ color: '#eee', fontWeight: 'bold' }}>Стол {b.tableNumber}</span>
                                      <span style={{ color: '#aaa', marginLeft: 8, fontSize: 13 }}>{b.clubName}</span>
                                      <span style={{ color: '#4caf50', marginLeft: 8, fontSize: 13 }}>{fmt(start)}–{fmt(end)}</span>
                                      {b.gameSystem && <span style={{ color: '#888', marginLeft: 8, fontSize: 12, fontStyle: 'italic' }}>{b.gameSystem}</span>}
                                      {b.isDoubles && <span style={{ color: '#7b2fff', marginLeft: 8, fontSize: 12, fontWeight: 'bold' }}>2×2</span>}
                                      <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                                        {b.user.name}{b.participants.length > 0 && ` + ${b.participants.map(p => (p.status === 'Invited' ? '(i) ' : '') + p.name).join(', ')}`}
                                        {isOwner && <span style={{ color: '#ff8c00', marginLeft: 6 }}>(организатор)</span>}
                                        {isAcceptedParticipant && <span style={{ color: '#4caf50', marginLeft: 6 }}>(участник)</span>}
                                        {isInvited && <span style={{ color: '#7b2fff', marginLeft: 6 }}>📩 приглашение</span>}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                      {canJoin && (
                                        <button style={{ ...btnStyle, background: '#1565c0', fontSize: 12, padding: '4px 10px', marginRight: 0 }} onClick={() => joinBooking(b)}>Присоединиться</button>
                                      )}
                                      {isInvited && (
                                        <>
                                          <button style={{ ...btnStyle, background: '#28a745', fontSize: 12, padding: '4px 10px', marginRight: 0 }} onClick={() => acceptInvite(b)}>✓ Принять</button>
                                          <button style={{ ...btnStyle, background: '#c0392b', fontSize: 12, padding: '4px 10px', marginRight: 0 }} onClick={() => declineInvite(b)}>✗ Отклонить</button>
                                        </>
                                      )}
                                      {isOwner && (
                                        <>
                                          <button style={{ ...btnStyle, background: '#e67e22', fontSize: 12, padding: '4px 10px', marginRight: 0 }} onClick={() => cancelBooking(b)}>Покинуть</button>
                                          <button style={{ ...btnStyle, background: '#c0392b', fontSize: 12, padding: '4px 10px', marginRight: 0 }} onClick={() => annulBooking(b)}>Аннулировать</button>
                                        </>
                                      )}
                                      {isAcceptedParticipant && (
                                        <button style={{ ...btnStyle, background: '#c0392b', fontSize: 12, padding: '4px 10px', marginRight: 0 }} onClick={() => leaveBooking(b)}>Выйти</button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ))
                        })()}
                      </div>
                    )}

                    {/* Tab: События клуба */}
                    {desktopTab === 'events' && (
                      <div>
                        {clubEvents.length === 0 ? (
                          <p style={{ color: '#aaa' }}>События отсутствуют.</p>
                        ) : (
                          clubEvents.map(ev => {
                            const isRegistered = user ? ev.participants.some(p => p.id === user.id) : false
                            const isFull = ev.participants.length >= ev.maxParticipants
                            return (
                              <div key={ev.id} style={{ background: '#0f1e3d', borderRadius: 6, padding: '10px 14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                <div>
                                  <span style={{ color: '#eee', fontWeight: 'bold' }}>{ev.title}</span>
                                  <span style={{ marginLeft: 8, color: '#ffc107', fontSize: 12 }}>{ev.eventType}</span>
                                  {ev.gameSystem && <span style={{ marginLeft: 8, color: '#888', fontSize: 12, fontStyle: 'italic' }}>{ev.gameSystem}</span>}
                                  <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                                    📅 {new Date(ev.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    &nbsp;·&nbsp;👥 {ev.participants.length}/{ev.maxParticipants}
                                    {isRegistered && <span style={{ color: '#4caf50', marginLeft: 8 }}>✓ вы записаны</span>}
                                  </div>
                                  {ev.participants.length > 0 && (
                                    <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                                      {ev.participants.map(p => p.name).join(', ')}
                                    </div>
                                  )}
                                </div>
                                {user && (
                                  isRegistered
                                    ? <button style={{ ...btnStyle, background: '#c0392b', fontSize: 12, padding: '4px 10px', marginRight: 0 }} onClick={() => unregisterEvent(ev.id)}>Отменить запись</button>
                                    : <button style={{ ...btnStyle, background: isFull ? '#555' : '#28a745', fontSize: 12, padding: '4px 10px', marginRight: 0 }} onClick={() => !isFull && registerEvent(ev.id)} disabled={isFull}>{isFull ? 'Мест нет' : 'Записаться'}</button>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}

                    {/* Tab: Журнал действий */}
                    {desktopTab === 'log' && (
                      <div>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: 15 }}>Журнал за последний месяц</h3>
                        {activityLog.length === 0 ? (
                          <p style={{ color: '#aaa', margin: 0 }}>Нет записей за последний месяц</p>
                        ) : (
                          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                            {activityLog.map(entry => {
                              const ts = new Date(entry.timestamp)
                              const start = new Date(entry.bookingStartTime)
                              const end = new Date(entry.bookingEndTime)
                              const fmtDt = (d: Date) => d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                              const fmtTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                              return (
                                <div key={entry.id} style={{ fontSize: 13, padding: '5px 0', borderBottom: '1px solid #1a2a4a', color: '#ccc' }}>
                                  <span style={{ color: '#666', marginRight: 8 }}>{fmtDt(ts)}</span>
                                  <span style={{ color: '#eee', fontWeight: 'bold' }}>{entry.userName}</span>
                                  {' '}
                                  <span style={{ color: LOG_ACTION_COLOR[entry.action] || '#aaa' }}>{LOG_ACTION_LABEL[entry.action] || entry.action}</span>
                                  {' резерв стола '}
                                  <span style={{ color: '#ffc107' }}>{entry.tableNumber}</span>
                                  {' на '}
                                  <span style={{ color: '#4caf50' }}>{fmtDt(start).split(',')[0]} {fmtTime(start)}–{fmtTime(end)}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab: Игроки клуба */}
                    {desktopTab === 'players' && (
                      <div>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: 15 }}>Игроки клуба</h3>
                        {members.length === 0 ? (
                          <p style={{ color: '#aaa', margin: 0 }}>Нет принятых игроков</p>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, color: '#ccc' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #0f3460', color: '#aaa' }}>
                                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Имя регистрации</th>
                                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Имя для отображения</th>
                                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Дата вступления</th>
                                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Информация</th>
                                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Системы</th>
                                </tr>
                              </thead>
                              <tbody>
                                {members.map(m => (
                                  <tr key={m.id} style={{ borderBottom: '1px solid #1a2a4a' }}>
                                    <td style={{ padding: '8px 12px' }}>{m.registrationName}</td>
                                    <td style={{ padding: '8px 12px' }}>{m.displayName || <span style={{ color: '#666' }}>—</span>}</td>
                                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{new Date(m.joinedAt).toLocaleDateString('ru-RU')}</td>
                                    <td style={{ padding: '8px 12px' }}>{m.bio || <span style={{ color: '#666' }}>—</span>}</td>
                                    <td style={{ padding: '8px 12px' }}>
                                      <button
                                        onClick={() => setPlayerSystemsModal(m)}
                                        style={{ background: '#0f3460', color: '#ccc', border: '1px solid #1a4a8a', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }}
                                      >
                                        Системы
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab: Схема клуба */}
                    {desktopTab === 'map' && (
                      <div>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: 15 }}>Схема клуба</h3>
                        <ClubMap
                          tables={tables}
                          bookings={bookings}
                          decorations={decorations}
                          onTableClick={() => {}}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>

    {/* Модалка: управление резервом (модератор) */}
    {moderatorBookingModal && (() => {
      const b = moderatorBookingModal
      const fmt = (s: string) => { const d = new Date(s); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
      const acceptedParticipants = b.participants.filter(p => p.status !== 'Invited')
      const isModeratorOwner = user != null && b.user.id === user.id
      const isModeratorParticipant = user != null && b.participants.some(p => p.id === user.id)
      const maxPlayers = b.isDoubles ? 4 : MAX_BOOKING_PLAYERS
      const canJoin = !isModeratorOwner && !isModeratorParticipant && (acceptedParticipants.length + 1) < maxPlayers
      const handleModeratorJoin = async () => {
        setModeratorBookingModal(null)
        const res = await fetch(`/api/booking/${b.id}/join`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          onBookingCreated()
        } else {
          const text = await res.text()
          alert(text || 'Не удалось присоединиться')
        }
      }
      return (
        <div
          onClick={() => setModeratorBookingModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#16213e', border: '1px solid #e94560', borderRadius: 8, padding: '24px 28px', minWidth: 300, maxWidth: 460, width: '90%' }}
          >
            <h3 style={{ margin: '0 0 4px 0', fontSize: 16, color: '#e94560' }}>⭐ Управление резервом</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#aaa' }}>
              {fmt(b.startTime)}–{fmt(b.endTime)}{b.gameSystem && ` · ${b.gameSystem}`}{b.isDoubles && ' · 2×2'}
            </p>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: '#aaa', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>Игроки в игре:</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #0f3460' }}>
                <span style={{ color: '#eee', fontSize: 14 }}>{b.user.name} <span style={{ color: '#ff8c00', fontSize: 12 }}>(организатор)</span></span>
                {!isModeratorOwner && (
                  <button
                    style={{ background: '#c0392b', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    onClick={() => kickPlayerFromBooking(b, b.user.id)}
                  >
                    Удалить из игры
                  </button>
                )}
              </div>
              {acceptedParticipants.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #0f3460' }}>
                  <span style={{ color: '#eee', fontSize: 14 }}>{p.name}</span>
                  {!(user != null && p.id === user.id) && (
                    <button
                      style={{ background: '#c0392b', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      onClick={() => kickPlayerFromBooking(b, p.id)}
                    >
                      Удалить из игры
                    </button>
                  )}
                </div>
              ))}
              {acceptedParticipants.length === 0 && (
                <p style={{ color: '#666', fontSize: 13, margin: '6px 0 0 0' }}>Других участников нет</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canJoin && (
                <button
                  onClick={handleModeratorJoin}
                  style={{ background: '#27ae60', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}
                >
                  Присоединиться
                </button>
              )}
              {isModeratorParticipant && !isModeratorOwner && (
                <button
                  onClick={async () => { setModeratorBookingModal(null); await leaveBooking(b) }}
                  style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}
                >
                  Выйти из игры
                </button>
              )}
              {isModeratorOwner && (
                <button
                  onClick={async () => { setModeratorBookingModal(null); await cancelBooking(b) }}
                  style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}
                >
                  Отменить бронирование
                </button>
              )}
              <button
                onClick={() => setModeratorBookingModal(null)}
                style={{ background: '#0f3460', color: '#ccc', border: '1px solid #1a4a8a', borderRadius: 4, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )
    })()}

    {/* Модалка: игровые системы игрока */}
    {playerSystemsModal && (
      <div
        onClick={() => setPlayerSystemsModal(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: '24px 28px', minWidth: 280, maxWidth: 420, width: '90%' }}
        >
          <h3 style={{ margin: '0 0 4px 0', fontSize: 16, color: '#e0e0e0' }}>
            {playerSystemsModal.displayName || playerSystemsModal.registrationName}
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#888' }}>Игровые системы</p>
          {playerSystemsModal.enabledGameSystems
            ? (
              <ul style={{ margin: 0, padding: '0 0 0 20px', color: '#ccc', fontSize: 14, lineHeight: 1.8 }}>
                {playerSystemsModal.enabledGameSystems.split('|').filter(s => s.trim()).map((s, idx) => (
                  <li key={idx}>{s.trim()}</li>
                ))}
              </ul>
            )
            : <p style={{ color: '#666', margin: 0, fontSize: 14 }}>Системы не указаны</p>
          }
          <button
            onClick={() => setPlayerSystemsModal(null)}
            style={{ marginTop: 20, background: '#0f3460', color: '#ccc', border: '1px solid #1a4a8a', borderRadius: 4, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}
          >
            Закрыть
          </button>
        </div>
      </div>
    )}
  </>
  )
}
