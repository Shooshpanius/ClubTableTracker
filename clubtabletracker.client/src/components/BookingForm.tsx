import { useState } from 'react'

interface GameTable { id: number; number: string }

interface Props {
  table: GameTable
  token: string
  onBooked: () => void
}

export default function BookingForm({ table, token, onBooked }: Props) {
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const book = async () => {
    if (!startTime || !endTime) { setError('Please select start and end times'); return }
    if (new Date(startTime) >= new Date(endTime)) { setError('End time must be after start time'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tableId: table.id, startTime, endTime })
    })
    setLoading(false)
    if (res.ok) { setStartTime(''); setEndTime(''); onBooked() }
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
        <label style={{ color: '#aaa', fontSize: 13 }}>Start:</label>
        <input style={inputStyle} type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} />
        <label style={{ color: '#aaa', fontSize: 13 }}>End:</label>
        <input style={inputStyle} type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} />
        <button style={btnStyle} onClick={book} disabled={loading}>{loading ? 'Booking...' : 'Book'}</button>
      </div>
      {error && <p style={{ color: '#e94560', marginTop: 8 }}>{error}</p>}
    </div>
  )
}
