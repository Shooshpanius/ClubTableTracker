using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ClubTableTracker.Server.Data;
using ClubTableTracker.Server.Models;
using ClubTableTracker.Server.Services;
using static ClubTableTracker.Server.Models.JwtConstants;

namespace ClubTableTracker.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthController> _logger;
    private readonly YandexAuthService _yandexAuth;
    private readonly VkAuthService _vkAuth;

    public AuthController(AppDbContext db, IConfiguration config, ILogger<AuthController> logger,
        YandexAuthService yandexAuth, VkAuthService vkAuth)
    {
        _db = db;
        _config = config;
        _logger = logger;
        _yandexAuth = yandexAuth;
        _vkAuth = vkAuth;
    }

    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest req)
    {
        if (string.IsNullOrEmpty(req.Credential))
        {
            return BadRequest("Credential is required");
        }

        var clientId = _config["Google:ClientId"];
        if (string.IsNullOrEmpty(clientId))
            return StatusCode(500, "Google authentication is not configured");

        GoogleJsonWebSignature.Payload payload;
        try
        {
            var validationSettings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { clientId }
            };
            payload = await GoogleJsonWebSignature.ValidateAsync(req.Credential, validationSettings);
        }
        catch (InvalidJwtException ex)
        {
            _logger.LogWarning(ex, "Google ID token validation failed.");
            return BadRequest("Invalid credential");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during Google token validation.");
            return StatusCode(500, "An error occurred while validating the credential");
        }

        var email = payload.Email ?? "";
        var name = payload.Name ?? "";
        var googleId = payload.Subject ?? "";
        var avatarUrl = payload.Picture;

        if (string.IsNullOrEmpty(googleId)) return BadRequest("No subject in token");

        AppUser? user;
        try
        {
            user = await ResolveUserAsync("google", googleId, email, name, avatarUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database error while processing Google login.");
            return StatusCode(500, "An error occurred while processing the login");
        }

        var jwt = GenerateJwt(user);
        return Ok(new { token = jwt, user = new { user.Id, user.Email, user.Name, user.DisplayName } });
    }

    [HttpPost("yandex")]
    public async Task<IActionResult> YandexLogin([FromBody] YandexLoginRequest req)
    {
        if (string.IsNullOrEmpty(req.Code))
            return BadRequest("Code is required");
        if (string.IsNullOrEmpty(req.RedirectUri))
            return BadRequest("RedirectUri is required");
        if (!_yandexAuth.IsConfigured)
            return StatusCode(500, "Yandex authentication is not configured");

        var accessToken = await _yandexAuth.ExchangeCodeAsync(req.Code, req.RedirectUri);
        if (string.IsNullOrEmpty(accessToken))
            return BadRequest("Invalid code or token exchange failed");

        var info = await _yandexAuth.GetUserInfoAsync(accessToken);
        if (info == null || string.IsNullOrEmpty(info.Id))
            return BadRequest("Failed to retrieve Yandex user info");

        AppUser user;
        try
        {
            user = await ResolveUserAsync("yandex", info.Id, info.Email, info.Name, info.AvatarUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database error while processing Yandex login.");
            return StatusCode(500, "An error occurred while processing the login");
        }

        var jwt = GenerateJwt(user);
        return Ok(new { token = jwt, user = new { user.Id, user.Email, user.Name, user.DisplayName } });
    }

    [HttpPost("vk")]
    public async Task<IActionResult> VkLogin([FromBody] VkLoginRequest req)
    {
        if (string.IsNullOrEmpty(req.Code))
            return BadRequest("Code is required");
        if (string.IsNullOrEmpty(req.RedirectUri))
            return BadRequest("RedirectUri is required");
        if (!_vkAuth.IsConfigured)
            return StatusCode(500, "VK authentication is not configured");

        var tokenResult = await _vkAuth.ExchangeCodeAsync(req.Code, req.RedirectUri, req.DeviceId);
        if (tokenResult == null)
            return BadRequest("Invalid code or token exchange failed");

        var info = await _vkAuth.GetUserInfoAsync(tokenResult.AccessToken, tokenResult.Email);
        if (info == null || string.IsNullOrEmpty(info.Id))
            return BadRequest("Failed to retrieve VK user info");

        AppUser user;
        try
        {
            user = await ResolveUserAsync("vk", info.Id, info.Email, info.Name, info.AvatarUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database error while processing VK login.");
            return StatusCode(500, "An error occurred while processing the login");
        }

        var jwt = GenerateJwt(user);
        return Ok(new { token = jwt, user = new { user.Id, user.Email, user.Name, user.DisplayName } });
    }

    /// <summary>
    /// Привязка Google-аккаунта к ТЕКУЩЕМУ пользователю (Шаг 9: link/merge).
    /// Если Google-аккаунта ещё нет в БД — простая привязка (GoogleId + дозаполнение профиля).
    /// Если уже есть (дубль) — данные дубля переносятся в текущий аккаунт (выживший = текущий,
    /// сессия сохраняется), дубль удаляется. После этого вход работает и по Google, и по Яндексу.
    /// </summary>
    [HttpPost("link-google")]
    [Authorize]
    public async Task<IActionResult> LinkGoogle([FromBody] GoogleLoginRequest req)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(currentUserId)) return Unauthorized();

        if (string.IsNullOrEmpty(req?.Credential))
            return BadRequest("Credential is required");

        var clientId = _config["Google:ClientId"];
        if (string.IsNullOrEmpty(clientId))
            return StatusCode(500, "Google authentication is not configured");

        GoogleJsonWebSignature.Payload payload;
        try
        {
            var validationSettings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { clientId }
            };
            payload = await GoogleJsonWebSignature.ValidateAsync(req.Credential, validationSettings);
        }
        catch (InvalidJwtException ex)
        {
            _logger.LogWarning(ex, "Google ID token validation failed (link-google).");
            return BadRequest("Invalid credential");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during Google token validation (link-google).");
            return StatusCode(500, "An error occurred while validating the credential");
        }

        var googleId = payload.Subject ?? "";
        if (string.IsNullOrEmpty(googleId)) return BadRequest("No subject in token");

        var current = _db.Users.Find(currentUserId);
        if (current == null) return NotFound();

        // Уже привязан к этому Google — идемпотентно.
        if (current.GoogleId == googleId)
            return Ok(new { token = GenerateJwt(current), user = UserDto(current) });

        if (!string.IsNullOrEmpty(current.GoogleId))
            return BadRequest("Аккаунт уже привязан к другому Google-аккаунту");

        var duplicate = _db.Users.FirstOrDefault(u => u.GoogleId == googleId && u.Id != currentUserId);

        try
        {
            if (duplicate != null)
            {
                // Дубль уже привязан к другому Яндексу/VK — сливать нельзя.
                if (!string.IsNullOrEmpty(duplicate.YandexId) && duplicate.YandexId != current.YandexId)
                    return BadRequest("Этот Google-аккаунт уже привязан к другому аккаунту Яндекса");
                if (!string.IsNullOrEmpty(duplicate.VkId) && duplicate.VkId != current.VkId)
                    return BadRequest("Этот Google-аккаунт уже привязан к другому аккаунту ВКонтакте");

                MergeGoogleUser(current, duplicate);
            }
            else
            {
                current.GoogleId = googleId;
                if (string.IsNullOrEmpty(current.Email) && !string.IsNullOrEmpty(payload.Email))
                    current.Email = payload.Email;
                if (string.IsNullOrEmpty(current.Name) && !string.IsNullOrWhiteSpace(payload.Name))
                    current.Name = payload.Name;
                if (string.IsNullOrEmpty(current.AvatarUrl) && !string.IsNullOrEmpty(payload.Picture))
                    current.AvatarUrl = payload.Picture;
                await _db.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database error while linking Google account.");
            return StatusCode(500, "An error occurred while linking the account");
        }

        return Ok(new { token = GenerateJwt(current), user = UserDto(current) });
    }

    /// <summary>
    /// Перенос данных из source (Google-дубль) в survivor (текущий аккаунт) и удаление source.
    /// survivor остаётся (Id не меняется, сессия валидна). Транзакция; две фазы SaveChanges —
    /// из-за unique-индексов YandexId/VkId (сначала обнуляем у source, потом проставляем survivor).
    /// </summary>
    private void MergeGoogleUser(AppUser survivor, AppUser source)
    {
        using var tx = _db.Database.BeginTransaction();
        try
        {
            var survivorId = survivor.Id;
            var sourceId = source.Id;
            var sourceYa = source.YandexId;
            var sourceVk = source.VkId;

            // --- Дедуп: удаляем строки source там, где у survivor уже есть запись ---

            var survivorChatIds = _db.ChatMembers
                .Where(m => m.UserId == survivorId)
                .Select(m => m.ChatId)
                .ToList();
            var dupChatMembers = _db.ChatMembers
                .Where(m => m.UserId == sourceId && survivorChatIds.Contains(m.ChatId))
                .ToList();
            _db.ChatMembers.RemoveRange(dupChatMembers);

            var survivorMemberships = _db.Memberships.Where(m => m.UserId == survivorId).ToList();
            var sourceMemberships = _db.Memberships.Where(m => m.UserId == sourceId).ToList();
            foreach (var sm in sourceMemberships)
            {
                var dup = survivorMemberships.FirstOrDefault(x => x.ClubId == sm.ClubId);
                if (dup != null)
                {
                    if (sm.IsModerator) dup.IsModerator = true;
                    if (sm.IsAdmin) dup.IsAdmin = true;
                    _db.Memberships.Remove(sm);
                }
                else
                {
                    sm.UserId = survivorId;
                }
            }

            var survivorEventIds = _db.EventParticipants
                .Where(p => p.UserId == survivorId)
                .Select(p => p.EventId)
                .ToList();
            var dupEvents = _db.EventParticipants
                .Where(p => p.UserId == sourceId && survivorEventIds.Contains(p.EventId))
                .ToList();
            _db.EventParticipants.RemoveRange(dupEvents);
            _db.EventParticipants.Where(p => p.UserId == sourceId).ToList()
                .ForEach(p => p.UserId = survivorId);

            var survivorBookingIds = _db.BookingParticipants
                .Where(p => p.UserId == survivorId)
                .Select(p => p.BookingId)
                .ToList();
            var dupBp = _db.BookingParticipants
                .Where(p => p.UserId == sourceId && survivorBookingIds.Contains(p.BookingId))
                .ToList();
            _db.BookingParticipants.RemoveRange(dupBp);
            _db.BookingParticipants.Where(p => p.UserId == sourceId).ToList()
                .ForEach(p => p.UserId = survivorId);

            // --- Переназначение остальных FK source -> survivor ---
            _db.Bookings.Where(b => b.UserId == sourceId).ToList().ForEach(b => b.UserId = survivorId);
            _db.BookingLogs.Where(l => l.UserId == sourceId).ToList().ForEach(l => l.UserId = survivorId);
            _db.ChatMembers.Where(m => m.UserId == sourceId).ToList().ForEach(m => m.UserId = survivorId);
            _db.ChatMessages.Where(m => m.SenderId == sourceId).ToList().ForEach(m => m.SenderId = survivorId);

            // --- Профиль survivor: дозаполнить пустые поля из source ---
            if (string.IsNullOrEmpty(survivor.Email) && !string.IsNullOrEmpty(source.Email)) survivor.Email = source.Email;
            if (string.IsNullOrEmpty(survivor.Name) && !string.IsNullOrWhiteSpace(source.Name)) survivor.Name = source.Name;
            if (string.IsNullOrEmpty(survivor.DisplayName) && !string.IsNullOrWhiteSpace(source.DisplayName)) survivor.DisplayName = source.DisplayName;
            if (string.IsNullOrEmpty(survivor.AvatarUrl) && !string.IsNullOrEmpty(source.AvatarUrl)) survivor.AvatarUrl = source.AvatarUrl;
            if (string.IsNullOrEmpty(survivor.Bio) && !string.IsNullOrWhiteSpace(source.Bio)) survivor.Bio = source.Bio;
            if (string.IsNullOrEmpty(survivor.City) && !string.IsNullOrWhiteSpace(source.City)) survivor.City = source.City;
            if (string.IsNullOrEmpty(survivor.EnabledGameSystems) && !string.IsNullOrWhiteSpace(source.EnabledGameSystems)) survivor.EnabledGameSystems = source.EnabledGameSystems;
            if (string.IsNullOrEmpty(survivor.FcmToken) && !string.IsNullOrEmpty(source.FcmToken)) survivor.FcmToken = source.FcmToken;

            // GoogleId переносим сразу (unique-индекса на GoogleId нет).
            survivor.GoogleId = source.GoogleId;

            // Фаза 1: обнуляем provider IDs у source (unique YandexId/VkId), сохраняем.
            source.YandexId = null;
            source.VkId = null;
            source.GoogleId = string.Empty;
            _db.SaveChanges();

            // Фаза 2: проставляем Yandex/Vk у survivor (source обнулён — конфликта нет), удаляем source.
            if (!string.IsNullOrEmpty(sourceYa) && string.IsNullOrEmpty(survivor.YandexId))
                survivor.YandexId = sourceYa;
            if (!string.IsNullOrEmpty(sourceVk) && string.IsNullOrEmpty(survivor.VkId))
                survivor.VkId = sourceVk;
            _db.Users.Remove(source);
            _db.SaveChanges();

            tx.Commit();
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    private static object UserDto(AppUser u) => new
    {
        u.Id, u.Email, u.Name, u.DisplayName,
        googleLinked = !string.IsNullOrEmpty(u.GoogleId),
        yandexLinked = !string.IsNullOrEmpty(u.YandexId),
        vkLinked = !string.IsNullOrEmpty(u.VkId)
    };

    /// <summary>
    /// Находит существующего пользователя по идентификатору провайдера или по email,
    /// привязывает аккаунт при необходимости и создаёт нового пользователя, если никто не найден.
    /// </summary>
    /// <param name="provider">"google" | "yandex" | "vk"</param>
    /// <param name="providerId">Идентификатор пользователя у провайдера (не пустой)</param>
    /// <param name="email">Email (может быть пустым, напр. у VK)</param>
    /// <param name="name">Отображаемое имя</param>
    /// <param name="avatarUrl">URL аватара (обновляется только при создании или если было пусто)</param>
    private async Task<AppUser> ResolveUserAsync(string provider, string providerId, string email, string name, string? avatarUrl)
    {
        var normalizedEmail = (email ?? "").Trim();
        var trimmedName = string.IsNullOrWhiteSpace(name) ? normalizedEmail : name;

        AppUser? user = provider switch
        {
            "google" => _db.Users.FirstOrDefault(u => u.GoogleId == providerId),
            "yandex" => _db.Users.FirstOrDefault(u => u.YandexId == providerId),
            "vk"     => _db.Users.FirstOrDefault(u => u.VkId == providerId),
            _ => null
        };

        // Если не найден по providerId — пробуем привязать по email.
        if (user == null && !string.IsNullOrEmpty(normalizedEmail))
        {
            user = _db.Users.FirstOrDefault(u => u.Email.ToLower() == normalizedEmail.ToLower());
        }

        if (user == null)
        {
            user = new AppUser
            {
                Id = Guid.NewGuid().ToString(),
                Email = normalizedEmail,
                Name = trimmedName,
                AvatarUrl = avatarUrl,
                EnabledGameSystems = GameSystemConstants.AllJoined
            };
            AssignProviderId(user, provider, providerId);
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
            return user;
        }

        // Существующий пользователь: привязываем провайдера, если ещё не привязан.
        AssignProviderId(user, provider, providerId, onlyIfEmpty: true);

        // Заполняем недостающие поля (имя/аватар), не перезаписывая то, что уже задано.
        if (string.IsNullOrEmpty(user.Email) && !string.IsNullOrEmpty(normalizedEmail))
            user.Email = normalizedEmail;
        if (string.IsNullOrEmpty(user.Name) && !string.IsNullOrWhiteSpace(trimmedName))
            user.Name = trimmedName;
        if (string.IsNullOrEmpty(user.AvatarUrl) && !string.IsNullOrEmpty(avatarUrl))
            user.AvatarUrl = avatarUrl;

        await _db.SaveChangesAsync();
        return user;
    }

    private static void AssignProviderId(AppUser user, string provider, string providerId, bool onlyIfEmpty = false)
    {
        switch (provider)
        {
            case "google":
                if (!onlyIfEmpty || string.IsNullOrEmpty(user.GoogleId))
                    user.GoogleId = providerId;
                break;
            case "yandex":
                if (!onlyIfEmpty || string.IsNullOrEmpty(user.YandexId))
                    user.YandexId = providerId;
                break;
            case "vk":
                if (!onlyIfEmpty || string.IsNullOrEmpty(user.VkId))
                    user.VkId = providerId;
                break;
        }
    }

    private string GenerateJwt(AppUser user)
    {
        var secret = _config["Jwt:Secret"]
            ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Name)
        };
        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record GoogleLoginRequest(string Credential);
public record YandexLoginRequest(string Code, string RedirectUri);
public record VkLoginRequest(string Code, string RedirectUri, string? DeviceId);
