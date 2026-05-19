import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Запись о полученном FCM-уведомлении
class NotificationLogEntry {
  final String id;
  final DateTime receivedAt;

  /// 'foreground' | 'background' | 'tap' | 'launch'
  final String source;
  final String? title;
  final String? body;
  final Map<String, dynamic> data;

  /// Было ли показано как системное уведомление
  final bool shown;

  const NotificationLogEntry({
    required this.id,
    required this.receivedAt,
    required this.source,
    this.title,
    this.body,
    required this.data,
    required this.shown,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'receivedAt': receivedAt.toIso8601String(),
        'source': source,
        'title': title,
        'body': body,
        'data': data,
        'shown': shown,
      };

  factory NotificationLogEntry.fromJson(Map<String, dynamic> j) =>
      NotificationLogEntry(
        id: j['id'] as String,
        receivedAt: DateTime.parse(j['receivedAt'] as String),
        source: j['source'] as String,
        title: j['title'] as String?,
        body: j['body'] as String?,
        data: (j['data'] as Map?)?.cast<String, dynamic>() ?? {},
        shown: j['shown'] as bool? ?? false,
      );
}

/// Хранит лог FCM-уведомлений в SharedPreferences (до 100 записей).
/// Используется для диагностики: понять, дошло ли уведомление и откуда.
class NotificationLogService {
  static const _key = 'fcm_notification_log';
  static const _maxEntries = 100;

  static Future<void> log(NotificationLogEntry entry) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      final List<dynamic> list =
          raw != null ? jsonDecode(raw) as List<dynamic> : [];
      list.insert(0, entry.toJson());
      if (list.length > _maxEntries) {
        list.removeRange(_maxEntries, list.length);
      }
      await prefs.setString(_key, jsonEncode(list));
      debugPrint('[FCMLog] ✓ ${entry.source} | "${entry.title}" | ${entry.receivedAt.toLocal()}');
    } catch (e) {
      debugPrint('[FCMLog] ✗ Ошибка записи: $e');
    }
  }

  static Future<List<NotificationLogEntry>> getAll() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw == null) return [];
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .map((e) => NotificationLogEntry.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('[FCMLog] ✗ Ошибка чтения: $e');
      return [];
    }
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
