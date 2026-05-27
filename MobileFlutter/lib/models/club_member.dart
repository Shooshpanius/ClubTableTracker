class ClubMember {
  final String id;
  final String name;
  final String? displayName;
  final String? registrationName;
  final String? enabledGameSystems;
  final String? bio;
  final String? city;
  final String? joinedAt;
  final bool isModerator;
  final bool hasKey;
  final bool isAdmin;
  final bool isManualEntry;

  const ClubMember({
    required this.id,
    required this.name,
    this.displayName,
    this.registrationName,
    this.enabledGameSystems,
    this.bio,
    this.city,
    this.joinedAt,
    this.isModerator = false,
    this.hasKey = false,
    this.isAdmin = false,
    this.isManualEntry = false,
  });

  String get effectiveName =>
      displayName?.isNotEmpty == true ? displayName! : name;

  List<String> get gameSystems => enabledGameSystems
          ?.split('|')
          .where((s) => s.isNotEmpty)
          .toList() ??
      [];

  factory ClubMember.fromJson(Map<String, dynamic> json) => ClubMember(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        displayName: json['displayName'] as String?,
        registrationName: json['registrationName'] as String?,
        enabledGameSystems: json['enabledGameSystems'] as String?,
        bio: json['bio'] as String?,
        city: json['city'] as String?,
        joinedAt: json['joinedAt'] as String?,
        isModerator: json['isModerator'] as bool? ?? false,
        hasKey: json['hasKey'] as bool? ?? false,
        isAdmin: json['isAdmin'] as bool? ?? false,
        isManualEntry: json['isManualEntry'] as bool? ?? false,
      );
}
