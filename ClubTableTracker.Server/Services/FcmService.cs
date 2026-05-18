using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;

namespace ClubTableTracker.Server.Services;

public class FcmService
{
    private readonly ILogger<FcmService> _logger;
    private readonly bool _initialized;

    public FcmService(ILogger<FcmService> logger, IConfiguration config)
    {
        _logger = logger;

        if (FirebaseApp.DefaultInstance != null)
        {
            _initialized = true;
            return;
        }

        var serviceAccountJson = config["Firebase:ServiceAccountJson"];
        if (string.IsNullOrWhiteSpace(serviceAccountJson))
        {
            _logger.LogWarning("Firebase:ServiceAccountJson is not configured. Push notifications will be disabled.");
            return;
        }

        try
        {
            FirebaseApp.Create(new AppOptions
            {
                Credential = GoogleCredential.FromJson(serviceAccountJson)
            });
            _initialized = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize Firebase Admin SDK. Push notifications will be disabled.");
        }
    }

    public async Task SendMessageNotificationAsync(
        IEnumerable<string> recipientTokens,
        string senderName,
        string messageText,
        int chatId)
    {
        if (!_initialized) return;

        var tokens = recipientTokens
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Distinct()
            .ToList();

        if (tokens.Count == 0) return;

        var body = messageText.Length > 100
            ? messageText[..100] + "…"
            : messageText;

        var messages = tokens.Select(token => new Message
        {
            Token = token,
            Notification = new Notification
            {
                Title = senderName,
                Body = body
            },
            Data = new Dictionary<string, string>
            {
                { "chatId", chatId.ToString() },
                { "type", "new_message" }
            },
            Android = new AndroidConfig
            {
                Priority = Priority.High,
                Notification = new AndroidNotification
                {
                    ChannelId = "messages"
                }
            }
        }).ToList();

        foreach (var msg in messages)
        {
            try
            {
                await FirebaseMessaging.DefaultInstance.SendAsync(msg);
            }
            catch (FirebaseMessagingException ex) when (
                ex.MessagingErrorCode == MessagingErrorCode.Unregistered ||
                ex.MessagingErrorCode == MessagingErrorCode.InvalidArgument)
            {
                // Токен устарел или недействителен — не критично, логируем предупреждение
                _logger.LogWarning("FCM token is no longer valid (chatId={ChatId}): {Error}", chatId, ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send FCM notification to token (chatId={ChatId})", chatId);
            }
        }
    }
}
