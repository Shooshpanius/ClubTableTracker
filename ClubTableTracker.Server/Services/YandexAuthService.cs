using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace ClubTableTracker.Server.Services;

/// <summary>
/// Информация о пользователе, полученная от Яндекса.
/// </summary>
public record YandexUserInfo(
    string Id,
    string Email,
    string Name,
    string? AvatarUrl);

/// <summary>
/// Сервис авторизации через Яндекс (Yandex ID / Яндекс.OAuth).
/// Реализует OAuth 2.0 Authorization Code Flow: обмен кода на access_token
/// и последующий запрос профиля пользователя.
/// </summary>
public class YandexAuthService
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<YandexAuthService> _logger;

    public YandexAuthService(HttpClient http, IConfiguration config, ILogger<YandexAuthService> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_config["Yandex:ClientId"]) &&
        !string.IsNullOrWhiteSpace(_config["Yandex:ClientSecret"]);

    /// <summary>
    /// Обмен авторизационного кода на access_token.
    /// См. https://yandex.ru/dev/id/doc/dg/oauth/concepts/authorization-code.html
    /// </summary>
    public async Task<string?> ExchangeCodeAsync(string code, string redirectUri)
    {
        if (!IsConfigured) return null;

        var clientId = _config["Yandex:ClientId"];
        var clientSecret = _config["Yandex:ClientSecret"];

        // Яндекс принимает учётные данные клиента как в теле, так и через Basic-auth.
        // Используем Basic-auth (client_id:client_secret), как рекомендует документация.
        var tokenUri = "https://oauth.yandex.ru/token";

        var request = new HttpRequestMessage(HttpMethod.Post, tokenUri)
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["code"] = code,
                ["client_id"] = clientId!,
                ["client_secret"] = clientSecret!,
                ["redirect_uri"] = redirectUri
            })
        };

        try
        {
            var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Yandex token exchange failed: {Status} {Body}", (int)response.StatusCode, body);
                return null;
            }

            var token = await response.Content.ReadFromJsonAsync<YandexTokenResponse>();
            return token?.AccessToken;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during Yandex token exchange.");
            return null;
        }
    }

    /// <summary>
    /// Запрос профиля пользователя через login.yandex.ru/info.
    /// См. https://yandex.ru/dev/id/doc/dg/api/reference/about.html
    /// </summary>
    public async Task<YandexUserInfo?> GetUserInfoAsync(string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "https://login.yandex.ru/info");
        request.Headers.Authorization = new AuthenticationHeaderValue("OAuth", accessToken);

        try
        {
            var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Yandex user info request failed: {Status} {Body}", (int)response.StatusCode, body);
                return null;
            }

            var info = await response.Content.ReadFromJsonAsync<YandexInfoResponse>();
            if (info == null || string.IsNullOrEmpty(info.Id)) return null;

            var email = info.DefaultEmail
                ?? (info.Emails != null && info.Emails.Count > 0 ? info.Emails[0] : "")
                ?? "";
            var name = (string.IsNullOrWhiteSpace(info.RealName) ? info.DisplayName : info.RealName) ?? "";
            var avatarUrl = !string.IsNullOrEmpty(info.DefaultAvatarId)
                ? $"https://avatars.yandex.net/get-yapic/{info.DefaultAvatarId}/islands-200"
                : null;

            return new YandexUserInfo(info.Id, email, name, avatarUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while fetching Yandex user info.");
            return null;
        }
    }

    private record YandexTokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken);

    private record YandexInfoResponse(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("default_email")] string? DefaultEmail,
        [property: JsonPropertyName("emails")] List<string>? Emails,
        [property: JsonPropertyName("real_name")] string? RealName,
        [property: JsonPropertyName("display_name")] string? DisplayName,
        [property: JsonPropertyName("default_avatar_id")] string? DefaultAvatarId);
}
