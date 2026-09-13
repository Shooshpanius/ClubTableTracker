class EventParticipant {
  final String id;
  final String name;
  final int? place;

  const EventParticipant({required this.id, required this.name, this.place});

  factory EventParticipant.fromJson(Map<String, dynamic> json) =>
      EventParticipant(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        place: json['place'] as int?,
      );
}

class EventPhoto {
  final int id;
  final String url;

  const EventPhoto({required this.id, required this.url});

  factory EventPhoto.fromJson(Map<String, dynamic> json) => EventPhoto(
        id: json['id'] as int,
        url: json['url'] as String? ?? '',
      );
}

class ClubEvent {
  final int id;
  final String title;
  final String startTime;
  final String endTime;
  final int maxParticipants;
  final String eventType;
  final String? gameSystem;
  final String? tableIds;
  final String? description;
  final String? regulationUrl;
  final String? regulationUrl2;
  final String? missionMapUrl;
  final String? gameMasterId;
  final String? gameMasterName;
  final List<EventParticipant> participants;
  final List<EventPhoto> photos;
  // null = активно, 'Completed' = завершено, 'Archived' = в архиве
  final String? status;

  const ClubEvent({
    required this.id,
    required this.title,
    required this.startTime,
    required this.endTime,
    required this.maxParticipants,
    required this.eventType,
    this.gameSystem,
    this.tableIds,
    this.description,
    this.regulationUrl,
    this.regulationUrl2,
    this.missionMapUrl,
    this.gameMasterId,
    this.gameMasterName,
    this.participants = const [],
    this.photos = const [],
    this.status,
  });

  DateTime get startDateTime => DateTime.parse(startTime);
  DateTime get endDateTime => DateTime.parse(endTime);

  bool get isActive {
    final now = DateTime.now();
    return startDateTime.isBefore(now) && endDateTime.isAfter(now);
  }

  bool get isUpcoming => startDateTime.isAfter(DateTime.now());

  bool get isCompleted => status == 'Completed';

  bool get isArchived => status == 'Archived';

  factory ClubEvent.fromJson(Map<String, dynamic> json) => ClubEvent(
        id: json['id'] as int,
        title: json['title'] as String? ?? '',
        startTime: json['startTime'] as String,
        endTime: json['endTime'] as String,
        maxParticipants: json['maxParticipants'] as int? ?? 0,
        eventType: json['eventType'] as String? ?? '',
        gameSystem: json['gameSystem'] as String?,
        tableIds: json['tableIds'] as String?,
        description: json['description'] as String?,
        regulationUrl: json['regulationUrl'] as String?,
        regulationUrl2: json['regulationUrl2'] as String?,
        missionMapUrl: json['missionMapUrl'] as String?,
        gameMasterId: json['gameMasterId'] as String?,
        gameMasterName: json['gameMasterName'] as String?,
        participants: (json['participants'] as List<dynamic>?)
                ?.map((p) =>
                    EventParticipant.fromJson(p as Map<String, dynamic>))
                .toList() ??
            [],
        photos: (json['photos'] as List<dynamic>?)
                ?.map((p) => EventPhoto.fromJson(p as Map<String, dynamic>))
                .toList() ??
            [],
        status: json['status'] as String?,
      );
}
