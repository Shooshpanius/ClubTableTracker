import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../app_colors.dart';
import '../models/chat.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../widgets/user_avatar.dart';

class MessengerScreen extends StatefulWidget {
  final String token;
  final VoidCallback onTokenExpired;

  const MessengerScreen({
    super.key,
    required this.token,
    required this.onTokenExpired,
  });

  @override
  State<MessengerScreen> createState() => _MessengerScreenState();
}

class _MessengerScreenState extends State<MessengerScreen> {
  final _api = ApiService();

  List<ChatSummary> _chats = [];
  bool _loading = true;
  String? _error;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _loadChats();
    _pollTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      _loadChats(silent: true);
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadChats({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final data = await _api.getChats(widget.token);
      if (!mounted) return;
      setState(() {
        _chats =
            data.map((c) => ChatSummary.fromJson(c as Map<String, dynamic>)).toList();
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        await AuthService.clearToken();
        widget.onTokenExpired();
        return;
      }
      if (!silent && mounted) {
        setState(() {
          _error = e.message;
          _loading = false;
        });
      }
    } catch (e) {
      if (!silent && mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: const Text(
          '💬 Сообщения',
          style: TextStyle(color: AppColors.accent),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accent))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!,
                          style:
                              const TextStyle(color: AppColors.accent)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                          onPressed: _loadChats,
                          child: const Text('Повторить')),
                    ],
                  ),
                )
              : _chats.isEmpty
                  ? const Center(
                      child: Text(
                        'Нет чатов',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadChats,
                      color: AppColors.accent,
                      child: ListView.separated(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: _chats.length,
                        separatorBuilder: (_, __) =>
                            const Divider(color: AppColors.border, height: 1),
                        itemBuilder: (_, i) => _buildChatTile(_chats[i]),
                      ),
                    ),
    );
  }

  Widget _buildChatTile(ChatSummary chat) {
    final lastMsg = chat.lastMessage;
    String subtitle = '';
    if (lastMsg != null) {
      subtitle = lastMsg.text.length > 60
          ? '${lastMsg.text.substring(0, 60)}...'
          : lastMsg.text;
    }

    return ListTile(
      tileColor: chat.unreadCount > 0
          ? AppColors.panelBg.withOpacity(0.4)
          : Colors.transparent,
      leading: Stack(
        children: [
          UserAvatar(name: chat.name, size: 44),
          if (chat.isGroup)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.all(2),
                decoration: const BoxDecoration(
                  color: AppColors.accentBlue,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.group, size: 10, color: Colors.white),
              ),
            ),
        ],
      ),
      title: Row(
        children: [
          Expanded(
            child: Text(
              chat.name,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: chat.unreadCount > 0
                    ? FontWeight.bold
                    : FontWeight.normal,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (chat.isGroup && chat.clubShortName != null) ...[
            const SizedBox(width: 6),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: _parseHexColor(
                    chat.clubBadgeColor, AppColors.accentBlue),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                chat.clubShortName!,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ],
      ),
      subtitle: subtitle.isNotEmpty
          ? Text(
              subtitle,
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 12),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            )
          : null,
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (lastMsg != null)
            Text(
              _fmtTime(lastMsg.sentAt),
              style: const TextStyle(
                  color: AppColors.textMuted, fontSize: 11),
            ),
          if (chat.unreadCount > 0) ...[
            const SizedBox(height: 4),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.accent,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                chat.unreadCount > 99
                    ? '99+'
                    : '${chat.unreadCount}',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ],
      ),
      onTap: () async {
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ChatScreen(
              chat: chat,
              token: widget.token,
              api: _api,
            ),
          ),
        );
        _loadChats(silent: true);
      },
    );
  }

  /// Разбирает hex-цвет вида '#4a9eff' или '4a9eff' в [Color].
  static Color _parseHexColor(String? hex, Color fallback) {
    if (hex == null) return fallback;
    try {
      final v = hex.replaceAll('#', '');
      return Color(0xFF000000 | int.parse(v, radix: 16));
    } catch (_) {
      return fallback;
    }
  }

  String _fmtTime(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final now = DateTime.now();
      if (dt.year == now.year &&
          dt.month == now.month &&
          dt.day == now.day) {
        return DateFormat('HH:mm').format(dt);
      }
      return DateFormat('dd.MM').format(dt);
    } catch (_) {
      return '';
    }
  }
}

// ─── Экран чата ────────────────────────────────────────────────────────────

class ChatScreen extends StatefulWidget {
  final ChatSummary chat;
  final String token;
  final ApiService api;

  const ChatScreen({
    super.key,
    required this.chat,
    required this.token,
    required this.api,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  List<ChatMessage> _messages = [];
  List<dynamic> _listItems = [];
  bool _loading = true;
  bool _sending = false;
  bool _deleting = false;
  ChatMessage? _replyTo;
  Timer? _pollTimer;

  String get _myId => AuthService.getUserId(widget.token) ?? '';

  @override
  void initState() {
    super.initState();
    _loadMessages();
    _markRead();
    _pollTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _loadMessages(silent: true);
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadMessages({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final data = await widget.api
          .getChatMessages(widget.chat.id, widget.token);
      if (!mounted) return;
      setState(() {
        _messages = data
            .map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
            .toList();
        _listItems = _buildListItems(_messages);
        _loading = false;
      });
    } catch (_) {
      if (!silent && mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markRead() async {
    try {
      await widget.api.markChatRead(widget.chat.id, widget.token);
    } catch (_) {}
  }

  Future<void> _sendMessage() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await widget.api.sendMessage(
        widget.chat.id,
        text,
        widget.token,
        replyToId: _replyTo?.id,
      );
      _msgCtrl.clear();
      setState(() => _replyTo = null);
      await _loadMessages(silent: true);
      _scrollToBottom();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppColors.panelBg),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // ─── Контекстное меню сообщения ─────────────────────────────────────────

  static const _msgPreviewLen = 80;

  void _showMessageMenu(ChatMessage msg) {
    final isMe = msg.sender.id == _myId;
    final preview = msg.text.length > _msgPreviewLen
        ? '${msg.text.substring(0, _msgPreviewLen)}…'
        : msg.text;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF1E2D4A),
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        padding: const EdgeInsets.only(bottom: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Превью сообщения
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
              child: Text(
                preview,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 13),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const Divider(color: Color(0xFF2A3A5E), height: 1),
            _menuItem('↩  Ответить', () {
              Navigator.pop(context);
              setState(() => _replyTo = msg);
            }),
            _menuItem('↗  Переслать', () {
              Navigator.pop(context);
              _showForwardDialog(msg.text);
            }),
            _menuItem('📋  Скопировать', () {
              Navigator.pop(context);
              _copyMessage(msg.text);
            }),
            if (isMe)
              _menuItem('🗑  Удалить', () {
                Navigator.pop(context);
                _confirmDelete(msg.id);
              }, danger: true),
          ],
        ),
      ),
    );
  }

  Widget _menuItem(String label, VoidCallback onTap, {bool danger = false}) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Color(0xFF1A2A40))),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: danger ? AppColors.accent : AppColors.textPrimary,
            fontSize: 16,
          ),
        ),
      ),
    );
  }

  void _copyMessage(String text) {
    Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Скопировано'),
        duration: Duration(seconds: 2),
        backgroundColor: Color(0xFF4A9EFF),
      ),
    );
  }

  Future<void> _showForwardDialog(String text) async {
    // Загружаем список чатов
    List<dynamic> chatsRaw;
    try {
      chatsRaw = await widget.api.getChats(widget.token);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Не удалось загрузить список чатов: $e'),
          backgroundColor: AppColors.accent,
        ),
      );
      return;
    }
    if (!mounted) return;

    final preview =
        text.length > _msgPreviewLen
            ? '«${text.substring(0, _msgPreviewLen)}…»'
            : '«$text»';

    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        title: const Text('Переслать в чат',
            style: TextStyle(color: AppColors.textPrimary)),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                preview,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 12),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 12),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 300),
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: chatsRaw.length,
                  itemBuilder: (_, i) {
                    final c = chatsRaw[i] as Map<String, dynamic>;
                    final name = c['name'] as String? ?? '';
                    final isGroup = c['isGroup'] as bool? ?? false;
                    final isPublic = c['isPublic'] as bool? ?? false;
                    final chatId = c['id'] as int;
                    return ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: UserAvatar(name: name, size: 32),
                      title: Text(
                        '${isGroup ? (isPublic ? '🌐 ' : '🔒 ') : ''}$name',
                        style: const TextStyle(
                            color: AppColors.textPrimary, fontSize: 13),
                      ),
                      onTap: () async {
                        Navigator.pop(ctx);
                        await _forwardMessage(chatId, text);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Отмена'),
          ),
        ],
      ),
    );
  }

  Future<void> _forwardMessage(int targetChatId, String text) async {
    try {
      await widget.api.sendMessage(targetChatId, text, widget.token);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Сообщение переслано'),
          duration: Duration(seconds: 2),
          backgroundColor: Color(0xFF4A9EFF),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Не удалось переслать: $e'),
          backgroundColor: AppColors.accent,
        ),
      );
    }
  }

  Future<void> _confirmDelete(int messageId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dlgCtx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        title: const Text('Удалить сообщение',
            style: TextStyle(color: AppColors.textPrimary)),
        content: const Text(
          'Удалить сообщение? Это действие нельзя отменить.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dlgCtx, false),
            child: const Text('Отмена'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dlgCtx, true),
            child: const Text('Удалить',
                style: TextStyle(color: AppColors.accent)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _deleteMessage(messageId);
  }

  Future<void> _deleteMessage(int messageId) async {
    if (_deleting) return;
    setState(() => _deleting = true);
    try {
      await widget.api.deleteMessage(widget.chat.id, messageId, widget.token);
      if (!mounted) return;
      setState(() {
        _messages = _messages.where((m) => m.id != messageId).toList();
        _listItems = _buildListItems(_messages);
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Не удалось удалить: $e'),
          backgroundColor: AppColors.accent,
        ),
      );
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      // Отключаем автоматический сдвиг тела Scaffold при появлении клавиатуры,
      // чтобы поле ввода само управляло отступом через viewInsets.bottom.
      resizeToAvoidBottomInset: false,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: Row(
          children: [
            UserAvatar(name: widget.chat.name, size: 32),
            const SizedBox(width: 10),
            Text(
              widget.chat.name,
              style: const TextStyle(
                  color: AppColors.textPrimary, fontSize: 15),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(
                        color: AppColors.accent))
                : _messages.isEmpty
                    ? const Center(
                        child: Text(
                          'Нет сообщений',
                          style: TextStyle(
                              color: AppColors.textSecondary),
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollCtrl,
                        reverse: true,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        itemCount: _listItems.length,
                        itemBuilder: (_, i) {
                          final item = _listItems[i];
                          if (item is DateTime) {
                            return _buildDateSeparator(item);
                          }
                          return _buildMessage(item as ChatMessage);
                        },
                      ),
          ),
          _buildInputArea(),
        ],
      ),
    );
  }

  static List<dynamic> _buildListItems(List<ChatMessage> messages) {
    final items = <dynamic>[];
    DateTime? lastDate;
    for (final msg in messages) {
      final local = msg.sentAtDateTime.toLocal();
      final dateOnly = DateTime(local.year, local.month, local.day);
      if (lastDate == null || dateOnly != lastDate) {
        items.add(dateOnly);
        lastDate = dateOnly;
      }
      items.add(msg);
    }
    return items.reversed.toList();
  }

  Widget _buildDateSeparator(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    String label;
    if (date == today) {
      label = 'Сегодня';
    } else if (date == yesterday) {
      label = 'Вчера';
    } else {
      label = DateFormat('d MMMM yyyy', 'ru').format(date);
    }
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.panelBg,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          label,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
        ),
      ),
    );
  }

  Widget _buildMessage(ChatMessage msg) {
    final isMe = msg.sender.id == _myId;
    final timeFmt = DateFormat('HH:mm');

    return GestureDetector(
      onLongPress: () => _showMessageMenu(msg),
      child: Align(
        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.75,
          ),
          margin: const EdgeInsets.symmetric(vertical: 3),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: isMe ? AppColors.accentPurple : AppColors.cardBg,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(12),
              topRight: const Radius.circular(12),
              bottomLeft: Radius.circular(isMe ? 12 : 2),
              bottomRight: Radius.circular(isMe ? 2 : 12),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!isMe)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    msg.sender.name,
                    style: const TextStyle(
                        color: AppColors.accentBlue,
                        fontSize: 11,
                        fontWeight: FontWeight.bold),
                  ),
                ),
              if (msg.replyTo != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.black26,
                    borderRadius: BorderRadius.circular(4),
                    border: const Border(
                        left:
                            BorderSide(color: AppColors.accentBlue, width: 2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        msg.replyTo!.senderName,
                        style: const TextStyle(
                            color: AppColors.accentBlue, fontSize: 10),
                      ),
                      Text(
                        msg.replyTo!.text,
                        style: const TextStyle(
                            color: AppColors.textSecondary, fontSize: 11),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              Text(
                msg.text,
                style: const TextStyle(
                    color: AppColors.textPrimary, fontSize: 13),
              ),
              const SizedBox(height: 2),
              Text(
                timeFmt.format(msg.sentAtDateTime.toLocal()),
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 9),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInputArea() {
    final mq = MediaQuery.of(context);
    return Container(
      padding: EdgeInsets.only(
        left: 12,
        right: 8,
        top: 8,
        // viewInsets.bottom  — высота клавиатуры
        // viewPadding.bottom — высота навигационной панели Android (жесты / кнопки)
        bottom: mq.viewInsets.bottom + mq.viewPadding.bottom + 8,
      ),
      decoration: const BoxDecoration(
        color: AppColors.cardBg,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_replyTo != null)
            Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.fromLTRB(8, 4, 4, 4),
              decoration: BoxDecoration(
                color: AppColors.panelBg,
                borderRadius: BorderRadius.circular(4),
                border: const Border(
                    left:
                        BorderSide(color: AppColors.accent, width: 3)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Ответ на: ${_replyTo!.sender.name}',
                          style: const TextStyle(
                              color: AppColors.accent, fontSize: 11),
                        ),
                        Text(
                          _replyTo!.text,
                          style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close,
                        size: 16, color: AppColors.textSecondary),
                    onPressed: () => setState(() => _replyTo = null),
                  ),
                ],
              ),
            ),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _msgCtrl,
                  maxLines: null,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: InputDecoration(
                    hintText: 'Сообщение...',
                    hintStyle:
                        const TextStyle(color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.panelBg,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 8),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(20),
                      borderSide:
                          const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(20),
                      borderSide:
                          const BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(20),
                      borderSide:
                          const BorderSide(color: AppColors.accent),
                    ),
                  ),
                  textInputAction: TextInputAction.newline,
                ),
              ),
              const SizedBox(width: 4),
              _sending
                  ? const SizedBox(
                      width: 40,
                      height: 40,
                      child: Padding(
                        padding: EdgeInsets.all(8),
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.accent),
                      ),
                    )
                  : IconButton(
                      icon: const Icon(Icons.send,
                          color: AppColors.accent),
                      onPressed: _sendMessage,
                    ),
            ],
          ),
        ],
      ),
    );
  }
}
