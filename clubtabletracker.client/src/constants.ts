export const MAX_BOOKING_DAYS_AHEAD = 30

export interface BookingColors {
  freeSlot: string
  eventFreeSlot: string
  myBooking: string
  othersBooking: string
}

export const DEFAULT_BOOKING_COLORS: BookingColors = {
  freeSlot: '#90ee90',
  eventFreeSlot: '#c45c5c',
  myBooking: '#ff8c00',
  othersBooking: '#ffff00',
}

export const BOOKING_COLORS_LABELS: Record<keyof BookingColors, string> = {
  freeSlot: 'Свободно',
  eventFreeSlot: 'Свободно (событие)',
  myBooking: 'Моё бронирование',
  othersBooking: 'Занято',
}

export const GAME_SYSTEMS_MAIN = [
  'Warhammer 40,000',
  'Age of Sigmar',
  'The Horus Heresy',
  'Necromunda',
  'Blood Bowl',
  'Warhammer Underworlds',
  'Kill Team',
  'Warcry',
  'Middle-earth Strategy Battle Game',
  'The Old World',
  'Bushido',
  'Battlefleet Gothic',
  'Saga',
  'Trench Crusade',
  'Battletech',
  'Mordheim',
]

export const GAME_SYSTEMS_BOTTOM = ['Покрас', 'Настольные игры']

export const ALL_GAME_SYSTEMS = [...GAME_SYSTEMS_MAIN, ...GAME_SYSTEMS_BOTTOM]

// Цвета игровых систем для календаря ивентов (различимы на тёмном фоне обоих дизайнов)
export const GAME_SYSTEM_COLORS: Record<string, string> = {
  'Warhammer 40,000': '#e04545',
  'Age of Sigmar': '#4a90d9',
  'The Horus Heresy': '#d98f2b',
  'Necromunda': '#b3ac2f',
  'Blood Bowl': '#46a35a',
  'Warhammer Underworlds': '#2fc4b0',
  'Kill Team': '#e56a9b',
  'Warcry': '#e07038',
  'Middle-earth Strategy Battle Game': '#8f6fd9',
  'The Old World': '#38a0dd',
  'Bushido': '#d4557a',
  'Battlefleet Gothic': '#7a8fe0',
  'Saga': '#c4825f',
  'Trench Crusade': '#b04ac9',
  'Battletech': '#7a9c4a',
  'Mordheim': '#cfc95a',
  'Покрас': '#b0b8c4',
  'Настольные игры': '#98a08a',
}
