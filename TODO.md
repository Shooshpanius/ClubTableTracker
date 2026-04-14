# TODO — Security Audit (2026-04-14)

Результаты комплексной проверки безопасности.  
Приоритеты: 🔴 Критический → 🟠 Высокий → 🟡 Средний → 🔵 Низкий

---

## 🔴 Критические

### ~~1. Жёстко закодированный запасной JWT-секрет~~ ✅ Исправлен
**Файлы:** `ClubTableTracker.Server/Controllers/AuthController.cs:96`, `ClubTableTracker.Server/Program.cs:25`

**Проблема:**  
Если переменная окружения `JWT_SECRET` не задана, используется захардкоженный секрет `"default-secret-key-at-least-32-chars!!"` из публичного репозитория. Любой, кто видит исходный код, может подделать JWT-токен и войти под любым пользователем.

```csharp
// AuthController.cs:96 — УЯЗВИМО
var secret = _config["Jwt:Secret"] ?? "default-secret-key-at-least-32-chars!!";

// Program.cs:25 — УЯЗВИМО
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "default-secret-key-at-least-32-chars!!";
```

**Исправление:**  
Бросать исключение при запуске, если секрет не задан. Убрать значение по умолчанию в обоих местах.

```csharp
// Program.cs
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException(
        "Jwt:Secret is not configured. Set the JWT_SECRET environment variable.");

// AuthController.cs — GenerateJwt()
var secret = _config["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
```

---

### ~~2. Пропуск валидации аудитории Google ID-токена~~ ✅ Исправлен
**Файл:** `ClubTableTracker.Server/Controllers/AuthController.cs:44–47`

**Проблема:**  
Если `Google:ClientId` не настроен, валидация аудитории Google-токена пропускается (`null` передаётся в `ValidateAsync`). Злоумышленник с любым Google OAuth-приложением может получить токен от Google и авторизоваться в системе.

```csharp
// УЯЗВИМО: при пустом clientId настройки валидации == null
var validationSettings = string.IsNullOrEmpty(clientId)
    ? null
    : new GoogleJsonWebSignature.ValidationSettings { Audience = new[] { clientId } };
payload = await GoogleJsonWebSignature.ValidateAsync(req.Credential, validationSettings);
```

**Исправление:**  
Требовать наличие `Google:ClientId` при запуске. Отклонять запрос, если конфиг отсутствует.

```csharp
// В начале метода GoogleLogin:
var clientId = _config["Google:ClientId"];
if (string.IsNullOrEmpty(clientId))
    return StatusCode(500, "Google authentication is not configured");

var validationSettings = new GoogleJsonWebSignature.ValidationSettings
{
    Audience = new[] { clientId }
};
payload = await GoogleJsonWebSignature.ValidateAsync(req.Credential, validationSettings);
```

Также добавить в `Program.cs` при запуске:
```csharp
if (string.IsNullOrEmpty(builder.Configuration["Google:ClientId"]))
    throw new InvalidOperationException(
        "Google:ClientId is not configured. Set VITE_GOOGLE_CLIENT_ID / Google__ClientId.");
```

---

## 🟠 Высокие

### ~~3. Чувствительные ключи в `localStorage`~~ ✅ Исправлен
**Файлы:**  
- `clubtabletracker.client/src/pages/HomePage.tsx` — JWT-токен пользователя  
- `clubtabletracker.client/src/pages/AdminPage.tsx` — мастер-ключ администратора  
- `clubtabletracker.client/src/pages/ClubAdminPage.tsx` — ключ доступа клуба  

**Проблема:**  
`localStorage` доступен любому JavaScript-коду на странице (в т.ч. скриптам из npm-зависимостей). При XSS-атаке все три типа секретов могут быть похищены. Особенно критично: мастер-ключ в `localStorage` даёт возможность создавать клубы и сбрасывать ключи доступа.

```ts
// УЯЗВИМО
localStorage.setItem('token', data.token)      // JWT пользователя
localStorage.setItem('masterKey', masterKey)   // Мастер-ключ (полный доступ к /admin API)
localStorage.setItem('clubKey', clubKey)       // Ключ доступа клуба
```

**Исправление:**  
- **JWT-токен:** Перенести в `httpOnly; Secure; SameSite=Strict` cookie (требует изменений на сервере — настройка cookie в ответе `/api/auth/google`).
- **Временное смягчение для всех трёх:** Использовать `sessionStorage` вместо `localStorage` — данные не переживают закрытие вкладки/браузера.
- **Мастер-ключ / Club-ключ:** Не хранить в браузерном хранилище вообще — вводить заново при каждой сессии (или использовать короткоживущие сессионные токены).

---

### ~~4. Отсутствие rate limiting (защиты от перебора)~~ ✅ Исправлен
**Файл:** `ClubTableTracker.Server/Program.cs`

**Проблема:**  
API не защищён от брутфорса ни на одном эндпоинте:
- `GET /api/admin/clubs` с заголовком `X-Master-Key` — перебор мастер-ключа администратора
- `GET /api/clubadmin/me` с заголовком `X-Club-Key` — перебор ключа доступа клуба
- `POST /api/auth/google` — флуд эндпоинта аутентификации

**Исправление:**  
Добавить `Microsoft.AspNetCore.RateLimiting` (встроен в .NET 7+):

```csharp
// Program.cs
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

builder.Services.AddRateLimiter(options =>
{
    // Жёсткий лимит для admin/auth эндпоинтов
    options.AddFixedWindowLimiter("auth", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// Применить на контроллерах AdminController и AuthController:
// [EnableRateLimiting("auth")]
```

---

### ~~5. Состояние гонки (TOCTOU) при бронировании столов~~ ✅ Исправлен
**Файл:** `ClubTableTracker.Server/Controllers/BookingController.cs:222–227`, а также `RescheduleBooking`

**Проблема:**  
Проверка конфликта и создание бронирования — два отдельных обращения к БД без транзакции. При параллельных запросах два пользователя могут одновременно пройти проверку и оба создать бронирование на одно и то же время.

```csharp
// УЯЗВИМО: READ и WRITE в разных транзакциях
var hasConflict = _db.Bookings.Any(b => b.TableId == req.TableId && ...);
if (hasConflict) return BadRequest(...);
_db.Bookings.Add(booking);       // ← другой поток уже прошёл сюда
_db.SaveChanges();
```

**Исправление:**  
Обернуть в сериализуемую транзакцию:

```csharp
using var tx = await _db.Database.BeginTransactionAsync(
    System.Data.IsolationLevel.Serializable);
try
{
    var hasConflict = _db.Bookings.Any(...);
    if (hasConflict) { await tx.RollbackAsync(); return BadRequest(...); }
    _db.Bookings.Add(booking);
    await _db.SaveChangesAsync();
    await tx.CommitAsync();
}
catch
{
    await tx.RollbackAsync();
    throw;
}
```

Альтернатива: уникальный индекс на уровне БД, запрещающий пересечение временных отрезков (требует специфичного для MariaDB триггера или приложения с пессимистичной блокировкой строки).

---

## 🟡 Средние

### ~~6. Загрузка файлов без проверки magic bytes~~ ✅ Исправлен
**Файл:** `ClubTableTracker.Server/Controllers/ClubAdminController.cs`  
**Методы:** `UploadLogo`, `UploadGalleryPhoto`, `UploadRegulation`, `UploadRegulation2`, `UploadMissionMap`

**Проблема:**  
Проверяются только расширение файла (`file.FileName`) и MIME-тип (`file.ContentType`), оба из которых задаются клиентом и могут быть подделаны. Содержимое файла не верифицируется. Злоумышленник может загрузить исполняемый файл с расширением `.pdf` или `.jpg`.

```csharp
// УЯЗВИМО: клиент контролирует оба значения
var fileExt = Path.GetExtension(file.FileName).ToLowerInvariant();
if (!allowedExtensions.Contains(fileExt) || !allowedMimeTypes.Contains(file.ContentType))
    return BadRequest(...);
```

**Исправление:**  
Читать первые байты файла и проверять magic bytes:

```csharp
private static readonly byte[] PdfMagic   = { 0x25, 0x50, 0x44, 0x46 };       // %PDF
private static readonly byte[] ZipMagic   = { 0x50, 0x4B, 0x03, 0x04 };       // PK (DOCX/XLSX)
private static readonly byte[] JpegMagic  = { 0xFF, 0xD8, 0xFF };
private static readonly byte[] PngMagic   = { 0x89, 0x50, 0x4E, 0x47 };
private static readonly byte[] WebpMagic  = { 0x52, 0x49, 0x46, 0x46 };       // RIFF

private static bool MatchesMagic(IFormFile file, byte[] magic)
{
    var buffer = new byte[magic.Length];
    using var stream = file.OpenReadStream();
    stream.Read(buffer, 0, buffer.Length);
    return buffer.SequenceEqual(magic);
}
```

---

### 7. JWT: отключена валидация Issuer и Audience
**Файл:** `ClubTableTracker.Server/Program.cs:33–34`

**Проблема:**  
Если секрет JWT будет использован в другом сервисе или утечёт, токены от других систем будут приняты.

```csharp
ValidateIssuer = false,    // ← УЯЗВИМО
ValidateAudience = false   // ← УЯЗВИМО
```

**Исправление:**  
```csharp
ValidateIssuer = true,
ValidateAudience = true,
ValidIssuer = "ClubTableTracker",
ValidAudience = "ClubTableTracker",
```

И при генерации токена в `AuthController.GenerateJwt`:
```csharp
var token = new JwtSecurityToken(
    issuer: "ClubTableTracker",
    audience: "ClubTableTracker",
    claims: claims,
    expires: DateTime.UtcNow.AddDays(30),
    signingCredentials: creds
);
```

---

### 8. Отсутствие security-заголовков HTTP в nginx
**Файл:** `clubtabletracker.client/nginx.conf`

**Проблема:**  
Ответы сервера не содержат стандартных заголовков безопасности, что открывает вектора для XSS, clickjacking и атак через MIME sniffing.

| Заголовок | Статус |
|---|---|
| `Content-Security-Policy` | ❌ Отсутствует |
| `X-Frame-Options` | ❌ Отсутствует |
| `X-Content-Type-Options: nosniff` | ❌ Отсутствует |
| `Strict-Transport-Security` | ❌ Отсутствует |
| `Referrer-Policy` | ❌ Отсутствует |
| `Permissions-Policy` | ❌ Отсутствует |

**Исправление:**  
Добавить в `nginx.conf` в блок `location /`:
```nginx
add_header X-Content-Type-Options    "nosniff"                            always;
add_header X-Frame-Options           "DENY"                               always;
add_header Referrer-Policy           "strict-origin-when-cross-origin"    always;
add_header Permissions-Policy        "geolocation=(), microphone=()"      always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
# CSP настроить под конкретные нужды (Google OAuth, Yandex.Metrika, etc.)
add_header Content-Security-Policy   "default-src 'self'; script-src 'self' https://accounts.google.com; frame-src https://accounts.google.com;" always;
```

---

## 🔵 Низкие / Информационные

### 9. Нет ограничений длины на поля Roster, BookingColors, DisplayName, GameSystem
**Файлы:** `ClubTableTracker.Server/Models/AppUser.cs`, `ClubTableTracker.Server/Models/Booking.cs`, `ClubTableTracker.Server/Models/BookingParticipant.cs`

**Проблема:**  
Поля без `[MaxLength]` принимают строки произвольной длины. Пользователь может отправить многомегабайтный `Roster` или `BookingColors`, что нагружает БД и сервер. Сейчас только поле `Bio` ограничено (500 символов) в контроллере.

**Исправление:**  
Добавить атрибуты `[MaxLength]` на модели (и проверки в контроллерах):
```csharp
[MaxLength(2000)] public string? OwnerRoster { get; set; }   // Booking
[MaxLength(2000)] public string? Roster { get; set; }        // BookingParticipant
[MaxLength(500)]  public string? BookingColors { get; set; } // AppUser
[MaxLength(100)]  public string? DisplayName { get; set; }   // AppUser
```

---

### 10. Длинный срок действия JWT без механизма отзыва
**Файл:** `ClubTableTracker.Server/Controllers/AuthController.cs:108`

**Проблема:**  
Токены живут 30 дней без возможности отзыва (`logout` на сервере отсутствует). При компрометации токена он остаётся валидным до 30 дней.

```csharp
expires: DateTime.UtcNow.AddDays(30)  // ← слишком долго без revocation
```

**Исправление:**  
- Сократить срок до 1–7 дней.
- Реализовать refresh-токены с хранением в БД и эндпоинтом `/api/auth/logout` для отзыва.
- Как минимум: добавить `jti` claim (JWT ID) и таблицу отозванных `jti`.

---

### 11. Non-constant-time сравнение мастер-ключа
**Файл:** `ClubTableTracker.Server/Controllers/AdminController.cs:20–22`

**Проблема:**  
Обычное сравнение строк (`key == _config["MasterKey"]`) теоретически уязвимо к timing-атакам.

```csharp
private bool IsAuthorized() =>
    Request.Headers.TryGetValue("X-Master-Key", out var key) &&
    key == _config["MasterKey"];  // ← timing attack
```

**Исправление:**  
```csharp
using System.Security.Cryptography;

private bool IsAuthorized()
{
    if (!Request.Headers.TryGetValue("X-Master-Key", out var key)) return false;
    var expected = _config["MasterKey"] ?? "";
    return CryptographicOperations.FixedTimeEquals(
        Encoding.UTF8.GetBytes(key.ToString()),
        Encoding.UTF8.GetBytes(expected));
}
```

---

## Сводная таблица

| # | Уязвимость | Файл / Компонент | Приоритет | Статус |
|---|---|---|---|---|
| 1 | Жёстко закодированный JWT-секрет | `AuthController.cs:96`, `Program.cs:25` | 🔴 Критический | ✅ Исправлен |
| 2 | Пропуск валидации аудитории Google | `AuthController.cs:44–47` | 🔴 Критический | ✅ Исправлен |
| 3 | Ключи в `localStorage` | Frontend: `HomePage`, `AdminPage`, `ClubAdminPage` | 🟠 Высокий | ✅ Исправлен |
| 4 | Нет rate limiting | `Program.cs` + все контроллеры | 🟠 Высокий | ✅ Исправлен |
| 5 | TOCTOU при бронировании | `BookingController.cs:222–227` | 🟠 Высокий | ✅ Исправлен |
| 6 | Загрузка файлов без magic bytes | `ClubAdminController.cs` | 🟡 Средний | ✅ Исправлен |
| 7 | JWT без issuer/audience | `Program.cs:33–34` | 🟡 Средний | ❌ Открыт |
| 8 | Отсутствие security-заголовков | `nginx.conf` | 🟡 Средний | ❌ Открыт |
| 9 | Нет ограничений длины полей | Модели + контроллеры | 🔵 Низкий | ❌ Открыт |
| 10 | Длинный JWT без отзыва | `AuthController.cs:108` | 🔵 Низкий | ❌ Открыт |
| 11 | Non-constant-time сравнение ключа | `AdminController.cs:20–22` | 🔵 Низкий | ❌ Открыт |
