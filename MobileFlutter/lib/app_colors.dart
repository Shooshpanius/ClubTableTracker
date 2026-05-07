import 'package:flutter/material.dart';

/// Цветовая схема приложения – соответствует тёмной теме веб-версии
class AppColors {
  AppColors._();

  // Фоны
  static const Color background = Color(0xFF1A1A2E);
  static const Color cardBg = Color(0xFF16213E);
  static const Color darkBg = Color(0xFF0F1E3D);
  static const Color panelBg = Color(0xFF0F3460);

  // Акценты
  static const Color accent = Color(0xFFE94560);
  static const Color accentBlue = Color(0xFF4A9EFF);
  static const Color accentGreen = Color(0xFF4CAF50);
  static const Color accentOrange = Color(0xFFFF8C00);
  static const Color accentYellow = Color(0xFFFFC107);
  static const Color accentPurple = Color(0xFF533483);

  // Текст
  static const Color textPrimary = Color(0xFFEEEEEE);
  static const Color textSecondary = Color(0xFFAAAAAA);
  static const Color textMuted = Color(0xFF666666);
  static const Color textBlue = Color(0xFF7EB8F7);

  // Статусы членства
  static const Color statusApproved = Color(0xFF4CAF50);
  static const Color statusPending = Color(0xFFFFC107);
  static const Color statusRejected = Color(0xFFE94560);

  // Бронирования (по умолчанию)
  static const Color bookingFree = Color(0xFF90EE90);
  static const Color bookingEventFree = Color(0xFFC45C5C);
  static const Color bookingMine = Color(0xFFFF8C00);
  static const Color bookingOthers = Color(0xFFFFFF00);

  // Разделители
  static const Color border = Color(0xFF0F3460);
  static const Color borderDark = Color(0xFF1A2A50);
}
