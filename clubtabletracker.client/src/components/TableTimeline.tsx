import { DEFAULT_BOOKING_COLORS } from '../constants'
import type { BookingColors } from '../constants'

interface Booking {
  id: number; tableId: number; startTime: string; endTime: string
  gameSystem?: string
  user: { id: string; name: string }
  participants: { id: string; name: string; status?: string }[]
}
interface GameTable { id: number; number: string; size: string; supportedGames: string; x: number; y: number; width: number; height: number; eventsOnly?: boolean }

interface Props {
  table: GameTable
  bookings: Booking[]
  openTime: string
  closeTime: string
  selectedDate: Date
  currentUserId?: string
  onSlotClick?: (table: GameTable, startMin: number, endMin: number) => void
  onBookingClick?: (booking: Booking) => void
  isSelected?: boolean
  isEventTable?: boolean
  colors?: BookingColors
  keyMemberIds?: Set<string>
}

const RECT_HEIGHT = 360
const RECT_WIDTH = 110
export const TABLE_HEADER_HEIGHT = 36

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

interface Segment {
  type: 'free' | 'booked'
  startMin: number
  endMin: number
  booking?: Booking
}

export default function TableTimeline({ table, bookings, openTime, closeTime, selectedDate, currentUserId, onSlotClick, onBookingClick, isSelected, isEventTable, colors, keyMemberIds }: Props) {
  const c = { ...DEFAULT_BOOKING_COLORS, ...colors }
  const openMin = parseHHMM(openTime)
  const closeMin = parseHHMM(closeTime)
  const totalMin = Math.max(closeMin - openMin, 1)

  const todayBookings = bookings
    .filter(b => b.tableId === table.id && isSameLocalDay(new Date(b.startTime), selectedDate))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  const segments: Segment[] = []
  let cursor = openMin
  for (const booking of todayBookings) {
    const bStart = Math.max(getLocalMinutes(new Date(booking.startTime)), openMin)
    const bEnd = Math.min(getLocalMinutes(new Date(booking.endTime)), closeMin)
    if (bStart > cursor) segments.push({ type: 'free', startMin: cursor, endMin: bStart })
    if (bEnd > bStart) segments.push({ type: 'booked', startMin: bStart, endMin: bEnd, booking })
    cursor = Math.max(cursor, bEnd)
  }
  if (cursor < closeMin) segments.push({ type: 'free', startMin: cursor, endMin: closeMin })

  return (
    <div style={{ display: 'inline-block', width: RECT_WIDTH, margin: '0 6px', textAlign: 'center', verticalAlign: 'top' }}>
      <div title={table.number} style={{ marginBottom: 8, fontWeight: 'bold', fontSize: 13, color: isSelected ? '#e94560' : '#eee', height: TABLE_HEADER_HEIGHT, overflow: 'hidden', wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {table.number}
      </div>
      <div style={{
        width: RECT_WIDTH, height: RECT_HEIGHT,
        border: isEventTable ? '3px solid #ffff00' : isSelected ? '3px solid #e94560' : '2px solid #555',
        borderRadius: 6, overflow: 'hidden', position: 'relative'
      }}>
        {segments.map((seg, i) => {
          const top = ((seg.startMin - openMin) / totalMin) * RECT_HEIGHT
          const height = Math.max(((seg.endMin - seg.startMin) / totalMin) * RECT_HEIGHT, 1)
          const isFree = seg.type === 'free'
          const isUserBooking = !isFree && seg.booking != null && currentUserId != null &&
            (seg.booking.user.id === currentUserId || seg.booking.participants.some(p => p.id === currentUserId))
          return (
            <div
              key={i}
              onClick={() => {
                if (isFree) onSlotClick?.(table, seg.startMin, seg.endMin)
                else if (seg.booking) onBookingClick?.(seg.booking)
              }}
              title={isFree ? `Свободно ${Math.floor(seg.startMin / 60)}:${String(seg.startMin % 60).padStart(2, '0')}–${Math.floor(seg.endMin / 60)}:${String(seg.endMin % 60).padStart(2, '0')}` : undefined}
              style={{
                position: 'absolute', left: 0, right: 0, top, height,
                background: isFree ? (isEventTable ? c.eventFreeSlot : c.freeSlot) : isUserBooking ? c.myBooking : c.othersBooking,
                cursor: (isFree && onSlotClick) || (!isFree && onBookingClick) ? 'pointer' : 'default',
                display: 'flex', flexDirection: 'column',
                justifyContent: 'center', alignItems: 'center',
                fontSize: 11, color: '#222', overflow: 'hidden',
                padding: '2px 4px', boxSizing: 'border-box',
                borderBottom: i < segments.length - 1 ? '1px solid rgba(0,0,0,0.15)' : 'none'
              }}>
              {isFree && (() => {
                const lines = []
                const firstHour = Math.ceil((seg.startMin + 1) / 60) * 60
                for (let h = firstHour; h < seg.endMin; h += 60) {
                  const lineTop = ((h - seg.startMin) / (seg.endMin - seg.startMin)) * height
                  lines.push(
                    <div key={h} style={{
                      position: 'absolute', left: 0, right: 0,
                      top: lineTop, height: 1,
                      background: 'rgba(0,0,0,0.25)',
                      pointerEvents: 'none'
                    }} />
                  )
                }
                return lines
              })()}
              {!isFree && seg.booking && height >= 24 && (
                <>
                  <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                    {keyMemberIds?.has(seg.booking.user.id) && <span aria-label="С ключом" role="img">🗝️</span>}{seg.booking.user.name}
                  </div>
                  {seg.booking.participants.map(p => (
                    <div key={p.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                      {p.status === 'Invited' ? '(i) ' : ''}{keyMemberIds?.has(p.id) && <span aria-label="С ключом" role="img">🗝️</span>}{p.name}
                    </div>
                  ))}
                  {seg.booking.gameSystem && height >= 36 && (
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center', fontStyle: 'italic' }}>
                      {seg.booking.gameSystem}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
