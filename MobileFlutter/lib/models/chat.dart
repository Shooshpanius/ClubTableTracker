class LastMessage {
  final String text;
  final String sentAt;

  const LastMessage({required this.text, required this.sentAt});

  factory LastMessage.fromJson(Map<String, dynamic> json) => LastMessage(
        text: json['text'] as String? ?? '',
        sentAt: json['sentAt'] as String? ?? '',
      );
}

class ChatSummary {
  final int id;
  final bool isGroup;
  final bool isPublic;
  final int? clubId;
  final String name;
  final String? avatarUrl;
  final LastMessage? lastMessage;
  final int unreadCount;

  const ChatSummary({
    required this.id,
    required this.isGroup,
    required this.isPublic,
    this.clubId,
    required this.name,
    this.avatarUrl,
    this.lastMessage,
    this.unreadCount = 0,
  });

  factory ChatSummary.fromJson(Map<String, dynamic> json) => ChatSummary(
        id: json['id'] as int,
        isGroup: json['isGroup'] as bool? ?? false,
        isPublic: json['isPublic'] as bool? ?? false,
        clubId: json['clubId'] as int?,
        name: json['name'] as String? ?? '',
        avatarUrl: json['avatarUrl'] as String?,
        lastMessage: json['lastMessage'] != null
            ? LastMessage.fromJson(
                json['lastMessage'] as Map<String, dynamic>)
            : null,
        unreadCount: json['unreadCount'] as int? ?? 0,
      );
}

class MessageSender {
  final String id;
  final String name;
  final String? avatarUrl;

  const MessageSender({required this.id, required this.name, this.avatarUrl});

  factory MessageSender.fromJson(Map<String, dynamic> json) => MessageSender(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        avatarUrl: json['avatarUrl'] as String?,
      );
}

class ReplyInfo {
  final int id;
  final String text;
  final String senderName;

  const ReplyInfo(
      {required this.id, required this.text, required this.senderName});

  factory ReplyInfo.fromJson(Map<String, dynamic> json) => ReplyInfo(
        id: json['id'] as int,
        text: json['text'] as String? ?? '',
        senderName: json['senderName'] as String? ?? '',
      );
}

class ChatMessage {
  final int id;
  final int chatId;
  final String text;
  final String sentAt;
  final MessageSender sender;
  final ReplyInfo? replyTo;

  const ChatMessage({
    required this.id,
    required this.chatId,
    required this.text,
    required this.sentAt,
    required this.sender,
    this.replyTo,
  });

  DateTime get sentAtDateTime => DateTime.parse(sentAt);

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as int,
        chatId: json['chatId'] as int,
        text: json['text'] as String? ?? '',
        sentAt: json['sentAt'] as String,
        sender:
            MessageSender.fromJson(json['sender'] as Map<String, dynamic>),
        replyTo: json['replyTo'] != null
            ? ReplyInfo.fromJson(json['replyTo'] as Map<String, dynamic>)
            : null,
      );
}
