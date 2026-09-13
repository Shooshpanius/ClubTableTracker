// Общая логика календаря ивентов — используется обоими дизайнами (grimdark и legacy), не дублируется.
// Цвет = конкретное событие (детерминированно по id), а не игровая система.
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
  photos?: { id: number; url: string }[]
}

export const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

export const MONTH_NAMES_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

export const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

// Палитра событий: у каждого события свой цвет, детерминированно по id
export const EVENT_PALETTE: string[] = Object.values(GAME_SYSTEM_COLORS)

export function eventColor(id: number): string {
  const n = EVENT_PALETTE.length
  return EVENT_PALETTE[((id % n) + n) % n]
}

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

export function isCampaign(e: EventCalendarItem): boolean {
  return e.eventType.trim().toLowerCase() === 'campaign'
}

export function isCompleted(e: EventCalendarItem): boolean {
  return e.status === 'Completed'
}

function dayStart(iso: string): Date {
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  return d
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
  return events.filter(e => isCampaign(e) && coversDay(e, date))
}

// Турниры и прочие не-кампании, покрывающие этот день
export function singleEventsOnDay(events: EventCalendarItem[], date: Date): EventCalendarItem[] {
  return events.filter(e => !isCampaign(e) && coversDay(e, date))
}

function coversDay(e: EventCalendarItem, date: Date): boolean {
  return dayStart(e.startTime).getTime() <= date.getTime() &&
    date.getTime() <= dayStart(e.endTime).getTime()
}

// События, пересекающиеся с просматриваемым месяцем (для легенды), по возрастанию даты начала
export function eventsInMonth(events: EventCalendarItem[], year: number, month: number): EventCalendarItem[] {
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  return events
    .filter(e => dayStart(e.startTime) <= monthEnd && dayStart(e.endTime) >= monthStart)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
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

// «13 сен» — для легенды турниров
export function formatDayShort(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`
}
