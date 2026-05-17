import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../app_colors.dart';
import '../constants.dart';
import '../models/club.dart';
import '../models/game_table.dart';
import '../models/club_member.dart';
import '../services/api_service.dart';

const String _reservedUserId = '__RESERVED__';
const String _promptSelectSystemId = '__prompt__';
const int _maxInvitedSlots = 4;

/// Диалог создания бронирования (показывается как bottom sheet)
class BookingDialog extends StatefulWidget {
  final GameTable table;
  final Club club;
  final String token;
  final List<ClubMember> members;
  final String myId;
  final bool isModerator;
  final ApiService api;
  final VoidCallback onBookingCreated;

  const BookingDialog({
    super.key,
    required this.table,
    required this.club,
    required this.token,
    required this.members,
    required this.myId,
    required this.isModerator,
    required this.api,
    required this.onBookingCreated,
  });

  @override
  State<BookingDialog> createState() => _BookingDialogState();
}

class _BookingDialogState extends State<BookingDialog> {
  DateTime _selectedDate = DateTime.now();
  String _startHour = '';
  String _startMinute = '00';
  String _endHour = '';
  String _endMinute = '00';
  String? _gameSystem;
  bool _isDoubles = false;
  bool _isForOthers = false;
  List<String> _invitedUserIds = List.filled(_maxInvitedSlots, '');
  bool _saving = false;
  String? _error;

  static const _minutes = ['00', '15', '30', '45'];

  /// Количество слотов для приглашённых участников
  int get _inviteSlots =>
      _isForOthers ? (_isDoubles ? 4 : 2) : (_isDoubles ? 3 : 1);

  /// Поддерживаемые игровые системы стола
  List<String> get _tableSystems => widget.table.supportedGames
      .split('|')
      .where((s) => s.isNotEmpty)
      .toList();

  /// Участники, допущенные к выбранной системе (исключая себя)
  List<ClubMember> get _eligibleMembers {
    if (_gameSystem == null || _gameSystem!.isEmpty) return [];
    return widget.members
        .where((m) => m.id != widget.myId)
        .where((m) => m.gameSystems.contains(_gameSystem))
        .toList();
  }

  /// Допустимые часы с учётом рабочего времени клуба
  List<String> _validHours() {
    final openH = _parseHour(widget.club.openTime);
    final closeH = _parseHour(widget.club.closeTime);
    return List.generate(24, (i) => i.toString().padLeft(2, '0'))
        .where((h) {
          final hNum = int.parse(h);
          return hNum >= openH && hNum <= closeH;
        })
        .toList();
  }

  int _parseHour(String time) {
    final parts = time.split(':');
    return int.tryParse(parts.isNotEmpty ? parts[0] : '0') ?? 0;
  }

  int _parseMinute(String time) {
    final parts = time.split(':');
    return int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0;
  }

  int _toTotalMinutes(String hour, String minute) =>
      int.parse(hour) * 60 + int.parse(minute);

  void _handleDoublesChange(bool checked) {
    setState(() {
      _isDoubles = checked;
      _trimInvitedSlots();
    });
  }

  void _handleForOthersChange(bool checked) {
    setState(() {
      _isForOthers = checked;
      _trimInvitedSlots();
    });
  }

  void _trimInvitedSlots() {
    final limit = _inviteSlots;
    for (int i = limit; i < _maxInvitedSlots; i++) {
      _invitedUserIds[i] = '';
    }
  }

  void _handleGameSystemChange(String? system) {
    final newSystem = (system?.isEmpty ?? true) ? null : system;
    final eligibleIds = newSystem != null
        ? widget.members
            .where((m) => m.id != widget.myId)
            .where((m) => m.gameSystems.contains(newSystem))
            .map((m) => m.id)
            .toSet()
        : <String>{};
    setState(() {
      _gameSystem = newSystem;
      for (int i = 0; i < _maxInvitedSlots; i++) {
        final id = _invitedUserIds[i];
        if (id.isNotEmpty && id != _reservedUserId && !eligibleIds.contains(id)) {
          _invitedUserIds[i] = '';
        }
      }
    });
  }

  void _setInvitedAt(int index, String value) {
    setState(() {
      _invitedUserIds = List.from(_invitedUserIds)..[index] = value;
    });
  }

  String _buildDatetimeLocal(DateTime date, String hour, String minute) {
    final dt = DateTime(date.year, date.month, date.day,
        int.parse(hour), int.parse(minute));
    return DateFormat("yyyy-MM-dd'T'HH:mm").format(dt);
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final maxDate = now.add(const Duration(days: maxBookingDaysAhead));
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: now,
      lastDate: maxDate,
      builder: (_, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(primary: AppColors.accent),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _selectedDate = picked);
  }

  String _getParticipantLabel(int index) {
    if (_isForOthers) {
      return _isDoubles ? 'Игрок ${index + 1}:' : (index == 0 ? 'Игрок 1:' : 'Игрок 2:');
    }
    return _isDoubles ? 'Игрок ${index + 2}:' : 'Оппонент:';
  }

  Future<void> _submit() async {
    if (_startHour.isEmpty || _endHour.isEmpty) {
      setState(() => _error = 'Выберите время начала и окончания');
      return;
    }

    final openMin =
        _parseHour(widget.club.openTime) * 60 + _parseMinute(widget.club.openTime);
    final closeMin =
        _parseHour(widget.club.closeTime) * 60 + _parseMinute(widget.club.closeTime);
    final startMin = _toTotalMinutes(_startHour, _startMinute);
    final endMin = _toTotalMinutes(_endHour, _endMinute);

    if (startMin < openMin || endMin > closeMin) {
      setState(() => _error =
          'Время должно быть в рамках ${widget.club.openTime}–${widget.club.closeTime}');
      return;
    }
    if (startMin >= endMin) {
      setState(() => _error = 'Время окончания должно быть позже начала');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final startStr = _buildDatetimeLocal(_selectedDate, _startHour, _startMinute);
      final endStr = _buildDatetimeLocal(_selectedDate, _endHour, _endMinute);

      final ids = _invitedUserIds
          .take(_inviteSlots)
          .where((id) => id.isNotEmpty)
          .toList();

      await widget.api.createBooking(
        tableId: widget.table.id,
        startTime: startStr,
        endTime: endStr,
        token: widget.token,
        gameSystem: (_gameSystem?.isNotEmpty == true) ? _gameSystem : null,
        isDoubles: _isDoubles,
        isForOthers: _isForOthers,
        invitedUserIds: ids.isNotEmpty ? ids : null,
      );
      if (!mounted) return;
      Navigator.pop(context);
      widget.onBookingCreated();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFmt = DateFormat('dd.MM.yyyy', 'ru');
    final validHours = _validHours();
    final systems = _tableSystems;

    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Заголовок
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Забронировать стол №${widget.table.number}',
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: AppColors.textSecondary),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const Divider(color: AppColors.border),

            // Дата
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Дата',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              subtitle: Text(
                dateFmt.format(_selectedDate),
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
              ),
              trailing: const Icon(Icons.calendar_today,
                  color: AppColors.accentBlue, size: 18),
              onTap: _pickDate,
            ),

            // Время начала и конца
            Row(
              children: [
                Expanded(
                  child: _TimeDropdown(
                    label: 'Начало',
                    hour: _startHour,
                    minute: _startMinute,
                    validHours: validHours,
                    minutes: _minutes,
                    onChanged: (h, m) => setState(() {
                      _startHour = h;
                      _startMinute = m;
                    }),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _TimeDropdown(
                    label: 'Конец',
                    hour: _endHour,
                    minute: _endMinute,
                    validHours: validHours,
                    minutes: _minutes,
                    onChanged: (h, m) => setState(() {
                      _endHour = h;
                      _endMinute = m;
                    }),
                  ),
                ),
              ],
            ),

            // Игровая система (только если стол её поддерживает)
            if (systems.isNotEmpty) ...[
              const SizedBox(height: 8),
              const Text('Игровая система (опционально)',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              const SizedBox(height: 6),
              DropdownButton<String?>(
                value: _gameSystem,
                hint: const Text('— Не выбрано —',
                    style: TextStyle(color: AppColors.textMuted)),
                dropdownColor: AppColors.cardBg,
                style: const TextStyle(color: AppColors.textPrimary),
                isExpanded: true,
                onChanged: (v) => _handleGameSystemChange(v),
                items: [
                  const DropdownMenuItem<String?>(
                    value: null,
                    child: Text('— Не выбрано —',
                        style: TextStyle(color: AppColors.textMuted)),
                  ),
                  ...systems.map(
                    (gs) => DropdownMenuItem<String?>(
                      value: gs,
                      child: Text(gs),
                    ),
                  ),
                ],
              ),
            ],

            // Дублс (2x2)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('2x2 (4 игрока)',
                  style: TextStyle(color: AppColors.textPrimary, fontSize: 13)),
              value: _isDoubles,
              activeColor: AppColors.accent,
              onChanged: (v) => _handleDoublesChange(v ?? false),
            ),

            // Для других (только для модераторов)
            if (widget.isModerator)
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Для других (модератор не участвует)',
                    style: TextStyle(color: Color(0xFFFFC107), fontSize: 13)),
                value: _isForOthers,
                activeColor: const Color(0xFFFFC107),
                onChanged: (v) => _handleForOthersChange(v ?? false),
              ),

            // Слоты участников
            if (widget.members.isNotEmpty) ...[
              const SizedBox(height: 4),
              Builder(builder: (context) {
                final selectedIds = _invitedUserIds.toSet();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: List.generate(_inviteSlots, (i) {
                    final currentId = _invitedUserIds[i];
                    final eligible = _eligibleMembers
                        .where((m) =>
                            m.id == currentId ||
                            !selectedIds.contains(m.id))
                        .toList();

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _getParticipantLabel(i),
                            style: TextStyle(
                              color: _isForOthers
                                  ? const Color(0xFFFFC107)
                                  : AppColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 4),
                          DropdownButton<String>(
                            value: currentId.isNotEmpty ? currentId : null,
                            hint: const Text('— Не выбран —',
                                style: TextStyle(color: AppColors.textMuted)),
                            dropdownColor: AppColors.cardBg,
                            style:
                                const TextStyle(color: AppColors.textPrimary),
                            isExpanded: true,
                            onChanged: (v) => _setInvitedAt(i, v ?? ''),
                            items: [
                              const DropdownMenuItem<String>(
                                value: '',
                                child: Text('— Не выбран —',
                                    style:
                                        TextStyle(color: AppColors.textMuted)),
                              ),
                              const DropdownMenuItem<String>(
                                value: _reservedUserId,
                                child: Text('ЗАБРОНИРОВАНО',
                                    style: TextStyle(
                                        color: AppColors.textSecondary)),
                              ),
                              if (systems.isNotEmpty &&
                                  (_gameSystem == null ||
                                      _gameSystem!.isEmpty))
                                const DropdownMenuItem<String>(
                                  value: _promptSelectSystemId,
                                  enabled: false,
                                  child: Text('Сначала выберите систему',
                                      style: TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 12)),
                                ),
                              ...eligible.map(
                                (m) => DropdownMenuItem<String>(
                                  value: m.id,
                                  child: Text(m.effectiveName),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  }),
                );
              }),
            ],

            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!,
                  style: const TextStyle(color: AppColors.accent)),
            ],

            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.accent,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: _saving ? null : _submit,
                child: Text(
                  _saving ? 'Бронируем...' : 'В резерв',
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Виджет выбора времени с шагом 15 минут (dropdowns для часов и минут)
class _TimeDropdown extends StatelessWidget {
  final String label;
  final String hour;
  final String minute;
  final List<String> validHours;
  final List<String> minutes;
  final void Function(String hour, String minute) onChanged;

  const _TimeDropdown({
    required this.label,
    required this.hour,
    required this.minute,
    required this.validHours,
    required this.minutes,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                color: AppColors.textSecondary, fontSize: 12)),
        const SizedBox(height: 4),
        Row(
          children: [
            Expanded(
              child: DropdownButton<String>(
                value: hour.isNotEmpty ? hour : null,
                hint: const Text('чч',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                dropdownColor: AppColors.cardBg,
                style: const TextStyle(
                    color: AppColors.textPrimary, fontSize: 14),
                isExpanded: true,
                onChanged: (h) => onChanged(h ?? '', minute),
                items: validHours
                    .map((h) => DropdownMenuItem(value: h, child: Text(h)))
                    .toList(),
              ),
            ),
            const Text(':', style: TextStyle(color: AppColors.textPrimary)),
            Expanded(
              child: DropdownButton<String>(
                value: minute,
                dropdownColor: AppColors.cardBg,
                style: const TextStyle(
                    color: AppColors.textPrimary, fontSize: 14),
                isExpanded: true,
                onChanged: hour.isNotEmpty
                    ? (m) => onChanged(hour, m ?? '00')
                    : null,
                items: minutes
                    .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                    .toList(),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
