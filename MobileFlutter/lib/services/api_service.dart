import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import '../constants.dart';

/// Сервис для работы с API ClubTableTracker
class ApiService {
  final String _base;
  final http.Client _client;

  ApiService({String? baseUrl})
      : _base = baseUrl ?? apiBaseUrl,
        _client = _buildClient(baseUrl ?? apiBaseUrl);

  /// Создаёт HTTP-клиент, принимающий самоподписанные/нераспознанные
  /// сертификаты только для хоста API (go40k.ru).
  /// TODO: убрать badCertificateCallback после настройки корректного
  /// TLS-сертификата на сервере (Let's Encrypt или другой доверенный CA).
  static http.Client _buildClient(String baseUrl) {
    final apiHost = Uri.parse(baseUrl).host;
    final httpClient = HttpClient()
      ..badCertificateCallback =
          (X509Certificate cert, String host, int port) => host == apiHost;
    return IOClient(httpClient);
  }

  Map<String, String> _headers(String? token) {
    final h = <String, String>{'Content-Type': 'application/json'};
    if (token != null && token.isNotEmpty) {
      h['Authorization'] = 'Bearer $token';
    }
    return h;
  }

  // ─── Клубы ───────────────────────────────────────────────────────────────

  Future<List<dynamic>> getClubs() async {
    final res = await _client.get(Uri.parse('$_base/api/club'));
    _checkStatus(res);
    return jsonDecode(res.body) as List<dynamic>;
  }

  Future<List<dynamic>> getMyMemberships(String token) async {
    final res = await _client.get(
      Uri.parse('$_base/api/club/my-memberships'),
      headers: _headers(token),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as List<dynamic>;
  }

  Future<Map<String, dynamic>> applyToClub(int clubId, String token) async {
    final res = await _client.post(
      Uri.parse('$_base/api/club/$clubId/apply'),
      headers: _headers(token),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<List<dynamic>> getClubTables(int clubId, String token) async {
    final res = await _client.get(
      Uri.parse('$_base/api/club/$clubId/tables'),
      headers: _headers(token),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as List<dynamic>;
  }

  Future<List<dynamic>> getClubMembers(int clubId, String token) async {
    final res = await _client.get(
      Uri.parse('$_base/api/club/$clubId/members'),
      headers: _headers(token),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as List<dynamic>;
  }

  Future<List<dynamic>> getClubGallery(int clubId, String token) async {
    final res = await _client.get(
      Uri.parse('$_base/api/club/$clubId/gallery'),
      headers: _headers(token),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as List<dynamic>;
  }

  // ─── Бронирования ────────────────────────────────────────────────────────

  Future<List<dynamic>> getBookings(int clubId, String token) async {
    final res = await _client.get(
      Uri.parse('$_base/api/booking/club/$clubId'),
      headers: _headers(token),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as List<dynamic>;
  }

  Future<List<dynamic>> getMyUpcomingBookings(String token,
      {int? clubId}) async {
    final query = clubId != null ? '?clubId=$clubId' : '';
    final res = await _client.get(
      Uri.parse('$_base/api/booking/my-upcoming$query'),
      headers: _headers(token),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as List<dynamic>;
  }

  Future<List<dynamic>> getAllUpcomingBookings(String token,
      {int? clubId}) async {
    final query = clubId != null ? '?clubId=$clubId' : '';
    final res = await _client.get(
      Uri.parse('$_base/api/booking/upcoming-all$query'),
      headers: _headers(token),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as List<dynamic>;
  }

  /// Создать бронирование
  Future<Map<String, dynamic>> createBooking({
    required int tableId,
    required String startTime,
    required String endTime,
    required String token,
    String? gameSystem,
    bool isDoubles = false,
    bool isForOthers = false,
    List<String>? invitedUserIds,
  }) async {
    final body = <String, dynamic>{
      'tableId': tableId,
      'startTime': startTime,
      'endTime': endTime,
      if (gameSystem != null) 'gameSystem': gameSystem,
      'isDoubles': isDoubles,
      'isForOthers': isForOthers,
      if (invitedUserIds != null) 'invitedUserIds': invitedUserIds,
    };
    final res = await _client.post(
      Uri.parse('$_base/api/booking'),
      headers: _headers(token),
      body: jsonEncode(body),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  /// Отменить бронирование
  Future<void> cancelBooking(int bookingId, String token) async {
    final res = await _client.delete(
      Uri.parse('$_base/api/booking/$bookingId'),
      headers: _headers(token),
    );
    _checkStatus(res);
  }

  /// Присоединиться к бронированию
  Future<void> joinBooking(int bookingId, String token) async {
    final res = await _client.post(
      Uri.parse('$_base/api/booking/$bookingId/join'),
      headers: _headers(token),
    );
    _checkStatus(res);
  }

  /// Покинуть бронирование
  Future<void> leaveBooking(int bookingId, String token) async {
    final res = await _client.delete(
      Uri.parse('$_base/api/booking/$bookingId/leave'),
      headers: _headers(token),
    );
    _checkStatus(res);
  }

  /// Принять приглашение на бронирование
  Future<void> acceptInvite(int bookingId, String token) async {
    final res = await _client.post(
      Uri.parse('$_base/api/booking/$bookingId/accept-invite'),
      headers: _headers(token),
    );
    _checkStatus(res);
  }

  /// Отклонить приглашение на бронирование
  Future<void> declineInvite(int bookingId, String token) async {
    final res = await _client.delete(
      Uri.parse('$_base/api/booking/$bookingId/decline-invite'),
      headers: _headers(token),
    );
    _checkStatus(res);
  }

  // ─── События ─────────────────────────────────────────────────────────────

  Future<List<dynamic>> getClubEvents(int clubId, {String? token}) async {
    final res = await _client.get(
      Uri.parse('$_base/api/event/club/$clubId'),
      headers: _headers(token),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as List<dynamic>;
  }

  Future<void> registerEvent(int eventId, String token) async {
    final res = await _client.post(
      Uri.parse('$_base/api/event/$eventId/register'),
      headers: _headers(token),
    );
    _checkStatus(res);
  }

  Future<void> unregisterEvent(int eventId, String token) async {
    final res = await _client.delete(
      Uri.parse('$_base/api/event/$eventId/unregister'),
      headers: _headers(token),
    );
    _checkStatus(res);
  }

  Future<Map<String, dynamic>> getCampaignMap(
      int eventId, String token) async {
    final res = await _client.get(
      Uri.parse('$_base/api/campaign-map/$eventId'),
      headers: _headers(token),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<List<dynamic>> getActivityLog(String token, {int? clubId}) async {
    final query = clubId != null ? '?clubId=$clubId' : '';
    final res = await _client.get(
      Uri.parse('$_base/api/booking/activity-log$query'),
      headers: _headers(token),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as List<dynamic>;
  }

  Future<List<dynamic>> getClubDecorations(int clubId, String token) async {
    final res = await _client.get(
      Uri.parse('$_base/api/club/$clubId/decorations'),
      headers: _headers(token),
    );
    if (res.statusCode == 404) return [];
    _checkStatus(res);
    return jsonDecode(res.body) as List<dynamic>;
  }

  // ─── Пользователь ────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getMe(String token) async {
    final res = await _client.get(
      Uri.parse('$_base/api/user/me'),
      headers: _headers(token),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<void> updateDisplayName(String name, String token) async {
    final res = await _client.put(
      Uri.parse('$_base/api/user/display-name'),
      headers: _headers(token),
      body: jsonEncode({'displayName': name}),
    );
    _checkStatus(res);
  }

  Future<void> updateBio(String bio, String token) async {
    final res = await _client.put(
      Uri.parse('$_base/api/user/bio'),
      headers: _headers(token),
      body: jsonEncode({'bio': bio}),
    );
    _checkStatus(res);
  }

  Future<void> updateCity(String city, String token) async {
    final res = await _client.put(
      Uri.parse('$_base/api/user/city'),
      headers: _headers(token),
      body: jsonEncode({'city': city}),
    );
    _checkStatus(res);
  }

  Future<void> updateGameSystems(
      List<String> systems, String token) async {
    final res = await _client.put(
      Uri.parse('$_base/api/user/game-systems'),
      headers: _headers(token),
      body: jsonEncode({'enabledGameSystems': systems}),
    );
    _checkStatus(res);
  }

  Future<void> updateBookingColors(
      Map<String, String> colors, String token) async {
    final res = await _client.put(
      Uri.parse('$_base/api/user/booking-colors'),
      headers: _headers(token),
      body: jsonEncode({'bookingColors': jsonEncode(colors)}),
    );
    _checkStatus(res);
  }

  Future<void> updateFcmToken(String? fcmToken, String token) async {
    final res = await _client.put(
      Uri.parse('$_base/api/user/fcm-token'),
      headers: _headers(token),
      body: jsonEncode({'fcmToken': fcmToken}),
    );
    _checkStatus(res);
  }

  // ─── Авторизация ─────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> googleLogin(String credential) async {
    final res = await _client.post(
      Uri.parse('$_base/api/auth/google'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'credential': credential}),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  // ─── Мессенджер ──────────────────────────────────────────────────────────

  Future<List<dynamic>> getChats(String token) async {
    final res = await _client.get(
      Uri.parse('$_base/api/messenger/chats'),
      headers: _headers(token),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as List<dynamic>;
  }

  Future<List<dynamic>> getChatMessages(int chatId, String token,
      {int skip = 0, int take = 50}) async {
    var url = '$_base/api/messenger/chats/$chatId/messages?skip=$skip&take=$take';
    final res = await _client.get(Uri.parse(url), headers: _headers(token));
    _checkStatus(res);
    return jsonDecode(res.body) as List<dynamic>;
  }

  Future<Map<String, dynamic>> sendMessage(
      int chatId, String text, String token,
      {int? replyToId}) async {
    final body = <String, dynamic>{
      'text': text,
      if (replyToId != null) 'replyToId': replyToId,
    };
    final res = await _client.post(
      Uri.parse('$_base/api/messenger/chats/$chatId/messages'),
      headers: _headers(token),
      body: jsonEncode(body),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<void> markChatRead(int chatId, String token) async {
    await _client.post(
      Uri.parse('$_base/api/messenger/chats/$chatId/read'),
      headers: _headers(token),
    );
  }

  Future<void> deleteMessage(int chatId, int messageId, String token) async {
    final res = await _client.delete(
      Uri.parse('$_base/api/messenger/chats/$chatId/messages/$messageId'),
      headers: _headers(token),
    );
    _checkStatus(res);
  }

  Future<Map<String, dynamic>> createDirectChat(
      String otherUserId, String token) async {
    final res = await _client.post(
      Uri.parse('$_base/api/messenger/chats/direct'),
      headers: _headers(token),
      body: jsonEncode({'otherUserId': otherUserId}),
    );
    _checkStatus(res);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  // ─── Вспомогательное ─────────────────────────────────────────────────────

  void _checkStatus(http.Response res) {
    if (res.statusCode == 401) {
      throw ApiException(401, 'Сессия истекла. Войдите снова.');
    }
    if (res.statusCode == 403) {
      throw ApiException(403, 'Нет доступа.');
    }
    if (res.statusCode >= 400) {
      String msg = 'Ошибка ${res.statusCode}';
      try {
        final body = jsonDecode(res.body);
        if (body is Map && body.containsKey('message')) {
          msg = body['message'] as String;
        } else if (res.body.isNotEmpty) {
          msg = res.body;
        }
      } catch (_) {
        if (res.body.isNotEmpty) msg = res.body;
      }
      throw ApiException(res.statusCode, msg);
    }
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;

  const ApiException(this.statusCode, this.message);

  @override
  String toString() => message;
}
