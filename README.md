# ClubTableTracker

<div align="center">

[![Live](https://img.shields.io/badge/🚀%20Продакшн-go40k.ru-darkgreen?style=for-the-badge&logo=google-chrome&logoColor=white)](https://go40k.ru/)

[![GitHub Stars](https://img.shields.io/github/stars/Shooshpanius/ClubTableTracker?style=flat-square&logo=github&label=Stars&cacheSeconds=3600)](https://github.com/Shooshpanius/ClubTableTracker/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/Shooshpanius/ClubTableTracker?style=flat-square&logo=github&label=Forks&cacheSeconds=3600)](https://github.com/Shooshpanius/ClubTableTracker/forks)
[![GitHub Issues](https://img.shields.io/github/issues/Shooshpanius/ClubTableTracker?style=flat-square&logo=github&label=Issues)](https://github.com/Shooshpanius/ClubTableTracker/issues)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

![.NET](https://img.shields.io/badge/.NET_10-512BD4?style=flat-square&logo=dotnet&logoColor=white)
![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![MariaDB](https://img.shields.io/badge/MariaDB-003545?style=flat-square&logo=mariadb&logoColor=white)

</div>

**ClubTableTracker** — полнофункциональная система для управления столами и бронированием мест в настольных клубах. Включает **веб-приложение** (ASP.NET Core + React + TypeScript + Vite).

---

## Содержание

- [О проекте](#о-проекте)
- [Технологии](#технологии)
- [Структура проекта](#структура-проекта)
- [Роли пользователей](#роли-пользователей)
- [Функциональность](#функциональность)
- [Быстрый старт](#быстрый-старт)
- [Конфигурация](#конфигурация)
- [API](#api)
- [Архитектура базы данных](#архитектура-базы-данных)

---

## О проекте

ClubTableTracker решает задачу учёта столов и бронирований в настольных клубах. Система поддерживает несколько клубов, каждый из которых управляет своими столами, участниками, событиями и расписанием. Пользователи входят через Google OAuth, подают заявки на вступление в клубы, видят карту столов, бронируют время для игры, записываются на клубные события и управляют профилем.

---

## Технологии

### Бэкенд
| Технология | Описание |
|---|---|
| ASP.NET Core 10 | Веб-фреймворк |
| Entity Framework Core | ORM и работа с базой данных |
| MariaDB / MySQL | База данных |
| JWT Bearer | Аутентификация пользователей |
| OpenAPI / Swagger | Документация API (в режиме разработки) |

### Фронтенд
| Технология | Описание |
|---|---|
| React 18 | UI-библиотека |
| TypeScript | Типизированный JavaScript |
| Vite | Сборщик и dev-сервер |
| React Router | Маршрутизация |
| Google Identity Services | Вход через Google OAuth |

---

## Структура проекта

```
ClubTableTracker/
├── ClubTableTracker.Server/          # Бэкенд ASP.NET Core
│   ├── Controllers/
│   │   ├── AdminController.cs        # Управление клубами (мастер-ключ)
│   │   ├── AuthController.cs         # Аутентификация через Google OAuth
│   │   ├── BookingController.cs      # Бронирование столов
│   │   ├── CampaignMapController.cs  # Карта кампании (блоки, связи, настройки)
│   │   ├── ClubAdminController.cs    # Управление столами, участниками и событиями клуба
│   │   ├── ClubController.cs         # Список клубов, заявки на вступление, участники
│   │   ├── EventController.cs        # Запись на клубные события
│   │   ├── MessengerController.cs    # Мессенджер (чаты, сообщения, непрочитанные)
│   │   └── UserController.cs         # Профиль пользователя
│   ├── Data/
│   │   └── AppDbContext.cs            # Контекст Entity Framework
│   ├── Models/
│   │   ├── AppUser.cs                # Пользователь
│   │   ├── Booking.cs                # Бронирование
│   │   ├── BookingConstants.cs       # Константы (ReservedUserId)
│   │   ├── BookingLog.cs             # Журнал действий с бронированиями
│   │   ├── BookingParticipant.cs     # Участник бронирования
│   │   ├── CampaignMap.cs            # Карта кампании (CampaignMap / Block / BlockFaction / Link)
│   │   ├── Chat.cs                   # Чат (личный или групповой)
│   │   ├── ChatMember.cs             # Участник чата (с LastReadAt для трекинга непрочитанных)
│   │   ├── ChatMessage.cs            # Сообщение чата
│   │   ├── Club.cs                   # Клуб
│   │   ├── ClubDecoration.cs         # Декоративный элемент карты клуба
│   │   ├── ClubEvent.cs              # Событие клуба
│   │   ├── ClubMembership.cs         # Членство в клубе
│   │   ├── ClubPhoto.cs              # Фото галереи клуба
│   │   ├── EventParticipant.cs       # Участник события
│   │   ├── GameSystemConstants.cs    # Список поддерживаемых игровых систем
│   │   └── GameTable.cs              # Игровой стол
│   ├── Migrations/                   # Миграции EF Core
│   ├── appsettings.json              # Конфигурация приложения
│   └── Program.cs                    # Точка входа и настройка DI
│
├── clubtabletracker.client/          # Фронтенд React
│   ├── src/
│   │   ├── pages/
│   │   │   ├── HomePage.tsx          # Главная страница (пользователь)
│   │   │   ├── AdminPage.tsx         # Панель системного администратора
│   │   │   ├── ClubAdminPage.tsx     # Панель администратора клуба
│   │   │   ├── ClubPage.tsx          # Страница клуба (карта столов, бронирования, события)
│   │   │   ├── MessengerPage.tsx     # Мессенджер (список чатов, переписка)
│   │   │   └── SettingsPage.tsx      # Настройки профиля
│   │   ├── components/               # Переиспользуемые компоненты
│   │   │   ├── CampaignMapEditor.tsx # Редактор карты кампании (канвас, блоки, связи)
│   │   │   └── CampaignMapView.tsx   # Read-only просмотр карты кампании
│   │   ├── App.tsx                   # Корневой компонент с маршрутами
│   │   └── main.tsx                  # Точка входа React
│   ├── .env.example                  # Пример переменных окружения
│   └── vite.config.ts                # Конфигурация Vite
│
└── ClubTableTracker.slnx             # Файл решения Visual Studio
```

---

## Роли пользователей

### 1. Обычный пользователь (`/`)
- Входит через Google OAuth
- Просматривает список доступных клубов
- Подаёт заявку на вступление в клуб
- После одобрения заявки:
  - Видит карту столов своего клуба
  - Видит расписание бронирований и журнал активности клуба
  - Создаёт бронирование на конкретный стол (одиночная игра или doubles)
  - Приглашает других участников клуба в своё бронирование
  - Принимает или отклоняет входящие приглашения на бронирование
  - Присоединяется к уже существующему бронированию
  - Отменяет или покидает бронирование
  - Просматривает список участников клуба
  - Записывается на клубные события и отписывается от них
  - Управляет профилем: отображаемое имя, биография, игровые системы, цвета бронирований
  - Переписывается с другими участниками клубов через **встроенный мессенджер** (личные чаты, счётчик непрочитанных)

### 2. Администратор клуба (`/clubAdmin`)
- Входит по уникальному ключу клуба (`X-Club-Key`)
- Управляет столами клуба: создаёт, редактирует, копирует, удаляет
- Настраивает параметры каждого стола: номер, размер, поддерживаемые игры, расположение на карте, флаг «только для событий»
- Настраивает часы работы клуба
- Просматривает заявки на вступление и одобряет/отклоняет их
- Назначает участников модераторами и исключает нарушителей
- Редактирует игровые системы и город участника
- Создаёт, редактирует и удаляет клубные события
- Управляет списком участников событий: приглашает и удаляет игроков
- Для событий типа **Campaign** открывает интерактивный редактор карты кампании: создаёт блоки-территории (с влиянием фракций), расставляет и соединяет их стрелками связей

### 3. Системный администратор (`/admin`)
- Входит по мастер-ключу (`X-Master-Key`)
- Создаёт новые клубы в системе
- Просматривает все клубы и их ключи доступа
- Перегенерирует ключи клубов

---

## Функциональность

### Карта столов
Администратор клуба размещает столы на интерактивной карте, задавая координаты (X, Y) и размеры (Width, Height). Кроме столов, администратор может добавлять **декоративные элементы** (стены, окна, двери), которые помогают воссоздать реальную планировку зала. Пользователи видят эту карту и выбирают стол для бронирования.

### Бронирование
- Каждое бронирование привязано к конкретному столу, дате и времени (в пределах часов работы клуба)
- Режим **одиночной игры**: максимум **2 игрока** за столом
- Режим **doubles**: максимум **4 игрока** за столом
- Создатель бронирования может заранее пригласить участников, а также добавлять новых игроков после создания; приглашённые принимают или отклоняют приглашение
- Бронирование можно пометить как **«для других»** (`IsForOthers`): создатель бронирует место для другого игрока и сам не занимает слот
- Слот можно пометить как **«ЗАБРОНИРОВАНО»** (`__RESERVED__`) — виртуальная занятая позиция без конкретного игрока; используется при приглашении и модераторском добавлении участников
- Система автоматически проверяет конфликты расписания при создании бронирования
- Бронирование нельзя создать позднее, чем за 30 дней (исключение — участники кампаний могут бронировать в пределах срока кампании)
- Владелец или модератор клуба может перенести бронирование на другое время (`reschedule`) в пределах того же дня
- Модератор клуба может перенести бронирование на другой стол, принудительно добавить или исключить участника
- Журнал активности хранит историю действий (Booked / Joined / Left / Cancelled / MovedTable / Rescheduled) за последний месяц

### Ростеры
Каждый участник бронирования может добавить текстовый **ростер** — описание своей армии или состава. Модератор клуба вправе редактировать ростер любого участника.

### Ручные участники
Администратор клуба может добавить **ручного участника** (игрок без аккаунта Google) — указать имя и email. Такой участник включается в список членов клуба и может быть добавлен в бронирование.

### Клубные события
- Администратор клуба создаёт события (тип, игровая система, дата начала и конца, максимальное число участников, прикреплённые столы, описание)
- Поддерживаемые типы событий: **Tournament** и **Campaign** (кампания; начало и конец могут отстоять до года)
- К событию можно прикрепить до двух файлов **регламента** (.pdf, .doc, .docx, до 10 МБ) и изображение **карты миссий** (.jpg, .png, .webp, до 10 МБ)
- Пользователи видят события своего клуба и записываются на них
- Столы, помеченные флагом **EventsOnly** или прикреплённые к турнирному событию (тип ≠ Campaign), доступны для бронирования только зарегистрированным участникам этого события

### Карта кампании
Для события типа **Campaign** администратор клуба создаёт интерактивную карту кампании — набор блоков-территорий с направленными связями между ними. Каждый блок отображается в виде сетки N×M ячеек: строки соответствуют фракциям, столбцы — уровням влияния. Администратор может:
- настроить параметры карты (`maxInfluence`, список фракций) — до появления первого блока;
- добавлять, перетаскивать и удалять блоки через drag-and-drop канвас;
- задавать название блока и текущее влияние каждой фракции (ползунок 0..N);
- проводить и удалять направленные стрелки между блоками.

Участники клуба видят карту кампании в режиме **read-only**: блоки и стрелки на масштабируемом канвасе, при наведении — tooltip с названием территории и значениями влияния.

### Логотип и галерея клуба
Администратор клуба может загрузить **логотип** (jpeg, png, webp, gif, до 5 МБ) и фотографии **галереи** (до 10 фото, каждое до 5 МБ). Логотип и галерея отображаются в списке клубов и на странице клуба.

### Мессенджер
Зарегистрированные пользователи могут переписываться друг с другом через встроенный мессенджер (`/messages`):
- **Личные чаты** — начать переписку можно с любым участником клуба, в котором состоит текущий пользователь
- **Непрочитанные сообщения** — на главной странице отображается суммарный счётчик непрочитанных на кнопке 💬 (обновляется каждые 15 секунд); в самом мессенджере — синий бейдж с числом у каждого чата
- Чат автоматически помечается прочитанным при открытии; новые сообщения в уже открытом чате также сбрасывают счётчик
- Список чатов обновляется каждые 5 секунд; сообщения подгружаются также каждые 5 секунд

### Столы
Каждый стол содержит:
- **Номер** — идентификатор стола в клубе
- **Размер** — Small / Medium / Large
- **Поддерживаемые игры** — список игр, разделённых символом `|`
- **Координаты и размеры** — для отображения на карте
- **EventsOnly** — если `true`, стол доступен только во время событий клуба

### Профиль пользователя
- **Отображаемое имя** — псевдоним, отображаемый вместо имени из Google-аккаунта
- **Биография** — краткое описание (до 500 символов)
- **Игровые системы** — список систем, в которые играет пользователь; используется при инвайтах для фильтрации
- **Цвета бронирований** — настройка цветовой маркировки в расписании

### Членство в клубе
1. Пользователь подаёт заявку (`Pending`)
2. Администратор клуба одобряет (`Approved`) или отклоняет (`Rejected`) заявку
3. Только члены клуба со статусом `Approved` могут видеть столы и создавать бронирования
4. Администратор может исключить участника (`Kicked`); исключённый пользователь может повторно подать заявку
5. Администратор может добавить **ручного участника** (IsManualEntry) без привязки к аккаунту Google

---

## Быстрый старт

### Требования

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)
- Аккаунт Google Cloud (для настройки OAuth)

### Локальная разработка

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/Shooshpanius/ClubTableTracker.git
   cd ClubTableTracker
   ```

2. Установите зависимости фронтенда:
   ```bash
   cd clubtabletracker.client
   npm install
   ```

3. Настройте переменные окружения — скопируйте `.env.example` в `.env` и укажите ваш Google Client ID:
   ```bash
   cp clubtabletracker.client/.env.example clubtabletracker.client/.env
   ```
   Содержимое `.env`:
   ```
   VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```

4. Запустите приложение:
   - **Visual Studio 2022:** откройте `ClubTableTracker.slnx` и нажмите «Запустить»
   - **Вручную:**
     ```bash
     # Бэкенд
     dotnet run --project ClubTableTracker.Server

     # Фронтенд (в отдельном терминале)
     cd clubtabletracker.client && npm run dev
     ```

5. Откройте браузер:
   - Фронтенд: `https://localhost:5173`
   - API (Swagger): `https://localhost:PORT/openapi` (только в режиме разработки)

> **Важно:** После каждого `git pull`, содержащего изменения в `package.json`, необходимо заново выполнить `npm install` в директории `clubtabletracker.client`. Без этого Vite выдаст ошибки `Failed to resolve import`.

### Деплой через Docker Compose

1. Скопируйте `.env.example` в `.env` в корне проекта и заполните все значения:
   ```bash
   cp .env.example .env
   ```
   Пример заполненного `.env`:
   ```
   VITE_GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
   JWT_SECRET=my-super-secret-key-32-chars-min!!
   MASTER_KEY=my-master-key
   DB_USER=clubuser
   DB_PASSWORD=strongpassword
   DB_ROOT_PASSWORD=rootstrongpassword
   ```

2. Убедитесь, что директории для данных существуют на хосте:
   ```bash
   mkdir -p /opt/docker/data/_wh40k_club/mariadb40club
   mkdir -p /opt/docker/data/_wh40k_club/club_uploads
   ```

3. Соберите образы (один раз, или после каждого обновления кода):
   ```bash
   # Бэкенд
   docker build -t back40club:local ./ClubTableTracker.Server

   # Фронтенд — VITE_GOOGLE_CLIENT_ID здесь не нужен:
   # значение подставляется при старте контейнера, не при сборке
   docker build -t front40club:local ./clubtabletracker.client
   ```

4. Запустите стек:
   ```bash
   docker compose up -d
   ```

   Docker Compose автоматически:
   - подхватит значение `VITE_GOOGLE_CLIENT_ID` из `.env` и передаст его в контейнер `front40club` как переменную окружения;
   - скрипт запуска контейнера (`entrypoint.sh`) подставит это значение в собранные JS-файлы до старта nginx;
   - передаст секреты (`JWT_SECRET`, `MASTER_KEY`, `DB_*`) в бэкенд как переменные окружения;
   - дождётся готовности MariaDB перед запуском бэкенда (health check).

> **Почему не `--build`:** `docker-compose.yml` использует готовые образы (`image: front40club:local`), поэтому флаг `--build` не нужен. `VITE_GOOGLE_CLIENT_ID` вшивается в JS **во время запуска** контейнера (не сборки), благодаря чему одним образом можно пользоваться с любым Client ID.

> **Важно:** Значение `VITE_GOOGLE_CLIENT_ID` в `.env` должно совпадать с Client ID, для которого в Google Cloud Console добавлен `https://go40k.ru` в раздел **Authorised JavaScript origins**. Несоответствие Client ID приведёт к ошибке `origin_mismatch`.

---

## Конфигурация

### Бэкенд (`appsettings.json`)

```json
{
  "MasterKey": "masterkey123",
  "Jwt": {
    "Secret": "your-secret-key-at-least-32-characters-long!!"
  },
  "Google": {
    "ClientId": "your-google-oauth-client-id"
  },
  "ConnectionStrings": {
    "Default": "Server=localhost;Database=clubtracker;User=root;Password=your-password;"
  }
}
```

| Параметр | Описание |
|---|---|
| `MasterKey` | Ключ системного администратора. Передаётся в заголовке `X-Master-Key`. Смените перед деплоем! |
| `Jwt:Secret` | Секрет для подписи JWT-токенов. Минимум 32 символа. Смените перед деплоем! |
| `Google:ClientId` | Client ID из [Google Cloud Console](https://console.cloud.google.com/). Используется сервером для верификации подписи Google ID-токена. |
| `ConnectionStrings:Default` | Строка подключения к MySQL. Пример: `Server=localhost;Database=clubtracker;User=root;Password=your-password;` Используйте отдельного пользователя с минимальными привилегиями в продакшене. |

### Фронтенд (`.env`)

| Переменная | Описание |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Client ID из [Google Cloud Console](https://console.cloud.google.com/). Необходим для входа через Google OAuth. |
| `YANDEX_METRIKA_ID` | Номер счётчика Яндекс.Метрики (из [metrika.yandex.ru](https://metrika.yandex.ru/)). Оставьте пустым или укажите `0`, чтобы отключить счётчик. |

### Настройка Google OAuth

1. Откройте [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте проект и перейдите в **APIs & Services → Credentials**
3. Создайте **OAuth 2.0 Client ID** типа **Web application**
4. В разделе **Authorised JavaScript origins** добавьте `https://localhost:5173` (для локальной разработки) и `https://go40k.ru` (для продакшена)
5. Скопируйте Client ID и вставьте:
   - в `appsettings.json` → `Google:ClientId` (для верификации токена на сервере)
   - в `.env` → `VITE_GOOGLE_CLIENT_ID` (для кнопки входа на фронтенде)

---

## API

### Аутентификация (`/api/auth`)

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/api/auth/google` | Вход через Google OAuth (принимает Google ID token, возвращает JWT) |

### Профиль пользователя (`/api/user`)

Все запросы требуют JWT.

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/user/me` | Текущий пользователь (id, email, name, displayName, enabledGameSystems, bookingColors, bio) |
| `PUT` | `/api/user/display-name` | Изменить отображаемое имя |
| `PUT` | `/api/user/game-systems` | Обновить список игровых систем |
| `PUT` | `/api/user/booking-colors` | Обновить цвета бронирований |
| `PUT` | `/api/user/bio` | Обновить биографию (не более 500 символов) |

### Клубы (`/api/club`)

| Метод | Путь | Авторизация | Описание |
|---|---|---|---|
| `GET` | `/api/club` | — | Список всех клубов (id, name, description, openTime, closeTime, logoUrl) |
| `GET` | `/api/club/{id}/tables` | JWT (участник) | Столы клуба |
| `GET` | `/api/club/{id}/decorations` | JWT (участник) | Декорации карты клуба |
| `GET` | `/api/club/{id}/members` | JWT (участник) | Список участников клуба |
| `GET` | `/api/club/{id}/gallery` | JWT (участник) | Фотографии галереи клуба |
| `POST` | `/api/club/{id}/apply` | JWT | Подать заявку на вступление |
| `GET` | `/api/club/my-memberships` | JWT | Мои членства |

### Бронирование (`/api/booking`)

Все запросы требуют JWT.

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/booking/club/{clubId}` | Все бронирования клуба (только для участников) |
| `GET` | `/api/booking/my-upcoming` | Мои предстоящие бронирования |
| `GET` | `/api/booking/upcoming-all` | Все предстоящие бронирования во всех моих клубах |
| `GET` | `/api/booking/activity-log` | Журнал активности за последний месяц |
| `POST` | `/api/booking` | Создать бронирование |
| `POST` | `/api/booking/{id}/join` | Присоединиться к бронированию |
| `POST` | `/api/booking/{id}/accept-invite` | Принять приглашение |
| `POST` | `/api/booking/{id}/invite-player` | Пригласить игрока (владелец бронирования) |
| `POST` | `/api/booking/{id}/add-player` | Добавить игрока без приглашения (модератор клуба) |
| `PATCH` | `/api/booking/{id}/move-table` | Перенести бронирование на другой стол (модератор клуба) |
| `PATCH` | `/api/booking/{id}/reschedule` | Перенести бронирование на другое время в тот же день (владелец или модератор) |
| `PUT` | `/api/booking/{id}/roster` | Установить свой ростер (владелец или участник) |
| `PUT` | `/api/booking/{id}/player-roster` | Установить ростер игрока (модератор клуба) |
| `DELETE` | `/api/booking/{id}/decline-invite` | Отклонить приглашение |
| `DELETE` | `/api/booking/{id}/leave` | Покинуть бронирование (если участник) |
| `DELETE` | `/api/booking/{id}` | Отменить бронирование (владелец; передаёт права первому принятому участнику) |
| `DELETE` | `/api/booking/{id}/annul` | Полностью удалить бронирование со всеми участниками (владелец) |
| `DELETE` | `/api/booking/{id}/kick-player/{targetUserId}` | Исключить игрока из бронирования по userId (модератор клуба) |
| `DELETE` | `/api/booking/{id}/kick-participant/{participantId}` | Исключить участника из бронирования по participantId (модератор клуба) |

### Клубные события (`/api/event`)

Все запросы требуют JWT.

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/event/club/{clubId}` | Список событий клуба (только для участников) |
| `POST` | `/api/event/{id}/register` | Записаться на событие |
| `DELETE` | `/api/event/{id}/unregister` | Отписаться от события |

### Управление клубом (`/api/clubadmin`)

Все запросы требуют заголовка `X-Club-Key: <ключ_клуба>`.

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/clubadmin/me` | Информация о клубе по ключу |
| `PUT` | `/api/clubadmin/settings` | Изменить часы работы клуба (openTime, closeTime) |
| `POST` | `/api/clubadmin/logo` | Загрузить логотип клуба (jpeg/png/webp/gif, до 5 МБ) |
| `DELETE` | `/api/clubadmin/logo` | Удалить логотип клуба |
| `GET` | `/api/clubadmin/gallery` | Список фотографий галереи клуба |
| `POST` | `/api/clubadmin/gallery` | Добавить фото в галерею (jpeg/png/webp/gif, до 5 МБ, максимум 10 фото) |
| `DELETE` | `/api/clubadmin/gallery/{id}` | Удалить фото из галереи |
| `GET` | `/api/clubadmin/tables` | Список столов |
| `POST` | `/api/clubadmin/tables` | Создать стол |
| `PUT` | `/api/clubadmin/tables/{id}` | Обновить стол |
| `POST` | `/api/clubadmin/tables/{id}/copy` | Скопировать стол |
| `DELETE` | `/api/clubadmin/tables/{id}` | Удалить стол |
| `GET` | `/api/clubadmin/decorations` | Список декораций карты |
| `POST` | `/api/clubadmin/decorations` | Создать декорацию |
| `PUT` | `/api/clubadmin/decorations/{id}` | Обновить декорацию |
| `DELETE` | `/api/clubadmin/decorations/{id}` | Удалить декорацию |
| `GET` | `/api/clubadmin/memberships` | Заявки на вступление и список участников |
| `POST` | `/api/clubadmin/memberships/manual` | Добавить ручного участника (без аккаунта Google) |
| `PUT` | `/api/clubadmin/memberships/{id}/manual` | Обновить данные ручного участника |
| `POST` | `/api/clubadmin/memberships/{id}/approve` | Одобрить заявку |
| `POST` | `/api/clubadmin/memberships/{id}/reject` | Отклонить заявку |
| `POST` | `/api/clubadmin/memberships/{id}/set-moderator` | Назначить / снять модератора |
| `POST` | `/api/clubadmin/memberships/{id}/kick` | Исключить участника (отменяет его будущие бронирования) |
| `PUT` | `/api/clubadmin/memberships/{id}/game-systems` | Обновить игровые системы участника |
| `PUT` | `/api/clubadmin/memberships/{id}/city` | Изменить город участника |
| `GET` | `/api/clubadmin/events` | Список событий клуба |
| `POST` | `/api/clubadmin/events` | Создать событие |
| `DELETE` | `/api/clubadmin/events/{id}` | Удалить событие |
| `PUT` | `/api/clubadmin/events/{id}/title` | Изменить название события |
| `PUT` | `/api/clubadmin/events/{id}/description` | Изменить описание события (до 500 символов) |
| `PUT` | `/api/clubadmin/events/{id}/date` | Изменить дату/время события |
| `POST` | `/api/clubadmin/events/{id}/regulation` | Загрузить файл регламента (.pdf/.doc/.docx, до 10 МБ) |
| `DELETE` | `/api/clubadmin/events/{id}/regulation` | Удалить файл регламента |
| `POST` | `/api/clubadmin/events/{id}/regulation2` | Загрузить второй файл регламента (.pdf/.doc/.docx, до 10 МБ) |
| `DELETE` | `/api/clubadmin/events/{id}/regulation2` | Удалить второй файл регламента |
| `POST` | `/api/clubadmin/events/{id}/missionmap` | Загрузить карту миссий (.jpg/.png/.webp, до 10 МБ) |
| `DELETE` | `/api/clubadmin/events/{id}/missionmap` | Удалить карту миссий |
| `POST` | `/api/clubadmin/events/{id}/participants/{userId}` | Добавить участника события |
| `DELETE` | `/api/clubadmin/events/{id}/participants/{userId}` | Удалить участника события |

### Системное администрирование (`/api/admin`)

Все запросы требуют заголовка `X-Master-Key: <мастер_ключ>`.

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/admin/clubs` | Список всех клубов с ключами |
| `POST` | `/api/admin/clubs` | Создать клуб |
| `POST` | `/api/admin/clubs/{id}/regenerate-key` | Перегенерировать ключ клуба |

### Мессенджер (`/api/messenger`)

Все запросы требуют JWT.

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/messenger/chats` | Список чатов текущего пользователя (с последним сообщением и счётчиком непрочитанных) |
| `POST` | `/api/messenger/chats/direct` | Начать или получить существующий личный чат (`{ otherUserId }`) |
| `GET` | `/api/messenger/chats/{chatId}/messages` | Сообщения чата (пагинация: `?skip=0&take=50`, max take=100) |
| `POST` | `/api/messenger/chats/{chatId}/messages` | Отправить сообщение (`{ text }`) |
| `POST` | `/api/messenger/chats/{chatId}/read` | Пометить чат как прочитанный (обновляет `LastReadAt`) |

---

## Архитектура базы данных

```
AppUser
  ├── Id (string, GUID)
  ├── Email
  ├── Name                       ← имя из Google-аккаунта
  ├── DisplayName                ← отображаемый псевдоним (опционально)
  ├── GoogleId
  ├── EnabledGameSystems         ← игровые системы через '|' (опционально)
  ├── BookingColors              ← цвета бронирований (JSON, опционально)
  ├── Bio                        ← биография до 500 символов (опционально)
  └── City                       ← город (до 50 символов, опционально)

Club
  ├── Id
  ├── Name
  ├── Description
  ├── AccessKey                  ← уникальный ключ для ClubAdmin
  ├── OpenTime                   ← время открытия (формат "HH:mm")
  ├── CloseTime                  ← время закрытия (формат "HH:mm")
  ├── LogoUrl                    ← URL логотипа (опционально)
  ├── Tables[]
  ├── Memberships[]
  └── Photos[]                   ← галерея клуба

GameTable
  ├── Id
  ├── ClubId             → Club
  ├── Number             (номер стола)
  ├── Size               (Small / Medium / Large)
  ├── SupportedGames     (игры через '|')
  ├── X, Y               (позиция на карте)
  ├── Width, Height      (размеры на карте)
  ├── EventsOnly         (только для событий)
  └── Bookings[]

ClubMembership
  ├── Id
  ├── UserId             → AppUser (null для ручных участников)
  ├── ClubId             → Club
  ├── Status             (Pending / Approved / Rejected / Kicked)
  ├── IsModerator        ← может исключать игроков из бронирований
  ├── AppliedAt
  ├── IsManualEntry      ← true для участников без аккаунта Google
  ├── ManualName         ← имя ручного участника
  ├── ManualEmail        ← email ручного участника (опционально)
  ├── ManualEnabledGameSystems ← игровые системы ручного участника
  └── ManualCity         ← город ручного участника (до 50 символов, опционально)

Booking
  ├── Id
  ├── TableId            → GameTable
  ├── UserId             → AppUser
  ├── StartTime
  ├── EndTime
  ├── GameSystem         ← игровая система (опционально)
  ├── IsDoubles          ← doubles-режим (4 игрока вместо 2)
  ├── IsForOthers        ← владелец бронирует для других и не занимает слот
  ├── OwnerRoster        ← ростер владельца (опционально)
  └── Participants[]

BookingParticipant
  ├── Id
  ├── BookingId          → Booking
  ├── UserId             → AppUser (null для ручных игроков)
  ├── ManualMembershipId → ClubMembership (для ручных игроков)
  ├── ManualName         ← имя ручного игрока на момент добавления
  ├── Status             (Invited / Accepted)
  └── Roster             ← ростер участника (опционально)

BookingLog
  ├── Id
  ├── Timestamp
  ├── Action             (Booked / Joined / Left / Cancelled / MovedTable / Rescheduled)
  ├── UserId             → AppUser
  ├── BookingId          → Booking (nullable — сохраняется после удаления)
  ├── TableNumber        ← снимок номера стола
  ├── ClubId
  ├── BookingStartTime   ← снимок времени начала
  └── BookingEndTime     ← снимок времени конца

ClubEvent
  ├── Id
  ├── ClubId             → Club
  ├── Title
  ├── StartTime          ← дата и время начала
  ├── EndTime            ← дата и время конца
  ├── MaxParticipants
  ├── EventType          (Tournament / Campaign)
  ├── GameSystem         (опционально)
  ├── TableIds           ← id столов через ',' (опционально)
  ├── Description        ← описание события до 500 символов (опционально)
  ├── RegulationUrl      ← URL файла регламента (опционально)
  ├── RegulationUrl2     ← URL второго файла регламента (опционально)
  ├── MissionMapUrl      ← URL карты миссий (опционально)
  └── Participants[]

EventParticipant
  ├── Id
  ├── EventId            → ClubEvent
  └── UserId             → AppUser

ClubDecoration
  ├── Id
  ├── ClubId             → Club
  ├── Type               (wall / window / door)
  ├── X, Y               (позиция на карте)
  └── Width, Height      (размеры на карте)

ClubPhoto
  ├── Id
  ├── ClubId             → Club
  ├── Url                ← URL изображения
  └── OrderIndex         ← порядок в галерее

Chat
  ├── Id
  ├── Name               ← название (опционально, для групповых чатов)
  ├── IsGroup            ← true для групповых чатов
  ├── ClubId             → Club (опционально)
  ├── CreatedAt
  ├── Members[]          → ChatMember
  └── Messages[]         → ChatMessage

ChatMember
  ├── Id
  ├── ChatId             → Chat
  ├── UserId             → AppUser
  └── LastReadAt         ← момент последнего прочтения чата (null = никогда не читал)

ChatMessage
  ├── Id
  ├── ChatId             → Chat
  ├── SenderId           → AppUser
  ├── Text               ← текст сообщения (до 4000 символов)
  └── SentAt
```

База данных MariaDB/MySQL создаётся и обновляется автоматически при первом запуске приложения через EF Core Migrations (`db.Database.Migrate()`). Убедитесь, что MySQL/MariaDB-сервер запущен и пользователь из строки подключения имеет права на создание и изменение базы данных.
---
