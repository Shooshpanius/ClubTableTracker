/// Константы приложения

const int maxBookingDaysAhead = 30;

/// Базовый URL API сервера.
/// При развёртывании замените на реальный адрес backend'а.
const String apiBaseUrl = 'https://go40k.ru';

/// Преобразует относительный URL в абсолютный, добавляя [apiBaseUrl].
/// Абсолютные URL (начинающиеся с http:// или https://) возвращаются без изменений.
/// Пустая строка возвращается без изменений.
String resolveMediaUrl(String url) {
  if (url.isEmpty) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Все медиа-URL сервера хранятся как относительные пути вида /uploads/...
  // Убеждаемся, что путь начинается с '/', чтобы не получить невалидный URL.
  final path = url.startsWith('/') ? url : '/$url';
  return '$apiBaseUrl$path';
}

/// Web OAuth 2.0 Client ID для Google Sign-In.
/// Подставляется CI через secrets.GOOGLE_CLIENT_ID.
/// Вручную: замените на значение вида XXXXXXXX.apps.googleusercontent.com
/// из Google Cloud Console → APIs & Services → Credentials → Web client.
const String googleServerClientId = '864128408339-d7j3k1852l3ksiadpnnhbmfo3v50s8e0.apps.googleusercontent.com';

/// Основные игровые системы (отображаются первыми в настройках)
const List<String> gameSystemsMain = [
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
];

/// Дополнительные игровые системы
const List<String> gameSystemsBottom = [
  'Покрас',
  'Настольные игры',
];

/// Все игровые системы
final List<String> allGameSystems = [...gameSystemsMain, ...gameSystemsBottom];

/// Цвета бронирования по умолчанию
const Map<String, String> defaultBookingColors = {
  'freeSlot': '#90EE90',
  'eventFreeSlot': '#C45C5C',
  'myBooking': '#FF8C00',
  'othersBooking': '#FFFF00',
};

/// Метки для цветов бронирования
const Map<String, String> bookingColorLabels = {
  'freeSlot': 'Свободно',
  'eventFreeSlot': 'Свободно (событие)',
  'myBooking': 'Моё бронирование',
  'othersBooking': 'Занято',
};
