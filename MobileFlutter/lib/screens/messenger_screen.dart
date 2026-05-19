import 'dart:async';
import 'package:flutter/material.dart';
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
      onLongPress: () {
        setState(() => _replyTo = msg);
      },
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
    return Container(
      padding: EdgeInsets.only(
        left: 12,
        right: 8,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 8,
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
