class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.payload,
    required this.createdAt,
    this.readAt,
  });

  final String id;
  final String type;
  final Map<String, dynamic> payload;
  final DateTime? createdAt;
  final DateTime? readAt;

  bool get isUnread => readAt == null;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    final payload = json['payload'];
    return AppNotification(
      id: '${json['id'] ?? ''}',
      type: '${json['type'] ?? ''}',
      payload: payload is Map<String, dynamic>
          ? payload
          : const <String, dynamic>{},
      createdAt: _parseDate(json['createdAt']),
      readAt: _parseDate(json['readAt']),
    );
  }

  AppNotification copyWith({DateTime? readAt}) {
    return AppNotification(
      id: id,
      type: type,
      payload: payload,
      createdAt: createdAt,
      readAt: readAt ?? this.readAt,
    );
  }

  static DateTime? _parseDate(dynamic value) {
    if (value == null) {
      return null;
    }

    return DateTime.tryParse('$value');
  }
}
