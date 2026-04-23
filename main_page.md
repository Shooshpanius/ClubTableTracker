
# main_page.md — Редизайн главной страницы (TODO для агентов)

> Этот файл содержит пошаговые инструкции для агентов, выполняющих рефакторинг главной страницы в несколько сессий.
> Каждый шаг оформлен как самостоятельная задача. После завершения шага агент должен отметить его как выполненный и запушить.

---

## Контекст проекта

- **Репозиторий:** `/home/runner/work/ClubTableTracker/ClubTableTracker`
- **Целевые файлы (фронтенд):** `clubtabletracker.client/src/`
- **Ветка:** `copilot/structure-main-page`
- **Команда проверки lint:** `cd clubtabletracker.client && npm run lint`
- **Команда тестов backend:** `dotnet test ClubTableTracker.slnx` (из корня репозитория)

### Текущее состояние

`HomePage.tsx` (~2347 строк) выполняет сразу две роли:
1. Показывает список клубов в виде аккордеона.
2. При раскрытии аккордеона — показывает полную панель управления клубом (столы, бронирования, события, игроки, карта, галерея, модальные окна).

**Цель:** разделить эти роли: HomePage — только список клубов-карточек, ClubPage — детальная страница клуба по маршруту `/club/:clubId`.

---

## Шаг 1 — Вынести хук useIsMobile в отдельный файл

**Статус:** [ ] не выполнено

### Задача

В `HomePage.tsx` (строки 17–25) определён локальный хук:
```tsx
function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return isMobile
}
```

### Инструкции

1. Создать файл `clubtabletracker.client/src/utils/useIsMobile.ts` с содержимым:
```ts
import { useState, useEffect } from 'react'

export default function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return isMobile
}
```

2. В `HomePage.tsx` заменить строки 17–25 (определение `useIsMobile`) на импорт:
```tsx
import useIsMobile from '../utils/useIsMobile'
```

3. Запустить `npm run lint` из `clubtabletracker.client/`. Убедиться — 0 ошибок.
4. Закоммитить и запушить.

---

## Шаг 2 — Создать ClubPage.tsx

**Статус:** [ ] не выполнено  
**Зависит от:** Шаг 1 выполнен (useIsMobile уже в utils/useIsMobile.ts)

### Задача

Создать новую страницу `clubtabletracker.client/src/pages/ClubPage.tsx`.  
Она получает `clubId` из URL-параметра, загружает данные клуба и рендерит весь контент, который сейчас находится в аккордеоне `HomePage.tsx`.

### Точные ссылки на исходный код

Из `HomePage.tsx` нужно перенести:

| Что | Строки в HomePage.tsx |
|---|---|
| Интерфейсы (User, Club, Membership, GameTable, BookingParticipant, BookingBase, Booking, UpcomingBooking, ActivityLogEntry, ClubMember, ClubEventItem, PlayerRosterInfo, ClubDecoration) | 28–42 |
| Вспомогательные функции (parseHHMM, isBookingPast, getLocalMinutes, isSameLocalDay, toDatetimeLocal, formatDate) | 44–80 |
| Константы (MAX_BOOKING_PLAYERS, PAST_DATE_HINT, LOG_ACTION_LABEL, LOG_ACTION_COLOR) | 82–101 |
| Весь state, кроме clubs/memberships/token/user | 110–482 |
| Функции: selectClub, registerEvent, unregisterEvent, onBookingCreated, loadUpcoming, loadActivityLog, loadGallery, leaveBooking, cancelBooking, annulBooking, acceptInvite, declineInvite, joinBooking, doJoinBooking, handleSlotClick, handleTableHeaderClick, handleShareBooking, kickPlayerFromBooking, moveBookingTable, fmtHHMM, saveMyRoster, savePlayerRoster, openPlayerRoster, saveCurrentPlayerRoster, openRescheduleModal, rescheduleBooking, addPlayerToBooking, invitePlayerToBooking | 223–691 |
| Константа RECT_HEIGHT | 693 |
| useMemo: eventTableIds/userEventTableIds/eventTableGameSystems, maxCampaignDate, isSelectedDatePast | 696–745 |
| JSX аккордеон-тела (MOBILE + DESKTOP) | 826–1703 |
| Все модальные окна | 1711–2344 |

### Структура ClubPage.tsx

```tsx
import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookingForm from '../components/BookingForm'
import TableTimeline, { TABLE_HEADER_HEIGHT } from '../components/TableTimeline'
import BookingCalendar from '../components/BookingCalendar'
import ClubMap from '../components/ClubMap'
import CampaignMapView from '../components/CampaignMapView'
import { DEFAULT_BOOKING_COLORS } from '../constants'
import type { BookingColors } from '../constants'
import { shareTextOnly } from '../utils/shareBooking'
import type { ShareSlot } from '../utils/shareBooking'
import { getAttachmentDisplayName } from '../utils/attachmentName'
import useIsMobile from '../utils/useIsMobile'
import { LAST_PR_NUMBER, LAST_PR_DATE } from '../version'

// === ИНТЕРФЕЙСЫ: скопировать из HomePage.tsx строки 28–42 ===
// ... (User, Club, Membership, GameTable, BookingParticipant, BookingBase, Booking,
//      UpcomingBooking, ActivityLogEntry, ClubMember, ClubEventItem, PlayerRosterInfo, ClubDecoration)

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ: скопировать из HomePage.tsx строки 44–80 ===
// ... (parseHHMM, isBookingPast, getLocalMinutes, isSameLocalDay, toDatetimeLocal, formatDate)

// === КОНСТАНТЫ: скопировать из HomePage.tsx строки 82–101 ===
// ... (MAX_BOOKING_PLAYERS, PAST_DATE_HINT, LOG_ACTION_LABEL, LOG_ACTION_COLOR)

export default function ClubPage() {
  const { clubId } = useParams<{ clubId: string }>()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [token] = useState(localStorage.getItem('token') || '')

  // Клуб
  const [club, setClub] = useState<Club | null>(null)

  // === ВЕСЬ ОСТАЛЬНОЙ STATE: скопировать из HomePage.tsx строки 106–109, 111–482 ===
  // Не копировать: clubs, memberships, selectedClub, token (setToken не нужен)
  // Скопировать: user, tables, bookings, members, playerSystemsModal,
  //   moderatorBookingModal, ownerBookingModal, selectedTable, bookingStart, bookingEnd,
  //   bookingColors, selectedDate, expandedTableId, upcomingMyBookings, upcomingAllBookings,
  //   activityLog, upcomingTab, clubEvents, missionMapModal, campaignMapModal, decorations,
  //   clubGallery, mobileTab, desktopTab, moderatorAddPlayerId, ownerInvitePlayerId,
  //   rescheduleModal, galleryPhotoModal, playersSystemFilter, rescheduleStartTime,
  //   rescheduleEndTime, rescheduleError, gameInfoModal, playerRosterModal, playerRosterValue,
  //   playerRosterSaving, playerRosterLoading, cardStyle, btnStyle, warnStyle, shareBtnStyle

  // === useEffect: загрузка данных по clubId ===
  useEffect(() => {
    let isCurrent = true
    const numId = parseInt(clubId ?? '')
    if (isNaN(numId)) return

    // 1. Загружаем список клубов, находим нужный
    fetch('/api/club')
      .then(r => r.json())
      .then((data: Club[]) => {
        if (!isCurrent) return
        const found = data.find(c => c.id === numId) ?? null
        setClub(found)
        if (!found) return
        // 2. Загружаем данные клуба параллельно
        const authHeaders: Record<string, string> = token
          ? { Authorization: `Bearer ${token}` }
          : {}
        Promise.all([
          fetch(`/api/club/${numId}/tables`, { headers: authHeaders }),
          fetch(`/api/booking/club/${numId}`, { headers: authHeaders }),
          fetch(`/api/club/${numId}/members`, { headers: authHeaders }),
          fetch(`/api/event/club/${numId}`, { headers: authHeaders }),
          fetch(`/api/club/${numId}/decorations`, { headers: authHeaders }),
        ]).then(async ([tablesRes, bookingsRes, membersRes, eventsRes, decorationsRes]) => {
          if (!isCurrent) return
          if (tablesRes.ok) setTables(await tablesRes.json())
          if (bookingsRes.ok) setBookings(await bookingsRes.json())
          if (membersRes.ok) setMembers(await membersRes.json())
          if (eventsRes.ok) setClubEvents(await eventsRes.json())
          if (decorationsRes.ok) setDecorations(await decorationsRes.json())
        })
      })
      .catch(err => console.error('Failed to load club:', err))

    // 3. Декодируем токен и загружаем профиль пользователя
    if (token) {
      try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
        const jsonPayload = decodeURIComponent(
          atob(base64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
        )
        const payload = JSON.parse(jsonPayload)
        const baseUser = {
          id: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'],
          email: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
          name: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
        }
        fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => {
            if (!isCurrent) return
            setUser(u => ({ ...(u ?? baseUser), displayName: data.displayName || undefined }))
            if (data.bookingColors) {
              try {
                const c = { ...DEFAULT_BOOKING_COLORS, ...JSON.parse(data.bookingColors) }
                setBookingColors(c)
                localStorage.setItem('bookingColors', JSON.stringify(c))
              } catch { /* ignore */ }
            }
          })
          .catch(() => { if (isCurrent) setUser(u => u ?? baseUser) })
      } catch { /* ignore */ }
    }

    return () => { isCurrent = false }
  }, [clubId, token])

  // === ФУНКЦИИ: скопировать из HomePage.tsx строки 248–691 ===
  // ВАЖНО: во всех функциях заменить:
  //   selectedClub  →  club
  //   selectedClub?.id  →  parseInt(clubId ?? '')
  //   selectedClub.id  →  parseInt(clubId ?? '')
  // Убрать функцию selectClub (она не нужна — клуб уже загружен через useEffect)

  // === useMemo: скопировать из HomePage.tsx строки 484–745 ===
  // isModerator, memberMap, keyMemberIds, keyIcon, availablePlayerSystems, filteredMembers,
  // eventTableIds/userEventTableIds/eventTableGameSystems, maxCampaignDate, isSelectedDatePast

  const RECT_HEIGHT = 360

  // === JSX ===
  if (!club) {
    return (
      <div style={{ padding: 40, color: '#aaa' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: '#0f3460', color: '#ccc', border: '1px solid #1a4a8a', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13, marginBottom: 16 }}
        >
          ← Назад
        </button>
        <p>Загрузка клуба...</p>
      </div>
    )
  }

  // Вычисляем параметры расписания клуба (были внутри .map() в HomePage)
  const clubOpenMin = parseHHMM(club.openTime)
  const clubCloseMin = parseHHMM(club.closeTime)
  const clubTotalHours = Math.ceil((clubCloseMin - clubOpenMin) / 60)
  const clubOpenHour = Math.floor(clubOpenMin / 60)

  return (
    <>
      <div style={{ padding: isMobile ? 16 : 40 }}>
        {/* Кнопка "Назад" */}
        <button
          onClick={() => navigate('/')}
          style={{ background: '#0f3460', color: '#ccc', border: '1px solid #1a4a8a', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13, marginBottom: 16 }}
        >
          ← Назад
        </button>

        {/* Заголовок клуба */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {club.logoUrl && (
            <img src={club.logoUrl} alt="Лого" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 6, background: '#0f3460' }} />
          )}
          <h2 style={{ color: '#e94560', margin: 0 }}>{club.name}</h2>
        </div>

        {/* === ТЕЛО АККОРДЕОНА ===
            Скопировать из HomePage.tsx строки 827–1703
            (содержимое <div style={{ borderTop: '1px solid #0f3460' }}> ... </div>)
            Заменить внешний div: убрать borderTop, т.к. мы теперь на отдельной странице.
            Переменные clubOpenMin, clubCloseMin, clubTotalHours, clubOpenHour
            теперь определены выше, не внутри map-callback.
            
            ВНИМАНИЕ: в мобильном табе "gallery":
              было: loadGallery(selectedClub.id)
              стало: loadGallery(parseInt(clubId ?? ''))
              
            В десктопном табе — аналогично.
        */}
      </div>

      {/* === МОДАЛЬНЫЕ ОКНА ===
          Скопировать из HomePage.tsx строки 1711–2344
          В модалке reschedule:
            было: const selectedClubData = selectedClub
            стало: const selectedClubData = club
      */}
    </>
  )
}
```

### Инструкции для агента

1. Прочитать `HomePage.tsx` целиком (2347 строк).
2. Создать файл `clubtabletracker.client/src/pages/ClubPage.tsx` согласно структуре выше.
3. Скопировать указанные блоки кода, выполнив замены:
   - `selectedClub` → `club`
   - `selectedClub?.id` → `parseInt(clubId ?? '')`
   - Убрать функцию `selectClub`
4. Запустить `npm run lint`. Исправить все ошибки.
5. Убедиться что нет неиспользуемых импортов.
6. Закоммитить и запушить.

---

## Шаг 3 — Добавить маршрут /club/:clubId в App.tsx

**Статус:** [ ] не выполнено  
**Зависит от:** Шаг 2 выполнен

### Файл

`clubtabletracker.client/src/App.tsx`

### Текущее содержимое App.tsx

```tsx
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import ClubAdminPage from './pages/ClubAdminPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', background: '#1a1a2e', color: '#eee' }}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/clubAdmin" element={<ClubAdminPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  )
}

export default App
```

### Изменения

Добавить импорт `ClubPage` и маршрут:
```tsx
import ClubPage from './pages/ClubPage'
// ...
<Route path="/club/:clubId" element={<ClubPage />} />
```

### Инструкции для агента

1. Открыть `clubtabletracker.client/src/App.tsx`.
2. Добавить `import ClubPage from './pages/ClubPage'` в список импортов.
3. Добавить `<Route path="/club/:clubId" element={<ClubPage />} />` после маршрута `/settings`.
4. Запустить `npm run lint`. Убедиться — 0 ошибок.
5. Закоммитить и запушить.

---

## Шаг 4 — Переделать HomePage.tsx: убрать аккордеон, добавить карточки

**Статус:** [ ] не выполнено  
**Зависит от:** Шаги 1, 2, 3 выполнены (ClubPage уже существует, маршрут зарегистрирован)

### Что удалить из HomePage.tsx

После того как ClubPage создан, из HomePage.tsx нужно удалить:

| Что удалить | Строки |
|---|---|
| Импорты BookingForm, TableTimeline, TABLE_HEADER_HEIGHT, BookingCalendar, ClubMap, CampaignMapView, shareTextOnly, ShareSlot, getAttachmentDisplayName | 4–15 |
| State: selectedClub, tables, bookings, members, playerSystemsModal, moderatorBookingModal, ownerBookingModal, selectedTable, bookingStart, bookingEnd, expandedTableId, upcomingMyBookings, upcomingAllBookings, activityLog, upcomingTab, clubEvents, missionMapModal, campaignMapModal, decorations, clubGallery, mobileTab, desktopTab, moderatorAddPlayerId, ownerInvitePlayerId, rescheduleModal, galleryPhotoModal, playersSystemFilter, rescheduleStartTime, rescheduleEndTime, rescheduleError, gameInfoModal, playerRosterModal, playerRosterValue, playerRosterSaving, playerRosterLoading | 110–479 |
| Константу isModerator (строка 484) и useMemo: memberMap, keyMemberIds, keyIcon, availablePlayerSystems, filteredMembers, eventTableIds/userEventTableIds/eventTableGameSystems, maxCampaignDate, isSelectedDatePast | 484–745 |
| Функции: selectClub, registerEvent, unregisterEvent, onBookingCreated, loadUpcoming, loadActivityLog, loadGallery, leaveBooking, cancelBooking, annulBooking, acceptInvite, declineInvite, joinBooking, doJoinBooking, handleSlotClick, handleTableHeaderClick, handleShareBooking, kickPlayerFromBooking, moveBookingTable, fmtHHMM, saveMyRoster, savePlayerRoster, openPlayerRoster, saveCurrentPlayerRoster, openRescheduleModal, rescheduleBooking, addPlayerToBooking, invitePlayerToBooking | 223–691 |
| Константу RECT_HEIGHT (строка 693) | 693 |
| Весь JSX аккордеона и модалок в return (строки 775–2344) | 775–2344 |

### Что оставить в HomePage.tsx

- Импорты: `useState`, `useEffect` из react; `GoogleLogin`; `useNavigate`; `isGoogleConfigured`; `LAST_PR_NUMBER`, `LAST_PR_DATE`; `DEFAULT_BOOKING_COLORS`, `BookingColors`
- Импорт `useIsMobile` из `'../utils/useIsMobile'`
- Интерфейсы: **только** `User`, `Club`, `Membership`, `ClubEventItem` (нужен для clubEventsMap)
- State: `user`, `token`/`setToken`, `clubs`, `memberships`, `bookingColors`/`setBookingColors`
- Весь `useEffect` из строк 133–176 (загрузка списка клубов, профиль пользователя, memberships), но **без вызовов** `setSelectedClub`, `setUpcomingMyBookings`, `setUpcomingAllBookings`, `setActivityLog`
- Функции: `handleGoogleLogin`, `applyToClub`
- Функцию `logout` — **упростить**:
  ```tsx
  const logout = () => {
    localStorage.removeItem('token')
    setToken('')
    setUser(null)
    setMemberships([])
  }
  ```
- Стили: `cardStyle`, `btnStyle`, `warnStyle`

### Что добавить в HomePage.tsx

**Новый state для событий клубов:**
```tsx
const [clubEventsMap, setClubEventsMap] = useState<Record<number, ClubEventItem[]>>({})
```

**Загрузка событий в useEffect** (после `setClubs(data)` в строке 137):
```tsx
// Загружаем события всех клубов для превью карточек
data.forEach((c: Club) => {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  fetch(`/api/event/club/${c.id}`, { headers })
    .then(r => r.ok ? r.json() : [])
    .then((evs: ClubEventItem[]) =>
      setClubEventsMap(prev => ({ ...prev, [c.id]: evs }))
    )
    .catch(() => {})
})
```

### Новый JSX в return (полная замена строк 747–2345)

```tsx
  // Вычисляем наборы клубов
  const now = new Date()
  const memberClubs = clubs.filter(c => memberships.some(m => m.club.id === c.id && m.status === 'Approved'))
  const otherClubs = clubs.filter(c => !memberships.some(m => m.club.id === c.id && m.status === 'Approved'))

  // Функция рендера одной карточки клуба
  const renderClubCard = (club: Club) => {
    const membership = memberships.find(m => m.club.id === club.id)
    const isApproved = membership?.status === 'Approved'
    const isPending = membership?.status === 'Pending'
    const isRejected = membership?.status === 'Rejected'
    const isKicked = membership?.status === 'Kicked'
    const events = clubEventsMap[club.id] ?? []
    const activeEvents = events.filter(ev =>
      new Date(ev.startTime) <= now && now <= new Date(ev.endTime)
    )
    const upcomingEvents = events
      .filter(ev => new Date(ev.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 3)
    const borderColor = isApproved ? '#4caf50'
      : isPending ? '#ffc107'
      : (isRejected || isKicked) ? '#e94560'
      : '#0f3460'

    return (
      <div
        key={club.id}
        style={{
          background: '#16213e',
          border: `2px solid ${borderColor}`,
          borderRadius: 8,
          overflow: 'hidden',
          cursor: isApproved ? 'pointer' : 'default'
        }}
        onClick={() => { if (isApproved) navigate(`/club/${club.id}`) }}
      >
        {/* Верхняя часть: логотип + события */}
        <div style={{ display: 'flex', minHeight: 110 }}>

          {/* Левая колонка: логотип (~1/3) */}
          <div style={{
            width: '30%', flexShrink: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: '#0f1e3d', padding: 12
          }}>
            {club.logoUrl
              ? <img src={club.logoUrl} alt="Лого" style={{ maxWidth: '100%', maxHeight: 80, objectFit: 'contain' }} />
              : <span style={{ fontSize: 32 }}>🎲</span>
            }
          </div>

          {/* Средняя колонка: активные события */}
          <div style={{ flex: 1, padding: '10px 12px', borderLeft: '1px solid #1a2a50', borderRight: '1px solid #1a2a50' }}>
            <div style={{ color: '#ffc107', fontSize: 10, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Сейчас</div>
            {activeEvents.length === 0
              ? <div style={{ color: '#555', fontSize: 12 }}>Нет активных событий</div>
              : activeEvents.map(ev => (
                <div key={ev.id} style={{ marginBottom: 3 }}>
                  <div style={{ color: '#eee', fontSize: 12, fontWeight: 600 }}>{ev.title}</div>
                  <div style={{ color: '#888', fontSize: 11 }}>{ev.eventType}</div>
                </div>
              ))
            }
          </div>

          {/* Правая колонка: ближайшие события */}
          <div style={{ flex: 1, padding: '10px 12px' }}>
            <div style={{ color: '#7eb8f7', fontSize: 10, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Ближайшие события</div>
            {upcomingEvents.length === 0
              ? <div style={{ color: '#555', fontSize: 12 }}>Нет предстоящих событий</div>
              : upcomingEvents.map(ev => (
                <div key={ev.id} style={{ marginBottom: 3 }}>
                  <div style={{ color: '#eee', fontSize: 11 }}>
                    {new Date(ev.startTime).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} {ev.title}
                  </div>
                </div>
              ))
            }
          </div>

        </div>

        {/* Нижняя панель: название, описание, статус, кнопка */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid #1a2a50', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 'bold', fontSize: 14, color: '#eee' }}>{club.name}</div>
            <div style={{ color: '#aaa', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club.description}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {user && (!membership || isKicked) && (
              <button
                style={{ ...btnStyle, fontSize: 12, padding: '4px 10px' }}
                onClick={e => { e.stopPropagation(); applyToClub(club.id) }}
              >
                Подать заявку
              </button>
            )}
            {isApproved && <span title="Одобрено">✅</span>}
            {isPending && <span title="На рассмотрении">⏳</span>}
            {isRejected && <span title="Отклонено">❌</span>}
            {isKicked && <span title="Исключён">🚫</span>}
            {isApproved && <span style={{ color: '#888', fontSize: 13 }}>→</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: isMobile ? 16 : 40 }}>

      {/* Шапка */}
      <div style={{ borderBottom: '1px solid #e94560', paddingBottom: 20, marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ color: '#e94560', margin: 0, fontSize: isMobile ? 22 : 32, whiteSpace: 'nowrap' }}>
              🎲 Club Table Tracker
            </h1>
            <div style={{ color: '#aaa', fontSize: 13, marginTop: 4 }}>
              Бронирование игровых столов для варгеймерских клубов
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{
                background: '#0f3460', color: '#7eb8f7', fontSize: 11,
                padding: '2px 8px', borderRadius: 12, fontWeight: 600
              }}>
                Beta v0.0.{LAST_PR_NUMBER} от {LAST_PR_DATE}
              </span>
            </div>
          </div>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, flexWrap: 'wrap' }}>
              <span style={{ color: '#aaa', fontSize: isMobile ? 13 : 14 }}>👤 {user.displayName || user.name}</span>
              <button style={{ ...btnStyle, background: '#0f3460' }} onClick={() => navigate('/settings')}>⚙️</button>
              <button style={{ ...btnStyle, background: '#555' }} onClick={logout}>Выйти</button>
            </div>
          ) : (
            isGoogleConfigured
              ? <GoogleLogin onSuccess={handleGoogleLogin} onError={() => console.log('Login Failed')} />
              : <span style={{ ...warnStyle, fontSize: isMobile ? 12 : 14 }}>⚠️ Google login is not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> in your <code>.env</code> file.</span>
          )}
        </div>
      </div>

      {/* Приветствие для незарегистрированных */}
      {!user && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h2>Welcome to ClubTableTracker</h2>
          <p style={{ color: '#aaa' }}>Track gaming tables at your local Warhammer and Games Workshop club. Sign in with Google to apply for club membership and book tables.</p>
        </div>
      )}

      {/* Секция "Мои клубы" (только одобренные) */}
      {memberClubs.length > 0 && (
        <>
          <div style={{ borderBottom: '2px solid #e94560', marginBottom: 16, paddingBottom: 6 }}>
            <h2 style={{ color: '#e94560', margin: 0, fontSize: 18 }}>Мои клубы</h2>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: 16,
            marginBottom: 32
          }}>
            {memberClubs.map(c => renderClubCard(c))}
          </div>
        </>
      )}

      {/* Секция "Все клубы" */}
      <div style={{ borderBottom: '2px solid #0f3460', marginBottom: 16, paddingBottom: 6 }}>
        <h2 style={{ color: '#aaa', margin: 0, fontSize: 18 }}>Все клубы</h2>
      </div>
      {otherClubs.length === 0 && memberClubs.length > 0 && (
        <p style={{ color: '#555', fontSize: 14 }}>Все доступные клубы уже в разделе «Мои клубы».</p>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: 16
      }}>
        {otherClubs.map(c => renderClubCard(c))}
      </div>

    </div>
  )
```

### Инструкции для агента

1. Прочитать текущий `HomePage.tsx` целиком.
2. Удалить перечисленные строки/блоки.
3. Добавить новый state `clubEventsMap` и загрузку событий в useEffect.
4. Заменить весь return новым JSX согласно описанию выше.
5. Запустить `npm run lint`. Исправить все ошибки (особенно — неиспользуемые импорты).
6. Убедиться что интерфейс `ClubEventItem` остался в файле (нужен для типа `clubEventsMap`).
7. Закоммитить и запушить.

---

## Итоговая структура файлов после всех шагов

```
clubtabletracker.client/src/
├── pages/
│   ├── HomePage.tsx          # Только список клубов-карточек (~200 строк вместо 2347)
│   ├── ClubPage.tsx          # Детальная страница клуба (перенесено из HomePage)
│   ├── AdminPage.tsx         # Без изменений
│   ├── ClubAdminPage.tsx     # Без изменений
│   └── SettingsPage.tsx      # Без изменений
├── utils/
│   ├── useIsMobile.ts        # Новый файл (хук из HomePage)
│   ├── shareBooking.ts       # Без изменений
│   └── attachmentName.ts     # Без изменений
└── App.tsx                   # Добавлен маршрут /club/:clubId
```

---

## Важные детали

### Переменные clubOpenMin/closeMin/totalHours/openHour

В `HomePage.tsx` они вычислялись внутри `clubs.map(club => { ... })` (строки 792–795).
В `ClubPage.tsx` — вычислять в теле функции компонента, после проверки `if (!club) return ...`:
```tsx
const clubOpenMin = parseHHMM(club.openTime)
const clubCloseMin = parseHHMM(club.closeTime)
const clubTotalHours = Math.ceil((clubCloseMin - clubOpenMin) / 60)
const clubOpenHour = Math.floor(clubOpenMin / 60)
```

### Замены в ClubPage.tsx

| Было (HomePage.tsx) | Стало (ClubPage.tsx) |
|---|---|
| `selectedClub` | `club` |
| `selectedClub?.id` | `parseInt(clubId ?? '')` |
| `selectedClub.id` | `parseInt(clubId ?? '')` |
| `selectedClub?.logoUrl` | `club?.logoUrl` |
| `const selectedClubData = selectedClub` | `const selectedClubData = club` |
| `loadGallery(selectedClub.id)` | `loadGallery(parseInt(clubId ?? ''))` |

### Кнопка "Назад" в ClubPage

ClubPage не имеет шапки с логаутом. Вместо неё — простая кнопка «← Назад» (navigate('/')).

### Авторизация на ClubPage

Токен читается из localStorage один раз: `const [token] = useState(localStorage.getItem('token') || '')`.
Это read-only — сеттер не нужен, логаут происходит на HomePage.
