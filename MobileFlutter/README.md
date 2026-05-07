# Club Table Tracker — Flutter Mobile App

Мобильное приложение для **Club Table Tracker** — системы бронирования игровых столов для варгеймерских клубов (Warhammer, Age of Sigmar и др.).

Приложение повторяет функционал мобильной веб-версии.

---

## Функциональность

### 🏠 Главная страница
- Список всех клубов с карточками (логотип, активные события, ближайшие события)
- Секция «Мои клубы» (одобренные членства) и «Все клубы»
- Статус членства: ✅ Одобрен / ⏳ На рассмотрении / ❌ Отклонён / 🚫 Исключён
- Подача заявки в клуб
- Счётчик непрочитанных сообщений с автообновлением

### 🎲 Страница клуба (4 вкладки)
- **Столы** — список столов, статус занятости, создание бронирований
- **Игры** — мои предстоящие бронирования в этом клубе
- **События** — турниры и ивенты (активные, предстоящие, прошедшие), запись/отмена записи
- **Игроки** — список участников клуба с аватаром, городом, биографией и игровыми системами

### ⚙️ Настройки профиля
- Имя для отображения (вместо Google-имени)
- Биография
- Город
- Выбор игровых систем (для приглашений в партию)

### 💬 Мессенджер
- Список чатов с непрочитанными счётчиками
- Открытие чата, просмотр сообщений
- Отправка сообщений с поддержкой ответов (long-press на сообщение → ответить)
- Автообновление каждые 10 секунд

---

## Технологии

| Компонент | Технология |
|-----------|-----------|
| UI Framework | Flutter |
| Авторизация | Google Sign-In (`google_sign_in`) |
| HTTP | `http` |
| Хранение токена | `shared_preferences` |
| Форматирование дат | `intl` |
| Кеш изображений | `cached_network_image` |

---

## Быстрый старт

### 1. Установите Flutter
```
https://docs.flutter.dev/get-started/install
```

### 2. Настройте Google Sign-In

В [Google Cloud Console](https://console.cloud.google.com/):
1. Создайте проект или используйте существующий
2. Перейдите в **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
3. Для Android:
   - Application type: **Android**
   - Package name: `com.example.club_table_tracker`
   - SHA-1 fingerprint вашего ключа подписи
4. Для iOS:
   - Application type: **iOS**
   - Bundle ID: `com.example.club_table_tracker`

### 3. Обновите конфигурацию

**Android** — в `android/app/src/main/AndroidManifest.xml` замените:
```
YOUR_CLIENT_ID → ваш реальный Client ID (без .apps.googleusercontent.com)
```

**Android `google-services.json`** — этот файл обязателен для Google Sign-In.  
Скопируйте `android/app/google-services.json.example` → `android/app/google-services.json`  
и заполните все `YOUR_*` значениями из Google Cloud Console.  
**Важно:** все вхождения `com.example.club_table_tracker` (package name) должны соответствовать  
значению `applicationId` в `android/app/build.gradle`.  
Для CI-сборки добавьте секрет `GOOGLE_SERVICES_JSON` (base64-содержимое файла):
```bash
base64 -w 0 android/app/google-services.json
# скопируйте вывод → GitHub → Settings → Secrets → Actions → GOOGLE_SERVICES_JSON
```

**iOS** — в `ios/Runner/Info.plist` замените:
```
YOUR_CLIENT_ID → ваш реальный Client ID (без .apps.googleusercontent.com)
YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com → полный Client ID
```

### 4. Настройте адрес сервера

В `lib/constants.dart` измените `apiBaseUrl`:
```dart
const String apiBaseUrl = 'https://go40k.ru'; // или ваш адрес
```

### 5. Запустите приложение

```bash
cd MobileFlutter
flutter pub get
flutter run
```

---

## Структура проекта

```
MobileFlutter/
├── pubspec.yaml                    # Зависимости проекта
├── android/                        # Конфигурация Android
├── ios/                            # Конфигурация iOS
└── lib/
    ├── main.dart                   # Точка входа, роутинг
    ├── app_colors.dart             # Цветовая схема (тёмная тема)
    ├── constants.dart              # Константы (URL, игровые системы)
    ├── models/
    │   ├── club.dart               # Модель клуба
    │   ├── membership.dart         # Модель членства
    │   ├── user.dart               # Модель пользователя
    │   ├── game_table.dart         # Модель игрового стола
    │   ├── booking.dart            # Модели бронирований
    │   ├── club_event.dart         # Модель события клуба
    │   ├── club_member.dart        # Модель участника клуба
    │   └── chat.dart               # Модели чата/сообщений
    ├── services/
    │   ├── api_service.dart        # HTTP клиент для API сервера
    │   └── auth_service.dart       # Авторизация, JWT токены
    ├── screens/
    │   ├── home_screen.dart        # Главная страница
    │   ├── club_screen.dart        # Страница клуба
    │   ├── settings_screen.dart    # Настройки профиля
    │   └── messenger_screen.dart   # Мессенджер
    └── widgets/
        ├── user_avatar.dart        # Аватар пользователя
        └── booking_dialog.dart     # Форма создания бронирования
```

---

## API

Приложение взаимодействует с тем же бэкендом, что и веб-версия:

| Метод | Путь | Описание |
|-------|------|---------|
| GET | `/api/club` | Список клубов |
| GET | `/api/club/my-memberships` | Мои членства |
| POST | `/api/club/{id}/apply` | Подать заявку |
| GET | `/api/club/{id}/tables` | Столы клуба |
| GET | `/api/club/{id}/members` | Участники клуба |
| GET | `/api/booking/club/{id}` | Бронирования клуба |
| POST | `/api/booking` | Создать бронирование |
| DELETE | `/api/booking/{id}` | Отменить бронирование |
| POST | `/api/booking/{id}/join` | Присоединиться |
| DELETE | `/api/booking/{id}/leave` | Покинуть игру |
| GET | `/api/booking/my-upcoming` | Мои предстоящие игры |
| GET | `/api/event/club/{id}` | События клуба |
| POST | `/api/event/{id}/register` | Записаться на событие |
| DELETE | `/api/event/{id}/unregister` | Отменить запись |
| GET | `/api/user/me` | Профиль пользователя |
| PUT | `/api/user/display-name` | Изменить отображаемое имя |
| PUT | `/api/user/bio` | Изменить биографию |
| PUT | `/api/user/city` | Изменить город |
| PUT | `/api/user/game-systems` | Изменить игровые системы |
| POST | `/api/auth/google` | Авторизация через Google |
| GET | `/api/messenger/chats` | Список чатов |
| GET | `/api/messenger/chats/{id}/messages` | Сообщения чата |
| POST | `/api/messenger/chats/{id}/messages` | Отправить сообщение |
| POST | `/api/messenger/chats/{id}/read` | Отметить прочитанным |
