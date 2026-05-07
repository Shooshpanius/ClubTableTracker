class Club {
  final int id;
  final String name;
  final String description;
  final String openTime;
  final String closeTime;
  final String? logoUrl;

  const Club({
    required this.id,
    required this.name,
    required this.description,
    required this.openTime,
    required this.closeTime,
    this.logoUrl,
  });

  factory Club.fromJson(Map<String, dynamic> json) => Club(
        id: json['id'] as int,
        name: json['name'] as String,
        description: json['description'] as String? ?? '',
        openTime: json['openTime'] as String? ?? '09:00',
        closeTime: json['closeTime'] as String? ?? '22:00',
        logoUrl: json['logoUrl'] as String?,
      );
}
