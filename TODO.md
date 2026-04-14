# TODO — Security & Quality Audit (2026-04-14 · Scan 2)

Предыдущий аудит полностью завершён (11/11 исправлено).  
Результаты повторного сканирования кодовой базы.  
Приоритеты: 🔴 Критический → 🟠 Высокий → 🟡 Средний → 🔵 Низкий

---

## 🟠 Высокие

### 1. JWT-токен по-прежнему хранится в `localStorage`
**Файлы:**  
- `clubtabletracker.client/src/pages/HomePage.tsx:95,162`  
- `clubtabletracker.client/src/pages/SettingsPage.tsx:38`

**Проблема:**  
В предыдущем аудите `masterKey` и `clubKey` были корректно перенесены в `sessionStorage`, однако JWT-токен пользователя остался в `localStorage`. `localStorage` сохраняется между сессиями браузера и доступен любому JavaScript-коду на странице — при XSS-атаке токен может быть похищен.

```ts
// HomePage.tsx:95 — УЯЗВИМО
const [token, setToken] = useState(localStorage.getItem('token') || '')

// HomePage.tsx:162 — УЯЗВИМО
localStorage.setItem('token', data.token)

// SettingsPage.tsx:38 — УЯЗВИМО
const token = localStorage.getItem('token') || ''
```

**Исправление:**  
- **Вариант A (надёжный):** Выдавать JWT в виде `httpOnly; Secure; SameSite=Strict` cookie в ответе `POST /api/auth/google`. Фронтенд не хранит токен вообще — браузер сам подставляет cookie.
- **Вариант B (временный):** Перенести в `sessionStorage` (аналогично masterKey/clubKey). Токен не переживёт закрытие вкладки:

```ts
// Замена localStorage → sessionStorage везде для token
sessionStorage.setItem('token', data.token)
const token = sessionStorage.getItem('token') || ''
```

---

### 2. Нет `[MaxLength]` на критических полях моделей
**Файлы:**  
- `ClubTableTracker.Server/Models/Club.cs` — `Name`, `Description`, `AccessKey`  
- `ClubTableTracker.Server/Models/ClubEvent.cs` — `Title`, `GameSystem`, `TableIds`, `RegulationUrl`, `RegulationUrl2`, `MissionMapUrl`  
- `ClubTableTracker.Server/Models/ClubMembership.cs` — `ManualName`, `ManualEmail`, `ManualEnabledGameSystems`  
- `ClubTableTracker.Server/Models/GameTable.cs` — `Number`, `Size`, `SupportedGames`

**Проблема:**  
Поля принимают строки произвольной длины. Авторизованный пользователь (например, клуб-администратор) может записать строку размером в мегабайты в поля `ManualName`, `Title` и т.д., что нагружает БД и приводит к чрезмерному потреблению памяти при загрузке данных.

**Исправление:**  
Добавить атрибуты `[MaxLength]`:

```csharp
// Club.cs
[MaxLength(100)]  public string Name        { get; set; } = string.Empty;
[MaxLength(1000)] public string Description { get; set; } = string.Empty;
[MaxLength(64)]   public string AccessKey   { get; set; } = string.Empty;

// ClubEvent.cs
[MaxLength(200)]  public string Title       { get; set; } = "";
[MaxLength(100)]  public string? GameSystem { get; set; }
[MaxLength(500)]  public string? TableIds   { get; set; }
[MaxLength(500)]  public string? Description { get; set; }
[MaxLength(500)]  public string? RegulationUrl  { get; set; }
[MaxLength(500)]  public string? RegulationUrl2 { get; set; }
[MaxLength(500)]  public string? MissionMapUrl  { get; set; }

// ClubMembership.cs
[MaxLength(100)]  public string? ManualName              { get; set; }
[MaxLength(200)]  public string? ManualEmail             { get; set; }
[MaxLength(500)]  public string? ManualEnabledGameSystems{ get; set; }

// GameTable.cs
[MaxLength(50)]   public string Number        { get; set; } = string.Empty;
[MaxLength(20)]   public string Size          { get; set; } = "Medium";
[MaxLength(500)]  public string SupportedGames{ get; set; } = string.Empty;
```

После добавления атрибутов создать EF-миграцию: `dotnet ef migrations add AddMaxLengthConstraints`.

---

## 🟡 Средние

### 3. `EnabledGameSystems` не валидируется в `UserController`
**Файл:** `ClubTableTracker.Server/Controllers/UserController.cs:56–57`

**Проблема:**  
В `ClubAdminController.UpdateMemberGameSystems` есть явная проверка против `GameSystemConstants.All`, но в `UserController.UpdateGameSystems` её нет. Пользователь может записать произвольные строки в `EnabledGameSystems`.

```csharp
// UserController.cs — НЕТ валидации
var systems = req.EnabledGameSystems ?? new List<string>();
user.EnabledGameSystems = systems.Count > 0 ? string.Join("|", systems) : null;
```

```csharp
// ClubAdminController.cs — ЕСТЬ валидация (образец)
var invalid = systems.Where(s => !GameSystemConstants.All.Contains(s)).ToList();
if (invalid.Count > 0) return BadRequest($"Неизвестные игровые системы: {string.Join(", ", invalid)}");
```

**Исправление:**  
Добавить в `UserController.UpdateGameSystems` аналогичную проверку:

```csharp
var invalid = systems.Where(s => !GameSystemConstants.All.Contains(s)).ToList();
if (invalid.Count > 0)
    return BadRequest($"Неизвестные игровые системы: {string.Join(", ", invalid)}");
```

---

### 4. `UserController.UpdateBookingColors` не валидирует длину
**Файл:** `ClubTableTracker.Server/Controllers/UserController.cs:72`

**Проблема:**  
`[MaxLength(500)]` объявлен на модели `AppUser.BookingColors`, но явной проверки в контроллере нет. Приложение полагается на БД для отклонения слишком длинных строк, что может привести к нечитаемым ошибкам на клиенте (500 вместо 400).

**Исправление:**  
Добавить явную проверку в контроллере:

```csharp
if (req.BookingColors != null && req.BookingColors.Length > 500)
    return BadRequest("BookingColors must not exceed 500 characters");
```

---

### 5. Нет пагинации на тяжёлых эндпоинтах
**Файл:** `ClubTableTracker.Server/Controllers/BookingController.cs`  
**Методы:** `GetBookings`, `GetUpcomingAll`, `GetActivityLog`

**Проблема:**  
Эндпоинты возвращают все записи без ограничения. В активном клубе с сотнями бронирований и тысячами лог-записей один запрос может загрузить МБ данных, перегрузить БД и вызвать OOM на сервере.

```csharp
// GetBookings — возвращает ВСЕ бронирования клуба без LIMIT
var bookings = _db.Bookings.Where(b => b.Table.ClubId == clubId).ToList();

// GetActivityLog — возвращает все записи за последний месяц без LIMIT
var logs = _db.BookingLogs.Where(l => l.Timestamp >= since && ...).ToList();
```

**Исправление:**  
Добавить параметры пагинации `page` / `pageSize` (или cursor-based):

```csharp
[HttpGet("activity-log")]
public IActionResult GetActivityLog([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
{
    pageSize = Math.Clamp(pageSize, 1, 200);
    var logs = _db.BookingLogs
        .Where(l => l.Timestamp >= since && ...)
        .OrderByDescending(l => l.Timestamp)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .Select(...)
        .ToList();
    return Ok(logs);
}
```

---

## 🔵 Низкие / Информационные

### 6. Таблица `BookingLog` растёт бесконечно
**Файл:** `ClubTableTracker.Server/Controllers/BookingController.cs`

**Проблема:**  
Записи `BookingLog` никогда не удаляются и не архивируются. При активной работе клуба таблица может вырасти до десятков тысяч строк в год. `GetActivityLog` уже ограничивает выборку одним месяцем, но сами данные остаются в БД навсегда.

**Исправление:**  
- Добавить фоновый сервис (`BackgroundService`) или Hangfire-задачу, удаляющую записи старше N месяцев (например, 6).
- Как минимум — добавить административный эндпоинт ручной очистки.

---

### 7. Отсутствует эндпоинт удаления клуба
**Файл:** `ClubTableTracker.Server/Controllers/AdminController.cs`

**Проблема:**  
`AdminController` позволяет создавать клубы и перегенерировать ключи, но не предоставляет возможности удалить клуб. Тестовые и устаревшие клубы накапливаются в БД и отображаются всем пользователям.

**Исправление:**  
Добавить эндпоинт:

```csharp
[HttpDelete("clubs/{id}")]
public IActionResult DeleteClub(int id)
{
    if (!IsAuthorized()) return Unauthorized();
    var club = _db.Clubs.Find(id);
    if (club == null) return NotFound();
    _db.Clubs.Remove(club);
    _db.SaveChanges();
    return NoContent();
}
```

---

### 8. CSP не включает `style-src 'unsafe-inline'`
**Файл:** `clubtabletracker.client/nginx.conf:22`

**Проблема:**  
Текущий CSP: `default-src 'self'; script-src 'self' https://accounts.google.com; frame-src https://accounts.google.com;`

Директива `default-src 'self'` неявно применяется к `style-src`, что запрещает инлайн-стили. Все компоненты приложения используют React inline styles (`style={{ ... }}`), которые транслируются в HTML-атрибуты `style`. Браузеры с строгой интерпретацией CSP могут блокировать эти стили.

**Исправление:**  
Добавить `style-src 'self' 'unsafe-inline'` (инлайн-стили не несут XSS-риска, только инлайн-скрипты опасны):

```nginx
add_header Content-Security-Policy "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' https://accounts.google.com; frame-src https://accounts.google.com;" always;
```

---

## Сводная таблица

| # | Проблема | Файл / Компонент | Приоритет | Статус |
|---|---|---|---|---|
| 1 | JWT-токен всё ещё в `localStorage` | `HomePage.tsx:95,162`, `SettingsPage.tsx:38` | 🟠 Высокий | ✅ Исправлен |
| 2 | Нет `[MaxLength]` на полях `Club`, `ClubEvent`, `GameTable`, `ClubMembership` | Модели сервера | 🟠 Высокий | ✅ Исправлен |
| 3 | `EnabledGameSystems` без валидации в `UserController` | `UserController.cs:56` | 🟡 Средний | ❌ Не исправлен |
| 4 | `UpdateBookingColors` без явной проверки длины | `UserController.cs:72` | 🟡 Средний | ❌ Не исправлен |
| 5 | Нет пагинации на `GetBookings`, `GetUpcomingAll`, `GetActivityLog` | `BookingController.cs` | 🟡 Средний | ❌ Не исправлен |
| 6 | `BookingLog` растёт бесконечно | `BookingController.cs` | 🔵 Низкий | ❌ Не исправлен |
| 7 | Нет эндпоинта удаления клуба | `AdminController.cs` | 🔵 Низкий | ❌ Не исправлен |
| 8 | CSP не включает `style-src 'unsafe-inline'` | `nginx.conf:22` | 🔵 Низкий | ❌ Не исправлен |
