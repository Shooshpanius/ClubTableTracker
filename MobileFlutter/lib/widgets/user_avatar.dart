import 'package:flutter/material.dart';
import '../app_colors.dart';

/// Аватар пользователя: показывает инициалы или картинку
class UserAvatar extends StatelessWidget {
  final String name;
  final String? url;
  final double size;

  const UserAvatar({
    super.key,
    required this.name,
    this.url,
    this.size = 36,
  });

  @override
  Widget build(BuildContext context) {
    final initials = _getInitials(name);
    final bg = _getColor(name);

    return ClipOval(
      child: Container(
        width: size,
        height: size,
        color: bg,
        alignment: Alignment.center,
        child: url != null
            ? Image.network(
                url!,
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _initialsWidget(initials),
              )
            : _initialsWidget(initials),
      ),
    );
  }

  Widget _initialsWidget(String initials) => Text(
        initials,
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.38,
          fontWeight: FontWeight.bold,
        ),
      );

  String _getInitials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, name.length.clamp(0, 2)).toUpperCase();
  }

  Color _getColor(String name) {
    const colors = [
      AppColors.accentBlue,
      AppColors.accent,
      AppColors.statusApproved,
      AppColors.accentOrange,
      Color(0xFF9C27B0),
      Color(0xFF00BCD4),
    ];
    if (name.isEmpty) return colors[0];
    return colors[name.codeUnitAt(0) % colors.length];
  }
}
