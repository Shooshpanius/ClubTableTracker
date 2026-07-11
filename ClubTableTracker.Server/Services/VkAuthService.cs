using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ClubTableTracker.Server.Services;

/// <summary>
/// Информация о пользователе, полученная от ВКонтакте (VK ID).
/// </summary>
public record VkUserInfo(
    string Id,
    string Email,
    string Name,
    string? AvatarUrl);

/// <summary>
/// Сервис авторизации через ВКонтакте (VK ID).
/// Реализует OAuth 2.0 Authorization Code Flow с использованием нового
/// endpoint VK ID (https://id.vk.com). Профиль запрашивается через
/// метод /method/account.getProfileInfo API ВКонтакте.
/// </summary>
public class VkAuthService
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<VkAuthService> _logger;

    public VkAuthService(HttpClient http, IConfiguration config, ILogger<VkAuthService> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_config["Vk:ClientId"]) &&
        !string.IsNullOrWhiteSpace(_config["Vk:ClientSecret"]);

    /// <summary>
    /// Обмен авторизационного кода на access_token (VK ID OAuth2).
    /// См. https://id.vk.com/about/business/go/docs/vkid/latest/vk-id/connection/auto/step-2/
    /// Возвращает access_token, user_id и (если доступен) email.
    /// </summary>
    public async Task<VkTokenResult?> ExchangeCodeAsync(string code, string redirectUri, string? deviceId)
    {
        if (!IsConfigured) return null;

        var clientId = _config["Vk:ClientId"];
        var clientSecret = _config["Vk:ClientSecret"];

        var tokenUri = "https://id.vk.com/oauth2/auth";

        var formValues = new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["client_id"] = clientId!,
            ["client_secret"] = clientSecret!,
            ["redirect_uri"] = redirectUri
        };
        if (!string.IsNullOrEmpty(deviceId))
            formValues["device_id"] = deviceId;

        var request = new HttpRequestMessage(HttpMethod.Post, tokenUri)
        {
            Content = new FormUrlEncodedContent(formValues)
        };

        try
        {
            var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("VK token exchange failed: {Status} {Body}", (int)response.StatusCode, body);
                return null;
            }

            var token = await response.Content.ReadFromJsonAsync<VkTokenResponse>();
            if (token == null || string.IsNullOrEmpty(token.AccessToken)) return null;
            return new VkTokenResult(token.AccessToken, token.UserId, token.Email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during VK token exchange.");
            return null;
        }
    }

    /// <summary>
    /// Запрос профиля пользователя через API ВКонтакте.
    /// Используем account.getProfileInfo + users.get для аватара.
    /// </summary>
    public async Task<VkUserInfo?> GetUserInfoAsync(string accessToken, string? userId)
    {
        const string apiVersion = "5.199";

        try
        {
            // users.get возвращает id, имя, фамилию и фото.
            var usersUri = $"https://api.vk.com/method/users.get?v={apiVersion}&fields=photo_200,has_photo&access_token={Uri.EscapeDataString(accessToken)}";
            var usersResp = await _http.GetFromJsonAsync<VkUsersGetResponse>(usersUri);
            var user = usersResp?.Response?.FirstOrDefault();
            if (user == null) return null;

            var id = user.Id.ToString();
            var name = $"{user.FirstName} {user.LastName}".Trim();
            var avatarUrl = !string.IsNullOrEmpty(user.Photo200) ? user.Photo200 : null;

            // Email приходит либо в token-ответе (в поле email), либо отсутствует.
            // VK не всегда отдаёт email — оставляем пустым, если недоступен.
            var email = userId ?? "";

            return new VkUserInfo(id, email, name, avatarUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while fetching VK user info.");
            return null;
        }
    }

    /// <summary>
    /// Результат обмена кода на токен ВКонтакте.
    /// </summary>
    public record VkTokenResult(string AccessToken, string? UserId, string? Email);

    private record VkTokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("user_id")] string? UserId,
        [property: JsonPropertyName("email")] string? Email);

    private record VkUsersGetResponse(
        [property: JsonPropertyName("response")] List<VkUser>? Response);

    private record VkUser(
        [property: JsonPropertyName("id")] long Id,
        [property: JsonPropertyName("first_name")] string FirstName,
        [property: JsonPropertyName("last_name")] string LastName,
        [property: JsonPropertyName("photo_200")] string? Photo200);
}
