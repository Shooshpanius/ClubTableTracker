import { useState, useEffect } from 'react'

interface GameTable { id: number; number: string; supportedGames?: string }
interface ClubMember { id: string; name: string; enabledGameSystems?: string }
interface BookingSlot { startTime: string; endTime: string; userName?: string; participants?: { name: string }[]; gameSystem?: string }

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
  members?: ClubMember[]
  tournamentGameSystem?: string
  clubName?: string
  tableBookings?: BookingSlot[]
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

function drawShareCanvas(
  table: GameTable,
  selectedDate: Date,
  clubName: string | undefined,
  tableBookings: BookingSlot[] | undefined,
  openTime: string | undefined,
  closeTime: string | undefined,
): HTMLCanvasElement {
  const W = 420
  const H = 580
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // Background
  ctx.fillStyle = '#16213e'
  ctx.fillRect(0, 0, W, H)

  // Header bar
  ctx.fillStyle = '#0f3460'
  ctx.fillRect(0, 0, W, 120)

  // Club name
  ctx.fillStyle = '#ffc107'
  ctx.font = 'bold 18px sans-serif'
  ctx.fillText(clubName || 'Клуб', 16, 32)

  // Table label
  ctx.fillStyle = '#e94560'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText(`Стол #${table.number}`, 16, 62)

  // Date
  ctx.fillStyle = '#cccccc'
  ctx.font = '14px sans-serif'
  const dateStr = selectedDate.toLocaleDateString('ru-RU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  ctx.fillText(dateStr, 16, 90)

  // Divider
  ctx.strokeStyle = '#533483'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 120)
  ctx.lineTo(W, 120)
  ctx.stroke()

  // Timeline area
  const tlLeft = 56
  const tlTop = 136
  const tlWidth = W - tlLeft - 20
  const tlHeight = 400

  const openMinutes = openTime ? parseTimeMinutes(openTime) : 0
  const closeMinutes = closeTime ? parseTimeMinutes(closeTime) : 24 * 60
  const validOpen = openMinutes >= 0 ? openMinutes : 0
  const validClose = closeMinutes >= 0 ? closeMinutes : 24 * 60
  const totalMin = Math.max(validClose - validOpen, 1)

  // Free background
  ctx.fillStyle = '#90ee90'
  ctx.fillRect(tlLeft, tlTop, tlWidth, tlHeight)

  // Booked segments
  if (tableBookings && tableBookings.length > 0) {
    for (const b of tableBookings) {
      const bs = new Date(b.startTime)
      const be = new Date(b.endTime)
      const bStartMin = Math.max(bs.getHours() * 60 + bs.getMinutes(), validOpen)
      const bEndMin = Math.min(be.getHours() * 60 + be.getMinutes(), validClose)
      if (bEndMin > bStartMin) {
        const segTop = tlTop + ((bStartMin - validOpen) / totalMin) * tlHeight
        const segH = Math.max(((bEndMin - bStartMin) / totalMin) * tlHeight, 2)
        ctx.fillStyle = '#ff8c00'
        ctx.fillRect(tlLeft, segTop, tlWidth, segH)
        if (segH >= 20) {
          ctx.fillStyle = '#ffffff'
          ctx.font = '11px sans-serif'
          const allNames = [b.userName, ...(b.participants ?? []).map(p => p.name)].filter((n): n is string => !!n)
          const nameLine = allNames.join(' + ')
          const lines: string[] = []
          if (nameLine.trim().length > 0) lines.push(nameLine)
          if (b.gameSystem) lines.push(b.gameSystem)
          const lineHeight = 14
          const totalTextH = lines.length * lineHeight
          const startY = segTop + segH / 2 - totalTextH / 2 + lineHeight - 2
          lines.forEach((line, idx) => {
            ctx.fillText(line, tlLeft + 6, startY + idx * lineHeight)
          })
        }
      }
    }
  }

  // Hour grid lines + labels
  const openHour = Math.floor(validOpen / 60)
  const closeHour = Math.ceil(validClose / 60)
  ctx.lineWidth = 1
  for (let h = openHour; h <= closeHour; h++) {
    const min = h * 60
    if (min < validOpen || min > validClose) continue
    const y = tlTop + ((min - validOpen) / totalMin) * tlHeight
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.moveTo(tlLeft, y)
    ctx.lineTo(tlLeft + tlWidth, y)
    ctx.stroke()
    ctx.fillStyle = '#888888'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${String(h).padStart(2, '0')}:00`, tlLeft - 4, y + 4)
    ctx.textAlign = 'left'
  }

  // Timeline border
  ctx.strokeStyle = '#533483'
  ctx.lineWidth = 2
  ctx.strokeRect(tlLeft, tlTop, tlWidth, tlHeight)

  // Legend
  const legendY = tlTop + tlHeight + 20
  ctx.fillStyle = '#90ee90'
  ctx.fillRect(tlLeft, legendY, 14, 10)
  ctx.fillStyle = '#cccccc'
  ctx.font = '12px sans-serif'
  ctx.fillText('Свободно', tlLeft + 18, legendY + 9)

  ctx.fillStyle = '#ff8c00'
  ctx.fillRect(tlLeft + 100, legendY, 14, 10)
  ctx.fillStyle = '#cccccc'
  ctx.fillText('Занято', tlLeft + 118, legendY + 9)

  // Footer
  ctx.fillStyle = '#555555'
  ctx.font = '11px sans-serif'
  ctx.fillText('ClubTableTracker', 16, H - 12)

  return canvas
}

export default function BookingForm({ table, token, onBooked, onCancel, selectedDate, initialStartTime = '', initialEndTime = '', openTime, closeTime, members = [], tournamentGameSystem, clubName, tableBookings }: Props) {
  const [startTime, setStartTime] = useState(() => snapTo15(extractTime(initialStartTime)))
  const [endTime, setEndTime] = useState(() => snapTo15(extractTime(initialEndTime)))
  const [gameSystem, setGameSystem] = useState(tournamentGameSystem || '')
  const [isDoubles, setIsDoubles] = useState(false)
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>(['', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const games = table.supportedGames ? table.supportedGames.split('|').filter(Boolean) : []

  const eligibleMembers = gameSystem
    ? members.filter(m => {
        if (!m.enabledGameSystems) return false
        const systems = m.enabledGameSystems.split('|').filter(Boolean)
        return systems.includes(gameSystem)
      })
    : []

  useEffect(() => {
    setInvitedUserIds(ids => ids.map(id => (!id || !eligibleMembers.some(m => m.id === id)) ? '' : id))
  }, [gameSystem])

  const setInvitedAt = (index: number, value: string) => {
    setInvitedUserIds(ids => ids.map((id, i) => i === index ? value : id))
  }

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
    const inviteSlots = isDoubles ? 3 : 1
    const ids = invitedUserIds.slice(0, inviteSlots).filter(Boolean)
    const res = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tableId: table.id, startTime: startDatetime, endTime: endDatetime, gameSystem: gameSystem || null, isDoubles, invitedUserIds: ids.length > 0 ? ids : null })
    })
    setLoading(false)
    if (res.ok) { setStartTime(''); setEndTime(''); setGameSystem(''); setIsDoubles(false); setInvitedUserIds(['', '', '']); onBooked() }
    else { const t = await res.text(); setError(t || 'Booking failed') }
  }

  const handleShare = () => {
    const canvas = drawShareCanvas(table, selectedDate, clubName, tableBookings, openTime, closeTime)
    canvas.toBlob(async (blob) => {
      if (!blob) { setError('Не удалось создать изображение для отправки'); return }
      const dateStr = selectedDate.toISOString().slice(0, 10)
      const file = new File([blob], `table-${table.number}-${dateStr}.png`, { type: 'image/png' })
      const shareData = {
        title: `${clubName || 'Клуб'} — Стол #${table.number}`,
        text: `Состояние стола #${table.number} на ${selectedDate.toLocaleDateString('ru-RU')}`,
        files: [file],
      }
      if (navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData)
          return
        } catch {
          // User cancelled or share failed, fall through to download
        }
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `table-${table.number}-${dateStr}.png`
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
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
      {(games.length > 0 || tournamentGameSystem) && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ color: '#aaa', fontSize: 13 }}>Система:</label>
          <select style={inputStyle} value={gameSystem} onChange={e => setGameSystem(e.target.value)} disabled={!!tournamentGameSystem} aria-label={tournamentGameSystem ? `Система игры турнира: ${tournamentGameSystem}` : undefined}>
            {!tournamentGameSystem && <option value="">— не выбрана —</option>}
            {tournamentGameSystem
              ? <option value={tournamentGameSystem}>{tournamentGameSystem}</option>
              : games.map(g => <option key={g} value={g}>{g}</option>)
            }
          </select>
        </div>
      )}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ color: '#aaa', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={isDoubles} onChange={e => setIsDoubles(e.target.checked)} style={{ accentColor: '#533483' }} />
          2x2 (4 игрока)
        </label>
      </div>
      {members.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Array.from({ length: isDoubles ? 3 : 1 }, (_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ color: '#aaa', fontSize: 13 }}>{isDoubles ? `Игрок ${i + 2}:` : 'Оппонент:'}</label>
              <select style={inputStyle} value={invitedUserIds[i]} onChange={e => setInvitedAt(i, e.target.value)} disabled={!gameSystem}>
                <option value="">— не выбран —</option>
                {eligibleMembers
                  .filter(m => !invitedUserIds.some((id, j) => j !== i && id === m.id))
                  .map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {!gameSystem && i === 0 && <span style={{ color: '#888', fontSize: 12 }}>Выберите систему</span>}
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={{ ...btnStyle, background: '#28a745' }} onClick={book} disabled={loading}>{loading ? 'Бронирование...' : 'В резерв'}</button>
        <button style={{ ...btnStyle, background: '#1a73e8' }} onClick={handleShare} type="button">📤 Поделиться</button>
        {onCancel && <button style={{ ...btnStyle, background: '#ffc107', color: '#222' }} onClick={onCancel}>Отмена</button>}
      </div>
      {error && <p style={{ color: '#e94560', marginTop: 8 }}>{error}</p>}
    </div>
  )
}
