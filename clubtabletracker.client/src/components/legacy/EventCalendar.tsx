// Календарь ивентов клуба (legacy-дизайн): кампании — фоновые полосы цвета системы,
// пересекающиеся кампании делят клетку на равные полосы; турниры — точки цвета системы.
// Общая логика — в utils/eventCalendar (делится с grimdark-версией).
import { useMemo, useState } from 'react'
import {
  type EventCalendarItem, MONTH_NAMES, DAY_NAMES, monthGrid, campaignsCoveringDay,
  singleEventsOnDay, systemColor, systemLabel, withAlpha, formatEventRange,
  formatEventTime, isCompleted, NO_SYSTEM_COLOR,
} from '../../utils/eventCalendar'

interface Props {
  events: EventCalendarItem[]
}

const SYSTEM_LABEL = 'Без системы'

export default function EventCalendar({ events }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<Date | null>(null)
  const [hiddenSystems, setHiddenSystems] = useState<Set<string>>(new Set())

  const toggleSystem = (label: string) => setHiddenSystems(prev => {
    const next = new Set(prev)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    return next
  })

  const visibleEvents = useMemo(
    () => events.filter(e => !hiddenSystems.has(systemLabel(e.gameSystem))),
    [events, hiddenSystems]
  )

  // Легенда: системы, встречающиеся в событиях клуба, с количеством событий
  const legend = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of events) {
      const l = systemLabel(e.gameSystem)
      counts.set(l, (counts.get(l) ?? 0) + 1)
    }
    return [...counts.entries()]
  }, [events])

  const weeks = monthGrid(viewYear, viewMonth)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }
  const goToday = () => {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
  }

  const navBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#eee', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }

  // Фон клетки: полосы кампаний, пересекающиеся — по равной полосе на кампанию
  const cellBackground = (day: Date): React.CSSProperties => {
    const camps = campaignsCoveringDay(visibleEvents, day)
    if (camps.length === 0) return {}
    const n = camps.length
    const stops = camps.map((c, i) => {
      const alpha = isCompleted(c) ? 0.16 : 0.4
      const color = withAlpha(systemColor(c.gameSystem), alpha)
      const from = Math.round((100 * i) / n)
      const to = Math.round((100 * (i + 1)) / n)
      return `${color} ${from}%, ${color} ${to}%`
    })
    return { background: `linear-gradient(to bottom, ${stops.join(', ')})` }
  }

  // Маркер начала кампании — цветная насечка слева
  const startNotch = (day: Date): React.CSSProperties => {
    const starting = visibleEvents.find(e => {
      if (e.eventType !== 'Campaign') return false
      const s = new Date(e.startTime); s.setHours(0, 0, 0, 0)
      return s.getTime() === day.getTime()
    })
    return starting ? { boxShadow: `inset 3px 0 0 0 ${systemColor(starting.gameSystem)}` } : {}
  }

  const cellTooltip = (day: Date): string | undefined => {
    const lines = [
      ...campaignsCoveringDay(visibleEvents, day).map(c => `⚔️ ${c.title} (${formatEventRange(c.startTime, c.endTime)})`),
      ...singleEventsOnDay(visibleEvents, day).map(t => `🏆 ${t.title} ${formatEventTime(t.startTime)}`),
    ]
    return lines.length ? lines.join('\n') : undefined
  }

  const renderTournamentDots = (day: Date) => {
    const list = singleEventsOnDay(visibleEvents, day)
    if (!list.length) return null
    const shown = list.slice(0, 3)
    const rest = list.length - shown.length
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
        {shown.map(ev => (
          <span key={ev.id} title={`${ev.title} · ${systemLabel(ev.gameSystem)}`} style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: systemColor(ev.gameSystem),
            opacity: isCompleted(ev) ? 0.45 : 1,
          }} />
        ))}
        {rest > 0 && <span style={{ fontSize: 9, color: '#aaa', lineHeight: '7px' }}>+{rest}</span>}
      </div>
    )
  }

  const selectedCampaigns = selected ? campaignsCoveringDay(visibleEvents, selected) : []
  const selectedTournaments = selected ? singleEventsOnDay(visibleEvents, selected) : []

  const swatchStyle = (e: EventCalendarItem): React.CSSProperties => ({
    width: 12, height: 12, borderRadius: 3, flexShrink: 0,
    background: systemColor(e.gameSystem),
    opacity: isCompleted(e) ? 0.45 : 1,
  })

  const chipStyle: React.CSSProperties = {
    fontSize: 11, padding: '1px 8px', borderRadius: 999,
    background: '#0f3460', color: '#eee',
    border: '1px solid #0f3460', whiteSpace: 'nowrap',
  }

  const detailRowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
    padding: '8px 0', borderBottom: '1px solid #0f3460',
  }

  return (
    <div style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: 16, userSelect: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
        <button style={navBtn} onClick={prevMonth}>‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 'bold', fontSize: 14, color: '#eee' }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button
            style={{ background: '#0f3460', border: '1px solid #0f3460', color: '#eee', fontSize: 11, padding: '2px 10px', borderRadius: 4, cursor: 'pointer' }}
            onClick={goToday}
          >Сегодня</button>
        </div>
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
              {week.map((day, di) => {
                if (!day) return <td key={di} />
                const isToday = day.getTime() === today.getTime()
                const isSelected = selected?.getTime() === day.getTime()
                return (
                  <td
                    key={di}
                    onClick={() => setSelected(day)}
                    title={cellTooltip(day)}
                    style={{
                      padding: '3px 2px 4px', textAlign: 'center', verticalAlign: 'top',
                      cursor: 'pointer', borderRadius: 4, fontSize: 13, height: 44,
                      color: isToday ? '#4caf50' : '#eee',
                      fontWeight: isToday || isSelected ? 'bold' : 'normal',
                      outline: isSelected ? '2px solid #e94560' : isToday ? '2px solid #4caf50' : 'none',
                      outlineOffset: -2,
                      ...cellBackground(day),
                      ...startNotch(day),
                    }}
                  >
                    <div>{day.getDate()}</div>
                    {renderTournamentDots(day)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Легенда: клик по чипу скрывает/показывает систему */}
      {legend.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {legend.map(([label, count]) => {
            const off = hiddenSystems.has(label)
            return (
              <button
                key={label}
                onClick={() => toggleSystem(label)}
                title={off ? 'Показать события этой системы' : 'Скрыть события этой системы'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#0f3460',
                  border: `1px solid ${off ? '#0f3460' : '#c0a060'}`,
                  color: '#eee', borderRadius: 999, padding: '2px 10px',
                  fontSize: 11, cursor: 'pointer', opacity: off ? 0.45 : 1,
                }}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                  background: label === SYSTEM_LABEL ? NO_SYSTEM_COLOR : systemColor(label),
                }} />
                {label} · {count}
              </button>
            )
          })}
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 11, color: '#666', textAlign: 'center' }}>
        Полосы — кампании, точки — турниры; клик по чипу легенды фильтрует систему
      </div>

      {/* Панель выбранного дня */}
      {selected && (
        <div style={{ marginTop: 12, borderTop: '1px solid #0f3460', paddingTop: 12, userSelect: 'text' }}>
          <div style={{ fontWeight: 'bold', fontSize: 14, color: '#eee', marginBottom: 4 }}>
            {selected.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          {selectedCampaigns.length === 0 && selectedTournaments.length === 0 && (
            <p style={{ color: '#aaa', margin: 0 }}>В этот день событий нет</p>
          )}
          {selectedCampaigns.map(ev => (
            <div key={ev.id} style={detailRowStyle}>
              <span style={swatchStyle(ev)} />
              <span style={{ color: '#eee', opacity: isCompleted(ev) ? 0.6 : 1 }}>⚔️ {ev.title}</span>
              <span style={chipStyle}>{systemLabel(ev.gameSystem)}</span>
              <span style={{ fontSize: 12, color: '#aaa' }}>
                кампания · {formatEventRange(ev.startTime, ev.endTime)}
                {ev.gameMasterName ? ` · ГМ: ${ev.gameMasterName}` : ''}
                {ev.participants ? ` · участников: ${ev.participants.length}` : ''}
              </span>
            </div>
          ))}
          {selectedTournaments.map(ev => (
            <div key={ev.id} style={detailRowStyle}>
              <span style={swatchStyle(ev)} />
              <span style={{ color: '#eee', opacity: isCompleted(ev) ? 0.6 : 1 }}>🏆 {ev.title}</span>
              <span style={chipStyle}>{systemLabel(ev.gameSystem)}</span>
              <span style={{ fontSize: 12, color: '#aaa' }}>
                {formatEventTime(ev.startTime)}–{formatEventTime(ev.endTime)}
                {ev.maxParticipants ? ` · участников: ${(ev.participants ?? []).length}/${ev.maxParticipants}` : ''}
                {ev.gameMasterName ? ` · ГМ: ${ev.gameMasterName}` : ''}
              </span>
            </div>
          ))}
          {(selectedCampaigns.length > 0 || selectedTournaments.length > 0) && (
            <p style={{ color: '#666', margin: '8px 0 0 0', fontSize: 11 }}>
              Регистрация — во вкладке «События»
            </p>
          )}
        </div>
      )}
    </div>
  )
}
