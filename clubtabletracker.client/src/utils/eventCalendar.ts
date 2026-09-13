// Общая логика календаря ивентов — используется обоими дизайнами (grimdark и legacy), не дублируется
import { GAME_SYSTEM_COLORS } from '../constants'

export interface EventCalendarItem {
  id: number
  title: string
  startTime: string
  endTime: string
  eventType: string
  gameSystem?: string
  status?: string | null
  gameMasterName?: string | null
  maxParticipants?: number
  participants?: unknown[]
}

export const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

export const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export const NO_SYSTEM_COLOR = '#8a919c'

const FALLBACK_PALETTE = Object.values(GAME_SYSTEM_COLORS)

export function systemLabel(system?: string | null): string {
  return system?.trim() || 'Без системы'
}

export function withAlpha(hex: string, alpha: number): string {
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return hex
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Цвет системы: известной — из палитры, свободному тексту — детерминированный хэш в палитру
export function systemColor(system?: string | null): string {
  if (!system?.trim()) return NO_SYSTEM_COLOR
  const known = GAME_SYSTEM_COLORS[system]
  if (known) return known
  let h = 0
  for (let i = 0; i < system.length; i++) h = (h * 31 + system.charCodeAt(i)) >>> 0
  return FALLBACK_PALETTE[h % FALLBACK_PALETTE.length]
}

// Сетка месяца, Пн-первый (как BookingCalendar)
export function monthGrid(year: number, month: number): (Date | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayRaw = new Date(year, month, 1).getDay()
  const startOffset = (firstDayRaw + 6) % 7
  const weeks: (Date | null)[][] = []
  let day = 1
  for (let w = 0; w < 6; w++) {
    const week: (Date | null)[] = []
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d
      week.push(idx < startOffset || day > daysInMonth ? null : new Date(year, month, day++))
    }
    weeks.push(week)
    if (day > daysInMonth) break
  }
  return weeks
}

// Кампании, идущие в этот день (сравнение на уровне дат, конец включительно)
export function campaignsCoveringDay(events: EventCalendarItem[], date: Date): EventCalendarItem[] {
  return events.filter(e => {
    if (e.eventType !== 'Campaign') return false
    const s = new Date(e.startTime); s.setHours(0, 0, 0, 0)
    const en = new Date(e.endTime); en.setHours(0, 0, 0, 0)
    return s.getTime() <= date.getTime() && date.getTime() <= en.getTime()
  })
}

// Турниры и прочие не-кампании, покрывающие этот день
export function singleEventsOnDay(events: EventCalendarItem[], date: Date): EventCalendarItem[] {
  return events.filter(e => {
    if (e.eventType === 'Campaign') return false
    const s = new Date(e.startTime); s.setHours(0, 0, 0, 0)
    const en = new Date(e.endTime); en.setHours(0, 0, 0, 0)
    return s.getTime() <= date.getTime() && date.getTime() <= en.getTime()
  })
}

export function formatEventRange(startTime: string, endTime: string): string {
  const s = new Date(startTime)
  const e = new Date(endTime)
  const sameYear = s.getFullYear() === e.getFullYear()
  const sText = sameYear
    ? s.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : s.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${sText} – ${e.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export function formatEventTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function isCompleted(e: EventCalendarItem): boolean {
  return e.status === 'Completed'
}
