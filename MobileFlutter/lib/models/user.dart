class AppUser {
  final String id;
  final String email;
  final String name;
  final String? displayName;
  final String? bio;
  final String? city;
  final List<String> enabledGameSystems;
  final Map<String, String>? bookingColors;

  const AppUser({
    required this.id,
    required this.email,
    required this.name,
    this.displayName,
    this.bio,
    this.city,
    this.enabledGameSystems = const [],
    this.bookingColors,
  });

  String get effectiveName => displayName?.isNotEmpty == true ? displayName! : name;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    final gsRaw = json['enabledGameSystems'] as String? ?? '';
    final gs = gsRaw.isNotEmpty ? gsRaw.split('|').where((s) => s.isNotEmpty).toList() : <String>[];

    return AppUser(
      id: (json['id'] as String?) ?? '',
      email: (json['email'] as String?) ?? '',
      name: (json['name'] as String?) ?? '',
      displayName: json['displayName'] as String?,
      bio: json['bio'] as String?,
      city: json['city'] as String?,
      enabledGameSystems: gs,
    );
  }

  AppUser copyWith({
    String? displayName,
    String? bio,
    String? city,
    List<String>? enabledGameSystems,
    Map<String, String>? bookingColors,
  }) =>
      AppUser(
        id: id,
        email: email,
        name: name,
        displayName: displayName ?? this.displayName,
        bio: bio ?? this.bio,
        city: city ?? this.city,
        enabledGameSystems: enabledGameSystems ?? this.enabledGameSystems,
        bookingColors: bookingColors ?? this.bookingColors,
      );
}
