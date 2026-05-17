import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../app_colors.dart';
import '../models/club.dart';
import '../models/game_table.dart';
import '../models/booking.dart';
import '../models/club_event.dart';
import '../models/club_member.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../widgets/booking_dialog.dart';
import '../widgets/user_avatar.dart';

class ClubScreen extends StatefulWidget {
  final int clubId;
  final String token;
  final VoidCallback onTokenExpired;

  const ClubScreen({
    super.key,
    required this.clubId,
    required this.token,
    required this.onTokenExpired,
  });

  @override
  State<ClubScreen> createState() => _ClubScreenState();
}

class _ClubScreenState extends State<ClubScreen>
    with SingleTickerProviderStateMixin {
  final _api = ApiService();

  Club? _club;
  List<GameTable> _tables = [];
  List<Booking> _bookings = [];
  List<ClubEvent> _events = [];
  List<ClubMember> _members = [];
  List<UpcomingBooking> _myUpcoming = [];
  bool _loading = true;
  String? _error;

  late TabController _tabController;

  String get _token => widget.token;
  String get _myId => AuthService.getUserId(_token) ?? '';

  static const _tabs = [
    Tab(text: 'Столы'),
    Tab(text: 'Игры'),
    Tab(text: 'События'),
    Tab(text: 'Игроки'),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadAll();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await Future.wait([
        _loadClub(),
        _loadTables(),
        _loadBookings(),
        _loadEvents(),
        _loadMembers(),
        _loadMyUpcoming(),
      ]);
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        await AuthService.clearToken();
        widget.onTokenExpired();
        return;
      }
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadClub() async {
    final clubs = await _api.getClubs();
    final found = clubs.firstWhere(
      (c) => (c['id'] as int) == widget.clubId,
      orElse: () => null,
    );
    if (found != null && mounted) {
      setState(() => _club = Club.fromJson(found as Map<String, dynamic>));
    }
  }

  Future<void> _loadTables() async {
    final data = await _api.getClubTables(widget.clubId, _token);
    if (mounted) {
      setState(() =>
          _tables = data.map((t) => GameTable.fromJson(t as Map<String, dynamic>)).toList());
    }
  }

  Future<void> _loadBookings() async {
    final data = await _api.getBookings(widget.clubId, _token);
    if (mounted) {
      setState(() =>
          _bookings = data.map((b) => Booking.fromJson(b as Map<String, dynamic>)).toList());
    }
  }

  Future<void> _loadEvents() async {
    final data = await _api.getClubEvents(widget.clubId, token: _token);
    if (mounted) {
      setState(() =>
          _events = data.map((e) => ClubEvent.fromJson(e as Map<String, dynamic>)).toList());
    }
  }

  Future<void> _loadMembers() async {
    final data = await _api.getClubMembers(widget.clubId, _token);
    if (mounted) {
      setState(() =>
          _members = data.map((m) => ClubMember.fromJson(m as Map<String, dynamic>)).toList());
    }
  }

  Future<void> _loadMyUpcoming() async {
    final data =
        await _api.getMyUpcomingBookings(_token, clubId: widget.clubId);
    if (mounted) {
      setState(() =>
          _myUpcoming = data.map((b) => UpcomingBooking.fromJson(b as Map<String, dynamic>)).toList());
    }
  }

  Future<void> _registerEvent(ClubEvent event) async {
    try {
      await _api.registerEvent(event.id, _token);
      await _loadEvents();
      _showSnack('Вы записаны на «${event.title}»');
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  Future<void> _unregisterEvent(ClubEvent event) async {
    final confirm = await _showConfirm('Отменить запись на событие?');
    if (!confirm) return;
    try {
      await _api.unregisterEvent(event.id, _token);
      await _loadEvents();
      _showSnack('Запись отменена');
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  Future<void> _cancelBooking(Booking booking) async {
    final confirm = await _showConfirm('Отменить бронирование?');
    if (!confirm) return;
    try {
      await _api.cancelBooking(booking.id, _token);
      await _loadBookings();
      await _loadMyUpcoming();
      _showSnack('Бронирование отменено');
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  Future<void> _joinBooking(Booking booking) async {
    try {
      await _api.joinBooking(booking.id, _token);
      await _loadBookings();
      await _loadMyUpcoming();
      _showSnack('Вы присоединились к игре');
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  Future<void> _leaveBooking(Booking booking) async {
    final confirm = await _showConfirm('Покинуть игру?');
    if (!confirm) return;
    try {
      await _api.leaveBooking(booking.id, _token);
      await _loadBookings();
      await _loadMyUpcoming();
      _showSnack('Вы покинули игру');
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  void _showSnack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.panelBg),
    );
  }

  Future<bool> _showConfirm(String msg) async {
    return await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            backgroundColor: AppColors.cardBg,
            title: const Text('Подтверждение',
                style: TextStyle(color: AppColors.textPrimary)),
            content: Text(msg,
                style: const TextStyle(color: AppColors.textSecondary)),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Отмена'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Да',
                    style: TextStyle(color: AppColors.accent)),
              ),
            ],
          ),
        ) ??
        false;
  }

  @override
  Widget build(BuildContext context) {
    final club = _club;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: Text(
          club?.name ?? 'Загрузка...',
          style: const TextStyle(color: AppColors.accent),
        ),
        bottom: TabBar(
          controller: _tabController,
          tabs: _tabs,
          labelColor: AppColors.accent,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.accent,
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accent))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!,
                            style: const TextStyle(color: AppColors.accent)),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: _loadAll,
                          child: const Text('Повторить'),
                        ),
                      ],
                    ),
                  ),
                )
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildTablesTab(),
                    _buildGamesTab(),
                    _buildEventsTab(),
                    _buildPlayersTab(),
                  ],
                ),
    );
  }

  // ─── Вкладка: Столы ─────────────────────────────────────────────────────

  Widget _buildTablesTab() {
    if (_tables.isEmpty) {
      return const Center(
        child: Text('Нет столов',
            style: TextStyle(color: AppColors.textSecondary)),
      );
    }

    final now = DateTime.now();

    return RefreshIndicator(
      onRefresh: _loadAll,
      color: AppColors.accent,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _tables.length,
        itemBuilder: (_, i) {
          final table = _tables[i];
          final tableBookings = _bookings
              .where((b) => b.tableId == table.id)
              .toList();
          final activeBooking = tableBookings.firstWhere(
            (b) =>
                b.startDateTime.isBefore(now) &&
                b.endDateTime.isAfter(now),
            orElse: () => Booking(
              id: -1,
              tableId: -1,
              startTime: '',
              endTime: '',
              user: BookingUser(id: '', name: ''),
            ),
          );
          final isOccupied = activeBooking.id != -1;

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              border: Border.all(
                color: isOccupied
                    ? AppColors.statusRejected
                    : AppColors.statusApproved,
              ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: ListTile(
              title: Text(
                'Стол №${table.number}',
                style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.bold),
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (table.size.isNotEmpty)
                    Text('Размер: ${table.size}',
                        style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12)),
                  if (table.supportedGames.isNotEmpty)
                    Text(
                      table.supportedGames,
                      style: const TextStyle(
                          color: AppColors.textSecondary, fontSize: 11),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  if (isOccupied)
                    Text(
                      '🎮 ${activeBooking.user.name}'
                      '${activeBooking.gameSystem != null ? " · ${activeBooking.gameSystem}" : ""}',
                      style: const TextStyle(
                          color: AppColors.accentYellow, fontSize: 12),
                    ),
                ],
              ),
              trailing: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: isOccupied
                          ? AppColors.statusRejected
                          : AppColors.statusApproved,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      isOccupied ? 'Занят' : 'Свободен',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.bold),
                    ),
                  ),
                  if (!isOccupied && _token.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    TextButton(
                      style: TextButton.styleFrom(
                        backgroundColor: AppColors.accentPurple,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      onPressed: () => _openBookingDialog(table),
                      child: const Text(
                        'Забронировать',
                        style:
                            TextStyle(color: Colors.white, fontSize: 10),
                      ),
                    ),
                  ],
                ],
              ),
              onTap: () => _showTableDetail(table),
            ),
          );
        },
      ),
    );
  }

  bool get _isCurrentUserModerator =>
      _members.any((m) => m.id == _myId && m.isModerator);

  void _openBookingDialog(GameTable table) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => BookingDialog(
        table: table,
        club: _club!,
        token: _token,
        members: _members,
        myId: _myId,
        isModerator: _isCurrentUserModerator,
        api: _api,
        onBookingCreated: () async {
          await _loadBookings();
          await _loadMyUpcoming();
        },
      ),
    );
  }

  void _showTableDetail(GameTable table) {
    final now = DateTime.now();
    final tableBookings = _bookings
        .where((b) => b.tableId == table.id)
        .where((b) => b.endDateTime.isAfter(now))
        .toList()
      ..sort((a, b) => a.startDateTime.compareTo(b.startDateTime));

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        builder: (_, ctrl) => Column(
          children: [
            Container(
              margin: const EdgeInsets.only(top: 8, bottom: 4),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.textMuted,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Text(
                    'Стол №${table.number}',
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.bold),
                  ),
                  const Spacer(),
                  if (_token.isNotEmpty)
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.accentPurple),
                      onPressed: () {
                        Navigator.pop(context);
                        _openBookingDialog(table);
                      },
                      child: const Text('Забронировать'),
                    ),
                ],
              ),
            ),
            const Divider(color: AppColors.border, height: 1),
            Expanded(
              child: tableBookings.isEmpty
                  ? const Center(
                      child: Text('Нет предстоящих бронирований',
                          style: TextStyle(
                              color: AppColors.textSecondary)))
                  : ListView.builder(
                      controller: ctrl,
                      padding: const EdgeInsets.all(12),
                      itemCount: tableBookings.length,
                      itemBuilder: (_, i) =>
                          _buildBookingTile(tableBookings[i]),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBookingTile(Booking booking) {
    final isMe = booking.user.id == _myId;
    final isParticipant =
        booking.participants.any((p) => p.id == _myId);
    final canJoin = !isMe &&
        !isParticipant &&
        booking.isDoubles &&
        booking.participants.isEmpty;
    final canLeave = isParticipant;
    final canCancel = isMe;

    final fmt = DateFormat('HH:mm');
    final dateFmt = DateFormat('dd.MM', 'ru');

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: isMe
            ? AppColors.accentOrange.withOpacity(0.15)
            : AppColors.darkBg,
        border: Border.all(
          color: isMe ? AppColors.accentOrange : AppColors.border,
        ),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                '${dateFmt.format(booking.startDateTime)} '
                '${fmt.format(booking.startDateTime)}–${fmt.format(booking.endDateTime)}',
                style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              if (booking.gameSystem != null)
                Text(
                  booking.gameSystem!,
                  style: const TextStyle(
                      color: AppColors.accentBlue, fontSize: 11),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '👤 ${booking.user.name}',
            style: const TextStyle(
                color: AppColors.textSecondary, fontSize: 12),
          ),
          if (booking.participants.isNotEmpty)
            Text(
              '+ ${booking.participants.map((p) => p.name).join(', ')}',
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 11),
            ),
          if (canJoin || canLeave || canCancel) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                if (canCancel)
                  _actionBtn(
                    'Отменить',
                    AppColors.statusRejected,
                    () => _cancelBooking(booking),
                  ),
                if (canJoin)
                  _actionBtn(
                    'Присоединиться',
                    AppColors.statusApproved,
                    () => _joinBooking(booking),
                  ),
                if (canLeave)
                  _actionBtn(
                    'Покинуть',
                    AppColors.accentYellow,
                    () => _leaveBooking(booking),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _actionBtn(String label, Color color, VoidCallback onTap) =>
      Padding(
        padding: const EdgeInsets.only(right: 8),
        child: TextButton(
          style: TextButton.styleFrom(
            backgroundColor: color.withOpacity(0.2),
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            minimumSize: Size.zero,
          ),
          onPressed: onTap,
          child: Text(label,
              style: TextStyle(color: color, fontSize: 11)),
        ),
      );

  // ─── Вкладка: Мои игры ───────────────────────────────────────────────────

  Widget _buildGamesTab() {
    if (_myUpcoming.isEmpty) {
      return const Center(
        child: Text('Нет предстоящих игр',
            style: TextStyle(color: AppColors.textSecondary)),
      );
    }
    final fmt = DateFormat('dd.MM HH:mm', 'ru');

    return RefreshIndicator(
      onRefresh: _loadMyUpcoming,
      color: AppColors.accent,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _myUpcoming.length,
        itemBuilder: (_, i) {
          final b = _myUpcoming[i];
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Стол №${b.tableNumber}',
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  '${fmt.format(b.startDateTime)} – ${DateFormat('HH:mm').format(b.endDateTime)}',
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 12),
                ),
                if (b.gameSystem != null)
                  Text(
                    b.gameSystem!,
                    style: const TextStyle(
                        color: AppColors.accentBlue, fontSize: 12),
                  ),
                if (b.participants.isNotEmpty)
                  Text(
                    'Участники: ${b.participants.map((p) => p.name).join(', ')}',
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 11),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  // ─── Вкладка: События ───────────────────────────────────────────────────

  Widget _buildEventsTab() {
    if (_events.isEmpty) {
      return const Center(
        child: Text('Нет событий',
            style: TextStyle(color: AppColors.textSecondary)),
      );
    }

    final now = DateTime.now();
    final active =
        _events.where((e) => e.isActive).toList();
    final upcoming = _events
        .where((e) => e.isUpcoming)
        .toList()
      ..sort((a, b) => a.startDateTime.compareTo(b.startDateTime));
    final past = _events
        .where((e) => e.endDateTime.isBefore(now))
        .toList()
      ..sort((a, b) => b.startDateTime.compareTo(a.startDateTime));

    return RefreshIndicator(
      onRefresh: _loadEvents,
      color: AppColors.accent,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (active.isNotEmpty) ...[
            _sectionLabel('Идут сейчас', AppColors.statusApproved),
            ...active.map(_buildEventCard),
          ],
          if (upcoming.isNotEmpty) ...[
            _sectionLabel('Предстоящие', AppColors.accentBlue),
            ...upcoming.map(_buildEventCard),
          ],
          if (past.isNotEmpty) ...[
            _sectionLabel('Прошедшие', AppColors.textMuted),
            ...past.map(_buildEventCard),
          ],
        ],
      ),
    );
  }

  Widget _sectionLabel(String text, Color color) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 6),
        child: Text(text,
            style: TextStyle(
                color: color,
                fontSize: 13,
                fontWeight: FontWeight.bold)),
      );

  Widget _buildEventCard(ClubEvent event) {
    final fmt = DateFormat('dd.MM HH:mm', 'ru');
    final isRegistered =
        event.participants.any((p) => p.id == _myId);
    final isFull = event.participants.length >= event.maxParticipants &&
        event.maxParticipants > 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        border: Border.all(
          color: event.isActive
              ? AppColors.statusApproved
              : AppColors.border,
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  event.title,
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.bold),
                ),
              ),
              if (event.isActive)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.statusApproved.withOpacity(0.2),
                    border: Border.all(color: AppColors.statusApproved),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text('LIVE',
                      style: TextStyle(
                          color: AppColors.statusApproved,
                          fontSize: 10,
                          fontWeight: FontWeight.bold)),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${fmt.format(event.startDateTime)} – ${fmt.format(event.endDateTime)}',
            style: const TextStyle(
                color: AppColors.textSecondary, fontSize: 12),
          ),
          if (event.eventType.isNotEmpty)
            Text(event.eventType,
                style: const TextStyle(
                    color: AppColors.accentBlue, fontSize: 11)),
          if (event.gameSystem != null)
            Text(event.gameSystem!,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 11)),
          const SizedBox(height: 4),
          Text(
            'Участников: ${event.participants.length}'
            '${event.maxParticipants > 0 ? " / ${event.maxParticipants}" : ""}',
            style: const TextStyle(
                color: AppColors.textSecondary, fontSize: 11),
          ),
          if (event.description != null) ...[
            const SizedBox(height: 4),
            Text(
              event.description!,
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 11),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (_token.isNotEmpty && event.isUpcoming) ...[
            const SizedBox(height: 8),
            if (isRegistered)
              _actionBtn(
                  'Отменить запись', AppColors.statusRejected,
                  () => _unregisterEvent(event))
            else if (!isFull)
              _actionBtn(
                  'Записаться', AppColors.statusApproved,
                  () => _registerEvent(event))
            else
              const Text(
                'Мест нет',
                style: TextStyle(
                    color: AppColors.textMuted, fontSize: 11),
              ),
          ],
        ],
      ),
    );
  }

  // ─── Вкладка: Игроки ────────────────────────────────────────────────────

  Widget _buildPlayersTab() {
    if (_members.isEmpty) {
      return const Center(
        child: Text('Нет участников',
            style: TextStyle(color: AppColors.textSecondary)),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadMembers,
      color: AppColors.accent,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _members.length,
        itemBuilder: (_, i) {
          final member = _members[i];
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                UserAvatar(name: member.effectiveName, size: 40),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              member.effectiveName,
                              style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13),
                            ),
                          ),
                          if (member.isModerator)
                            const Text('⚙️',
                                style: TextStyle(fontSize: 12)),
                          if (member.hasKey)
                            const Text('🔑',
                                style: TextStyle(fontSize: 12)),
                        ],
                      ),
                      if (member.city != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          '📍 ${member.city}',
                          style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11),
                        ),
                      ],
                      if (member.bio != null &&
                          member.bio!.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          member.bio!,
                          style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      if (member.gameSystems.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: 4,
                          runSpacing: 4,
                          children: member.gameSystems.take(5).map((gs) =>
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.panelBg,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                gs,
                                style: const TextStyle(
                                    color: AppColors.textBlue,
                                    fontSize: 9),
                              ),
                            ),
                          ).toList(),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
