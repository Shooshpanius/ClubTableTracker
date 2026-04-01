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
  'Aeronautica Imperialis',
  'Middle-earth Strategy Battle Game',
  'The Old World',
]

export const GAME_SYSTEMS_BOTTOM = ['Покрас', 'Настольные игры']

export const ALL_GAME_SYSTEMS = [...GAME_SYSTEMS_MAIN, ...GAME_SYSTEMS_BOTTOM]
