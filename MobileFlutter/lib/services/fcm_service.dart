import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_service.dart';

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

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

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
