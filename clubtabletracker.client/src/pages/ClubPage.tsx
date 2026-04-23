import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DEFAULT_BOOKING_COLORS } from '../constants'
import type { BookingColors } from '../constants'
import { shareTextOnly } from '../utils/shareBooking'
import type { ShareSlot } from '../utils/shareBooking'
import useIsMobile from '../utils/useIsMobile'

// === ИНТЕРФЕЙСЫ: скопировать из HomePage.tsx строки 28–42 ===

export interface User { id: string; email: string; name: string; displayName?: string }
export interface Club {
  id: number; name: string; description: string; openTime: string; closeTime: string; logoUrl?: string;
}
export interface Membership { id: number; status: string; club: Club }
export interface GameTable { id: number; number: string; size: string; supportedGames: string; x: number; y: number; width: number; height: number; eventsOnly?: boolean }
export interface BookingParticipant { participantId?: number; id: string; name: string; status?: string; roster?: string }
export interface BookingBase { id: number; user: { id: string; name: string }; ownerRoster?: string; participants: BookingParticipant[]; isDoubles?: boolean; isForOthers?: boolean }
export interface Booking extends BookingBase { tableId: number; startTime: string; endTime: string; gameSystem?: string }
export interface UpcomingBooking extends BookingBase { tableId: number; tableNumber: string; clubName: string; clubId: number; startTime: string; endTime: string; gameSystem?: string }
export interface ActivityLogEntry { id: number; timestamp: string; action: string; userName: string; tableNumber: string; clubId: number; bookingStartTime: string; bookingEndTime: string }
export interface ClubMember { id: string; name: string; enabledGameSystems?: string; registrationName: string; displayName?: string; bio?: string; joinedAt: string; isModerator?: boolean; hasKey?: boolean; isManualEntry?: boolean }
export interface ClubEventItem { id: number; title: string; startTime: string; endTime: string; maxParticipants: number; eventType: string; gameSystem?: string; tableIds?: string; description?: string; regulationUrl?: string; regulationUrl2?: string; missionMapUrl?: string; gameMasterId?: string; gameMasterName?: string; participants: { id: string; name: string }[] }
export interface PlayerRosterInfo { booking: Booking | UpcomingBooking; playerName: string; isOwnerPlayer: boolean; participantId?: number; roster?: string; canEdit: boolean; isAdminEdit: boolean }
export interface ClubDecoration { id: number; type: 'wall' | 'window' | 'door'; x: number; y: number; width: number; height: number }

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ: скопировать из HomePage.tsx строки 44–80 ===

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isBookingPast(startTime: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(startTime)
  d.setHours(0, 0, 0, 0)
  return d < today
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

// === КОНСТАНТЫ: скопировать из HomePage.tsx строки 82–101 ===

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MAX_BOOKING_PLAYERS = 2

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PAST_DATE_HINT = '📅 Просмотр прошедших игр'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LOG_ACTION_LABEL: Record<string, string> = {
  Booked: 'зарезервировал',
  Joined: 'присоединился к',
  Left: 'вышел из',
  Cancelled: 'отменил',
  MovedTable: 'переместил игру (стол)',
  Rescheduled: 'изменил время'
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LOG_ACTION_COLOR: Record<string, string> = {
  Booked: '#4caf50',
  Joined: '#2196f3',
  Left: '#ffc107',
  Cancelled: '#e94560',
  MovedTable: '#9c27b0',
  Rescheduled: '#00bcd4'
}

export default function ClubPage() {
  const { clubId } = useParams<{ clubId: string }>()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigate = useNavigate()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isMobile = useIsMobile()
  const [token] = useState(localStorage.getItem('token') || '')

  // Клуб
   
  const [club, setClub] = useState<Club | null>(null)

   
  const [user, setUser] = useState<User | null>(null)
   
  const [tables, setTables] = useState<GameTable[]>([])
   
  const [bookings, setBookings] = useState<Booking[]>([])
   
  const [members, setMembers] = useState<ClubMember[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [playerSystemsModal, setPlayerSystemsModal] = useState<ClubMember | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [moderatorBookingModal, setModeratorBookingModal] = useState<Booking | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [ownerBookingModal, setOwnerBookingModal] = useState<Booking | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedTable, setSelectedTable] = useState<GameTable | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bookingStart, setBookingStart] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bookingEnd, setBookingEnd] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bookingColors, setBookingColors] = useState<BookingColors>(() => {
    try {
      const stored = localStorage.getItem('bookingColors')
      if (stored) return { ...DEFAULT_BOOKING_COLORS, ...JSON.parse(stored) }
    } catch { /* ignore */ }
    return DEFAULT_BOOKING_COLORS
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [expandedTableId, setExpandedTableId] = useState<number | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [upcomingMyBookings, setUpcomingMyBookings] = useState<UpcomingBooking[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [upcomingAllBookings, setUpcomingAllBookings] = useState<UpcomingBooking[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [upcomingTab, setUpcomingTab] = useState<'my' | 'all'>('my')
   
  const [clubEvents, setClubEvents] = useState<ClubEventItem[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [missionMapModal, setMissionMapModal] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [campaignMapModal, setCampaignMapModal] = useState<ClubEventItem | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [decorations, setDecorations] = useState<ClubDecoration[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [clubGallery, setClubGallery] = useState<{ id: number; url: string }[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mobileTab, setMobileTab] = useState<'tables' | 'games' | 'events' | 'log' | 'players' | 'map' | 'gallery'>('tables')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [desktopTab, setDesktopTab] = useState<'booking' | 'upcoming' | 'events' | 'log' | 'players' | 'map' | 'gallery'>('booking')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [moderatorAddPlayerId, setModeratorAddPlayerId] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [ownerInvitePlayerId, setOwnerInvitePlayerId] = useState('')
   
  const [rescheduleModal, setRescheduleModal] = useState<Booking | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [galleryPhotoModal, setGalleryPhotoModal] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [playersSystemFilter, setPlayersSystemFilter] = useState<string>('')
   
  const [rescheduleStartTime, setRescheduleStartTime] = useState('')
   
  const [rescheduleEndTime, setRescheduleEndTime] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rescheduleError, setRescheduleError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [gameInfoModal, setGameInfoModal] = useState<Booking | UpcomingBooking | null>(null)
   
  const [playerRosterModal, setPlayerRosterModal] = useState<PlayerRosterInfo | null>(null)
   
  const [playerRosterValue, setPlayerRosterValue] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [playerRosterSaving, setPlayerRosterSaving] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [playerRosterLoading, setPlayerRosterLoading] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const cardStyle: React.CSSProperties = { background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: 16, marginBottom: 16 }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const btnStyle: React.CSSProperties = { background: '#533483', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', marginRight: 8 }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const warnStyle: React.CSSProperties = { color: '#ffc107', fontSize: 14 }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const shareBtnStyle: React.CSSProperties = { background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }

  // === useEffect: загрузка данных по clubId ===
  useEffect(() => {
    let isCurrent = true
    const numId = parseInt(clubId ?? '')
    if (isNaN(numId)) return

    fetch('/api/club')
      .then(r => r.json())
      .then((data: Club[]) => {
        if (!isCurrent) return
        const found = data.find(c => c.id === numId) ?? null
        setClub(found)
        if (!found) return
        const authHeaders: Record<string, string> = token
          ? { Authorization: `Bearer ${token}` }
          : {}
        Promise.all([
          fetch(`/api/club/${numId}/tables`, { headers: authHeaders }),
          fetch(`/api/booking/club/${numId}`, { headers: authHeaders }),
          fetch(`/api/club/${numId}/members`, { headers: authHeaders }),
          fetch(`/api/event/club/${numId}`, { headers: authHeaders }),
          fetch(`/api/club/${numId}/decorations`, { headers: authHeaders }),
        ]).then(async ([tablesRes, bookingsRes, membersRes, eventsRes, decorationsRes]) => {
          if (!isCurrent) return
          if (tablesRes.ok) setTables(await tablesRes.json())
          if (bookingsRes.ok) setBookings(await bookingsRes.json())
          if (membersRes.ok) setMembers(await membersRes.json())
          if (eventsRes.ok) setClubEvents(await eventsRes.json())
          if (decorationsRes.ok) setDecorations(await decorationsRes.json())
        })
      })
      .catch(err => console.error('Failed to load club:', err))

    if (token) {
      try {
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
            if (data.bookingColors) {
              try {
                const c = { ...DEFAULT_BOOKING_COLORS, ...JSON.parse(data.bookingColors) }
                setBookingColors(c)
                localStorage.setItem('bookingColors', JSON.stringify(c))
              } catch { /* ignore */ }
            }
          })
          .catch(() => { if (isCurrent) setUser(u => u ?? baseUser) })
      } catch { /* ignore */ }
    }

    return () => { isCurrent = false }
  }, [clubId, token])

  // === ФУНКЦИИ ===

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const registerEvent = async (eventId: number) => {
    const res = await fetch(`/api/event/${eventId}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      if (!club) return
      const evRes = await fetch(`/api/event/club/${parseInt(clubId ?? '')}`, { headers: { Authorization: `Bearer ${token}` } })
      if (evRes.ok) setClubEvents(await evRes.json())
    } else {
      const text = await res.text()
      alert(text || 'Не удалось записаться на событие')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const unregisterEvent = async (eventId: number) => {
    if (!confirm('Отменить запись на событие?')) return
    const res = await fetch(`/api/event/${eventId}/unregister`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      if (!club) return
      const evRes = await fetch(`/api/event/club/${parseInt(clubId ?? '')}`, { headers: { Authorization: `Bearer ${token}` } })
      if (evRes.ok) setClubEvents(await evRes.json())
    } else {
      const text = await res.text()
      alert(text || 'Не удалось отменить запись')
    }
  }

   
  const loadUpcoming = async () => {
    const clubParam = club ? `?clubId=${parseInt(clubId ?? '')}` : ''
    const [myRes, allRes] = await Promise.all([
      fetch(`/api/booking/my-upcoming${clubParam}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/booking/upcoming-all${clubParam}`, { headers: { Authorization: `Bearer ${token}` } })
    ])
    if (myRes.ok) setUpcomingMyBookings(await myRes.json())
    if (allRes.ok) setUpcomingAllBookings(await allRes.json())
  }

   
  const onBookingCreated = async () => {
    if (!club) return
    const res = await fetch(`/api/booking/club/${parseInt(clubId ?? '')}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setBookings(await res.json())
    setSelectedTable(null)
    await loadUpcoming()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const loadActivityLog = async () => {
    const clubParam = club ? `?clubId=${parseInt(clubId ?? '')}` : ''
    const res = await fetch(`/api/booking/activity-log${clubParam}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setActivityLog(await res.json())
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const loadGallery = async (gid: number) => {
    const res = await fetch(`/api/club/${gid}/gallery`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setClubGallery(await res.json())
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const isModerator = user != null && members.some(m => m.id === user.id && m.isModerator)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const joinBooking = async (booking: Booking) => {
    if (!user) return
    if (isModerator) {
      setModeratorAddPlayerId('')
      setModeratorBookingModal(booking)
      return
    }
    if (booking.user.id === user.id) {
      setOwnerInvitePlayerId('')
      setOwnerBookingModal(booking)
      return
    }
    if (booking.participants.some(p => p.id === user.id)) {
      setGameInfoModal(booking)
      return
    }
    setGameInfoModal(booking)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const doJoinBooking = async (booking: BookingBase) => {
    const res = await fetch(`/api/booking/${booking.id}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      setGameInfoModal(null)
      onBookingCreated()
    } else {
      const text = await res.text()
      alert(text || 'Не удалось присоединиться')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSlotClick = (table: GameTable, startMin: number, endMin: number) => {
    setSelectedTable(table)
    setBookingStart(toDatetimeLocal(selectedDate, startMin))
    setBookingEnd(toDatetimeLocal(selectedDate, endMin))
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleTableHeaderClick = (table: GameTable) => {
    setSelectedTable(table)
    setBookingStart('')
    setBookingEnd('')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleShareBooking = (b: Booking) => {
    const table = tables.find(t => t.id === b.tableId)
    if (!table) return
    const bookingDate = new Date(b.startTime)
    const dayBookings = bookings.filter(bk =>
      bk.tableId === b.tableId && isSameLocalDay(new Date(bk.startTime), bookingDate)
    )
    const localMemberMap = new Map(members.map(m => [m.id, m]))
    const resolveName = (id: string, fallback: string): string => {
      const member = localMemberMap.get(id)
      if (member) {
        const regName = member.registrationName || member.name
        return member.displayName ? `${regName} (${member.displayName})` : regName
      }
      return fallback
    }
    const slots: ShareSlot[] = dayBookings.map(bk => ({
      startTime: bk.startTime,
      endTime: bk.endTime,
      gameSystem: bk.gameSystem,
      userName: resolveName(bk.user.id, bk.user.name),
      participants: bk.participants.map(p => ({ name: resolveName(p.id, p.name) })),
    }))
    shareTextOnly(table.number, bookingDate, slots)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const kickPlayerFromBooking = async (booking: Booking, targetId: string, participantId?: number) => {
    const targetName = booking.user.id === targetId
      ? booking.user.name
      : booking.participants.find(p => p.id === targetId)?.name ?? targetId
    if (!confirm(`Удалить ${targetName} из игры?`)) return
    const url = participantId != null
      ? `/api/booking/${booking.id}/kick-participant/${participantId}`
      : `/api/booking/${booking.id}/kick-player/${encodeURIComponent(targetId)}`
    const res = await fetch(url, {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const moveBookingTable = async (booking: Booking, newTableId: number) => {
    const newTable = tables.find(t => t.id === newTableId)
    if (!newTable) return
    if (!confirm(`Переместить игру на стол ${newTable.number}?`)) return
    const res = await fetch(`/api/booking/${booking.id}/move-table`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ newTableId })
    })
    if (res.ok) {
      setModeratorBookingModal(null)
      onBookingCreated()
    } else {
      const text = await res.text()
      alert(text || 'Не удалось переместить игру')
    }
  }

   
  const fmtHHMM = (s: string) => {
    const d = new Date(s)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

   
  const saveMyRoster = async (bookingId: number, roster: string) => {
    setPlayerRosterSaving(true)
    const res = await fetch(`/api/booking/${bookingId}/roster`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ roster: roster || null })
    })
    setPlayerRosterSaving(false)
    if (res.ok) {
      onBookingCreated()
    } else {
      const text = await res.text()
      alert(text || 'Не удалось сохранить ростер')
    }
  }

   
  const savePlayerRoster = async (bookingId: number, participantId: number | null, roster: string) => {
    setPlayerRosterSaving(true)
    const res = await fetch(`/api/booking/${bookingId}/player-roster`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ participantId: participantId, roster: roster || null })
    })
    setPlayerRosterSaving(false)
    if (res.ok) {
      onBookingCreated()
    } else {
      const text = await res.text()
      alert(text || 'Не удалось сохранить ростер')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const openPlayerRoster = async (info: PlayerRosterInfo) => {
    setPlayerRosterValue('')
    setPlayerRosterLoading(true)
    setPlayerRosterModal(info)
    const url = info.isOwnerPlayer
      ? `/api/booking/${info.booking.id}/roster`
      : `/api/booking/${info.booking.id}/roster?participantId=${info.participantId}`
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setPlayerRosterValue(data.roster ?? '')
      } else {
        alert('Не удалось загрузить ростер')
        setPlayerRosterModal(null)
      }
    } finally {
      setPlayerRosterLoading(false)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const saveCurrentPlayerRoster = async () => {
    if (!playerRosterModal || !playerRosterModal.canEdit) return
    const { booking: b, isOwnerPlayer, participantId, isAdminEdit } = playerRosterModal
    if (isAdminEdit) {
      await savePlayerRoster(b.id, isOwnerPlayer ? null : (participantId ?? null), playerRosterValue)
    } else {
      await saveMyRoster(b.id, playerRosterValue)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const openRescheduleModal = (booking: Booking) => {
    setRescheduleStartTime(fmtHHMM(booking.startTime))
    setRescheduleEndTime(fmtHHMM(booking.endTime))
    setRescheduleError('')
    setRescheduleModal(booking)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const rescheduleBooking = async () => {
    const booking = rescheduleModal
    if (!booking) return
    setRescheduleError('')
    if (!rescheduleStartTime || !rescheduleEndTime) {
      setRescheduleError('Выберите время начала и окончания')
      return
    }
    const buildDt = (timeStr: string): string => {
      const d = new Date(booking.startTime)
      const [h, m] = timeStr.split(':').map(Number)
      d.setHours(h, m, 0, 0)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hours = String(d.getHours()).padStart(2, '0')
      const mins = String(d.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${mins}`
    }
    const startDt = buildDt(rescheduleStartTime)
    const endDt = buildDt(rescheduleEndTime)
    if (startDt >= endDt) {
      setRescheduleError('Время окончания должно быть позже времени начала')
      return
    }
    const res = await fetch(`/api/booking/${booking.id}/reschedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ startTime: startDt, endTime: endDt })
    })
    if (res.ok) {
      setRescheduleModal(null)
      setModeratorBookingModal(null)
      setOwnerBookingModal(null)
      onBookingCreated()
    } else {
      const text = await res.text()
      setRescheduleError(text || 'Ошибка при изменении времени')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addPlayerToBooking = async (booking: Booking, memberId: string) => {
    const member = members.find(m => m.id === memberId)
    const memberName = memberId === '__RESERVED__' ? 'ЗАБРОНИРОВАНО' : (member?.displayName || member?.registrationName || memberId)
    if (!confirm(`Добавить ${memberName} в игру?`)) return
    const res = await fetch(`/api/booking/${booking.id}/add-player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: memberId })
    })
    if (res.ok) {
      setModeratorBookingModal(null)
      onBookingCreated()
    } else {
      const text = await res.text()
      alert(text || 'Не удалось добавить игрока')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const invitePlayerToBooking = async (booking: Booking, memberId: string) => {
    const member = members.find(m => m.id === memberId)
    const memberName = memberId === '__RESERVED__' ? 'ЗАБРОНИРОВАНО' : (member?.displayName || member?.registrationName || memberId)
    if (!confirm(`Пригласить ${memberName} в игру?`)) return
    const res = await fetch(`/api/booking/${booking.id}/invite-player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: memberId })
    })
    if (res.ok) {
      setOwnerBookingModal(null)
      onBookingCreated()
    } else {
      const text = await res.text()
      alert(text || 'Не удалось пригласить игрока')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const RECT_HEIGHT = 360

  // === useMemo ===

  const memberMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const keyMemberIds = useMemo(() => new Set(members.filter(m => m.hasKey).map(m => m.id)), [members])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const keyIcon = (id: string) => memberMap.get(id)?.hasKey ? <span style={{ marginRight: 3 }} title="С ключом" aria-label="С ключом" role="img">🗝️</span> : null

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const availablePlayerSystems = useMemo(
    () => Array.from(new Set(members.flatMap(m => (m.enabledGameSystems || '').split('|').filter(Boolean)))).sort(),
    [members]
  )

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const filteredMembers = useMemo(
    () => !playersSystemFilter ? members : members.filter(m => (m.enabledGameSystems || '').split('|').includes(playersSystemFilter)),
    [members, playersSystemFilter]
  )

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { eventTableIds, userEventTableIds, eventTableGameSystems } = useMemo(() => {
    const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
    const eventsOnSelectedDate = clubEvents.filter(ev => {
      if (ev.eventType === 'Campaign') return false
      const evStart = new Date(ev.startTime)
      const evEnd = new Date(ev.endTime)
      return evStart < dayEnd && evEnd > dayStart
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const maxCampaignDate = useMemo(() => {
    if (!user) return null
    const campaignEvents = clubEvents.filter(ev =>
      ev.eventType === 'Campaign' &&
      ev.tableIds &&
      ev.participants.some(p => p.id === user.id)
    )
    if (campaignEvents.length === 0) return null
    const maxMs = Math.max(...campaignEvents.map(ev => new Date(ev.endTime).getTime()))
    const d = new Date(maxMs)
    d.setHours(0, 0, 0, 0)
    return d
  }, [clubEvents, user])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isSelectedDatePast = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return selectedDate < today
  }, [selectedDate])

  return null  // будет заменено в Шаге 2г
}
