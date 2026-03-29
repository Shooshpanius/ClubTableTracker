interface Booking {
  id: number; tableId: number; startTime: string; endTime: string
  user: { id: string; name: string }
  participants: { id: string; name: string }[]
}
interface GameTable { id: number; number: string; size: string; supportedGames: string; x: number; y: number; width: number; height: number }

interface Props {
  table: GameTable
  bookings: Booking[]
  openTime: string
  closeTime: string
  selectedDate: Date
  onSlotClick?: (table: GameTable, startMin: number, endMin: number) => void
  isSelected?: boolean
}

const RECT_HEIGHT = 360
const RECT_WIDTH = 110

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

export default function TableTimeline({ table, bookings, openTime, closeTime, selectedDate, onSlotClick, isSelected }: Props) {
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
      <div style={{ marginBottom: 8, fontWeight: 'bold', fontSize: 13, color: isSelected ? '#e94560' : '#eee', height: 20 }}>
        Стол {table.number}
      </div>
      <div style={{
        width: RECT_WIDTH, height: RECT_HEIGHT,
        border: isSelected ? '3px solid #e94560' : '2px solid #555',
        borderRadius: 6, overflow: 'hidden', position: 'relative'
      }}>
        {segments.map((seg, i) => {
          const top = ((seg.startMin - openMin) / totalMin) * RECT_HEIGHT
          const height = Math.max(((seg.endMin - seg.startMin) / totalMin) * RECT_HEIGHT, 1)
          const isFree = seg.type === 'free'
          return (
            <div
              key={i}
              onClick={() => isFree && onSlotClick?.(table, seg.startMin, seg.endMin)}
              title={isFree ? `Свободно ${Math.floor(seg.startMin / 60)}:${String(seg.startMin % 60).padStart(2, '0')}–${Math.floor(seg.endMin / 60)}:${String(seg.endMin % 60).padStart(2, '0')}` : undefined}
              style={{
                position: 'absolute', left: 0, right: 0, top, height,
                background: isFree ? '#90ee90' : '#ffff00',
                cursor: isFree && onSlotClick ? 'pointer' : 'default',
                display: 'flex', flexDirection: 'column',
                justifyContent: 'center', alignItems: 'center',
                fontSize: 11, color: '#222', overflow: 'hidden',
                padding: '2px 4px', boxSizing: 'border-box',
                borderBottom: i < segments.length - 1 ? '1px solid rgba(0,0,0,0.15)' : 'none'
              }}>
              {!isFree && seg.booking && height >= 24 && (
                <>
                  <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                    {seg.booking.user.name}
                  </div>
                  {seg.booking.participants[0] && (
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                      {seg.booking.participants[0].name}
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
