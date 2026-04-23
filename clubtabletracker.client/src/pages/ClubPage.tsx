import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DEFAULT_BOOKING_COLORS } from '../constants'
import type { BookingColors } from '../constants'
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isSameLocalDay(date: Date, ref: Date): boolean {
  return date.getFullYear() === ref.getFullYear() &&
    date.getMonth() === ref.getMonth() &&
    date.getDate() === ref.getDate()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [club, setClub] = useState<Club | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [user, setUser] = useState<User | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tables, setTables] = useState<GameTable[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bookings, setBookings] = useState<Booking[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rescheduleModal, setRescheduleModal] = useState<Booking | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [galleryPhotoModal, setGalleryPhotoModal] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [playersSystemFilter, setPlayersSystemFilter] = useState<string>('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rescheduleStartTime, setRescheduleStartTime] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rescheduleEndTime, setRescheduleEndTime] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rescheduleError, setRescheduleError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [gameInfoModal, setGameInfoModal] = useState<Booking | UpcomingBooking | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [playerRosterModal, setPlayerRosterModal] = useState<PlayerRosterInfo | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  return null  // будет заменено в Шаге 2в
}
