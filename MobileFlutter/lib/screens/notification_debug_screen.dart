import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../app_colors.dart';
import '../services/notification_log_service.dart';

/// Экран отладки FCM-уведомлений.
/// Показывает хронологический лог всех полученных push-сообщений:
/// когда пришло, откуда (foreground/background/tap/launch), заголовок, тело, data-payload.
class NotificationDebugScreen extends StatefulWidget {
  const NotificationDebugScreen({super.key});

  @override
  State<NotificationDebugScreen> createState() =>
      _NotificationDebugScreenState();
}

class _NotificationDebugScreenState extends State<NotificationDebugScreen> {
  List<NotificationLogEntry> _entries = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final entries = await NotificationLogService.getAll();
    if (!mounted) return;
    setState(() {
      _entries = entries;
      _loading = false;
    });
  }

  Future<void> _clear() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        title: const Text('Очистить лог?',
            style: TextStyle(color: AppColors.accent)),
        content: const Text(
          'Все записи об уведомлениях будут удалены.',
          style: TextStyle(color: AppColors.textPrimary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Отмена',
                style: TextStyle(color: AppColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Очистить',
                style: TextStyle(color: AppColors.accent)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await NotificationLogService.clear();
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: const Text(
          '🔔 Лог уведомлений',
          style: TextStyle(color: AppColors.accent),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            tooltip: 'Обновить',
            onPressed: _load,
          ),
          if (_entries.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_outline, color: AppColors.accent),
              tooltip: 'Очистить',
              onPressed: _clear,
            ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accent))
          : _entries.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.notifications_off_outlined,
                          size: 56, color: AppColors.textSecondary),
                      const SizedBox(height: 12),
                      const Text(
                        'Уведомлений ещё не поступало',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Отправьте сообщение с другого устройства,\nчтобы проверить доставку.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            color: AppColors.textSecondary.withOpacity(0.6),
                            fontSize: 12),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(
                      vertical: 8, horizontal: 12),
                  itemCount: _entries.length,
                  itemBuilder: (_, i) => _buildEntry(_entries[i]),
                ),
    );
  }

  Widget _buildEntry(NotificationLogEntry e) {
    final timeStr =
        DateFormat('dd.MM.yy HH:mm:ss').format(e.receivedAt.toLocal());

    Color sourceBadgeColor;
    String sourceLabel;
    switch (e.source) {
      case 'foreground':
        sourceBadgeColor = AppColors.accentBlue;
        sourceLabel = 'FG';
        break;
      case 'background':
        sourceBadgeColor = Colors.orange;
        sourceLabel = 'BG';
        break;
      case 'tap':
        sourceBadgeColor = Colors.green;
        sourceLabel = 'TAP';
        break;
      case 'launch':
        sourceBadgeColor = Colors.purple;
        sourceLabel = 'LAUNCH';
        break;
      default:
        sourceBadgeColor = AppColors.textSecondary;
        sourceLabel = e.source.toUpperCase();
    }

    final dataStr = e.data.isEmpty
        ? null
        : e.data.entries.map((kv) => '${kv.key}: ${kv.value}').join('\n');

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        border: Border.all(
          color: e.shown ? AppColors.border : AppColors.accent.withOpacity(0.4),
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row: badge + time + shown icon
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: sourceBadgeColor,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  sourceLabel,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  timeStr,
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 12),
                ),
              ),
              Icon(
                e.shown ? Icons.check_circle : Icons.cancel_outlined,
                size: 16,
                color: e.shown ? Colors.green : AppColors.accent,
              ),
              const SizedBox(width: 4),
              Text(
                e.shown ? 'показано' : 'не показано',
                style: TextStyle(
                    color: e.shown ? Colors.green : AppColors.accent,
                    fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Title
          if (e.title != null)
            Text(
              e.title!,
              style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 14),
            ),
          // Body
          if (e.body != null) ...[
            const SizedBox(height: 2),
            Text(
              e.body!,
              style: const TextStyle(
                  color: AppColors.textPrimary, fontSize: 13),
            ),
          ],
          // Data payload
          if (dataStr != null) ...[
            const SizedBox(height: 6),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                dataStr,
                style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                    fontFamily: 'monospace'),
              ),
            ),
          ],
          if (e.title == null && e.body == null && dataStr == null)
            const Text(
              '(пустое сообщение)',
              style: TextStyle(
                  color: AppColors.textSecondary,
                  fontStyle: FontStyle.italic),
            ),
        ],
      ),
    );
  }
}
