import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../app_colors.dart';
import '../models/game_table.dart';
import '../services/api_service.dart';

class AdminMembership {
  final int id;
  final String status;
  final bool isModerator;
  final bool hasKey;
  final bool isAdmin;
  final String appliedAt;
  final bool isManualEntry;
  final String userId;
  final String userName;
  final String userEmail;

  const AdminMembership({
    required this.id,
    required this.status,
    required this.isModerator,
    required this.hasKey,
    required this.isAdmin,
    required this.appliedAt,
    required this.isManualEntry,
    required this.userId,
    required this.userName,
    required this.userEmail,
  });

  factory AdminMembership.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>? ?? {};
    return AdminMembership(
      id: json['id'] as int,
      status: json['status'] as String? ?? '',
      isModerator: json['isModerator'] as bool? ?? false,
      hasKey: json['hasKey'] as bool? ?? false,
      isAdmin: json['isAdmin'] as bool? ?? false,
      appliedAt: json['appliedAt'] as String? ?? '',
      isManualEntry: json['isManualEntry'] as bool? ?? false,
      userId: user['id'] as String? ?? '',
      userName: user['name'] as String? ?? '',
      userEmail: user['email'] as String? ?? '',
    );
  }
}

class AdminEvent {
  final int id;
  final String title;
  final String startTime;
  final String endTime;
  final int maxParticipants;
  final String eventType;
  final String? gameSystem;
  final List<dynamic> participants;

  const AdminEvent({
    required this.id,
    required this.title,
    required this.startTime,
    required this.endTime,
    required this.maxParticipants,
    required this.eventType,
    this.gameSystem,
    this.participants = const [],
  });

  factory AdminEvent.fromJson(Map<String, dynamic> json) => AdminEvent(
        id: json['id'] as int,
        title: json['title'] as String? ?? '',
        startTime: json['startTime'] as String? ?? '',
        endTime: json['endTime'] as String? ?? '',
        maxParticipants: json['maxParticipants'] as int? ?? 8,
        eventType: json['eventType'] as String? ?? 'Tournament',
        gameSystem: json['gameSystem'] as String?,
        participants: json['participants'] as List<dynamic>? ?? [],
      );
}

class ClubAdminScreen extends StatefulWidget {
  final int clubId;
  final String token;

  const ClubAdminScreen({
    super.key,
    required this.clubId,
    required this.token,
  });

  @override
  State<ClubAdminScreen> createState() => _ClubAdminScreenState();
}

class _ClubAdminScreenState extends State<ClubAdminScreen>
    with SingleTickerProviderStateMixin {
  final _api = ApiService();
  late TabController _tabController;

  String? _clubName;
  List<GameTable> _tables = [];
  List<AdminMembership> _memberships = [];
  List<AdminEvent> _events = [];
  bool _loading = true;
  String? _error;

  // Settings
  String _openTime = '10:00';
  String _closeTime = '22:00';

  String get _token => widget.token;
  int get _clubId => widget.clubId;

  static const _tabs = [
    Tab(icon: Icon(Icons.people, size: 18), text: 'Участники'),
    Tab(icon: Icon(Icons.table_bar, size: 18), text: 'Столы'),
    Tab(icon: Icon(Icons.event, size: 18), text: 'События'),
    Tab(icon: Icon(Icons.settings, size: 18), text: 'Настройки'),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        _api.adminGetClub(_token, _clubId),
        _api.adminGetTables(_token, _clubId),
        _api.adminGetMemberships(_token, _clubId),
        _api.adminGetEvents(_token, _clubId),
      ]);
      final clubData = results[0] as Map<String, dynamic>;
      final tablesData = results[1] as List<dynamic>;
      final membersData = results[2] as List<dynamic>;
      final eventsData = results[3] as List<dynamic>;

      if (mounted) {
        setState(() {
          _clubName = clubData['name'] as String? ?? '';
          _openTime = clubData['openTime'] as String? ?? '10:00';
          _closeTime = clubData['closeTime'] as String? ?? '22:00';
          _tables = tablesData.map((t) => GameTable.fromJson(t as Map<String, dynamic>)).toList();
          _memberships = membersData.map((m) => AdminMembership.fromJson(m as Map<String, dynamic>)).toList();
          _events = eventsData.map((e) => AdminEvent.fromJson(e as Map<String, dynamic>)).toList();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<void> _refreshMembers() async {
    try {
      final data = await _api.adminGetMemberships(_token, _clubId);
      if (mounted) {
        setState(() {
          _memberships = data.map((m) => AdminMembership.fromJson(m as Map<String, dynamic>)).toList();
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _refreshTables() async {
    try {
      final data = await _api.adminGetTables(_token, _clubId);
      if (mounted) {
        setState(() {
          _tables = data.map((t) => GameTable.fromJson(t as Map<String, dynamic>)).toList();
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _refreshEvents() async {
    try {
      final data = await _api.adminGetEvents(_token, _clubId);
      if (mounted) {
        setState(() {
          _events = data.map((e) => AdminEvent.fromJson(e as Map<String, dynamic>)).toList();
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  // ─── Members Actions ────────────────────────────────────────────────────

  Future<void> _approveMember(AdminMembership m) async {
    try {
      await _api.adminApproveMembership(_token, _clubId, m.id);
      await _refreshMembers();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _rejectMember(AdminMembership m) async {
    try {
      await _api.adminRejectMembership(_token, _clubId, m.id);
      await _refreshMembers();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _kickMember(AdminMembership m) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        title: const Text('Исключить?', style: TextStyle(color: AppColors.textPrimary)),
        content: Text('Исключить ${m.userName} из клуба?', style: const TextStyle(color: AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Исключить', style: TextStyle(color: AppColors.accent))),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _api.adminKickMember(_token, _clubId, m.id);
      await _refreshMembers();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _toggleModerator(AdminMembership m) async {
    try {
      await _api.adminSetModerator(_token, _clubId, m.id, !m.isModerator);
      await _refreshMembers();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _toggleKey(AdminMembership m) async {
    try {
      await _api.adminSetKey(_token, _clubId, m.id, !m.hasKey);
      await _refreshMembers();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _toggleAdmin(AdminMembership m) async {
    try {
      await _api.adminSetAdmin(_token, _clubId, m.id, !m.isAdmin);
      await _refreshMembers();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  // ─── Tables Actions ─────────────────────────────────────────────────────

  Future<void> _addTable() async {
    final numberCtrl = TextEditingController();
    final size = 'Medium';
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        title: const Text('Новый стол', style: TextStyle(color: AppColors.textPrimary)),
        content: TextField(
          controller: numberCtrl,
          style: const TextStyle(color: AppColors.textPrimary),
          decoration: const InputDecoration(
            labelText: 'Номер стола',
            labelStyle: TextStyle(color: AppColors.textSecondary),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Отмена')),
          TextButton(onPressed: () => Navigator.pop(ctx, numberCtrl.text), child: const Text('Создать', style: TextStyle(color: AppColors.accent))),
        ],
      ),
    );
    if (result == null || result.isEmpty) return;
    try {
      await _api.adminCreateTable(_token, _clubId, {
        'number': result,
        'size': size,
        'supportedGames': '',
        'x': 0,
        'y': 0,
        'width': 100,
        'height': 60,
        'eventsOnly': false,
      });
      await _refreshTables();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _deleteTable(GameTable t) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        title: const Text('Удалить стол?', style: TextStyle(color: AppColors.textPrimary)),
        content: Text('Удалить стол №${t.number}?', style: const TextStyle(color: AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Удалить', style: TextStyle(color: AppColors.accent))),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _api.adminDeleteTable(_token, _clubId, t.id);
      await _refreshTables();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  // ─── Events Actions ─────────────────────────────────────────────────────

  Future<void> _addEvent() async {
    final titleCtrl = TextEditingController();
    final maxCtrl = TextEditingController(text: '8');
    String eventType = 'Tournament';
    DateTime? startDate;
    DateTime? endDate;

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setDialogState) {
          return AlertDialog(
            backgroundColor: AppColors.cardBg,
            title: const Text('Новое событие', style: TextStyle(color: AppColors.textPrimary)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: titleCtrl,
                    style: const TextStyle(color: AppColors.textPrimary),
                    decoration: const InputDecoration(
                      labelText: 'Название',
                      labelStyle: TextStyle(color: AppColors.textSecondary),
                    ),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: eventType,
                    dropdownColor: AppColors.cardBg,
                    style: const TextStyle(color: AppColors.textPrimary),
                    items: const [
                      DropdownMenuItem(value: 'Tournament', child: Text('Турнир')),
                      DropdownMenuItem(value: 'Campaign', child: Text('Кампания')),
                      DropdownMenuItem(value: 'Other', child: Text('Другое')),
                    ],
                    onChanged: (v) => setDialogState(() => eventType = v ?? 'Tournament'),
                    decoration: const InputDecoration(
                      labelText: 'Тип',
                      labelStyle: TextStyle(color: AppColors.textSecondary),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: maxCtrl,
                    style: const TextStyle(color: AppColors.textPrimary),
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Макс. участников',
                      labelStyle: TextStyle(color: AppColors.textSecondary),
                    ),
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    title: Text(startDate != null ? DateFormat('dd.MM.yyyy HH:mm').format(startDate!) : 'Начало',
                        style: TextStyle(color: startDate != null ? AppColors.textPrimary : AppColors.textSecondary)),
                    trailing: const Icon(Icons.calendar_today, color: AppColors.accent),
                    onTap: () async {
                      final date = await showDatePicker(context: ctx, initialDate: DateTime.now(), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
                      if (date != null) {
                        final time = await showTimePicker(context: ctx, initialTime: TimeOfDay(hour: date.hour, minute: 0));
                        if (time != null) {
                          setDialogState(() => startDate = DateTime(date.year, date.month, date.day, time.hour, time.minute));
                        }
                      }
                    },
                  ),
                  ListTile(
                    title: Text(endDate != null ? DateFormat('dd.MM.yyyy HH:mm').format(endDate!) : 'Конец',
                        style: TextStyle(color: endDate != null ? AppColors.textPrimary : AppColors.textSecondary)),
                    trailing: const Icon(Icons.calendar_today, color: AppColors.accent),
                    onTap: () async {
                      final date = await showDatePicker(context: ctx, initialDate: startDate ?? DateTime.now(), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
                      if (date != null) {
                        final time = await showTimePicker(context: ctx, initialTime: TimeOfDay(hour: date.hour, minute: 0));
                        if (time != null) {
                          setDialogState(() => endDate = DateTime(date.year, date.month, date.day, time.hour, time.minute));
                        }
                      }
                    },
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Создать', style: TextStyle(color: AppColors.accent)),
              ),
            ],
          );
        });
      },
    );

    if (result != true || titleCtrl.text.isEmpty || startDate == null || endDate == null) return;

    try {
      await _api.adminCreateEvent(_token, _clubId, {
        'title': titleCtrl.text,
        'startTime': startDate!.toUtc().toIso8601String(),
        'endTime': endDate!.toUtc().toIso8601String(),
        'maxParticipants': int.tryParse(maxCtrl.text) ?? 8,
        'eventType': eventType,
      });
      await _refreshEvents();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _deleteEvent(AdminEvent ev) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        title: const Text('Удалить событие?', style: TextStyle(color: AppColors.textPrimary)),
        content: Text('Удалить «${ev.title}»?', style: const TextStyle(color: AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Удалить', style: TextStyle(color: AppColors.accent))),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _api.adminDeleteEvent(_token, _clubId, ev.id);
      await _refreshEvents();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  // ─── Settings ───────────────────────────────────────────────────────────

  Future<void> _saveSettings() async {
    try {
      await _api.adminUpdateSettings(_token, _clubId, {
        'openTime': _openTime,
        'closeTime': _closeTime,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Настройки сохранены'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  // ─── Build ──────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: Text(
          '👑 ${_clubName ?? 'Админка'}',
          style: const TextStyle(color: AppColors.accent),
        ),
        bottom: TabBar(
          controller: _tabController,
          tabs: _tabs,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          labelColor: AppColors.accent,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.accent,
          labelStyle: const TextStyle(fontSize: 11),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, style: const TextStyle(color: AppColors.accent)),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _loadData, child: const Text('Повторить')),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildMembersTab(),
                    _buildTablesTab(),
                    _buildEventsTab(),
                    _buildSettingsTab(),
                  ],
                ),
    );
  }

  // ─── Members Tab ────────────────────────────────────────────────────────

  Widget _buildMembersTab() {
    final pending = _memberships.where((m) => m.status == 'Pending').toList();
    final approved = _memberships.where((m) => m.status == 'Approved').toList();
    final others = _memberships.where((m) => m.status != 'Pending' && m.status != 'Approved').toList();

    return RefreshIndicator(
      onRefresh: _refreshMembers,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          if (pending.isNotEmpty) ...[
            const Text('Заявки', style: TextStyle(color: AppColors.accent, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...pending.map((m) => _buildMemberCard(m, isPending: true)),
            const SizedBox(height: 16),
          ],
          const Text('Участники', style: TextStyle(color: AppColors.accent, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ...approved.map((m) => _buildMemberCard(m, isPending: false)),
          if (others.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Прочие', style: TextStyle(color: AppColors.textSecondary, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...others.map((m) => _buildMemberCard(m, isPending: false)),
          ],
        ],
      ),
    );
  }

  Widget _buildMemberCard(AdminMembership m, {required bool isPending}) {
    final statusColor = m.status == 'Approved'
        ? Colors.green
        : m.status == 'Rejected'
            ? AppColors.accent
            : m.status == 'Kicked'
                ? Colors.orange
                : Colors.amber;

    return Card(
      color: AppColors.cardBg,
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Text(m.userName, style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold)),
                      if (m.isManualEntry)
                        Container(
                          margin: const EdgeInsets.only(left: 6),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(color: Colors.green.withOpacity(0.2), borderRadius: BorderRadius.circular(4)),
                          child: const Text('вручную', style: TextStyle(color: Colors.green, fontSize: 10)),
                        ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: statusColor.withOpacity(0.2), borderRadius: BorderRadius.circular(4)),
                  child: Text(
                    m.status == 'Kicked' ? 'Исключён' : m.status,
                    style: TextStyle(color: statusColor, fontSize: 11),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(m.userEmail, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            if (m.status == 'Approved') ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  if (m.isAdmin) const Text('👑 ', style: TextStyle(fontSize: 14)),
                  if (m.isModerator) const Text('⭐ ', style: TextStyle(fontSize: 14)),
                  if (m.hasKey) const Text('🗝️ ', style: TextStyle(fontSize: 14)),
                  const Spacer(),
                  if (!m.isManualEntry) ...[
                    _smallButton(
                      m.isModerator ? '⭐ Снять' : '⭐ Модер',
                      m.isModerator ? Colors.amber.shade900 : Colors.green.shade900,
                      () => _toggleModerator(m),
                    ),
                    const SizedBox(width: 4),
                  ],
                  _smallButton(
                    m.hasKey ? '🗝️ Снять' : '🗝️ Ключ',
                    m.hasKey ? Colors.amber.shade900 : Colors.brown.shade700,
                    () => _toggleKey(m),
                  ),
                  const SizedBox(width: 4),
                  if (!m.isManualEntry) ...[
                    _smallButton(
                      m.isAdmin ? '👑 Снять' : '👑 Админ',
                      m.isAdmin ? AppColors.accent.withOpacity(0.7) : Colors.purple.shade700,
                      () => _toggleAdmin(m),
                    ),
                    const SizedBox(width: 4),
                  ],
                  _smallButton('Исключить', Colors.red.shade700, () => _kickMember(m)),
                ],
              ),
            ],
            if (isPending) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  ElevatedButton(
                    onPressed: () => _approveMember(m),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                    child: const Text('Одобрить', style: TextStyle(color: Colors.white)),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: () => _rejectMember(m),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent),
                    child: const Text('Отклонить', style: TextStyle(color: Colors.white)),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _smallButton(String text, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4)),
        child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 10)),
      ),
    );
  }

  // ─── Tables Tab ─────────────────────────────────────────────────────────

  Widget _buildTablesTab() {
    return RefreshIndicator(
      onRefresh: _refreshTables,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          ElevatedButton.icon(
            onPressed: _addTable,
            icon: const Icon(Icons.add),
            label: const Text('Добавить стол'),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent),
          ),
          const SizedBox(height: 12),
          ..._tables.map((t) => Card(
                color: AppColors.cardBg,
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text('Стол №${t.number}', style: const TextStyle(color: AppColors.textPrimary)),
                  subtitle: Text('${t.size} • ${t.supportedGames.replaceAll('|', ', ')}${t.eventsOnly ? ' • Только события' : ''}',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete, color: AppColors.accent),
                    onPressed: () => _deleteTable(t),
                  ),
                ),
              )),
        ],
      ),
    );
  }

  // ─── Events Tab ─────────────────────────────────────────────────────────

  Widget _buildEventsTab() {
    return RefreshIndicator(
      onRefresh: _refreshEvents,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          ElevatedButton.icon(
            onPressed: _addEvent,
            icon: const Icon(Icons.add),
            label: const Text('Добавить событие'),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent),
          ),
          const SizedBox(height: 12),
          ..._events.map((ev) {
            final start = DateTime.tryParse(ev.startTime);
            final end = DateTime.tryParse(ev.endTime);
            final fmt = DateFormat('dd.MM.yyyy HH:mm');
            return Card(
              color: AppColors.cardBg,
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text(ev.title, style: const TextStyle(color: AppColors.textPrimary)),
                subtitle: Text(
                  '${ev.eventType} • ${start != null ? fmt.format(start) : '?'} — ${end != null ? fmt.format(end) : '?'}\n'
                  '${ev.participants.length}/${ev.maxParticipants} участников${ev.gameSystem != null ? ' • ${ev.gameSystem}' : ''}',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.delete, color: AppColors.accent),
                  onPressed: () => _deleteEvent(ev),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  // ─── Settings Tab ───────────────────────────────────────────────────────

  Widget _buildSettingsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: AppColors.cardBg,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Время работы', style: TextStyle(color: AppColors.accent, fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Text('Открытие:', style: TextStyle(color: AppColors.textSecondary)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        style: const TextStyle(color: AppColors.textPrimary),
                        decoration: const InputDecoration(
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                          border: OutlineInputBorder(),
                          hintText: '10:00',
                          hintStyle: TextStyle(color: AppColors.textSecondary),
                        ),
                        controller: TextEditingController(text: _openTime),
                        onChanged: (v) => _openTime = v,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Text('Закрытие:', style: TextStyle(color: AppColors.textSecondary)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        style: const TextStyle(color: AppColors.textPrimary),
                        decoration: const InputDecoration(
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                          border: OutlineInputBorder(),
                          hintText: '22:00',
                          hintStyle: TextStyle(color: AppColors.textSecondary),
                        ),
                        controller: TextEditingController(text: _closeTime),
                        onChanged: (v) => _closeTime = v,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _saveSettings,
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent),
                    child: const Text('Сохранить'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
