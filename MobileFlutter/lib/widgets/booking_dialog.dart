import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../app_colors.dart';
import '../constants.dart';
import '../models/club.dart';
import '../models/game_table.dart';
import '../models/club_member.dart';
import '../services/api_service.dart';

/// Диалог создания бронирования (показывается как bottom sheet)
class BookingDialog extends StatefulWidget {
  final GameTable table;
  final Club club;
  final String token;
  final List<ClubMember> members;
  final String myId;
  final ApiService api;
  final VoidCallback onBookingCreated;

  const BookingDialog({
    super.key,
    required this.table,
    required this.club,
    required this.token,
    required this.members,
    required this.myId,
    required this.api,
    required this.onBookingCreated,
  });

  @override
  State<BookingDialog> createState() => _BookingDialogState();
}

class _BookingDialogState extends State<BookingDialog> {
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _startTime = TimeOfDay.now();
  TimeOfDay _endTime = TimeOfDay(
      hour: (TimeOfDay.now().hour + 2) % 24, minute: TimeOfDay.now().minute);
  String? _gameSystem;
  bool _isDoubles = false;
  String? _partnerMemberId;
  bool _saving = false;
  String? _error;

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final maxDate = now.add(Duration(days: maxBookingDaysAhead));
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

  Future<void> _pickTime(bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart ? _startTime : _endTime,
      builder: (_, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(primary: AppColors.accent),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  String _buildDatetimeLocal(DateTime date, TimeOfDay time) {
    final dt = DateTime(
        date.year, date.month, date.day, time.hour, time.minute);
    return DateFormat("yyyy-MM-dd'T'HH:mm").format(dt);
  }

  Future<void> _submit() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final startStr =
          _buildDatetimeLocal(_selectedDate, _startTime);
      final endStr =
          _buildDatetimeLocal(_selectedDate, _endTime);

      final List<String>? partnerIds = _isDoubles && _partnerMemberId != null
          ? [_partnerMemberId!]
          : null;

      await widget.api.createBooking(
        tableId: widget.table.id,
        startTime: startStr,
        endTime: endStr,
        token: widget.token,
        gameSystem: _gameSystem,
        isDoubles: _isDoubles,
        participantIds: partnerIds,
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
    final otherMembers = widget.members
        .where((m) => m.id != widget.myId)
        .toList();

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
                  icon: const Icon(Icons.close,
                      color: AppColors.textSecondary),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const Divider(color: AppColors.border),

            // Дата
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Дата',
                  style: TextStyle(
                      color: AppColors.textSecondary, fontSize: 12)),
              subtitle: Text(
                dateFmt.format(_selectedDate),
                style: const TextStyle(
                    color: AppColors.textPrimary, fontSize: 14),
              ),
              trailing: const Icon(Icons.calendar_today,
                  color: AppColors.accentBlue, size: 18),
              onTap: _pickDate,
            ),

            // Время
            Row(
              children: [
                Expanded(
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Начало',
                        style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12)),
                    subtitle: Text(
                      _startTime.format(context),
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 14),
                    ),
                    trailing: const Icon(Icons.access_time,
                        color: AppColors.accentBlue, size: 18),
                    onTap: () => _pickTime(true),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Конец',
                        style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12)),
                    subtitle: Text(
                      _endTime.format(context),
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 14),
                    ),
                    trailing: const Icon(Icons.access_time,
                        color: AppColors.accentBlue, size: 18),
                    onTap: () => _pickTime(false),
                  ),
                ),
              ],
            ),

            // Игровая система
            const Text(
              'Игровая система (опционально)',
              style: TextStyle(
                  color: AppColors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 6),
            DropdownButton<String?>(
              value: _gameSystem,
              hint: const Text('Не выбрано',
                  style: TextStyle(color: AppColors.textMuted)),
              dropdownColor: AppColors.cardBg,
              style: const TextStyle(color: AppColors.textPrimary),
              isExpanded: true,
              onChanged: (v) => setState(() => _gameSystem = v),
              items: [
                const DropdownMenuItem<String?>(
                  value: null,
                  child: Text('— Не выбрано —',
                      style:
                          TextStyle(color: AppColors.textMuted)),
                ),
                ...allGameSystems.map(
                  (gs) => DropdownMenuItem<String?>(
                    value: gs,
                    child: Text(gs),
                  ),
                ),
              ],
            ),

            // Дублс
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Дублс (2 игрока)',
                  style: TextStyle(
                      color: AppColors.textPrimary, fontSize: 13)),
              value: _isDoubles,
              activeColor: AppColors.accent,
              onChanged: (v) => setState(() {
                _isDoubles = v ?? false;
                if (!_isDoubles) _partnerMemberId = null;
              }),
            ),

            if (_isDoubles && otherMembers.isNotEmpty) ...[
              const Text(
                'Партнёр (опционально)',
                style: TextStyle(
                    color: AppColors.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 6),
              DropdownButton<String?>(
                value: _partnerMemberId,
                hint: const Text('Выбрать партнёра',
                    style: TextStyle(color: AppColors.textMuted)),
                dropdownColor: AppColors.cardBg,
                style: const TextStyle(color: AppColors.textPrimary),
                isExpanded: true,
                onChanged: (v) => setState(() => _partnerMemberId = v),
                items: [
                  const DropdownMenuItem<String?>(
                    value: null,
                    child: Text('— Не выбрано —',
                        style:
                            TextStyle(color: AppColors.textMuted)),
                  ),
                  ...otherMembers.map(
                    (m) => DropdownMenuItem<String?>(
                      value: m.id,
                      child: Text(m.effectiveName),
                    ),
                  ),
                ],
              ),
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
                  _saving ? 'Бронируем...' : 'Забронировать',
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
