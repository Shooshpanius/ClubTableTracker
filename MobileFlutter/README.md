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
- **Столы** — список столов, статус занятости, создание бронирований (одиночная игра или **2×2**, до 4 приглашённых участников)
- **Игры** — мои предстоящие бронирования в этом клубе (включая принятые приглашения)
- **События** — турниры и ивенты (активные, предстоящие, прошедшие), запись/отмена записи
- **Игроки** — список участников клуба с аватаром, городом, биографией и игровыми системами

Для каждого бронирования на вкладке Столы / Игры отображаются кнопки в зависимости от роли:
- **Отменить** — для создателя бронирования
- **Присоединиться** — если есть свободный слот (не является участником)
- **Покинуть** — если уже принятый участник
- **✓ Принять / ✗ Отклонить** — если получено приглашение (статус `Invited`)

### ⚙️ Настройки профиля
- Имя для отображения (вместо Google-имени)
- Биография
- Город
- Выбор игровых систем (для приглашений в партию)
- Цвета бронирований на расписании

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
| Push-уведомления | Firebase Cloud Messaging (`firebase_messaging`) |

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
Для CI-сборки добавьте следующие секреты в **GitHub → Settings → Secrets → Actions**:

| Секрет | Обязателен | Значение |
|--------|:----------:|---------|
| `CLIENT_SECRET_WEB` | ✅ | Содержимое файла `client_secret_*.json` из Google Cloud Console (Web-клиент OAuth 2.0) |
| `GOOGLE_SERVICES_JSON` | — | Полное содержимое `google-services.json` из Firebase Console. Если задан и содержит `project_info`, используется напрямую (рекомендуется). При наличии этого секрета `ANDROID_CLIENT_ID` и `ANDROID_SHA1` игнорируются. |
| `ANDROID_CLIENT_ID` | ⚠️ | OAuth Client ID для Android из Google Cloud Console (вида `123-xyz.apps.googleusercontent.com`). Обязателен для работы Google Sign-In на Android, если `GOOGLE_SERVICES_JSON` не задан. |
| `ANDROID_SHA1` | ⚠️ | SHA-1 отпечаток ключа подписи APK (зарегистрированный в Google Cloud Console для Android-клиента). Обязателен вместе с `ANDROID_CLIENT_ID`. |

> **Почему нужен `ANDROID_SHA1`?**  
> Google Play Services проверяет SHA-1 подпись APK при каждом входе через Google. Если SHA-1 не зарегистрирован в Google Cloud Console или отсутствует Android OAuth-клиент в `google-services.json` — вход завершится ошибкой `DEVELOPER_ERROR` (code 10).

**Как получить SHA-1:**
```bash
# Ключ отладки (для разработки)
keytool -list -v -keystore ~/.android/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android | grep 'SHA1:'

# Релизный ключ
keytool -list -v -keystore <путь-к-keystore> -alias <alias> | grep 'SHA1:'
```

**iOS** — в `ios/Runner/Info.plist` замените:
```
YOUR_CLIENT_ID → ваш реальный Client ID (без .apps.googleusercontent.com)
YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com → полный Client ID
```

### 4. Настройте Firebase (FCM push-уведомления)

Push-уведомления о новых сообщениях приходят через Firebase Cloud Messaging.  
Для работы FCM необходимо настроить Firebase-проект и передать серверный ключ бэкенду.

> **Важно:** Если не настроить FCM, приложение продолжит работать, но push-уведомления о сообщениях приходить не будут.

#### 4.1 Подготовка Firebase-проекта

1. Откройте [Firebase Console](https://console.firebase.google.com/) и выберите свой проект (или создайте новый).
2. Перейдите в **Project Settings → Service Accounts**.
3. Нажмите **Generate new private key** → **Generate Key** — скачается JSON-файл.  
   Этот файл — **секрет**. Не добавляйте его в репозиторий.
4. Перейдите в **Project Settings → General → Your apps**.
5. Добавьте Android-приложение с package name `com.example.club_table_tracker`, если оно ещё не добавлено.
6. Скачайте **`google-services.json`** из Firebase Console для этого Android-приложения.  
   Этот файл нужен при сборке APK вместо заглушки `google-services.json.example`.

#### 4.2 Настройка бэкенда

Передайте содержимое JSON-файла из шага 4.1.3 в переменную окружения `Firebase__ServiceAccountJson` на сервере.

**Для Docker Compose** — добавьте в `.env`:
```
Firebase__ServiceAccountJson={"type":"service_account","project_id":"your-project-id",...}
```
Значение — это содержимое скачанного JSON на одной строке (удалите переносы строк).  
В `docker-compose.yml` переменная автоматически попадёт в контейнер бэкенда через `environment`.

**Для GitHub Actions** (CI-деплой) — добавьте в **Settings → Secrets → Actions**:

| Секрет | Обязателен | Значение |
|--------|:----------:|---------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | ✅ (для FCM) | Содержимое JSON-файла сервисного аккаунта из Firebase Console (Project Settings → Service Accounts → Generate new private key) |
| `GOOGLE_SERVICES_JSON` | ✅ (для FCM) | Содержимое `google-services.json` из Firebase Console. Без этого файла FCM не инициализируется во Flutter и приложение не получит FCM-токен. |

> Если `GOOGLE_SERVICES_JSON` уже задан для Google Sign-In — он подходит и для FCM, отдельно добавлять не нужно.

#### 4.3 Настройте адрес сервера

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
    │   ├── auth_service.dart       # Авторизация, JWT токены
    │   └── fcm_service.dart        # FCM push-уведомления (регистрация/сброс токена)
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
| GET | `/api/booking/my-upcoming` | Мои предстоящие игры |
| GET | `/api/booking/upcoming-all` | Все предстоящие игры во всех моих клубах |
| POST | `/api/booking` | Создать бронирование |
| DELETE | `/api/booking/{id}` | Отменить бронирование |
| POST | `/api/booking/{id}/join` | Присоединиться |
| DELETE | `/api/booking/{id}/leave` | Покинуть игру |
| POST | `/api/booking/{id}/accept-invite` | Принять приглашение |
| DELETE | `/api/booking/{id}/decline-invite` | Отклонить приглашение |
| GET | `/api/event/club/{id}` | События клуба |
| POST | `/api/event/{id}/register` | Записаться на событие |
| DELETE | `/api/event/{id}/unregister` | Отменить запись |
| GET | `/api/user/me` | Профиль пользователя |
| PUT | `/api/user/display-name` | Изменить отображаемое имя |
| PUT | `/api/user/bio` | Изменить биографию |
| PUT | `/api/user/city` | Изменить город |
| PUT | `/api/user/game-systems` | Изменить игровые системы |
| PUT | `/api/user/booking-colors` | Обновить цвета бронирований |
| PUT | `/api/user/fcm-token` | Зарегистрировать / сбросить FCM токен устройства (Bearer) |
| POST | `/api/auth/google` | Авторизация через Google |
| GET | `/api/messenger/chats` | Список чатов |
| GET | `/api/messenger/chats/{id}/messages` | Сообщения чата |
| POST | `/api/messenger/chats/{id}/messages` | Отправить сообщение |
| POST | `/api/messenger/chats/{id}/read` | Отметить прочитанным |
