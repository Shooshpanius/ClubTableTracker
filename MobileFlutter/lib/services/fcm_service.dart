import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_service.dart';

/// Канал уведомлений для новых сообщений (должен совпадать с ChannelId на сервере)
const _kMessagesChannelId = 'messages';
const _kMessagesChannelName = 'Сообщения';
const _kMessagesChannelDesc = 'Уведомления о новых сообщениях в чате';

final _localNotifications = FlutterLocalNotificationsPlugin();
int _notificationId = 0;

/// Обработчик фоновых уведомлений (должен быть top-level функцией)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // При получении уведомления в фоне — ничего особенного делать не нужно,
  // Firebase сам показывает notification payload
}

class FcmService {
  static final _messaging = FirebaseMessaging.instance;

  /// Инициализация FCM: запрос разрешений, получение токена, регистрация на сервере.
  static Future<void> init(String token) async {
    if (token.isEmpty) return;

    await _initLocalNotifications();

    // Запрашиваем разрешение на уведомления (Android 13+, iOS)
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    // Получаем FCM токен
    final fcmToken = await _messaging.getToken();
    if (fcmToken == null) return;

    await _saveFcmToken(fcmToken, token);

    // Обновляем токен при его обновлении Firebase
    _messaging.onTokenRefresh.listen((newToken) async {
      await _saveFcmToken(newToken, token);
    });

    // Показываем уведомление при получении сообщения, когда приложение открыто
    FirebaseMessaging.onMessage.listen(_showForegroundNotification);
  }

  /// Инициализация flutter_local_notifications и создание канала "messages"
  static Future<void> _initLocalNotifications() async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    const initSettings = InitializationSettings(android: androidInit, iOS: iosInit);
    await _localNotifications.initialize(initSettings);

    const channel = AndroidNotificationChannel(
      _kMessagesChannelId,
      _kMessagesChannelName,
      description: _kMessagesChannelDesc,
      importance: Importance.high,
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  /// Показ уведомления, когда приложение открыто (foreground)
  static Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    const androidDetails = AndroidNotificationDetails(
      _kMessagesChannelId,
      _kMessagesChannelName,
      channelDescription: _kMessagesChannelDesc,
      importance: Importance.high,
      priority: Priority.high,
    );
    const details = NotificationDetails(android: androidDetails);

    await _localNotifications.show(
      _notificationId++,
      notification.title,
      notification.body,
      details,
    );
  }

  static Future<void> _saveFcmToken(String fcmToken, String authToken) async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString('fcm_token');
    if (stored == fcmToken) return; // токен не изменился

    try {
      final api = ApiService();
      await api.updateFcmToken(fcmToken, authToken);
      await prefs.setString('fcm_token', fcmToken);
    } catch (_) {
      // Не критично — при следующем запуске попробуем снова
    }
  }

  /// Сброс FCM токена при выходе из аккаунта
  static Future<void> clearToken(String authToken) async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString('fcm_token');
    if (stored == null) return;

    try {
      final api = ApiService();
      await api.updateFcmToken(null, authToken);
      await prefs.remove('fcm_token');
    } catch (_) {}
  }
}
