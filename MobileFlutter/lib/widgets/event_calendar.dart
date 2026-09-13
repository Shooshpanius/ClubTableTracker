import 'package:flutter/material.dart';

import '../app_colors.dart';
import '../constants.dart';
import '../models/club_event.dart';

/// Календарь ивентов клуба: кампании — фоновые полосы цвета игровой системы
/// (пересекающиеся кампании делят клетку на равные горизонтальные полосы),
/// турниры — точки цвета системы. Легенда фильтрует системы, клик по дню
/// открывает панель событий дня. Зеркалит веб-версию
/// (clubtabletracker.client/src/components/EventCalendar.tsx).

const List<String> _monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const List<String> _dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const List<String> _weekdayNames = [
  'понедельник', 'вторник', 'среда', 'четверг',
  'пятница', 'суббота', 'воскресенье',
];
const List<String> _monthNamesGenitive = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const List<String> _monthNamesShort = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

const String _noSystemColorHex = '#8A919C';
const String _noSystemLabel = 'Без системы';

Color _hexToColor(String hex) {
  var raw = hex.replaceFirst('#', '');
  if (raw.length == 3) {
    raw = raw.split('').map((c) => c + c).join();
  }
  final n = int.tryParse(raw, radix: 16);
  if (n == null) return AppColors.textMuted;
  return Color(0xFF000000 | n);
}

String _systemLabel(String? system) {
  final s = system?.trim() ?? '';
  return s.isEmpty ? _noSystemLabel : s;
}

/// Цвет системы: известной — из палитры, свободному тексту —
/// детерминированный хэш в палитру (как в вебе)
Color systemColor(String? system) {
  final s = system?.trim() ?? '';
  if (s.isEmpty) return _hexToColor(_noSystemColorHex);
  final hex = gameSystemColors[s];
  if (hex != null) return _hexToColor(hex);
  final palette = gameSystemColors.values.toList();
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = (h * 31 + s.codeUnitAt(i)) & 0xFFFFFFFF;
  }
  return _hexToColor(palette[h % palette.length]);
}

DateTime _dayOnly(DateTime d) => DateTime(d.year, d.month, d.day);

bool _isCampaign(ClubEvent e) =>
    e.eventType.trim().toLowerCase() == 'campaign';

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

String _formatRange(DateTime s, DateTime en) {
  final sameYear = s.year == en.year;
  final sText = sameYear
      ? '${s.day} ${_monthNamesShort[s.month - 1]}'
      : '${s.day} ${_monthNamesShort[s.month - 1]} ${s.year}';
  return '$sText – ${en.day} ${_monthNamesShort[en.month - 1]} ${en.year}';
}

String _formatTime(DateTime d) =>
    '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

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
  final Set<String> _hiddenSystems = {};

  @override
  void initState() {
    super.initState();
    _viewYear = _today.year;
    _viewMonth = _today.month;
  }

  List<ClubEvent> get _visibleEvents => widget.events
      .where((e) => !_hiddenSystems.contains(_systemLabel(e.gameSystem)))
      .toList();

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

  // Легенда: системы, встречающиеся в событиях, с количеством
  List<MapEntry<String, int>> get _legend {
    final counts = <String, int>{};
    for (final e in widget.events) {
      final l = _systemLabel(e.gameSystem);
      counts[l] = (counts[l] ?? 0) + 1;
    }
    return counts.entries.toList();
  }

  BoxDecoration _cellDecoration(DateTime day, List<ClubEvent> camps,
      bool isSelected, bool isToday) {
    // Полосы кампаний: пересекающиеся — по равной полосе на кампанию
    Gradient? gradient;
    if (camps.isNotEmpty) {
      final n = camps.length;
      final colors = <Color>[];
      final stops = <double>[];
      for (var i = 0; i < n; i++) {
        final c = camps[i];
        final col = systemColor(c.gameSystem)
            .withOpacity(c.isCompleted ? 0.16 : 0.4);
        colors..add(col)..add(col);
        stops..add(i / n)..add((i + 1) / n);
      }
      stops[stops.length - 1] = 1.0;
      gradient = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: colors,
        stops: stops,
      );
    }

    // Рамка: выбранный день / сегодня / насечка старта кампании слева
    Border? border;
    final side = BorderSide(color: AppColors.border);
    if (isSelected) {
      border = Border.all(color: AppColors.accent, width: 1.5);
    } else if (isToday) {
      border = Border.all(color: AppColors.accentGreen, width: 1.5);
    } else {
      border = Border(top: side, bottom: side, right: side, left: side);
    }
    final starting = camps
        .where((c) => _dayOnly(c.startDateTime) == day)
        .firstOrNull;
    if (starting != null && !isSelected) {
      border = Border(
        left: BorderSide(color: systemColor(starting.gameSystem), width: 3),
        top: border.top,
        right: border.right,
        bottom: border.bottom,
      );
    }

    return BoxDecoration(gradient: gradient, border: border);
  }

  Widget _buildDots(List<ClubEvent> tournaments) {
    if (tournaments.isEmpty) return const SizedBox.shrink();
    final shown = tournaments.take(3).toList();
    final rest = tournaments.length - shown.length;
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (final ev in shown)
            Container(
              width: 6,
              height: 6,
              margin: const EdgeInsets.symmetric(horizontal: 1.5),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: systemColor(ev.gameSystem),
              ),
            ),
          if (rest > 0)
            Padding(
              padding: const EdgeInsets.only(left: 2),
              child: Text(
                '+$rest',
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 9),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildGrid() {
    final events = _visibleEvents;
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
          Row(
            children: [
              for (final day in week)
                Expanded(
                  child: AspectRatio(
                    aspectRatio: 0.9,
                    child: day == null
                        ? const SizedBox.shrink()
                        : GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => setState(() => _selected = day),
                            child: Container(
                              margin: const EdgeInsets.all(1),
                              padding: const EdgeInsets.only(top: 3),
                              decoration: _cellDecoration(
                                day,
                                _campaignsCoveringDay(events, day),
                                _selected == day,
                                day == _today,
                              ),
                              child: Column(
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
                                  _buildDots(_singleEventsOnDay(events, day)),
                                ],
                              ),
                            ),
                          ),
                  ),
                ),
            ],
          ),
      ],
    );
  }

  Widget _buildLegend() {
    final legend = _legend;
    if (legend.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final entry in legend)
          () {
            final off = _hiddenSystems.contains(entry.key);
            return GestureDetector(
              onTap: () => setState(() {
                off
                    ? _hiddenSystems.remove(entry.key)
                    : _hiddenSystems.add(entry.key);
              }),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.panelBg,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                      color: off ? AppColors.border : AppColors.accent),
                ),
                child: Opacity(
                  opacity: off ? 0.45 : 1,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(2),
                          color: entry.key == _noSystemLabel
                              ? _hexToColor(_noSystemColorHex)
                              : systemColor(entry.key),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${entry.key} · ${entry.value}',
                        style: const TextStyle(
                            color: AppColors.textPrimary, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }(),
      ],
    );
  }

  Widget _buildDayPanel() {
    if (_selected == null) return const SizedBox.shrink();
    final day = _selected!;
    final events = _visibleEvents;
    final campaigns = _campaignsCoveringDay(events, day);
    final tournaments = _singleEventsOnDay(events, day);
    final nothing = campaigns.isEmpty && tournaments.isEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
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
        ),
      ],
    );
  }

  Widget _buildDetailRow(ClubEvent e, {required bool isCampaign}) {
    final color = systemColor(e.gameSystem);
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
              borderRadius: BorderRadius.circular(3),
              color: color,
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Opacity(
                        opacity: e.isCompleted ? 0.6 : 1,
                        child: Text(
                          '${isCampaign ? '⚔️' : '🏆'} ${e.title}',
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ),
                  ],
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
              'Полосы — кампании, точки — турниры; '
              'нажмите на чип легенды, чтобы скрыть систему',
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
