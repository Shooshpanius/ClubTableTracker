class BookingUser {
  final String id;
  final String name;

  const BookingUser({required this.id, required this.name});

  factory BookingUser.fromJson(Map<String, dynamic> json) => BookingUser(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
      );
}

class BookingParticipant {
  final int? participantId;
  final String id;
  final String name;
  final String? status;
  final String? roster;

  const BookingParticipant({
    this.participantId,
    required this.id,
    required this.name,
    this.status,
    this.roster,
  });

  factory BookingParticipant.fromJson(Map<String, dynamic> json) =>
      BookingParticipant(
        participantId: json['participantId'] as int?,
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        status: json['status'] as String?,
        roster: json['roster'] as String?,
      );
}

class Booking {
  final int id;
  final int tableId;
  final String startTime;
  final String endTime;
  final String? gameSystem;
  final bool isDoubles;
  final bool isForOthers;
  final String? ownerRoster;
  final BookingUser user;
  final List<BookingParticipant> participants;

  const Booking({
    required this.id,
    required this.tableId,
    required this.startTime,
    required this.endTime,
    this.gameSystem,
    this.isDoubles = false,
    this.isForOthers = false,
    this.ownerRoster,
    required this.user,
    this.participants = const [],
  });

  DateTime get startDateTime => DateTime.parse(startTime);
  DateTime get endDateTime => DateTime.parse(endTime);

  factory Booking.fromJson(Map<String, dynamic> json) => Booking(
        id: json['id'] as int,
        tableId: json['tableId'] as int,
        startTime: json['startTime'] as String,
        endTime: json['endTime'] as String,
        gameSystem: json['gameSystem'] as String?,
        isDoubles: json['isDoubles'] as bool? ?? false,
        isForOthers: json['isForOthers'] as bool? ?? false,
        ownerRoster: json['ownerRoster'] as String?,
        user: BookingUser.fromJson(json['user'] as Map<String, dynamic>),
        participants: (json['participants'] as List<dynamic>?)
                ?.map((p) =>
                    BookingParticipant.fromJson(p as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class UpcomingBooking {
  final int id;
  final int tableId;
  final String tableNumber;
  final String clubName;
  final int clubId;
  final String startTime;
  final String endTime;
  final String? gameSystem;
  final BookingUser user;
  final List<BookingParticipant> participants;

  const UpcomingBooking({
    required this.id,
    required this.tableId,
    required this.tableNumber,
    required this.clubName,
    required this.clubId,
    required this.startTime,
    required this.endTime,
    this.gameSystem,
    required this.user,
    this.participants = const [],
  });

  DateTime get startDateTime => DateTime.parse(startTime);
  DateTime get endDateTime => DateTime.parse(endTime);

  factory UpcomingBooking.fromJson(Map<String, dynamic> json) =>
      UpcomingBooking(
        id: json['id'] as int,
        tableId: json['tableId'] as int,
        tableNumber: json['tableNumber'] as String? ?? '',
        clubName: json['clubName'] as String? ?? '',
        clubId: json['clubId'] as int? ?? 0,
        startTime: json['startTime'] as String,
        endTime: json['endTime'] as String,
        gameSystem: json['gameSystem'] as String?,
        user: BookingUser.fromJson(json['user'] as Map<String, dynamic>),
        participants: (json['participants'] as List<dynamic>?)
                ?.map((p) =>
                    BookingParticipant.fromJson(p as Map<String, dynamic>))
                .toList() ??
            [],
      );
}
