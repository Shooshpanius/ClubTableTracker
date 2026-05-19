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
        if (!_initialized)
        {
            _logger.LogWarning("FCM[chatId={ChatId}] Firebase не инициализирован — уведомления отключены.", chatId);
            return;
        }

        var tokens = recipientTokens
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Distinct()
            .ToList();

        if (tokens.Count == 0)
        {
            _logger.LogInformation("FCM[chatId={ChatId}] Нет получателей с FCM-токеном — уведомления не отправляются.", chatId);
            return;
        }

        _logger.LogInformation("FCM[chatId={ChatId}] Отправка уведомления от '{Sender}' — {Count} получател(ей).",
            chatId, senderName, tokens.Count);

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

        var sent = 0;
        var failed = 0;

        foreach (var msg in messages)
        {
            // Показываем только последние 8 символов токена, чтобы можно было сопоставить с Flutter-логом
            var tokenHint = msg.Token.Length >= 8 ? "…" + msg.Token[^8..] : msg.Token;
            try
            {
                var messageId = await FirebaseMessaging.DefaultInstance.SendAsync(msg);
                sent++;
                _logger.LogInformation(
                    "FCM[chatId={ChatId}] ✓ Уведомление доставлено (токен={TokenHint}, fcmMessageId={MessageId}).",
                    chatId, tokenHint, messageId);
            }
            catch (FirebaseMessagingException ex) when (
                ex.MessagingErrorCode == MessagingErrorCode.Unregistered ||
                ex.MessagingErrorCode == MessagingErrorCode.InvalidArgument)
            {
                failed++;
                _logger.LogWarning(
                    "FCM[chatId={ChatId}] ✗ Токен недействителен (токен={TokenHint}): {Error}",
                    chatId, tokenHint, ex.Message);
            }
            catch (Exception ex)
            {
                failed++;
                _logger.LogError(ex,
                    "FCM[chatId={ChatId}] ✗ Ошибка отправки (токен={TokenHint}).",
                    chatId, tokenHint);
            }
        }

        _logger.LogInformation(
            "FCM[chatId={ChatId}] Итого: {Sent} доставлено, {Failed} ошибок из {Total}.",
            chatId, sent, failed, tokens.Count);
    }
}
