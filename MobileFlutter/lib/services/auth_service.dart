import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Сервис авторизации: хранение/чтение JWT токена
class AuthService {
  static const _tokenKey = 'token';

  static Future<String> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey) ?? '';
  }

  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  static Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  /// Проверить, не истёк ли токен
  static bool isTokenExpired(String token) {
    if (token.isEmpty) return true;
    try {
      final parts = token.split('.');
      if (parts.length != 3) return true;
      final payload = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      final normalized =
          payload.padRight((payload.length + 3) ~/ 4 * 4, '=');
      final decoded = utf8.decode(base64Decode(normalized));
      final json = jsonDecode(decoded) as Map<String, dynamic>;
      final exp = json['exp'];
      if (exp == null) return false;
      final expTime =
          DateTime.fromMillisecondsSinceEpoch((exp as int) * 1000);
      return DateTime.now().isAfter(expTime);
    } catch (_) {
      return true;
    }
  }

  /// Извлечь userId из токена
  static String? getUserId(String token) {
    if (token.isEmpty) return null;
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final payload = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      final normalized =
          payload.padRight((payload.length + 3) ~/ 4 * 4, '=');
      final decoded = utf8.decode(base64Decode(normalized));
      final json = jsonDecode(decoded) as Map<String, dynamic>;
      return json[
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] as String?;
    } catch (_) {
      return null;
    }
  }
}
