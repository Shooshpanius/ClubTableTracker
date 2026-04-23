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
  return null
}
