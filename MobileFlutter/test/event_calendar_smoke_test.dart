import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:club_table_tracker/models/club_event.dart';
import 'package:club_table_tracker/widgets/event_calendar.dart';

ClubEvent _ev(
  int id,
  String title,
  DateTime start,
  DateTime end, {
  String eventType = 'Tournament',
  String? gameSystem,
  String? status,
  int maxParticipants = 0,
}) =>
    ClubEvent(
      id: id,
      title: title,
      startTime: start.toIso8601String(),
      endTime: end.toIso8601String(),
      maxParticipants: maxParticipants,
      eventType: eventType,
      gameSystem: gameSystem,
      status: status,
    );

void main() {
  final y = DateTime.now().year;
  final events = <ClubEvent>[
    // Две пересекающиеся кампании + завершённая кампания из прошлого месяца
    _ev(1, 'Крестовый поход Аврелия', DateTime(y, 9, 1, 10), DateTime(y, 9, 20, 22),
        eventType: 'Campaign', gameSystem: 'Warhammer 40,000'),
    _ev(2, 'Теневые войны hive-города', DateTime(y, 9, 10, 10), DateTime(y, 9, 30, 22),
        eventType: 'Campaign', gameSystem: 'Necromunda'),
    _ev(3, 'Кампания Морхейма', DateTime(y, 8, 25, 10), DateTime(y, 9, 15, 22),
        eventType: 'Campaign', gameSystem: 'Mordheim', status: 'Completed'),
    // Турниры внутри дат кампаний
    _ev(4, 'Осенний турнир 1000 очков', DateTime(y, 9, 13, 11), DateTime(y, 9, 13, 20),
        gameSystem: 'Age of Sigmar', maxParticipants: 16),
    _ev(5, 'Командный килл-тим', DateTime(y, 9, 14, 11), DateTime(y, 9, 14, 18),
        gameSystem: 'Kill Team', maxParticipants: 8),
    // Архивный — вызывающая сторона фильтрует, в легенду попасть не должен
    _ev(6, 'Архивный турнир', DateTime(y, 9, 5, 11), DateTime(y, 9, 5, 20),
        gameSystem: 'Blood Bowl', status: 'Archived'),
  ];
  // Как передает club_screen: без архивных
  final visible = events.where((e) => e.status != 'Archived').toList();

  Widget wrap(Widget child) =>
      MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child)));

  testWidgets('сетка и легенда месяца рендерятся', (tester) async {
    await tester.pumpWidget(wrap(EventCalendarWidget(events: visible)));
    await tester.pumpAndSettle();
    expect(find.text('Сентябрь $y'), findsOneWidget);
    expect(find.text('Пн'), findsOneWidget);
    expect(find.text('Вс'), findsOneWidget);
    // Легенда месяца: все 5 событий (включая завершённую кампанию из августа)
    expect(find.textContaining('Крестовый поход Аврелия'), findsOneWidget);
    expect(find.textContaining('Теневые войны hive-города'), findsOneWidget);
    expect(find.textContaining('Кампания Морхейма'), findsOneWidget);
    expect(find.textContaining('Осенний турнир 1000 очков'), findsOneWidget);
    expect(find.textContaining('Командный килл-тим'), findsOneWidget);
    expect(find.text('Мероприятия месяца:'), findsOneWidget);
  });

  testWidgets('клик по дню открывает панель с кампаниями и турнирами',
      (tester) async {
    await tester.pumpWidget(wrap(EventCalendarWidget(events: visible)));
    await tester.pumpAndSettle();

    // 15 сентября: идут все три кампании, турниров нет
    await tester.tap(find.text('15'));
    await tester.pumpAndSettle();
    // каждый заголовок виден дважды: в легенде месяца и в панели дня
    expect(find.textContaining('Крестовый поход Аврелия'), findsNWidgets(2));
    expect(find.textContaining('Теневые войны hive-города'), findsNWidgets(2));
    expect(find.textContaining('Кампания Морхейма'), findsNWidgets(2));
    expect(find.text('Регистрация — во вкладке «События»'), findsOneWidget);

    // 14 сентября: обе активные кампании + турнир
    await tester.tap(find.text('14'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Командный килл-тим'), findsNWidgets(2));
    expect(find.textContaining('участников: 0 / 8'), findsOneWidget);
  });

  testWidgets('тап по легенде ведёт к дате начала события', (tester) async {
    await tester.pumpWidget(wrap(EventCalendarWidget(events: visible)));
    await tester.pumpAndSettle();

    final legendItem = find.textContaining('Осенний турнир 1000 очков');
    await tester.ensureVisible(legendItem);
    await tester.pumpAndSettle();
    await tester.tap(legendItem);
    await tester.pumpAndSettle();

    // Панель дня открылась на 13 сентября
    expect(find.textContaining('13 сентября $y'), findsOneWidget);
    expect(find.text('Сентябрь $y'), findsOneWidget);
  });

  testWidgets('пустой день — заглушка; пустой месяц — пустая легенда',
      (tester) async {
    await tester.pumpWidget(wrap(EventCalendarWidget(events: visible)));
    await tester.pumpAndSettle();
    // В сентябре все дни покрыты кампаниями — уходим в пустой октябрь
    await tester.tap(find.byIcon(Icons.chevron_right));
    await tester.pumpAndSettle();
    expect(find.text('Октябрь $y'), findsOneWidget);
    expect(find.text('В этом месяце событий нет'), findsOneWidget);
    await tester.tap(find.text('7'));
    await tester.pumpAndSettle();
    expect(find.text('В этот день событий нет'), findsOneWidget);
  });
}
