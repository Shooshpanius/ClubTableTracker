import 'club.dart';

class Membership {
  final int id;
  final String status;
  final Club club;

  const Membership({
    required this.id,
    required this.status,
    required this.club,
  });

  factory Membership.fromJson(Map<String, dynamic> json) => Membership(
        id: json['id'] as int,
        status: json['status'] as String,
        club: Club.fromJson(json['club'] as Map<String, dynamic>),
      );

  bool get isApproved => status == 'Approved';
  bool get isPending => status == 'Pending';
  bool get isRejected => status == 'Rejected';
  bool get isKicked => status == 'Kicked';
}
