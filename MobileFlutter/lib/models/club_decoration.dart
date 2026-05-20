import 'package:flutter/material.dart';

class ClubDecoration {
  final int id;
  final String type; // 'wall' | 'window' | 'door'
  final int x;
  final int y;
  final int width;
  final int height;

  const ClubDecoration({
    required this.id,
    required this.type,
    required this.x,
    required this.y,
    required this.width,
    required this.height,
  });

  Color get fillColor {
    switch (type) {
      case 'wall':
        return const Color(0xFF4A4A4A);
      case 'window':
        return const Color(0x3364C8FF);
      case 'door':
        return const Color(0x33FFC864);
      default:
        return const Color(0xFF555555);
    }
  }

  Color get borderColor {
    switch (type) {
      case 'wall':
        return const Color(0xFF222222);
      case 'window':
        return const Color(0xFF64C8FF);
      case 'door':
        return const Color(0xFFFFC864);
      default:
        return const Color(0xFF555555);
    }
  }

  bool get isDashed => type == 'window' || type == 'door';

  factory ClubDecoration.fromJson(Map<String, dynamic> json) =>
      ClubDecoration(
        id: json['id'] as int,
        type: json['type'] as String? ?? 'wall',
        x: (json['x'] as num?)?.toInt() ?? 0,
        y: (json['y'] as num?)?.toInt() ?? 0,
        width: (json['width'] as num?)?.toInt() ?? 50,
        height: (json['height'] as num?)?.toInt() ?? 50,
      );
}
