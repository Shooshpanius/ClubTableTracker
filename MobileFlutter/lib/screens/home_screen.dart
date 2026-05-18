import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../app_colors.dart';
import '../constants.dart';
import '../version.dart';
import '../models/club.dart';
import '../models/membership.dart';
import '../models/club_event.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/fcm_service.dart';

class HomeScreen extends StatefulWidget {
  final String token;
  final ValueChanged<String> onTokenChanged;

  const HomeScreen({
    super.key,
    required this.token,
    required this.onTokenChanged,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const _signingChannel =
      MethodChannel('com.example.club_table_tracker/signing');

  final _api = ApiService();
  final _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
    serverClientId: googleServerClientId,
  );

  String get _token => widget.token;

  List<Club> _clubs = [];
  List<Membership> _memberships = [];
  Map<int, List<ClubEvent>> _clubEventsMap = {};
  int _totalUnread = 0;
  bool _loading = false;
  String? _error;

  Timer? _unreadTimer;

  @override
  void initState() {
    super.initState();
    _loadData();
    _startUnreadPolling();
  }

  @override
  void didUpdateWidget(HomeScreen old) {
    super.didUpdateWidget(old);
    if (old.token != widget.token) {
      _loadData();
      _startUnreadPolling();
    }
  }

  @override
  void dispose() {
    _unreadTimer?.cancel();
    super.dispose();
  }

  void _startUnreadPolling() {
    _unreadTimer?.cancel();
    if (_token.isEmpty || AuthService.isTokenExpired(_token)) return;
    _fetchUnread();
    _unreadTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      _fetchUnread();
    });
  }

  Future<void> _fetchUnread() async {
    if (_token.isEmpty) return;
    try {
      final chats = await _api.getChats(_token);
      if (!mounted) return;
      final total = chats.fold<int>(
          0, (sum, c) => sum + ((c['unreadCount'] as int?) ?? 0));
      setState(() => _totalUnread = total);
    } catch (_) {}
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final clubsData = await _api.getClubs();
      final clubs = clubsData
          .map((c) => Club.fromJson(c as Map<String, dynamic>))
          .toList();

      List<Membership> memberships = [];
      if (_token.isNotEmpty && !AuthService.isTokenExpired(_token)) {
        try {
          final mData = await _api.getMyMemberships(_token);
          memberships = mData
              .map((m) => Membership.fromJson(m as Map<String, dynamic>))
              .toList();
        } catch (_) {}
      }

      if (!mounted) return;
      setState(() {
        _clubs = clubs;
        _memberships = memberships;
        _loading = false;
      });

      // Загружаем события для каждого клуба
      for (final club in clubs) {
        _loadClubEvents(club.id);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadClubEvents(int clubId) async {
    try {
      final evData = await _api.getClubEvents(
        clubId,
        token: _token.isNotEmpty ? _token : null,
      );
      if (!mounted) return;
      final events = evData
          .map((e) => ClubEvent.fromJson(e as Map<String, dynamic>))
          .toList();
      setState(() => _clubEventsMap[clubId] = events);
    } catch (_) {}
  }

  Future<void> _handleGoogleLogin() async {
    try {
      final account = await _googleSignIn.signIn();
      if (account == null) return;
      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) {
        _showSnack('Не удалось получить токен Google');
        return;
      }
      final data = await _api.googleLogin(idToken);
      final token = data['token'] as String;
      await AuthService.saveToken(token);
      FcmService.init(token);
      widget.onTokenChanged(token);
    } catch (e) {
      if (e is PlatformException &&
          e.code == 'sign_in_failed' &&
          (e.message?.contains(': 10:') ?? false)) {
        String sha1Info = 'не удалось получить';
        try {
          final sha1 = await _signingChannel.invokeMethod<String>('getSha1');
          if (sha1 != null) sha1Info = sha1;
        } catch (_) {}
        if (!mounted) return;
        showDialog<void>(
          context: context,
          builder: (_) => AlertDialog(
            backgroundColor: AppColors.cardBg,
            title: const Text(
              'Google Sign-In: ошибка 10',
              style: TextStyle(color: AppColors.accent),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'SHA-1 этой сборки не зарегистрирован в Google Cloud Console.',
                  style: TextStyle(color: AppColors.textPrimary),
                ),
                const SizedBox(height: 12),
                const Text(
                  'SHA-1 подписи:',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                const SizedBox(height: 4),
                SelectableText(
                  sha1Info,
                  style: const TextStyle(
                    color: AppColors.accentBlue,
                    fontFamily: 'monospace',
                    fontSize: 13,
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK', style: TextStyle(color: AppColors.accent)),
              ),
            ],
          ),
        );
      } else {
        _showSnack('Ошибка входа: $e');
      }
    }
  }

  Future<void> _logout() async {
    await FcmService.clearToken(_token);
    await _googleSignIn.signOut();
    await AuthService.clearToken();
    widget.onTokenChanged('');
  }

  Future<void> _applyToClub(int clubId) async {
    if (_token.isEmpty) {
      _showSnack('Войдите для подачи заявки');
      return;
    }
    try {
      final data = await _api.applyToClub(clubId, _token);
      final club = _clubs.firstWhere((c) => c.id == clubId);
      final existing = _memberships.indexWhere((m) => m.club.id == clubId);
      final newMembership = Membership(
        id: data['id'] as int,
        status: data['status'] as String,
        club: club,
      );
      setState(() {
        if (existing >= 0) {
          _memberships[existing] = newMembership;
        } else {
          _memberships.add(newMembership);
        }
      });
      _showSnack('Заявка подана');
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  void _showSnack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: const TextStyle(color: AppColors.textPrimary)),
        backgroundColor: AppColors.panelBg,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLoggedIn =
        _token.isNotEmpty && !AuthService.isTokenExpired(_token);

    final memberClubs = _clubs
        .where((c) =>
            _memberships.any((m) => m.club.id == c.id && m.isApproved))
        .toList();
    final otherClubs = _clubs
        .where((c) =>
            !_memberships.any((m) => m.club.id == c.id && m.isApproved))
        .toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadData,
          color: AppColors.accent,
          backgroundColor: AppColors.cardBg,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _buildHeader(isLoggedIn)),
              if (_loading)
                const SliverFillRemaining(
                  child: Center(
                    child: CircularProgressIndicator(
                        color: AppColors.accent),
                  ),
                )
              else if (_error != null)
                SliverFillRemaining(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(_error!,
                              style: const TextStyle(
                                  color: AppColors.accent)),
                          const SizedBox(height: 12),
                          ElevatedButton(
                            onPressed: _loadData,
                            child: const Text('Повторить'),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else ...[
                if (!isLoggedIn)
                  SliverToBoxAdapter(child: _buildWelcomeCard()),
                if (memberClubs.isNotEmpty) ...[
                  SliverToBoxAdapter(
                    child: _buildSectionHeader('Мои клубы',
                        color: AppColors.accent),
                  ),
                  SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (_, i) => _buildClubCard(memberClubs[i]),
                      childCount: memberClubs.length,
                    ),
                  ),
                ],
                SliverToBoxAdapter(
                  child: _buildSectionHeader('Все клубы',
                      color: AppColors.textSecondary),
                ),
                if (otherClubs.isEmpty && memberClubs.isNotEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      child: Text(
                        'Все доступные клубы уже в разделе «Мои клубы».',
                        style: TextStyle(
                            color: AppColors.textMuted, fontSize: 13),
                      ),
                    ),
                  ),
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => _buildClubCard(otherClubs[i]),
                    childCount: otherClubs.length,
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 32)),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(bool isLoggedIn) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: const BoxDecoration(
        border: Border(
            bottom: BorderSide(color: AppColors.accent, width: 1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '🎲 Club Table Tracker',
                      style: TextStyle(
                        color: AppColors.accent,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Бронирование игровых столов для варгеймерских клубов',
                      style: TextStyle(
                          color: AppColors.textSecondary, fontSize: 12),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.panelBg,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'Beta v0.0.$appBuildNumber от $appBuildDate',
                        style: const TextStyle(
                          color: AppColors.textBlue,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _buildUserActions(isLoggedIn),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildUserActions(bool isLoggedIn) {
    if (!isLoggedIn) {
      return ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.panelBg,
          foregroundColor: AppColors.textPrimary,
        ),
        icon: const Text('G', style: TextStyle(fontWeight: FontWeight.bold)),
        label: const Text('Войти'),
        onPressed: _handleGoogleLogin,
      );
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          icon: const Icon(Icons.settings, color: AppColors.textSecondary),
          onPressed: () =>
              Navigator.pushNamed(context, '/settings').then((_) => _loadData()),
        ),
        Stack(
          children: [
            IconButton(
              icon: const Icon(Icons.chat_bubble_outline,
                  color: AppColors.textSecondary),
              onPressed: () => Navigator.pushNamed(context, '/messages'),
            ),
            if (_totalUnread > 0)
              Positioned(
                right: 6,
                top: 6,
                child: Container(
                  padding: const EdgeInsets.all(3),
                  decoration: const BoxDecoration(
                    color: AppColors.accent,
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    _totalUnread > 99 ? '99+' : '$_totalUnread',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.bold),
                  ),
                ),
              ),
          ],
        ),
        IconButton(
          icon: const Icon(Icons.logout, color: AppColors.textSecondary),
          onPressed: _logout,
        ),
      ],
    );
  }

  Widget _buildWelcomeCard() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Text(
            'Добро пожаловать в ClubTableTracker',
            style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Text(
            'Следите за игровыми столами в вашем Warhammer-клубе. '
            'Войдите через Google, чтобы вступить в клуб и бронировать столы.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, {required Color color}) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      padding: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: color, width: 2)),
      ),
      child: Text(
        title,
        style: TextStyle(
            color: color, fontSize: 16, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildClubCard(Club club) {
    final membership = _memberships.firstWhere(
      (m) => m.club.id == club.id,
      orElse: () => Membership(id: -1, status: '', club: club),
    );
    final hasMembership = membership.id != -1;
    final isApproved = membership.isApproved;
    final isPending = membership.isPending;
    final isRejected = membership.isRejected;
    final isKicked = membership.isKicked;

    final events = _clubEventsMap[club.id] ?? [];
    final now = DateTime.now();
    final activeEvents = events
        .where((e) =>
            e.startDateTime.isBefore(now) && e.endDateTime.isAfter(now))
        .toList();
    final upcomingEvents = events
        .where((e) => e.startDateTime.isAfter(now))
        .toList()
      ..sort((a, b) => a.startDateTime.compareTo(b.startDateTime));
    final nextEvents = upcomingEvents.take(3).toList();

    Color borderColor;
    if (isApproved) {
      borderColor = AppColors.statusApproved;
    } else if (isPending) {
      borderColor = AppColors.statusPending;
    } else if (isRejected || isKicked) {
      borderColor = AppColors.statusRejected;
    } else {
      borderColor = AppColors.border;
    }

    return GestureDetector(
      onTap: isApproved
          ? () => Navigator.pushNamed(context, '/club',
              arguments: {'clubId': club.id})
          : null,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          border: Border.all(color: borderColor, width: 2),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            // Верхняя часть: лого + события
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Лого
                  Container(
                    width: 90,
                    constraints: const BoxConstraints(minHeight: 80),
                    color: AppColors.darkBg,
                    child: club.logoUrl != null
                        ? CachedNetworkImage(
                            imageUrl: club.logoUrl!,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => const Center(
                              child: Text('🎲', style: TextStyle(fontSize: 28)),
                            ),
                            errorWidget: (_, __, ___) => const Center(
                              child: Text('🎲', style: TextStyle(fontSize: 28)),
                            ),
                          )
                        : const Center(
                            child: Text('🎲', style: TextStyle(fontSize: 28)),
                          ),
                  ),

                  // Активные события
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: const BoxDecoration(
                        border: Border(
                          left: BorderSide(color: AppColors.borderDark),
                          right: BorderSide(color: AppColors.borderDark),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'СЕЙЧАС',
                            style: TextStyle(
                                color: AppColors.accentYellow,
                                fontSize: 9,
                                fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          if (activeEvents.isEmpty)
                            const Text(
                              'Нет активных событий',
                              style: TextStyle(
                                  color: AppColors.textMuted, fontSize: 11),
                            )
                          else
                            ...activeEvents.map((e) => Padding(
                                  padding: const EdgeInsets.only(bottom: 2),
                                  child: Text(
                                    e.title,
                                    style: const TextStyle(
                                        color: AppColors.textPrimary,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                )),
                        ],
                      ),
                    ),
                  ),

                  // Ближайшие события
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'БЛИЖАЙШИЕ',
                            style: TextStyle(
                                color: AppColors.textBlue,
                                fontSize: 9,
                                fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          if (nextEvents.isEmpty)
                            const Text(
                              'Нет предстоящих',
                              style: TextStyle(
                                  color: AppColors.textMuted, fontSize: 11),
                            )
                          else
                            ...nextEvents.map((e) => Padding(
                                  padding: const EdgeInsets.only(bottom: 2),
                                  child: Text(
                                    '${_fmtDate(e.startDateTime)} ${e.title}',
                                    style: const TextStyle(
                                        color: AppColors.textPrimary,
                                        fontSize: 10),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                )),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Нижняя панель: название + статус
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: const BoxDecoration(
                border: Border(
                    top: BorderSide(color: AppColors.borderDark)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          club.name,
                          style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.bold),
                        ),
                        if (club.description.isNotEmpty)
                          Text(
                            club.description,
                            style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 11),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (!hasMembership || isKicked)
                        _token.isNotEmpty
                            ? TextButton(
                                style: TextButton.styleFrom(
                                  backgroundColor: AppColors.accentPurple,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 4),
                                  minimumSize: Size.zero,
                                ),
                                onPressed: () => _applyToClub(club.id),
                                child: const Text(
                                  'Подать заявку',
                                  style: TextStyle(
                                      color: Colors.white, fontSize: 11),
                                ),
                              )
                            : const SizedBox.shrink(),
                      if (isApproved) ...[
                        const Text('✅', style: TextStyle(fontSize: 14)),
                        const SizedBox(width: 4),
                        const Icon(Icons.arrow_forward_ios,
                            size: 12, color: AppColors.textSecondary),
                      ],
                      if (isPending) const Text('⏳', style: TextStyle(fontSize: 14)),
                      if (isRejected) const Text('❌', style: TextStyle(fontSize: 14)),
                      if (isKicked) const Text('🚫', style: TextStyle(fontSize: 14)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _fmtDate(DateTime dt) {
    final d = dt.day.toString().padLeft(2, '0');
    final m = dt.month.toString().padLeft(2, '0');
    return '$d.$m';
  }
}
