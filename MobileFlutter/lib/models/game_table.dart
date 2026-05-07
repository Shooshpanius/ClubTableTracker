class GameTable {
  final int id;
  final String number;
  final String size;
  final String supportedGames;
  final int x;
  final int y;
  final int width;
  final int height;
  final bool eventsOnly;

  const GameTable({
    required this.id,
    required this.number,
    required this.size,
    required this.supportedGames,
    required this.x,
    required this.y,
    required this.width,
    required this.height,
    this.eventsOnly = false,
  });

  factory GameTable.fromJson(Map<String, dynamic> json) => GameTable(
        id: json['id'] as int,
        number: json['number'] as String? ?? '',
        size: json['size'] as String? ?? '',
        supportedGames: json['supportedGames'] as String? ?? '',
        x: (json['x'] as num?)?.toInt() ?? 0,
        y: (json['y'] as num?)?.toInt() ?? 0,
        width: (json['width'] as num?)?.toInt() ?? 100,
        height: (json['height'] as num?)?.toInt() ?? 100,
        eventsOnly: json['eventsOnly'] as bool? ?? false,
      );
}
