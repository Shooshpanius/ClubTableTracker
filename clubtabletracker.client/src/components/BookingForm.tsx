import { useState } from 'react'

interface GameTable { id: number; number: string; supportedGames?: string }

interface Props {
  table: GameTable
  token: string
  onBooked: () => void
  onCancel?: () => void
  selectedDate: Date
  initialStartTime?: string
  initialEndTime?: string
  openTime?: string
  closeTime?: string
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

const MINUTES = ['00', '15', '30', '45']
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))

function parseTimeMinutes(t: string | undefined): number {
  if (!t) return -1
  const m = TIME_RE.exec(t)
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1
}

function TimeSelect({ value, onChange, style, minTime, maxTime }: { value: string; onChange: (v: string) => void; style?: React.CSSProperties; minTime?: string; maxTime?: string }) {
  const match = TIME_RE.exec(value)
  const hour = match ? match[1] : ''
  const minute = match ? (MINUTES.includes(match[2]) ? match[2] : '00') : '00'

  const minTotalMin = parseTimeMinutes(minTime)
  const maxTotalMin = parseTimeMinutes(maxTime)
  const minH = minTotalMin >= 0 ? Math.floor(minTotalMin / 60) : 0
  const minM = minTotalMin >= 0 ? minTotalMin % 60 : 0
  const maxH = maxTotalMin >= 0 ? Math.floor(maxTotalMin / 60) : 23
  const maxM = maxTotalMin >= 0 ? maxTotalMin % 60 : 59

  const validHours = HOURS.filter(h => {
    const hNum = parseInt(h, 10)
    return hNum >= minH && hNum <= maxH
  })

  const currentHourNum = hour ? parseInt(hour, 10) : null
  const validMinutes = MINUTES.filter(m => {
    if (currentHourNum === null) return true
    const mNum = parseInt(m, 10)
    if (currentHourNum === minH && mNum < minM) return false
    if (currentHourNum === maxH && mNum > maxM) return false
    return true
  })

  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <select style={style} value={hour} onChange={e => {
        const h = e.target.value
        onChange(h ? `${h}:${minute}` : '')
      }}>
        <option value="">чч</option>
        {validHours.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <select style={style} value={minute} disabled={!hour} onChange={e => {
        onChange(hour ? `${hour}:${e.target.value}` : '')
      }}>
        {validMinutes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </span>
  )
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

export default function BookingForm({ table, token, onBooked, onCancel, selectedDate, initialStartTime = '', initialEndTime = '', openTime, closeTime }: Props) {
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
    if (openTime && closeTime) {
      const openMin = parseTimeMinutes(openTime)
      const closeMin = parseTimeMinutes(closeTime)
      const startMin = parseTimeMinutes(startTime)
      const endMin = parseTimeMinutes(endTime)
      if (startMin < openMin || endMin > closeMin) {
        setError(`Время бронирования должно быть в рамках рабочего времени клуба (${openTime}–${closeTime})`)
        return
      }
    }
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <label style={{ color: '#aaa', fontSize: 13 }}>Начало:</label>
          <TimeSelect style={inputStyle} value={startTime} onChange={setStartTime} minTime={openTime} maxTime={closeTime} />
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <label style={{ color: '#aaa', fontSize: 13 }}>Конец:</label>
          <TimeSelect style={inputStyle} value={endTime} onChange={setEndTime} minTime={openTime} maxTime={closeTime} />
        </span>
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
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button style={{ ...btnStyle, background: '#28a745' }} onClick={book} disabled={loading}>{loading ? 'Бронирование...' : 'В резерв'}</button>
        {onCancel && <button style={{ ...btnStyle, background: '#ffc107', color: '#222' }} onClick={onCancel}>Отмена</button>}
      </div>
      {error && <p style={{ color: '#e94560', marginTop: 8 }}>{error}</p>}
    </div>
  )
}
