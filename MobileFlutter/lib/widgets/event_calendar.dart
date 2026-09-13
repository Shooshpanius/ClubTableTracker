import 'package:flutter/material.dart';

import '../app_colors.dart';
import '../constants.dart';
import '../models/club_event.dart';

/// Календарь ивентов клуба. Цвет — у каждого события свой (детерминированно по id).
/// Кампании — фоновые полосы (пересекающиеся делят клетку на равные полосы);
/// под датой — бейджи всех событий дня (квадрат — кампания, круг — турнир);
/// внизу — легенда мероприятий выбранного месяца, тап — переход к дате начала.
/// Зеркалит веб-версию (clubtabletracker.client/src/components/EventCalendar.tsx).

const List<String> _monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const List<String> _monthNamesShort = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];
const List<String> _monthNamesGenitive = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const List<String> _weekdayNames = [
  'понедельник', 'вторник', 'среда', 'четверг',
  'пятница', 'суббота', 'воскресенье',
];
const List<String> _dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

Color _hexToColor(String hex) {
  var raw = hex.replaceFirst('#', '');
  if (raw.length == 3) {
    raw = raw.split('').map((c) => c + c).join();
  }
  final n = int.tryParse(raw, radix: 16);
  if (n == null) return AppColors.textMuted;
  return Color(0xFF000000 | n);
}

/// Цвет события: детерминированно по id (формула совпадает с вебом)
Color eventColor(int id) {
  final n = eventPalette.length;
  final index = ((id % n) + n) % n;
  return _hexToColor(eventPalette[index]);
}

String _systemLabel(String? system) {
  final s = system?.trim() ?? '';
  return s.isEmpty ? 'Без системы' : s;
}

bool _isCampaign(ClubEvent e) =>
    e.eventType.trim().toLowerCase() == 'campaign';

DateTime _dayOnly(DateTime d) => DateTime(d.year, d.month, d.day);

bool _coversDay(ClubEvent e, DateTime day) {
  final s = _dayOnly(e.startDateTime);
  final en = _dayOnly(e.endDateTime);
  return !s.isAfter(day) && !day.isAfter(en);
}

List<ClubEvent> _campaignsCoveringDay(List<ClubEvent> events, DateTime day) =>
    events.where((e) => _isCampaign(e) && _coversDay(e, day)).toList();

List<ClubEvent> _singleEventsOnDay(List<ClubEvent> events, DateTime day) =>
    events.where((e) => !_isCampaign(e) && _coversDay(e, day)).toList();

/// Сетка месяца, Пн-первый
List<List<DateTime?>> _monthGrid(int year, int month) {
  final daysInMonth = DateTime(year, month + 1, 0).day;
  final startOffset = DateTime(year, month, 1).weekday - 1; // 1=Пн .. 7=Вс
  final weeks = <List<DateTime?>>[];
  var day = 1;
  for (var w = 0; w < 6; w++) {
    final week = <DateTime?>[];
    for (var d = 0; d < 7; d++) {
      final idx = w * 7 + d;
      week.add(idx < startOffset || day > daysInMonth
          ? null
          : DateTime(year, month, day++));
    }
    weeks.add(week);
    if (day > daysInMonth) break;
  }
  return weeks;
}

/// События, пересекающиеся с месяцем (для легенды), по возрастанию даты начала
List<ClubEvent> _eventsInMonth(List<ClubEvent> events, int year, int month) {
  final monthStart = DateTime(year, month, 1);
  final monthEnd = DateTime(year, month + 1, 0);
  final result = events
      .where((e) =>
          !_dayOnly(e.startDateTime).isAfter(monthEnd) &&
          !_dayOnly(e.endDateTime).isBefore(monthStart))
      .toList()
    ..sort((a, b) => a.startDateTime.compareTo(b.startDateTime));
  return result;
}

String _formatRange(DateTime s, DateTime en) {
  final sameYear = s.year == en.year;
  final sText = sameYear
      ? '${s.day} ${_monthNamesShort[s.month - 1]}'
      : '${s.day} ${_monthNamesShort[s.month - 1]} ${s.year}';
  return '$sText – ${en.day} ${_monthNamesShort[en.month - 1]} ${en.year}';
}

String _formatDayShort(DateTime d) =>
    '${d.day} ${_monthNamesShort[d.month - 1]}';

String _formatTime(DateTime d) =>
    '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

// Инициалы события для бейджа: первые буквы первых двух слов («Крестовый поход» → «КП»)
String _eventInitials(String title) {
  final words = title.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  if (words.isEmpty) return '?';
  final first = words[0].isNotEmpty ? words[0][0] : '';
  final second = words.length > 1 && words[1].isNotEmpty ? words[1][0] : '';
  return (first + second).toUpperCase();
}

class EventCalendarWidget extends StatefulWidget {
  final List<ClubEvent> events;

  const EventCalendarWidget({super.key, required this.events});

  @override
  State<EventCalendarWidget> createState() => _EventCalendarWidgetState();
}

class _EventCalendarWidgetState extends State<EventCalendarWidget> {
  final DateTime _today = _dayOnly(DateTime.now());
  late int _viewYear;
  late int _viewMonth;
  DateTime? _selected;

  @override
  void initState() {
    super.initState();
    _viewYear = _today.year;
    _viewMonth = _today.month;
  }

  void _prevMonth() => setState(() {
        if (_viewMonth == 1) {
          _viewYear--;
          _viewMonth = 12;
        } else {
          _viewMonth--;
        }
      });

  void _nextMonth() => setState(() {
        if (_viewMonth == 12) {
          _viewYear++;
          _viewMonth = 1;
        } else {
          _viewMonth++;
        }
      });

  void _goToday() => setState(() {
        _viewYear = _today.year;
        _viewMonth = _today.month;
      });

  // Тап по легенде: перейти к месяцу начала события и выбрать день начала
  void _goToEvent(ClubEvent e) => setState(() {
        final s = _dayOnly(e.startDateTime);
        _viewYear = s.year;
        _viewMonth = s.month;
        _selected = s;
      });

  BoxDecoration _cellDecoration(bool isSelected, bool isToday) {
    // Клетки не заливаются цветами событий — их несут бейджи под датой
    if (isSelected) {
      return BoxDecoration(
          border: Border.all(color: AppColors.accent, width: 1.5));
    }
    if (isToday) {
      return BoxDecoration(
          border: Border.all(color: AppColors.accentGreen, width: 1.5));
    }
    return const BoxDecoration(
        border: Border.fromBorderSide(
            BorderSide(color: AppColors.borderDark)));
  }

  // Бейджи событий дня: одинаковой ширины чипы с иконкой типа и инициалами
  Widget _buildDayBadges(List<ClubEvent> dayEvents) {
    if (dayEvents.isEmpty) return const SizedBox.shrink();
    final shown = dayEvents.take(3).toList();
    final rest = dayEvents.length - shown.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final ev in shown)
          Container(
            height: 17,
            margin: const EdgeInsets.symmetric(vertical: 1),
            padding: const EdgeInsets.symmetric(horizontal: 2),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(3),
              color: eventColor(ev.id)
                  .withOpacity(ev.isCompleted ? 0.15 : 0.32),
              border: Border.all(
                  color: eventColor(ev.id)
                      .withOpacity(ev.isCompleted ? 0.45 : 0.9)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  _isCampaign(ev) ? '⚔' : '🏆',
                  style: const TextStyle(fontSize: 9, height: 1.1),
                ),
                const SizedBox(width: 3),
                Flexible(
                  child: Text(
                    _eventInitials(ev.title),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 9,
                        height: 1.1,
                        fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
        if (rest > 0)
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Text(
              '+$rest',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 9),
            ),
          ),
      ],
    );
  }

  Widget _buildGrid() {
    final weeks = _monthGrid(_viewYear, _viewMonth);

    return Column(
      children: [
        Row(
          children: [
            for (final d in _dayNames)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Text(
                    d,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 11),
                  ),
                ),
              ),
          ],
        ),
        for (final week in weeks)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final day in week)
                  Expanded(
                    child: day == null
                        ? const SizedBox.expand()
                        : GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => setState(() => _selected = day),
                            child: Container(
                              margin: const EdgeInsets.all(1),
                              padding: const EdgeInsets.only(top: 3, bottom: 2),
                              decoration: _cellDecoration(
                                _selected == day,
                                day == _today,
                              ),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    '${day.day}',
                                    style: TextStyle(
                                      color: day == _today
                                          ? AppColors.accentGreen
                                          : AppColors.textPrimary,
                                      fontSize: 13,
                                      fontWeight: _selected == day ||
                                              day == _today
                                          ? FontWeight.bold
                                          : FontWeight.normal,
                                    ),
                                  ),
                                  _buildDayBadges([
                                    ..._campaignsCoveringDay(
                                        widget.events, day),
                                    ..._singleEventsOnDay(widget.events, day),
                                  ]),
                                ],
                              ),
                            ),
                          ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  // Легенда: мероприятия выбранного месяца, тап — к дате начала
  Widget _buildLegend() {
    final monthEvents = _eventsInMonth(widget.events, _viewYear, _viewMonth);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.only(bottom: 4),
          child: Text('Мероприятия месяца:',
              style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
        ),
        if (monthEvents.isEmpty)
          const Text('В этом месяце событий нет',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
        for (final e in monthEvents)
          GestureDetector(
            onTap: () => _goToEvent(e),
            child: Container(
              margin: const EdgeInsets.only(bottom: 4),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.panelBg,
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      shape: _isCampaign(e)
                          ? BoxShape.rectangle
                          : BoxShape.circle,
                      borderRadius:
                          _isCampaign(e) ? BorderRadius.circular(2) : null,
                      color: eventColor(e.id),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      '${_isCampaign(e) ? '⚔️' : '🏆'} ${e.title}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: AppColors.textPrimary, fontSize: 12),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _isCampaign(e)
                        ? _formatRange(e.startDateTime, e.endDateTime)
                        : '${_formatDayShort(e.startDateTime)}, '
                            '${_formatTime(e.startDateTime)}',
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 11),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildDayPanel() {
    if (_selected == null) return const SizedBox.shrink();
    final day = _selected!;
    final campaigns = _campaignsCoveringDay(widget.events, day);
    final tournaments = _singleEventsOnDay(widget.events, day);
    final nothing = campaigns.isEmpty && tournaments.isEmpty;

    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.only(top: 12),
      decoration: const BoxDecoration(
        border: Border(
            top: BorderSide(color: AppColors.border, width: 1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${_weekdayNames[day.weekday - 1]}, '
            '${day.day} ${_monthNamesGenitive[day.month - 1]} ${day.year}',
            style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.bold),
          ),
          if (nothing)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('В этот день событий нет',
                  style: TextStyle(
                      color: AppColors.textSecondary, fontSize: 12)),
            ),
          for (final e in campaigns) _buildDetailRow(e, isCampaign: true),
          for (final e in tournaments) _buildDetailRow(e, isCampaign: false),
          if (!nothing)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text(
                'Регистрация — во вкладке «События»',
                style: TextStyle(
                    color: AppColors.textMuted, fontSize: 11),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(ClubEvent e, {required bool isCampaign}) {
    final color = eventColor(e.id);
    final details = isCampaign
        ? 'кампания · ${_formatRange(e.startDateTime, e.endDateTime)}'
        : '${_formatTime(e.startDateTime)}–${_formatTime(e.endDateTime)}'
            '${e.maxParticipants > 0 ? ' · участников: ${e.participants.length} / ${e.maxParticipants}' : ''}';
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: const BoxDecoration(
        border: Border(
            bottom: BorderSide(color: AppColors.border, width: 1)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 12,
            height: 12,
            margin: const EdgeInsets.only(top: 2, right: 8),
            decoration: BoxDecoration(
              shape: isCampaign ? BoxShape.rectangle : BoxShape.circle,
              borderRadius:
                  isCampaign ? BorderRadius.circular(2) : null,
              color: color,
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Opacity(
                  opacity: e.isCompleted ? 0.6 : 1,
                  child: Text(
                    '${isCampaign ? '⚔️' : '🏆'} ${e.title}',
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${_systemLabel(e.gameSystem)} · $details'
                  '${e.gameMasterName != null ? ' · ГМ: ${e.gameMasterName}' : ''}'
                  '${isCampaign && e.participants.isNotEmpty ? ' · участников: ${e.participants.length}' : ''}',
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              IconButton(
                onPressed: _prevMonth,
                icon: const Icon(Icons.chevron_left,
                    color: AppColors.textPrimary),
                visualDensity: VisualDensity.compact,
              ),
              Expanded(
                child: Column(
                  children: [
                    Text(
                      '${_monthNames[_viewMonth - 1]} $_viewYear',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.bold),
                    ),
                    GestureDetector(
                      onTap: _goToday,
                      child: const Text(
                        'Сегодня',
                        style: TextStyle(
                            color: AppColors.accentBlue, fontSize: 11),
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: _nextMonth,
                icon: const Icon(Icons.chevron_right,
                    color: AppColors.textPrimary),
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          const SizedBox(height: 8),
          _buildGrid(),
          const SizedBox(height: 12),
          _buildLegend(),
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text(
              'Бейджи под датой — события дня (⚔ — кампания, 🏆 — турнир); '
              'тап по легенде — к дате начала',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted, fontSize: 11),
            ),
          ),
          _buildDayPanel(),
        ],
      ),
    );
  }
}
