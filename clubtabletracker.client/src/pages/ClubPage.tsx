import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookingForm from '../components/BookingForm'
import TableTimeline, { TABLE_HEADER_HEIGHT } from '../components/TableTimeline'
import BookingCalendar from '../components/BookingCalendar'
import ClubMap from '../components/ClubMap'
import CampaignMapView from '../components/CampaignMapView'
import { DEFAULT_BOOKING_COLORS } from '../constants'
import type { BookingColors } from '../constants'
import { shareTextOnly } from '../utils/shareBooking'
import type { ShareSlot } from '../utils/shareBooking'
import { getAttachmentDisplayName } from '../utils/attachmentName'
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

// === КОНСТАНТЫ: скопировать из HomePage.tsx строки 82–101 ===

 
const MAX_BOOKING_PLAYERS = 2

 
const PAST_DATE_HINT = '📅 Просмотр прошедших игр'

 
const LOG_ACTION_LABEL: Record<string, string> = {
  Booked: 'зарезервировал',
  Joined: 'присоединился к',
  Left: 'вышел из',
  Cancelled: 'отменил',
  MovedTable: 'переместил игру (стол)',
  Rescheduled: 'изменил время'
}
 
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
   
  const navigate = useNavigate()
   
  const isMobile = useIsMobile()
  const [token] = useState(localStorage.getItem('token') || '')

  // Клуб
   
  const [club, setClub] = useState<Club | null>(null)

   
  const [user, setUser] = useState<User | null>(null)
   
  const [tables, setTables] = useState<GameTable[]>([])
   
  const [bookings, setBookings] = useState<Booking[]>([])
   
  const [members, setMembers] = useState<ClubMember[]>([])
   
  const [playerSystemsModal, setPlayerSystemsModal] = useState<ClubMember | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [moderatorBookingModal, setModeratorBookingModal] = useState<Booking | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [ownerBookingModal, setOwnerBookingModal] = useState<Booking | null>(null)
   
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
   
  const [expandedTableId, setExpandedTableId] = useState<number | null>(null)
   
  const [upcomingMyBookings, setUpcomingMyBookings] = useState<UpcomingBooking[]>([])
   
  const [upcomingAllBookings, setUpcomingAllBookings] = useState<UpcomingBooking[]>([])
   
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
   
  const [upcomingTab, setUpcomingTab] = useState<'my' | 'all'>('my')
   
  const [clubEvents, setClubEvents] = useState<ClubEventItem[]>([])
   
  const [missionMapModal, setMissionMapModal] = useState<string | null>(null)
   
  const [campaignMapModal, setCampaignMapModal] = useState<ClubEventItem | null>(null)
   
  const [decorations, setDecorations] = useState<ClubDecoration[]>([])
   
  const [clubGallery, setClubGallery] = useState<{ id: number; url: string }[]>([])
   
  const [mobileTab, setMobileTab] = useState<'tables' | 'games' | 'events' | 'log' | 'players' | 'map' | 'gallery'>('tables')
   
  const [desktopTab, setDesktopTab] = useState<'booking' | 'upcoming' | 'events' | 'log' | 'players' | 'map' | 'gallery'>('booking')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [moderatorAddPlayerId, setModeratorAddPlayerId] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [ownerInvitePlayerId, setOwnerInvitePlayerId] = useState('')
   
  const [rescheduleModal, setRescheduleModal] = useState<Booking | null>(null)
   
  const [galleryPhotoModal, setGalleryPhotoModal] = useState<string | null>(null)
   
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
   
  const cardStyle: React.CSSProperties = { background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: 16, marginBottom: 16 }
   
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

   
  const loadActivityLog = async () => {
    const clubParam = club ? `?clubId=${parseInt(clubId ?? '')}` : ''
    const res = await fetch(`/api/booking/activity-log${clubParam}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setActivityLog(await res.json())
  }

   
  const loadGallery = async (gid: number) => {
    const res = await fetch(`/api/club/${gid}/gallery`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setClubGallery(await res.json())
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

  const isModerator = user != null && members.some(m => m.id === user.id && m.isModerator)

   
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

   
  const RECT_HEIGHT = 360

  // === useMemo ===

  const memberMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

   
  const keyMemberIds = useMemo(() => new Set(members.filter(m => m.hasKey).map(m => m.id)), [members])

   
  const keyIcon = (id: string) => memberMap.get(id)?.hasKey ? <span style={{ marginRight: 3 }} title="С ключом" aria-label="С ключом" role="img">🗝️</span> : null

   
  const availablePlayerSystems = useMemo(
    () => Array.from(new Set(members.flatMap(m => (m.enabledGameSystems || '').split('|').filter(Boolean)))).sort(),
    [members]
  )

   
  const filteredMembers = useMemo(
    () => !playersSystemFilter ? members : members.filter(m => (m.enabledGameSystems || '').split('|').includes(playersSystemFilter)),
    [members, playersSystemFilter]
  )

   
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

   
  const isSelectedDatePast = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return selectedDate < today
  }, [selectedDate])

  if (!club) {
    return (
      <div style={{ padding: 40, color: '#aaa' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: '#0f3460', color: '#ccc', border: '1px solid #1a4a8a', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13, marginBottom: 16 }}
        >
          ← Назад
        </button>
        <p>Загрузка клуба...</p>
      </div>
    )
  }

  const clubOpenMin = parseHHMM(club.openTime)
  const clubCloseMin = parseHHMM(club.closeTime)
  const clubTotalHours = Math.ceil((clubCloseMin - clubOpenMin) / 60)
  const clubOpenHour = Math.floor(clubOpenMin / 60)

  return (
    <>
      <div style={{ padding: isMobile ? 16 : 40 }}>
        {/* Кнопка "Назад" */}
        <button
          onClick={() => navigate('/')}
          style={{ background: '#0f3460', color: '#ccc', border: '1px solid #1a4a8a', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13, marginBottom: 16 }}
        >
          ← Назад
        </button>

        {/* Заголовок клуба */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {club.logoUrl && (
            <img src={club.logoUrl} alt="Лого" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 6, background: '#0f3460' }} />
          )}
          <h2 style={{ color: '#e94560', margin: 0 }}>{club.name}</h2>
        </div>

        {/* === ТЕЛО АККОРДЕОНА === */}
        {isMobile ? (
          /* ===== MOBILE accordion body ===== */
          <div>
            {/* Mobile tab bar */}
            <div style={{ display: "flex", borderBottom: "2px solid #0f3460" }}>
              {(["tables", "games", "events", "log", "players", "map", "gallery"] as const).map((tab, i) => {
                const labels = ["Столы", "Игры", "События", "📋", "👥", "🗺️", "🖼️"]
                return (
                  <button
                    key={tab}
                    style={{
                      flex: 1,
                      background: mobileTab === tab ? "#e94560" : "#0f3460",
                      color: "#fff",
                      border: "none",
                      borderRadius: tab === "tables" ? "4px 0 0 0" : tab === "gallery" ? "0 4px 0 0" : 0,
                      padding: "9px 4px",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: mobileTab === tab ? "bold" : "normal",
                    }}
                    onClick={async () => {
                      setMobileTab(tab)
                      if (tab === "games") await loadUpcoming()
                      else if (tab === "log") await loadActivityLog()
                      else if (tab === "gallery") await loadGallery(parseInt(clubId ?? ''))
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
                    maxCampaignDate={maxCampaignDate}
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
                  {user && !isSelectedDatePast && <span style={{ color: "#aaa" }}>Нажмите на свободный слот для бронирования</span>}
                  {isSelectedDatePast && <span style={{ color: "#888", fontStyle: "italic" }}>{PAST_DATE_HINT}</span>}
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
                            <div style={{ width: 44, flexShrink: 0, position: "relative", height: RECT_HEIGHT + TABLE_HEADER_HEIGHT + 8, marginRight: 4 }}>
                              {Array.from({ length: clubTotalHours + 1 }, (_, i) => {
                                const hour = clubOpenHour + i
                                const top = (i / clubTotalHours) * RECT_HEIGHT + TABLE_HEADER_HEIGHT + 8
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
                              onSlotClick={user && !isSelectedDatePast && (!eventTableIds.has(table.id) || userEventTableIds.has(table.id)) ? handleSlotClick : undefined}
                              onBookingClick={user ? joinBooking : undefined}
                              isSelected={isTableSelected}
                              isEventTable={eventTableIds.has(table.id)}
                              colors={bookingColors}
                              keyMemberIds={keyMemberIds}
                            />
                          </div>
                          {isTableSelected && user && !isSelectedDatePast && (
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
                                  .map(b => ({ startTime: b.startTime, endTime: b.endTime, userId: b.user.id, userName: b.user.name, participants: b.participants.filter(p => p.status !== 'Invited').map(p => ({ id: p.id, name: p.name })), gameSystem: b.gameSystem, isDoubles: b.isDoubles, isForOthers: b.isForOthers }))}
                                isModerator={isModerator}
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
                                  <div style={{ fontSize: 12, marginTop: 2 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                                      <span style={{ color: b.ownerRoster ? "#eee" : "#aaa" }}>{keyIcon(b.user.id)}{b.user.name}</span>
                                      {isOwner && <span style={{ color: "#ff8c00", fontSize: 11 }}>(орг.)</span>}
                                      <button
                                        style={{ background: b.ownerRoster ? "#1a4a2a" : "#222", color: b.ownerRoster ? "#27ae60" : "#666", border: `1px solid ${b.ownerRoster ? "#27ae60" : "#444"}`, borderRadius: 3, padding: "1px 6px", fontSize: 11, cursor: "pointer", fontWeight: 700, lineHeight: "16px" }}
                                        onClick={e => { e.stopPropagation(); openPlayerRoster({ booking: b, playerName: b.user.name, isOwnerPlayer: true, roster: b.ownerRoster, canEdit: user?.id === b.user.id, isAdminEdit: false }) }}
                                      >R</button>
                                    </div>
                                    {b.participants.filter(p => p.status !== "Invited").map(p => (
                                      <div key={p.participantId ?? p.id} style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                                        <span style={{ color: p.roster ? "#eee" : "#aaa" }}>{keyIcon(p.id)}{p.name}</span>
                                        <button
                                          style={{ background: p.roster ? "#1a4a2a" : "#222", color: p.roster ? "#27ae60" : "#666", border: `1px solid ${p.roster ? "#27ae60" : "#444"}`, borderRadius: 3, padding: "1px 6px", fontSize: 11, cursor: "pointer", fontWeight: 700, lineHeight: "16px" }}
                                          onClick={e => { e.stopPropagation(); openPlayerRoster({ booking: b, playerName: p.name, isOwnerPlayer: false, participantId: p.participantId, roster: p.roster, canEdit: user?.id === p.id, isAdminEdit: false }) }}
                                        >R</button>
                                      </div>
                                    ))}
                                    {b.participants.filter(p => p.status === "Invited").map(p => (
                                      <div key={p.participantId ?? p.id} style={{ color: "#7b2fff", fontSize: 11, marginTop: 2 }}>{p.name} 📩</div>
                                    ))}
                                    {isAcceptedParticipant && <span style={{ color: "#4caf50", fontSize: 11 }}>(участник)</span>}
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
                            📅 {new Date(ev.startTime).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            {" – "}
                            {new Date(ev.endTime).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            &nbsp;·&nbsp;👥 {ev.participants.length}/{ev.maxParticipants}
                            {isRegistered && <span style={{ color: "#4caf50", marginLeft: 8 }}>✓ вы записаны</span>}
                          </div>
                          {ev.gameMasterName && (
                            <div style={{ fontSize: 12, color: "#c0a060", marginTop: 3 }}>
                              🎖️ Гейм-мастер: <strong>{ev.gameMasterName}</strong>
                            </div>
                          )}
                          {ev.participants.length > 0 && (
                            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                              {ev.participants.map(p => p.name).join(", ")}
                            </div>
                          )}
                          {ev.description && (
                            <div style={{ fontSize: 12, color: "#bbb", marginTop: 4, whiteSpace: "pre-wrap" }}>{ev.description}</div>
                          )}
                          {ev.regulationUrl && (
                            <div style={{ marginTop: 4 }}>
                              <a href={ev.regulationUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#7eb8f7", fontSize: 12 }}>📄 {getAttachmentDisplayName(ev.regulationUrl, 'Регламент 1')}</a>
                            </div>
                          )}
                          {ev.regulationUrl2 && (
                            <div style={{ marginTop: 2 }}>
                              <a href={ev.regulationUrl2} target="_blank" rel="noopener noreferrer" style={{ color: "#7eb8f7", fontSize: 12 }}>📄 {getAttachmentDisplayName(ev.regulationUrl2, 'Регламент 2')}</a>
                            </div>
                          )}
                          {ev.missionMapUrl && (
                            <div style={{ marginTop: 4 }}>
                              <img src={ev.missionMapUrl} alt="Карта миссии" onClick={() => setMissionMapModal(ev.missionMapUrl ?? '')}
                                style={{ maxHeight: 60, maxWidth: 100, borderRadius: 4, cursor: 'pointer', border: '1px solid #334' }}
                                title="Нажмите для просмотра" />
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                          {ev.eventType === "Campaign" && (
                            <button style={{ ...btnStyle, background: "#7b3fa0", fontSize: 12, padding: "4px 10px", marginRight: 0 }} onClick={() => setCampaignMapModal(ev)}>🗺️ Карта кампании</button>
                          )}
                          {user && (
                            isRegistered
                              ? <button style={{ ...btnStyle, background: "#c0392b", fontSize: 12, padding: "4px 10px", marginRight: 0 }} onClick={() => unregisterEvent(ev.id)}>Отменить запись</button>
                              : <button style={{ ...btnStyle, background: isFull ? "#555" : "#28a745", fontSize: 12, padding: "4px 10px", marginRight: 0 }} onClick={() => !isFull && registerEvent(ev.id)} disabled={isFull}>{isFull ? "Мест нет" : "Записаться"}</button>
                          )}
                        </div>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: 15 }}>Игроки клуба</h3>
                  <select
                    value={playersSystemFilter}
                    onChange={e => setPlayersSystemFilter(e.target.value)}
                    style={{ background: "#0f3460", color: "#ccc", border: "1px solid #1a4a8a", borderRadius: 4, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                  >
                    <option value="">Все системы</option>
                    {availablePlayerSystems.map(sys => (
                      <option key={sys} value={sys}>{sys}</option>
                    ))}
                  </select>
                </div>
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
                        {filteredMembers.map(m => (
                          <tr key={m.id} style={{ borderBottom: "1px solid #1a2a4a" }}>
                            <td style={{ padding: "6px 8px" }}>{m.hasKey && <span style={{ marginRight: 3 }} title="С ключом" aria-label="С ключом" role="img">🗝️</span>}{m.registrationName}</td>
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
                  onTableClick={table => { setSelectedTable(table); setMobileTab("tables") }}
                />
              </div>
            )}

            {/* Tab: Галерея (mobile) */}
            {mobileTab === "gallery" && (
              <div>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 15 }}>Галерея клуба</h3>
                {clubGallery.length === 0 ? (
                  <p style={{ color: "#aaa", margin: 0 }}>Фотографий нет.</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {clubGallery.map(photo => (
                      <img key={photo.id} src={photo.url} alt="" onClick={() => setGalleryPhotoModal(photo.url)} style={{ width: "calc(50% - 4px)", aspectRatio: "4/3", objectFit: "cover", borderRadius: 6, cursor: 'pointer' }} />
                    ))}
                  </div>
                )}
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
                ['gallery', '🖼️ Галерея'],
              ] as [string, string][]).map(([tab, label]) => (
                <button
                  key={tab}
                  style={{ ...btnStyle, background: desktopTab === tab ? '#e94560' : '#0f3460', marginBottom: 0, marginRight: 0, borderRadius: '4px 4px 0 0' }}
                  onClick={async () => {
                    if (tab === 'upcoming') await loadUpcoming()
                    else if (tab === 'log') await loadActivityLog()
                    else if (tab === 'gallery') await loadGallery(parseInt(clubId ?? ''))
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
                    <div style={{ width: 44, flexShrink: 0, position: 'relative', height: RECT_HEIGHT + TABLE_HEADER_HEIGHT + 8, marginRight: 4 }}>
                      {Array.from({ length: clubTotalHours + 1 }, (_, i) => {
                        const hour = clubOpenHour + i
                        const top = (i / clubTotalHours) * RECT_HEIGHT + TABLE_HEADER_HEIGHT + 8
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
                            onSlotClick={user && !isSelectedDatePast && (!eventTableIds.has(table.id) || userEventTableIds.has(table.id)) ? handleSlotClick : undefined}
                            onBookingClick={user ? joinBooking : undefined}
                            isSelected={selectedTable?.id === table.id}
                            isEventTable={eventTableIds.has(table.id)}
                            colors={bookingColors}
                            keyMemberIds={keyMemberIds}
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
                    {user && !isSelectedDatePast && <span style={{ color: '#aaa' }}>Нажмите на свободный слот для бронирования</span>}
                    {isSelectedDatePast && <span style={{ color: '#888', fontStyle: 'italic' }}>{PAST_DATE_HINT}</span>}
                  </div>
                  {selectedTable && user && !isSelectedDatePast && (
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
                          .map(b => ({ startTime: b.startTime, endTime: b.endTime, userId: b.user.id, userName: b.user.name, participants: b.participants.filter(p => p.status !== 'Invited').map(p => ({ id: p.id, name: p.name })), gameSystem: b.gameSystem, isDoubles: b.isDoubles, isForOthers: b.isForOthers }))}
                        isModerator={isModerator}
                      />
                    </div>
                  )}
                </div>
                <div style={{ width: 220, flexShrink: 0 }}>
                  <BookingCalendar
                    bookings={bookings}
                    selectedDate={selectedDate}
                    onSelectDate={date => { setSelectedDate(date); setSelectedTable(null) }}
                    maxCampaignDate={maxCampaignDate}
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
                              <div style={{ fontSize: 12, marginTop: 2 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                  <span style={{ color: b.ownerRoster ? '#eee' : '#aaa' }}>{keyIcon(b.user.id)}{b.user.name}</span>
                                  {isOwner && <span style={{ color: '#ff8c00', fontSize: 11 }}>(орг.)</span>}
                                  <button
                                    style={{ background: b.ownerRoster ? '#1a4a2a' : '#222', color: b.ownerRoster ? '#27ae60' : '#666', border: `1px solid ${b.ownerRoster ? '#27ae60' : '#444'}`, borderRadius: 3, padding: '1px 6px', fontSize: 11, cursor: 'pointer', fontWeight: 700, lineHeight: '16px' }}
                                    onClick={e => { e.stopPropagation(); openPlayerRoster({ booking: b, playerName: b.user.name, isOwnerPlayer: true, roster: b.ownerRoster, canEdit: user?.id === b.user.id, isAdminEdit: false }) }}
                                  >R</button>
                                </div>
                                {b.participants.filter(p => p.status !== 'Invited').map(p => (
                                  <div key={p.participantId ?? p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                                    <span style={{ color: p.roster ? '#eee' : '#aaa' }}>{keyIcon(p.id)}{p.name}</span>
                                    <button
                                      style={{ background: p.roster ? '#1a4a2a' : '#222', color: p.roster ? '#27ae60' : '#666', border: `1px solid ${p.roster ? '#27ae60' : '#444'}`, borderRadius: 3, padding: '1px 6px', fontSize: 11, cursor: 'pointer', fontWeight: 700, lineHeight: '16px' }}
                                      onClick={e => { e.stopPropagation(); openPlayerRoster({ booking: b, playerName: p.name, isOwnerPlayer: false, participantId: p.participantId, roster: p.roster, canEdit: user?.id === p.id, isAdminEdit: false }) }}
                                    >R</button>
                                  </div>
                                ))}
                                {b.participants.filter(p => p.status === 'Invited').map(p => (
                                  <div key={p.participantId ?? p.id} style={{ color: '#7b2fff', fontSize: 11, marginTop: 2 }}>{p.name} 📩</div>
                                ))}
                                {isAcceptedParticipant && <span style={{ color: '#4caf50', fontSize: 11 }}>(участник)</span>}
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
                            📅 {new Date(ev.startTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {' – '}
                            {new Date(ev.endTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            &nbsp;·&nbsp;👥 {ev.participants.length}/{ev.maxParticipants}
                            {isRegistered && <span style={{ color: '#4caf50', marginLeft: 8 }}>✓ вы записаны</span>}
                          </div>
                          {ev.gameMasterName && (
                            <div style={{ fontSize: 12, color: '#c0a060', marginTop: 3 }}>
                              🎖️ Гейм-мастер: <strong>{ev.gameMasterName}</strong>
                            </div>
                          )}
                          {ev.participants.length > 0 && (
                            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                              {ev.participants.map(p => p.name).join(', ')}
                            </div>
                          )}
                          {ev.description && (
                            <div style={{ fontSize: 12, color: '#bbb', marginTop: 4, whiteSpace: 'pre-wrap' }}>{ev.description}</div>
                          )}
                          {ev.regulationUrl && (
                            <div style={{ marginTop: 4 }}>
                              <a href={ev.regulationUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#7eb8f7', fontSize: 12 }}>📄 {getAttachmentDisplayName(ev.regulationUrl, 'Регламент 1')}</a>
                            </div>
                          )}
                          {ev.regulationUrl2 && (
                            <div style={{ marginTop: 2 }}>
                              <a href={ev.regulationUrl2} target="_blank" rel="noopener noreferrer" style={{ color: '#7eb8f7', fontSize: 12 }}>📄 {getAttachmentDisplayName(ev.regulationUrl2, 'Регламент 2')}</a>
                            </div>
                          )}
                          {ev.missionMapUrl && (
                            <div style={{ marginTop: 4 }}>
                              <img src={ev.missionMapUrl} alt="Карта миссии" onClick={() => setMissionMapModal(ev.missionMapUrl ?? '')}
                                style={{ maxHeight: 60, maxWidth: 100, borderRadius: 4, cursor: 'pointer', border: '1px solid #334' }}
                                title="Нажмите для просмотра" />
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                          {ev.eventType === 'Campaign' && (
                            <button style={{ ...btnStyle, background: '#7b3fa0', fontSize: 12, padding: '4px 10px', marginRight: 0 }} onClick={() => setCampaignMapModal(ev)}>🗺️ Карта кампании</button>
                          )}
                          {user && (
                            isRegistered
                              ? <button style={{ ...btnStyle, background: '#c0392b', fontSize: 12, padding: '4px 10px', marginRight: 0 }} onClick={() => unregisterEvent(ev.id)}>Отменить запись</button>
                              : <button style={{ ...btnStyle, background: isFull ? '#555' : '#28a745', fontSize: 12, padding: '4px 10px', marginRight: 0 }} onClick={() => !isFull && registerEvent(ev.id)} disabled={isFull}>{isFull ? 'Мест нет' : 'Записаться'}</button>
                          )}
                        </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 15 }}>Игроки клуба</h3>
                  <select
                    value={playersSystemFilter}
                    onChange={e => setPlayersSystemFilter(e.target.value)}
                    style={{ background: '#0f3460', color: '#ccc', border: '1px solid #1a4a8a', borderRadius: 4, padding: '4px 10px', fontSize: 13, cursor: 'pointer' }}
                  >
                    <option value=''>Все системы</option>
                    {availablePlayerSystems.map(sys => (
                      <option key={sys} value={sys}>{sys}</option>
                    ))}
                  </select>
                </div>
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
                        {filteredMembers.map(m => (
                          <tr key={m.id} style={{ borderBottom: '1px solid #1a2a4a' }}>
                            <td style={{ padding: '8px 12px' }}>{m.hasKey && <span style={{ marginRight: 3 }} title="С ключом" aria-label="С ключом" role="img">🗝️</span>}{m.registrationName}</td>
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
                  onTableClick={table => { setSelectedTable(table); setDesktopTab('booking') }}
                />
              </div>
            )}

            {/* Tab: Галерея */}
            {desktopTab === 'gallery' && (
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 15 }}>Галерея клуба</h3>
                {clubGallery.length === 0 ? (
                  <p style={{ color: '#aaa', margin: 0 }}>Фотографий нет.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {clubGallery.map(photo => (
                      <img key={photo.id} src={photo.url} alt="" onClick={() => setGalleryPhotoModal(photo.url)} style={{ width: 200, height: 150, objectFit: 'cover', borderRadius: 8, border: '1px solid #0f3460', cursor: 'pointer' }} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модальные окна будут добавлены в Шаге 2д */}

      {/* Модалка: просмотр фото в галерее */}
      {galleryPhotoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setGalleryPhotoModal(null)}>
          <img src={galleryPhotoModal} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, border: '2px solid #0f3460' }} />
        </div>
      )}

      {/* Модалка: карта миссии */}
      {missionMapModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setMissionMapModal(null)}>
          <img src={missionMapModal} alt="Карта миссии" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, border: '2px solid #0f3460' }} />
        </div>
      )}

      {/* Модалка: карта кампании */}
      {campaignMapModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setCampaignMapModal(null)}>
          <div style={{ background: '#16213e', borderRadius: 12, padding: 24, maxWidth: '95vw', maxHeight: '95vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#e94560' }}>{campaignMapModal.title}</h3>
              <button onClick={() => setCampaignMapModal(null)} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>
            <CampaignMapView event={campaignMapModal} members={members} bookings={bookings} />
          </div>
        </div>
      )}

      {/* Модалка: системы игрока */}
      {playerSystemsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setPlayerSystemsModal(null)}>
          <div style={{ background: '#16213e', borderRadius: 10, padding: 24, minWidth: 280, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px 0', color: '#e94560' }}>{playerSystemsModal.registrationName}</h3>
            {(playerSystemsModal.enabledGameSystems || '').split('|').filter(Boolean).length === 0
              ? <p style={{ color: '#aaa', margin: 0 }}>Не указаны</p>
              : (playerSystemsModal.enabledGameSystems || '').split('|').filter(Boolean).map(s => (
                <div key={s} style={{ color: '#eee', padding: '4px 0', borderBottom: '1px solid #0f3460' }}>{s}</div>
              ))
            }
            <button onClick={() => setPlayerSystemsModal(null)} style={{ marginTop: 16, ...btnStyle }}>Закрыть</button>
          </div>
        </div>
      )}
    </>
  )
}
