import { useState } from 'react'
import { MAX_BOOKING_DAYS_AHEAD } from '../constants'

interface Booking {
  startTime: string
}

interface Props {
  bookings: Booking[]
  selectedDate: Date
  onSelectDate: (date: Date) => void
  maxCampaignDate?: Date | null
}

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export default function BookingCalendar({ bookings, selectedDate, onSelectDate, maxCampaignDate }: Props) {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth())

  const datesWithBookings = new Set(
    bookings.map(b => {
      const d = new Date(b.startTime)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  )

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayRaw = new Date(viewYear, viewMonth, 1).getDay()
  const startOffset = (firstDayRaw + 6) % 7  // Monday-first

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date(today)
  maxDate.setDate(maxDate.getDate() + MAX_BOOKING_DAYS_AHEAD)

  // Участники кампании могут переходить к датам в пределах срока кампании
  const effectiveMaxDate = (maxCampaignDate && maxCampaignDate > maxDate) ? maxCampaignDate : maxDate

  const weeks: (number | null)[][] = []
  let day = 1
  for (let w = 0; w < 6; w++) {
    const week: (number | null)[] = []
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d
      week.push(idx < startOffset || day > daysInMonth ? null : day++)
    }
    weeks.push(week)
    if (day > daysInMonth) break
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const navBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#eee', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }

  return (
    <div style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: 16, userSelect: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button style={navBtn} onClick={prevMonth}>‹</button>
        <span style={{ fontWeight: 'bold', fontSize: 14 }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button style={navBtn} onClick={nextMonth}>›</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {DAY_NAMES.map(d => (
              <th key={d} style={{ color: '#aaa', fontSize: 11, padding: '2px 0', fontWeight: 'normal', textAlign: 'center' }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((dayNum, di) => {
                if (!dayNum) return <td key={di} />
                const cellDate = new Date(viewYear, viewMonth, dayNum)
                cellDate.setHours(0, 0, 0, 0)
                const isPast = cellDate < today
                const isBeyondMax = cellDate > effectiveMaxDate
                const isDisabled = isBeyondMax
                const isCampaignDate = maxCampaignDate != null && cellDate > maxDate && !isBeyondMax
                const dateKey = `${viewYear}-${viewMonth}-${dayNum}`
                const isSelected = selectedDate.getFullYear() === viewYear && selectedDate.getMonth() === viewMonth && selectedDate.getDate() === dayNum
                const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === dayNum
                const hasBookings = datesWithBookings.has(dateKey)
                return (
                  <td
                    key={di}
                    onClick={() => !isDisabled && onSelectDate(new Date(viewYear, viewMonth, dayNum))}
                    title={isBeyondMax ? `Бронирование доступно не более чем на ${MAX_BOOKING_DAYS_AHEAD} дней вперёд` : isPast ? 'Только просмотр (прошедшая дата)' : isCampaignDate ? 'Дата кампании' : undefined}
                    style={{
                      padding: '4px 2px', textAlign: 'center',
                      cursor: isDisabled ? 'default' : 'pointer',
                      borderRadius: 4, fontSize: 13,
                      background: isSelected ? '#e94560' : hasBookings ? '#ffc107' : 'transparent',
                      color: isDisabled ? '#444' : isSelected ? '#fff' : hasBookings ? '#222' : isToday ? '#4caf50' : isPast ? '#666' : isCampaignDate ? '#ffc107' : '#eee',
                      fontWeight: isToday || isSelected ? 'bold' : 'normal',
                      outline: isToday && !isSelected ? '2px solid #4caf50' : isCampaignDate && !isSelected ? '1px solid #ffc107' : 'none',
                      outlineOffset: '-2px',
                      opacity: isDisabled ? 0.4 : isPast ? 0.6 : 1,
                      textDecoration: 'none'
                    }}
                  >
                    {dayNum}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 11, color: '#666', textAlign: 'center' }}>
        Бронирование доступно на {MAX_BOOKING_DAYS_AHEAD} дней вперёд
        {maxCampaignDate && maxCampaignDate > maxDate && ' · кампании — до конца срока'}
      </div>
    </div>
  )
}
