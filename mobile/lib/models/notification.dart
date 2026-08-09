/// Mirrors notifications.serializers.NotificationSerializer.
class AppNotification {
  final int id;
  final String message;
  final String kind;
  final int? ticketId;
  final bool isRead;
  final DateTime? createdAt;

  const AppNotification({
    required this.id,
    required this.message,
    this.kind = '',
    this.ticketId,
    this.isRead = false,
    this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
        id: json['id'] as int,
        message: json['message'] as String? ?? '',
        kind: json['kind'] as String? ?? '',
        ticketId: json['ticket'] as int?,
        isRead: json['is_read'] as bool? ?? false,
        createdAt:
            DateTime.tryParse(json['created_at'] as String? ?? '')?.toLocal(),
      );
}
