# ClubTableTracker

**ClubTableTracker** — полнофункциональное веб-приложение для управления столами и бронированием мест в настольных клубах. Построено на **ASP.NET Core** (бэкенд) и **React + TypeScript + Vite** (фронтенд).

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

ClubTableTracker решает задачу учёта столов и бронирований в настольных клубах. Система поддерживает несколько клубов, каждый из которых управляет своими столами, участниками и расписанием. Пользователи входят через Google OAuth, подают заявки на вступление в клубы, видят карту столов и бронируют время для игры.

---

## Технологии

### Бэкенд
| Технология | Описание |
|---|---|
| ASP.NET Core 8 | Веб-фреймворк |
| Entity Framework Core | ORM и работа с базой данных |
| SQLite | База данных (файл `clubtracker.db`) |
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
│   │   ├── ClubAdminController.cs    # Управление столами и участниками клуба
│   │   └── ClubController.cs         # Список клубов, заявки на вступление
│   ├── Data/
│   │   └── AppDbContext.cs            # Контекст Entity Framework
│   ├── Models/
│   │   ├── AppUser.cs                # Пользователь
│   │   ├── Booking.cs                # Бронирование
│   │   ├── BookingParticipant.cs     # Участник бронирования
│   │   ├── Club.cs                   # Клуб
│   │   ├── ClubMembership.cs         # Членство в клубе
│   │   └── GameTable.cs              # Игровой стол
│   ├── appsettings.json              # Конфигурация приложения
│   └── Program.cs                    # Точка входа и настройка DI
│
├── clubtabletracker.client/          # Фронтенд React
│   ├── src/
│   │   ├── pages/
│   │   │   ├── HomePage.tsx          # Главная страница (пользователь)
│   │   │   ├── AdminPage.tsx         # Панель системного администратора
│   │   │   └── ClubAdminPage.tsx     # Панель администратора клуба
│   │   ├── components/               # Переиспользуемые компоненты
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
  - Видит расписание бронирований
  - Создаёт бронирование на конкретный стол
  - Присоединяется к уже существующему бронированию
  - Отменяет своё бронирование

### 2. Администратор клуба (`/clubAdmin`)
- Входит по уникальному ключу клуба (`X-Club-Key`)
- Управляет столами клуба: создаёт, редактирует, копирует, удаляет
- Настраивает параметры каждого стола: номер, размер, поддерживаемые игры, расположение на карте
- Просматривает заявки на вступление и одобряет/отклоняет их

### 3. Системный администратор (`/admin`)
- Входит по мастер-ключу (`X-Master-Key`)
- Создаёт новые клубы в системе
- Просматривает все клубы и их ключи доступа
- Перегенерирует ключи клубов

---

## Функциональность

### Карта столов
Администратор клуба размещает столы на интерактивной карте, задавая координаты (X, Y) и размеры (Width, Height). Пользователи видят эту карту и выбирают стол для бронирования.

### Бронирование
- Каждое бронирование привязано к конкретному столу, дате и времени
- Максимум **2 игрока** одновременно за одним столом
- Пользователь может создать бронирование или присоединиться к существующему (если есть свободное место)
- Система автоматически проверяет конфликты расписания при создании бронирования

### Столы
Каждый стол содержит:
- **Номер** — идентификатор стола в клубе
- **Размер** — Small / Medium / Large
- **Поддерживаемые игры** — список игр, разделённых символом `|`
- **Координаты и размеры** — для отображения на карте

### Членство в клубе
1. Пользователь подаёт заявку (`Pending`)
2. Администратор клуба одобряет (`Approved`) или отклоняет (`Rejected`) заявку
3. Только члены клуба со статусом `Approved` могут видеть столы и создавать бронирования

---

## Быстрый старт

### Требования

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)
- Аккаунт Google Cloud (для настройки OAuth)

### Установка

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

### Настройка Google OAuth

1. Откройте [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте проект и перейдите в **APIs & Services → Credentials**
3. Создайте **OAuth 2.0 Client ID** типа **Web application**
4. В разделе **Authorised JavaScript origins** добавьте `https://localhost:5173` (для локальной разработки) и `https://club.wh40kcards.ru` (для продакшена)
5. Скопируйте Client ID и вставьте:
   - в `appsettings.json` → `Google:ClientId` (для верификации токена на сервере)
   - в `.env` → `VITE_GOOGLE_CLIENT_ID` (для кнопки входа на фронтенде)

---

## API

### Аутентификация (`/api/auth`)

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/api/auth/google` | Вход через Google OAuth (принимает Google ID token, возвращает JWT) |

### Клубы (`/api/club`)

| Метод | Путь | Авторизация | Описание |
|---|---|---|---|
| `GET` | `/api/club` | — | Список всех клубов |
| `GET` | `/api/club/{id}/tables` | JWT (участник) | Столы клуба |
| `POST` | `/api/club/{id}/apply` | JWT | Подать заявку на вступление |
| `GET` | `/api/club/my-memberships` | JWT | Мои членства |

### Бронирование (`/api/booking`)

| Метод | Путь | Авторизация | Описание |
|---|---|---|---|
| `GET` | `/api/booking/club/{clubId}` | JWT (участник) | Все бронирования клуба |
| `POST` | `/api/booking` | JWT | Создать бронирование |
| `POST` | `/api/booking/{id}/join` | JWT | Присоединиться к бронированию |
| `DELETE` | `/api/booking/{id}` | JWT (владелец) | Отменить бронирование |

### Управление клубом (`/api/clubadmin`)

Все запросы требуют заголовка `X-Club-Key: <ключ_клуба>`.

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/clubadmin/me` | Информация о клубе по ключу |
| `GET` | `/api/clubadmin/tables` | Список столов |
| `POST` | `/api/clubadmin/tables` | Создать стол |
| `PUT` | `/api/clubadmin/tables/{id}` | Обновить стол |
| `POST` | `/api/clubadmin/tables/{id}/copy` | Скопировать стол |
| `DELETE` | `/api/clubadmin/tables/{id}` | Удалить стол |
| `GET` | `/api/clubadmin/memberships` | Заявки на вступление |
| `POST` | `/api/clubadmin/memberships/{id}/approve` | Одобрить заявку |
| `POST` | `/api/clubadmin/memberships/{id}/reject` | Отклонить заявку |

### Системное администрирование (`/api/admin`)

Все запросы требуют заголовка `X-Master-Key: <мастер_ключ>`.

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/admin/clubs` | Список всех клубов с ключами |
| `POST` | `/api/admin/clubs` | Создать клуб |
| `POST` | `/api/admin/clubs/{id}/regenerate-key` | Перегенерировать ключ клуба |

---

## Архитектура базы данных

```
AppUser
  ├── Id (string, GUID)
  ├── Email
  ├── Name
  └── GoogleId

Club
  ├── Id
  ├── Name
  ├── Description
  ├── AccessKey          ← уникальный ключ для ClubAdmin
  ├── Tables[]
  └── Memberships[]

GameTable
  ├── Id
  ├── ClubId             → Club
  ├── Number             (номер стола)
  ├── Size               (Small / Medium / Large)
  ├── SupportedGames     (игры через '|')
  ├── X, Y               (позиция на карте)
  ├── Width, Height      (размеры на карте)
  └── Bookings[]

ClubMembership
  ├── Id
  ├── UserId             → AppUser
  ├── ClubId             → Club
  ├── Status             (Pending / Approved / Rejected)
  └── AppliedAt

Booking
  ├── Id
  ├── TableId            → GameTable
  ├── UserId             → AppUser
  ├── StartTime
  ├── EndTime
  └── Participants[]

BookingParticipant
  ├── Id
  ├── BookingId          → Booking
  └── UserId             → AppUser
```

База данных MySQL создаётся автоматически при первом запуске приложения (`db.Database.EnsureCreated()`). Убедитесь, что MySQL-сервер запущен и пользователь из строки подключения имеет права на создание базы данных.