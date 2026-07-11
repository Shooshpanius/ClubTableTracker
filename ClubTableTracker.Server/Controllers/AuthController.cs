using Google.Apis.Auth;
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
