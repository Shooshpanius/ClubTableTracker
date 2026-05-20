class ActivityLogEntry {
  final int id;
  final String timestamp;
  final String action;
  final String userName;
  final String tableNumber;
  final int clubId;
  final String bookingStartTime;
  final String bookingEndTime;

  const ActivityLogEntry({
    required this.id,
    required this.timestamp,
    required this.action,
    required this.userName,
    required this.tableNumber,
    required this.clubId,
    required this.bookingStartTime,
    required this.bookingEndTime,
  });

  DateTime get timestampDateTime => DateTime.parse(timestamp);
  DateTime get bookingStart => DateTime.parse(bookingStartTime);
  DateTime get bookingEnd => DateTime.parse(bookingEndTime);

  factory ActivityLogEntry.fromJson(Map<String, dynamic> json) =>
      ActivityLogEntry(
        id: json['id'] as int,
        timestamp: json['timestamp'] as String,
        action: json['action'] as String? ?? '',
        userName: json['userName'] as String? ?? '',
        tableNumber: json['tableNumber'] as String? ?? '',
        clubId: json['clubId'] as int? ?? 0,
        bookingStartTime: json['bookingStartTime'] as String,
        bookingEndTime: json['bookingEndTime'] as String,
      );
}

const logActionLabel = <String, String>{
  'Booked': 'зарезервировал',
  'Joined': 'присоединился к',
  'Left': 'вышел из',
  'Cancelled': 'отменил',
  'MovedTable': 'переместил игру (стол)',
  'Rescheduled': 'изменил время',
};

const logActionColor = <String, int>{
  'Booked': 0xFF4CAF50,
  'Joined': 0xFF2196F3,
  'Left': 0xFFFFC107,
  'Cancelled': 0xFFE94560,
  'MovedTable': 0xFF9C27B0,
  'Rescheduled': 0xFF00BCD4,
};
