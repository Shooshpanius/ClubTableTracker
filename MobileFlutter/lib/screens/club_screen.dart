import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../app_colors.dart';
import '../constants.dart';
import '../models/club.dart';
import '../models/game_table.dart';
import '../models/booking.dart';
import '../models/club_event.dart';
import '../models/club_member.dart';
import '../models/chat.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../widgets/booking_dialog.dart';
import '../widgets/user_avatar.dart';
import 'messenger_screen.dart';

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
  List<Map<String, dynamic>> _gallery = [];
  bool _loading = true;
  String? _error;

  // ─── Вкладка «Столы»: состояние аккордеонов ────────────────────────────
  int? _expandedTableId;
  bool _calendarExpanded = false;
  late DateTime _selectedDate;
  late int _calViewYear;
  late int _calViewMonth;

  late TabController _tabController;

  String get _token => widget.token;
  String get _myId => AuthService.getUserId(_token) ?? '';

  static const _tabs = [
    Tab(text: 'Столы'),
    Tab(text: 'Игры'),
    Tab(text: 'События'),
    Tab(text: 'Игроки'),
    Tab(text: 'Фото'),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    final now = DateTime.now();
    _selectedDate = DateTime(now.year, now.month, now.day);
    _calViewYear = now.year;
    _calViewMonth = now.month;
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
        _loadGallery(),
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

  Future<void> _openDirectChat(ClubMember member) async {
    try {
      final data = await _api.createDirectChat(member.id, _token);
      if (!mounted) return;
      final chatSummary = ChatSummary.fromJson(data);
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ChatScreen(
            chat: chatSummary,
            token: _token,
            api: _api,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Не удалось открыть чат: $e')),
      );
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

  Future<void> _loadGallery() async {
    try {
      final data = await _api.getClubGallery(widget.clubId, _token);
      if (mounted) {
        setState(() => _gallery = data
            .map((p) => p as Map<String, dynamic>)
            .toList());
      }
    } catch (_) {
      // Галерея необязательна — ошибку игнорируем
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

  Future<void> _acceptInvite(Booking booking) async {
    try {
      await _api.acceptInvite(booking.id, _token);
      await _loadBookings();
      await _loadMyUpcoming();
      _showSnack('Вы приняли приглашение');
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  Future<void> _declineInvite(Booking booking) async {
    final confirm = await _showConfirm('Отклонить приглашение?');
    if (!confirm) return;
    try {
      await _api.declineInvite(booking.id, _token);
      await _loadBookings();
      await _loadMyUpcoming();
      _showSnack('Приглашение отклонено');
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
                    _buildGalleryTab(),
                  ],
                ),
    );
  }

  // ─── Вкладка: Столы ─────────────────────────────────────────────────────

  // Вспомогательные методы для вкладки «Столы»

  static int _parseTimeToMinutes(String hhmm) {
    final parts = hhmm.split(':');
    if (parts.length < 2) return 0;
    return (int.tryParse(parts[0]) ?? 0) * 60 + (int.tryParse(parts[1]) ?? 0);
  }

  static bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  /// Возвращает понедельник недели, в которую входит [date].
  static DateTime _weekMonday(DateTime date) {
    return DateTime(date.year, date.month, date.day - (date.weekday - 1));
  }

  // Аккордеон-календарь: свёрнуто — неделя, развёрнуто — месяц
  Widget _buildCalendarAccordion() {
    final monday = _weekMonday(_selectedDate);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    // Даты с бронированиями
    final datesWithBookings = <String>{};
    for (final b in _bookings) {
      final d = b.startDateTime;
      datesWithBookings.add('${d.year}-${d.month}-${d.day}');
    }

    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    // ── Полоса текущей недели (всегда видна как «заголовок») ─────────
    final weekRow = Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: List.generate(7, (i) {
        final day = monday.add(Duration(days: i));
        final isSelected = _isSameDay(day, _selectedDate);
        final isToday = _isSameDay(day, today);
        final hasBookings =
            datesWithBookings.contains('${day.year}-${day.month}-${day.day}');
        return GestureDetector(
          onTap: () => setState(() {
            _selectedDate = day;
            _expandedTableId = null;
          }),
          child: Container(
            width: 38,
            padding: const EdgeInsets.symmetric(vertical: 5),
            decoration: BoxDecoration(
              color: isToday && !isSelected
                  ? AppColors.panelBg
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(6),
              border: isSelected
                  ? Border.all(color: AppColors.accent, width: 1.5)
                  : isToday
                      ? Border.all(color: AppColors.accentGreen.withOpacity(0.6))
                      : null,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  dayNames[i],
                  style: TextStyle(
                    fontSize: 10,
                    color: isSelected ? AppColors.accent : AppColors.textMuted,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${day.day}',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: isSelected
                        ? AppColors.accent
                        : isToday
                            ? AppColors.accentGreen
                            : hasBookings
                                ? AppColors.accentYellow
                                : AppColors.textPrimary,
                  ),
                ),
                SizedBox(
                  height: 7,
                  child: hasBookings && !isSelected
                      ? Center(
                          child: Container(
                            width: 4,
                            height: 4,
                            decoration: const BoxDecoration(
                              color: AppColors.accentYellow,
                              shape: BoxShape.circle,
                            ),
                          ),
                        )
                      : null,
                ),
              ],
            ),
          ),
        );
      }),
    );

    // ── Полный месяц (тело аккордеона) ───────────────────────────────
    final daysInMonth = DateTime(_calViewYear, _calViewMonth + 1, 0).day;
    final startOffset =
        DateTime(_calViewYear, _calViewMonth, 1).weekday - 1; // 0=Пн

    final List<List<int?>> weeks = [];
    int d = 1;
    for (int w = 0; w < 6; w++) {
      final List<int?> week = [];
      for (int di = 0; di < 7; di++) {
        final idx = w * 7 + di;
        week.add(idx < startOffset || d > daysInMonth ? null : d++);
      }
      weeks.add(week);
      if (d > daysInMonth) break;
    }

    const monthNames = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];

    final monthView = Padding(
      padding: const EdgeInsets.fromLTRB(8, 0, 8, 10),
      child: Column(
        children: [
          // Навигация по месяцам
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: const Icon(Icons.chevron_left,
                    color: AppColors.textSecondary, size: 20),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () => setState(() {
                  if (_calViewMonth == 1) {
                    _calViewMonth = 12;
                    _calViewYear--;
                  } else {
                    _calViewMonth--;
                  }
                }),
              ),
              Text(
                '${monthNames[_calViewMonth - 1]} $_calViewYear',
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.chevron_right,
                    color: AppColors.textSecondary, size: 20),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () => setState(() {
                  if (_calViewMonth == 12) {
                    _calViewMonth = 1;
                    _calViewYear++;
                  } else {
                    _calViewMonth++;
                  }
                }),
              ),
            ],
          ),
          // Заголовок дней недели
          Row(
            children: dayNames
                .map((n) => Expanded(
                      child: Text(
                        n,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 10, color: AppColors.textMuted),
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 4),
          // Сетка дней
          ...weeks.map((week) => Row(
                children: week.map((dayNum) {
                  if (dayNum == null) {
                    return const Expanded(child: SizedBox(height: 36));
                  }
                  final cellDate =
                      DateTime(_calViewYear, _calViewMonth, dayNum);
                  final isSelected = _isSameDay(cellDate, _selectedDate);
                  final isTodayCell = _isSameDay(cellDate, today);
                  final dateKey =
                      '${cellDate.year}-${cellDate.month}-${cellDate.day}';
                  final hasBookings = datesWithBookings.contains(dateKey);
                  return Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() {
                        _selectedDate = cellDate;
                        _expandedTableId = null;
                      }),
                      child: Container(
                        margin: const EdgeInsets.all(2),
                        height: 32,
                        decoration: BoxDecoration(
                          color: hasBookings && !isSelected
                              ? AppColors.accentYellow
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(4),
                          border: isSelected
                              ? Border.all(color: AppColors.accent, width: 1.5)
                              : isTodayCell
                                  ? Border.all(
                                      color: AppColors.accentGreen, width: 1.5)
                                  : null,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '$dayNum',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: isTodayCell || isSelected
                                ? FontWeight.bold
                                : FontWeight.normal,
                            color: isSelected
                                ? AppColors.accent
                                : hasBookings
                                    ? const Color(0xFF222222)
                                    : isTodayCell
                                        ? AppColors.accentGreen
                                        : AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              )),
        ],
      ),
    );

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          // Заголовок: полоса недели + стрелка
          InkWell(
            borderRadius: _calendarExpanded
                ? const BorderRadius.vertical(top: Radius.circular(8))
                : BorderRadius.circular(8),
            onTap: () {
              setState(() {
                _calendarExpanded = !_calendarExpanded;
                if (_calendarExpanded) {
                  _calViewYear = _selectedDate.year;
                  _calViewMonth = _selectedDate.month;
                }
              });
            },
            child: Padding(
              padding: const EdgeInsets.fromLTRB(6, 8, 10, 8),
              child: Row(
                children: [
                  Expanded(child: weekRow),
                  Icon(
                    _calendarExpanded
                        ? Icons.keyboard_arrow_up
                        : Icons.keyboard_arrow_down,
                    color: AppColors.textSecondary,
                  ),
                ],
              ),
            ),
          ),

          // Тело: полный месяц
          if (_calendarExpanded) ...[
            const Divider(height: 1, color: AppColors.border),
            monthView,
          ],
        ],
      ),
    );
  }

  // Тонкая полоска занятости стола на выбранный день
  Widget _buildOccupancyBar(GameTable table) {
    final club = _club;
    if (club == null) return const SizedBox(height: 4);

    final openMin = _parseTimeToMinutes(club.openTime);
    final closeMin = _parseTimeToMinutes(club.closeTime);
    final total = closeMin - openMin;
    if (total <= 0) return const SizedBox(height: 4);

    final dayBookings = _bookings
        .where((b) =>
            b.tableId == table.id &&
            _isSameDay(b.startDateTime, _selectedDate))
        .toList()
      ..sort((a, b) => a.startDateTime.compareTo(b.startDateTime));

    final List<(bool, int, int)> segments = [];
    int cursor = openMin;
    for (final b in dayBookings) {
      final bStart = b.startDateTime.hour * 60 + b.startDateTime.minute;
      final bEnd = b.endDateTime.hour * 60 + b.endDateTime.minute;
      final sStart = bStart < openMin ? openMin : bStart;
      final sEnd = bEnd > closeMin ? closeMin : bEnd;
      if (sStart > cursor) segments.add((true, cursor, sStart));
      if (sEnd > sStart) segments.add((false, sStart, sEnd));
      cursor = sEnd > cursor ? sEnd : cursor;
    }
    if (cursor < closeMin) segments.add((true, cursor, closeMin));
    if (segments.isEmpty) return const SizedBox(height: 4);

    return SizedBox(
      height: 4,
      child: Row(
        children: segments.map((seg) {
          final flex = seg.$3 - seg.$2;
          return Expanded(
            flex: flex,
            child: Container(
              color: seg.$1
                  ? AppColors.statusApproved
                  : AppColors.statusRejected,
            ),
          );
        }).toList(),
      ),
    );
  }

  // Один элемент — аккордеон стола
  Widget _buildTableAccordionItem(GameTable table) {
    final now = DateTime.now();
    final isExpanded = _expandedTableId == table.id;

    // Определяем, занят ли стол прямо сейчас
    final activeBooking = _bookings.firstWhere(
      (b) =>
          b.tableId == table.id &&
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

    // Бронирования на выбранный день
    final dayBookings = _bookings
        .where((b) =>
            b.tableId == table.id &&
            _isSameDay(b.startDateTime, _selectedDate))
        .toList()
      ..sort((a, b) => a.startDateTime.compareTo(b.startDateTime));

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        border: Border.all(
          color: isExpanded
              ? AppColors.accentBlue
              : isOccupied
                  ? AppColors.statusRejected
                  : AppColors.statusApproved,
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ─── Заголовок ────────────────────────────────────────────────
          InkWell(
            borderRadius: isExpanded
                ? const BorderRadius.vertical(top: Radius.circular(7))
                : BorderRadius.circular(7),
            onTap: () => setState(() {
              _expandedTableId = isExpanded ? null : table.id;
            }),
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Стол №${table.number}',
                          style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 15),
                        ),
                        if (table.size.isNotEmpty)
                          Text(
                            table.size,
                            style: const TextStyle(
                                color: AppColors.textMuted, fontSize: 11),
                          ),
                        if (isOccupied)
                          Text(
                            '🎮 ${activeBooking.user.name}'
                            '${activeBooking.gameSystem != null ? ' · ${activeBooking.gameSystem}' : ''}',
                            style: const TextStyle(
                                color: AppColors.accentYellow, fontSize: 11),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Бейдж занятости
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
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
                  const SizedBox(width: 6),
                  Icon(
                    isExpanded
                        ? Icons.keyboard_arrow_up
                        : Icons.keyboard_arrow_down,
                    color: AppColors.textSecondary,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),

          // ─── Полоска занятости ────────────────────────────────────────
          _buildOccupancyBar(table),

          // ─── Тело аккордеона ─────────────────────────────────────────
          if (isExpanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Кнопка «Забронировать»
                  if (_token.isNotEmpty)
                    Align(
                      alignment: Alignment.centerRight,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.accentPurple,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        icon: const Icon(Icons.add, size: 15,
                            color: Colors.white),
                        label: const Text('Забронировать',
                            style: TextStyle(
                                color: Colors.white, fontSize: 13)),
                        onPressed: () => _openBookingDialog(table),
                      ),
                    ),

                  const SizedBox(height: 10),

                  // Бронирования на выбранный день
                  if (dayBookings.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        'Нет бронирований на выбранный день',
                        style: const TextStyle(
                            color: AppColors.textSecondary, fontSize: 12),
                      ),
                    )
                  else
                    ...dayBookings
                        .map((b) => _buildBookingTile(b))
                        .toList(),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTablesTab() {
    return RefreshIndicator(
      onRefresh: _loadAll,
      color: AppColors.accent,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Аккордеон-календарь
          _buildCalendarAccordion(),

          if (_tables.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.only(top: 24),
                child: Text('Нет столов',
                    style: TextStyle(color: AppColors.textSecondary)),
              ),
            )
          else
            ..._tables.map(_buildTableAccordionItem).toList(),
        ],
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

  Widget _buildBookingTile(Booking booking) {
    final isMe = booking.user.id == _myId;
    final myParticipantEntry =
        booking.participants.where((p) => p.id == _myId).firstOrNull;
    final isParticipant = myParticipantEntry != null;
    final isInvited = myParticipantEntry?.status == 'Invited';
    final acceptedCount =
        booking.participants.where((p) => p.status != 'Invited').length;
    final maxPlayers = booking.isDoubles ? 4 : 2;
    final canJoin = !isMe && !isParticipant && acceptedCount < maxPlayers - 1;
    final canLeave = isParticipant && !isInvited;
    final canAcceptInvite = isInvited;
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
          if (canJoin || canLeave || canAcceptInvite || canCancel) ...[
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
                if (canAcceptInvite) ...[
                  _actionBtn(
                    '✓ Принять',
                    AppColors.statusApproved,
                    () => _acceptInvite(booking),
                  ),
                  _actionBtn(
                    '✗ Отклонить',
                    AppColors.statusRejected,
                    () => _declineInvite(booking),
                  ),
                ],
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
                          if (!member.isManualEntry) ...[
                            const SizedBox(width: 4),
                            GestureDetector(
                              onTap: () => _openDirectChat(member),
                              child: const Icon(
                                Icons.chat_bubble_outline,
                                color: AppColors.textBlue,
                                size: 18,
                              ),
                            ),
                          ],
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

  // ─── Вкладка: Фото ──────────────────────────────────────────────────────

  Widget _buildGalleryTab() {
    if (_gallery.isEmpty) {
      return const Center(
        child: Text('Нет фотографий',
            style: TextStyle(color: AppColors.textSecondary)),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadGallery,
      color: AppColors.accent,
      child: GridView.builder(
        padding: const EdgeInsets.all(8),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
          childAspectRatio: 4 / 3,
        ),
        itemCount: _gallery.length,
        itemBuilder: (_, i) {
          final url = resolveMediaUrl(_gallery[i]['url'] as String? ?? '');
          return GestureDetector(
            onTap: () => _showPhotoViewer(url),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(
                url,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  color: AppColors.cardBg,
                  child: const Icon(Icons.broken_image,
                      color: AppColors.textMuted),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  void _showPhotoViewer(String url) {
    showDialog(
      context: context,
      barrierColor: Colors.black87,
      builder: (_) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: EdgeInsets.zero,
        child: GestureDetector(
          onTap: () => Navigator.pop(context),
          child: InteractiveViewer(
            child: Image.network(
              url,
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const Icon(
                Icons.broken_image,
                color: Colors.white54,
                size: 64,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
