import { useState } from 'react'

interface GameTable { id: number; number: string; supportedGames?: string }

interface Props {
  table: GameTable
  token: string
  onBooked: () => void
  selectedDate: Date
  initialStartTime?: string
  initialEndTime?: string
}

function extractTime(datetimeOrTime: string): string {
  if (!datetimeOrTime) return ''
  const tIndex = datetimeOrTime.indexOf('T')
  return tIndex >= 0 ? datetimeOrTime.slice(tIndex + 1, tIndex + 6) : datetimeOrTime.slice(0, 5)
}

const TIME_RE = /^(\d{2}):(\d{2})$/

function snapTo15(time: string): string {
  const match = TIME_RE.exec(time)
  if (!match) return time
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const snapped = Math.floor(m / 15) * 15
  return `${String(h).padStart(2, '0')}:${String(snapped).padStart(2, '0')}`
}

function buildDatetime(date: Date, time: string): string | null {
  const match = TIME_RE.exec(time)
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${mins}`
}

export default function BookingForm({ table, token, onBooked, selectedDate, initialStartTime = '', initialEndTime = '' }: Props) {
  const [startTime, setStartTime] = useState(() => snapTo15(extractTime(initialStartTime)))
  const [endTime, setEndTime] = useState(() => snapTo15(extractTime(initialEndTime)))
  const [gameSystem, setGameSystem] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const games = table.supportedGames ? table.supportedGames.split('|').filter(Boolean) : []

  const book = async () => {
    if (!startTime || !endTime) { setError('Выберите время начала и окончания'); return }
    const startDatetime = buildDatetime(selectedDate, startTime)
    const endDatetime = buildDatetime(selectedDate, endTime)
    if (!startDatetime || !endDatetime) { setError('Некорректный формат времени'); return }
    const startMinutes = parseInt(TIME_RE.exec(startTime)?.[2] ?? '0', 10)
    const endMinutes = parseInt(TIME_RE.exec(endTime)?.[2] ?? '0', 10)
    if (startMinutes % 15 !== 0 || endMinutes % 15 !== 0) { setError('Минуты должны быть кратны 15 (00, 15, 30, 45)'); return }
    if (new Date(startDatetime) >= new Date(endDatetime)) { setError('Время окончания должно быть позже времени начала'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tableId: table.id, startTime: startDatetime, endTime: endDatetime, gameSystem: gameSystem || null })
    })
    setLoading(false)
    if (res.ok) { setStartTime(''); setEndTime(''); setGameSystem(''); onBooked() }
    else { const t = await res.text(); setError(t || 'Booking failed') }
  }

  const inputStyle: React.CSSProperties = {
    background: '#0f3460', border: '1px solid #533483', color: '#eee',
    padding: '8px 12px', borderRadius: 4, marginRight: 8
  }
  const btnStyle: React.CSSProperties = {
    background: '#533483', color: '#fff', border: 'none',
    padding: '8px 16px', borderRadius: 4, cursor: 'pointer'
  }

  return (
    <div>
      <h4>Book Table #{table.number}</h4>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <label style={{ color: '#aaa', fontSize: 13 }}>Начало:</label>
        <input style={inputStyle} type="time" step={900} value={startTime} onChange={e => setStartTime(snapTo15(e.target.value))} />
        <label style={{ color: '#aaa', fontSize: 13 }}>Конец:</label>
        <input style={inputStyle} type="time" step={900} value={endTime} onChange={e => setEndTime(snapTo15(e.target.value))} />
      </div>
      {games.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ color: '#aaa', fontSize: 13 }}>Система:</label>
          <select style={inputStyle} value={gameSystem} onChange={e => setGameSystem(e.target.value)}>
            <option value="">— не выбрана —</option>
            {games.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <button style={btnStyle} onClick={book} disabled={loading}>{loading ? 'Booking...' : 'Book'}</button>
      </div>
      {error && <p style={{ color: '#e94560', marginTop: 8 }}>{error}</p>}
    </div>
  )
}
