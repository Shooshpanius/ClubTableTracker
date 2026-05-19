import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_service.dart';
import 'notification_log_service.dart';

/// Канал уведомлений для новых сообщений (должен совпадать с ChannelId на сервере)
const _kMessagesChannelId = 'messages';
const _kMessagesChannelName = 'Сообщения';
const _kMessagesChannelDesc = 'Уведомления о новых сообщениях в чате';

final _localNotifications = FlutterLocalNotificationsPlugin();
int _notificationId = 0;

/// Инициализирует LocalNotifications в изоляте фонового обработчика.
Future<void> _initLocalNotificationsForBackground() async {
  const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
  const initSettings = InitializationSettings(
    android: androidInit,
    iOS: DarwinInitializationSettings(),
  );
  await _localNotifications.initialize(initSettings);
  const channel = AndroidNotificationChannel(
    _kMessagesChannelId,
    _kMessagesChannelName,
    description: _kMessagesChannelDesc,
    importance: Importance.high,
  );
  await _localNotifications
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(channel);
}

/// Обработчик фоновых уведомлений (должен быть top-level функцией).
/// Firebase автоматически показывает уведомления с полем notification когда
/// приложение в фоне/завершено. Для data-only сообщений (без notification)
/// мы сами показываем локальное уведомление.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  final now = DateTime.now();
  final title = message.notification?.title ?? message.data['title'] as String?;
  final body = message.notification?.body ?? message.data['body'] as String?;
  final hasNotification = message.notification != null;

  debugPrint('[FCM] 📩 Фоновое сообщение: '
      'title="$title", '
      'hasNotification=$hasNotification, '
      'data=${message.data}');

  // Логируем получение
  await NotificationLogService.log(NotificationLogEntry(
    id: message.messageId ?? now.millisecondsSinceEpoch.toString(),
    receivedAt: now,
    source: 'background',
    title: title,
    body: body,
    data: message.data,
    // Firebase сам показывает notification payload — нам ничего делать не надо
    shown: hasNotification,
  ));

  // Для data-only сообщений (без notification payload) показываем вручную
  if (!hasNotification && (title != null || body != null)) {
    await _initLocalNotificationsForBackground();
    const androidDetails = AndroidNotificationDetails(
      _kMessagesChannelId,
      _kMessagesChannelName,
      channelDescription: _kMessagesChannelDesc,
      importance: Importance.high,
      priority: Priority.high,
    );
    await _localNotifications.show(
      message.messageId?.hashCode ?? now.millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      const NotificationDetails(android: androidDetails),
    );
    debugPrint('[FCM] 📲 Background data-only уведомление показано вручную.');
  }
}

class FcmService {
  static final _messaging = FirebaseMessaging.instance;

  /// Флаг предотвращает повторную регистрацию слушателей при повторном вызове init().
  static bool _initialized = false;

  /// Инициализация FCM: запрос разрешений, получение токена, регистрация на сервере.
  static Future<void> init(String token) async {
    if (token.isEmpty) {
      debugPrint('[FCM] init() пропущен: auth-токен пустой.');
      return;
    }

    if (_initialized) {
      // Повторный вызов (напр. после входа) — только обновляем токен на сервере
      debugPrint('[FCM] Повторный init() — обновляем FCM-токен на сервере.');
      final fcmToken = await _messaging.getToken();
      if (fcmToken != null) await _saveFcmToken(fcmToken, token);
      return;
    }
    _initialized = true;

    await _initLocalNotifications();

    // iOS: показываем уведомления когда приложение на переднем плане
    await _messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    // Запрашиваем разрешение на уведомления (Android 13+, iOS)
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    debugPrint('[FCM] Статус разрешения: ${settings.authorizationStatus}');

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('[FCM] Разрешение отклонено — уведомления не будут работать.');
      return;
    }

    // Получаем FCM токен
    final fcmToken = await _messaging.getToken();
    if (fcmToken == null) {
      debugPrint('[FCM] Токен не получен (getToken() вернул null).');
      return;
    }

    final hint = fcmToken.length >= 8 ? '…${fcmToken.substring(fcmToken.length - 8)}' : fcmToken;
    debugPrint('[FCM] Токен получен ($hint).');

    await _saveFcmToken(fcmToken, token);

    // Обновляем токен при его обновлении Firebase
    _messaging.onTokenRefresh.listen((newToken) async {
      final h = newToken.length >= 8 ? '…${newToken.substring(newToken.length - 8)}' : newToken;
      debugPrint('[FCM] Токен обновлён Firebase ($h) — сохраняем на сервере.');
      await _saveFcmToken(newToken, token);
    });

    // Foreground: показываем уведомление когда приложение открыто
    FirebaseMessaging.onMessage.listen(_showForegroundNotification);

    // Background→open: пользователь нажал на уведомление пока приложение в фоне
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Terminated→open: приложение было запущено нажатием на уведомление
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      debugPrint('[FCM] Приложение запущено из уведомления: '
          'title="${initialMessage.notification?.title}", data=${initialMessage.data}');
      _handleNotificationTap(initialMessage);
    }

    debugPrint('[FCM] Инициализация завершена.');
  }

  /// Обработка нажатия на уведомление (из фона или при запуске приложения)
  static void _handleNotificationTap(RemoteMessage message) {
    debugPrint('[FCM] 👆 Нажатие на уведомление: '
        'title="${message.notification?.title ?? message.data["title"]}", '
        'data=${message.data}');
    NotificationLogService.log(NotificationLogEntry(
      id: '${message.messageId ?? DateTime.now().millisecondsSinceEpoch}_tap',
      receivedAt: DateTime.now(),
      source: 'tap',
      title: message.notification?.title ?? message.data['title'] as String?,
      body: message.notification?.body ?? message.data['body'] as String?,
      data: message.data,
      shown: true,
    ));
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

  /// Показ уведомления, когда приложение открыто (foreground).
  /// Поддерживает как notification-payload, так и data-only сообщения.
  static Future<void> _showForegroundNotification(RemoteMessage message) async {
    final now = DateTime.now();
    final title = message.notification?.title ?? message.data['title'] as String?;
    final body = message.notification?.body ?? message.data['body'] as String?;

    debugPrint('[FCM] 📩 Foreground-сообщение: '
        'title="$title", '
        'chatId=${message.data["chatId"]}');

    // Логируем
    await NotificationLogService.log(NotificationLogEntry(
      id: message.messageId ?? now.millisecondsSinceEpoch.toString(),
      receivedAt: now,
      source: 'foreground',
      title: title,
      body: body,
      data: message.data,
      shown: title != null || body != null,
    ));

    if (title == null && body == null) {
      debugPrint('[FCM] Нет title/body — показ пропущен.');
      return;
    }

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
      title,
      body,
      details,
    );
    debugPrint('[FCM] 📲 Foreground-уведомление показано (id=${_notificationId - 1}).');
  }

  static Future<void> _saveFcmToken(String fcmToken, String authToken) async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString('fcm_token');
    if (stored == fcmToken) {
      debugPrint('[FCM] Токен не изменился — отправка на сервер пропущена.');
      return;
    }

    try {
      final api = ApiService();
      await api.updateFcmToken(fcmToken, authToken);
      await prefs.setString('fcm_token', fcmToken);
      final hint = fcmToken.length >= 8 ? '…${fcmToken.substring(fcmToken.length - 8)}' : fcmToken;
      debugPrint('[FCM] ✓ Токен успешно сохранён на сервере ($hint).');
    } catch (e) {
      debugPrint('[FCM] ✗ Не удалось сохранить токен на сервере: $e');
      // Не критично — при следующем запуске попробуем снова
    }
  }

  /// Сброс FCM токена при выходе из аккаунта
  static Future<void> clearToken(String authToken) async {
    _initialized = false;
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString('fcm_token');
    if (stored == null) {
      debugPrint('[FCM] clearToken: токен не был сохранён локально.');
      return;
    }

    try {
      final api = ApiService();
      await api.updateFcmToken(null, authToken);
      await prefs.remove('fcm_token');
      debugPrint('[FCM] ✓ Токен сброшен на сервере.');
    } catch (e) {
      debugPrint('[FCM] ✗ Не удалось сбросить токен: $e');
    }
  }
}
