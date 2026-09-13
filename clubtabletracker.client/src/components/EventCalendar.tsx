// Календарь ивентов клуба (grimdark). Цвет — у каждого события свой (детерминированно по id).
// Кампании — фоновые полосы (пересекающиеся делят клетку на равные полосы);
// под датой — бейджи всех событий дня (квадрат — кампания, круг — турнир);
// внизу — легенда мероприятий выбранного месяца, клик — переход к дате начала.
// Общая логика — в utils/eventCalendar (делится с legacy-версией).
import { useState } from 'react'
import {
  type EventCalendarItem, MONTH_NAMES, DAY_NAMES, monthGrid, campaignsCoveringDay,
  singleEventsOnDay, eventsInMonth, eventColor, systemLabel, withAlpha,
  formatEventRange, formatEventTime, formatDayShort, isCampaign, isCompleted,
} from '../utils/eventCalendar'

interface Props {
  events: EventCalendarItem[]
}

export default function EventCalendar({ events }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<Date | null>(null)

  const weeks = monthGrid(viewYear, viewMonth)
  const monthEvents = eventsInMonth(events, viewYear, viewMonth)

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
  // Клик по легенде: перейти к месяцу начала события и выбрать день начала
  const goToEvent = (ev: EventCalendarItem) => {
    const s = new Date(ev.startTime)
    const d = new Date(s.getFullYear(), s.getMonth(), s.getDate())
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
    setSelected(d)
  }

  const navBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--gd-fg)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }

  // Фон клетки: полосы кампаний, пересекающиеся — по равной полосе на кампанию
  const cellBackground = (day: Date): React.CSSProperties => {
    const camps = campaignsCoveringDay(events, day)
    if (camps.length === 0) return {}
    const n = camps.length
    const stops = camps.map((c, i) => {
      const alpha = isCompleted(c) ? 0.16 : 0.4
      const color = withAlpha(eventColor(c.id), alpha)
      const from = Math.round((100 * i) / n)
      const to = Math.round((100 * (i + 1)) / n)
      return `${color} ${from}%, ${color} ${to}%`
    })
    return { background: `linear-gradient(to bottom, ${stops.join(', ')})` }
  }

  // Маркер начала кампании — цветная насечка слева
  const startNotch = (day: Date): React.CSSProperties => {
    const starting = events.find(e => {
      if (!isCampaign(e)) return false
      const s = new Date(e.startTime); s.setHours(0, 0, 0, 0)
      return s.getTime() === day.getTime()
    })
    return starting ? { boxShadow: `inset 3px 0 0 0 ${eventColor(starting.id)}` } : {}
  }

  // Бейджи событий дня: кампании — квадратики, турниры — кружки
  const renderDayBadges = (day: Date) => {
    const list = [...campaignsCoveringDay(events, day), ...singleEventsOnDay(events, day)]
    if (!list.length) return null
    const shown = list.slice(0, 4)
    const rest = list.length - shown.length
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 2, flexWrap: 'wrap' }}>
        {shown.map(ev => (
          <span key={ev.id} title={ev.title} style={{
            width: 8, height: 8, flexShrink: 0,
            borderRadius: isCampaign(ev) ? 2 : '50%',
            background: eventColor(ev.id),
            opacity: isCompleted(ev) ? 0.45 : 1,
          }} />
        ))}
        {rest > 0 && <span style={{ fontSize: 9, color: 'var(--gd-fg-secondary)', lineHeight: '9px' }}>+{rest}</span>}
      </div>
    )
  }

  const cellTooltip = (day: Date): string | undefined => {
    const lines = [
      ...campaignsCoveringDay(events, day).map(c => `⚔️ ${c.title} (${formatEventRange(c.startTime, c.endTime)})`),
      ...singleEventsOnDay(events, day).map(t => `🏆 ${t.title} ${formatEventTime(t.startTime)}`),
    ]
    return lines.length ? lines.join('\n') : undefined
  }

  const selectedCampaigns = selected ? campaignsCoveringDay(events, selected) : []
  const selectedTournaments = selected ? singleEventsOnDay(events, selected) : []

  const swatchStyle = (e: EventCalendarItem): React.CSSProperties => ({
    width: 12, height: 12, borderRadius: isCampaign(e) ? 2 : '50%', flexShrink: 0,
    background: eventColor(e.id),
    opacity: isCompleted(e) ? 0.45 : 1,
  })

  const chipStyle: React.CSSProperties = {
    fontSize: 11, padding: '1px 8px', borderRadius: 999,
    background: 'var(--gd-surface-active)', color: 'var(--gd-fg-secondary)',
    border: '1px solid var(--gd-border)', whiteSpace: 'nowrap',
  }

  const detailRowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
    padding: '8px 0', borderBottom: '1px solid var(--gd-border)',
  }

  const legendItemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
    background: 'var(--gd-surface-active)', border: '1px solid var(--gd-border)',
    borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
  }

  return (
    <div style={{ background: 'var(--gd-surface)', border: '1px solid var(--gd-border)', borderRadius: 8, padding: 16, userSelect: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
        <button style={navBtn} onClick={prevMonth}>‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 'bold', fontSize: 14, color: 'var(--gd-fg)' }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button
            style={{ background: 'var(--gd-surface-active)', border: '1px solid var(--gd-border)', color: 'var(--gd-fg)', fontSize: 11, padding: '2px 10px', borderRadius: 4, cursor: 'pointer' }}
            onClick={goToday}
          >Сегодня</button>
        </div>
        <button style={navBtn} onClick={nextMonth}>›</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {DAY_NAMES.map(d => (
              <th key={d} style={{ color: 'var(--gd-fg-secondary)', fontSize: 11, padding: '2px 0', fontWeight: 'normal', textAlign: 'center' }}>{d}</th>
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
                      cursor: 'pointer', borderRadius: 4, fontSize: 13, height: 48,
                      color: isToday ? 'var(--gd-success)' : 'var(--gd-fg)',
                      fontWeight: isToday || isSelected ? 'bold' : 'normal',
                      outline: isSelected ? '2px solid var(--gd-brass)' : isToday ? '2px solid var(--gd-success)' : 'none',
                      outlineOffset: -2,
                      ...cellBackground(day),
                      ...startNotch(day),
                    }}
                  >
                    <div>{day.getDate()}</div>
                    {renderDayBadges(day)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Легенда: мероприятия выбранного месяца, клик — к дате начала */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11, color: 'var(--gd-fg-muted)', marginBottom: 2 }}>Мероприятия месяца:</div>
        {monthEvents.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--gd-fg-secondary)' }}>В этом месяце событий нет</div>
        )}
        {monthEvents.map(ev => (
          <button key={ev.id} style={legendItemStyle} onClick={() => goToEvent(ev)} title="Перейти к дате начала">
            <span style={{
              width: 12, height: 12, borderRadius: isCampaign(ev) ? 2 : '50%', flexShrink: 0,
              background: eventColor(ev.id),
              opacity: isCompleted(ev) ? 0.45 : 1,
            }} />
            <span style={{
              color: 'var(--gd-fg)', fontSize: 12, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{isCampaign(ev) ? '⚔️' : '🏆'} {ev.title}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--gd-fg-secondary)', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {isCampaign(ev)
                ? formatEventRange(ev.startTime, ev.endTime)
                : `${formatDayShort(ev.startTime)}, ${formatEventTime(ev.startTime)}`}
            </span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--gd-fg-muted)', textAlign: 'center' }}>
        Полосы — кампании, бейджи под датой — события дня; клик по легенде — к дате начала
      </div>

      {/* Панель выбранного дня */}
      {selected && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--gd-border)', paddingTop: 12, userSelect: 'text' }}>
          <div style={{ fontWeight: 'bold', fontSize: 14, color: 'var(--gd-fg)', marginBottom: 4 }}>
            {selected.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          {selectedCampaigns.length === 0 && selectedTournaments.length === 0 && (
            <p className="gd-text-muted" style={{ margin: 0 }}>В этот день событий нет</p>
          )}
          {selectedCampaigns.map(ev => (
            <div key={ev.id} style={detailRowStyle}>
              <span style={swatchStyle(ev)} />
              <span style={{ color: 'var(--gd-fg)', opacity: isCompleted(ev) ? 0.6 : 1 }}>⚔️ {ev.title}</span>
              <span style={chipStyle}>{systemLabel(ev.gameSystem)}</span>
              <span style={{ fontSize: 12, color: 'var(--gd-fg-secondary)' }}>
                кампания · {formatEventRange(ev.startTime, ev.endTime)}
                {ev.gameMasterName ? ` · ГМ: ${ev.gameMasterName}` : ''}
                {ev.participants ? ` · участников: ${ev.participants.length}` : ''}
              </span>
            </div>
          ))}
          {selectedTournaments.map(ev => (
            <div key={ev.id} style={detailRowStyle}>
              <span style={swatchStyle(ev)} />
              <span style={{ color: 'var(--gd-fg)', opacity: isCompleted(ev) ? 0.6 : 1 }}>🏆 {ev.title}</span>
              <span style={chipStyle}>{systemLabel(ev.gameSystem)}</span>
              <span style={{ fontSize: 12, color: 'var(--gd-fg-secondary)' }}>
                {formatEventTime(ev.startTime)}–{formatEventTime(ev.endTime)}
                {ev.maxParticipants ? ` · участников: ${(ev.participants ?? []).length}/${ev.maxParticipants}` : ''}
                {ev.gameMasterName ? ` · ГМ: ${ev.gameMasterName}` : ''}
              </span>
            </div>
          ))}
          {(selectedCampaigns.length > 0 || selectedTournaments.length > 0) && (
            <p className="gd-text-muted" style={{ margin: '8px 0 0 0', fontSize: 11 }}>
              Регистрация — во вкладке «События»
            </p>
          )}
        </div>
      )}
    </div>
  )
}
