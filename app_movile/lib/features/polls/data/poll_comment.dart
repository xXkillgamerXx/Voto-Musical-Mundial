class PollComment {
  const PollComment({
    required this.id,
    required this.userId,
    required this.displayName,
    required this.photoUrl,
    required this.text,
    required this.gifUrl,
    required this.createdAt,
  });

  final String id;
  final String userId;
  final String displayName;
  final String photoUrl;
  final String text;
  final String gifUrl;
  final DateTime? createdAt;

  factory PollComment.fromJson(Map<String, dynamic> json) {
    final gif = json['gif'];
    var gifUrl = '';
    if (gif is Map) {
      gifUrl = '${gif['url'] ?? ''}'.trim();
    }

    return PollComment(
      id: '${json['id'] ?? ''}',
      userId: '${json['userId'] ?? ''}',
      displayName: '${json['displayName'] ?? 'Fan'}'.trim().isEmpty
          ? 'Fan'
          : '${json['displayName'] ?? 'Fan'}'.trim(),
      photoUrl: '${json['photoUrl'] ?? json['photoURL'] ?? ''}'.trim(),
      text: '${json['text'] ?? ''}'.trim(),
      gifUrl: gifUrl,
      createdAt: _parseDate(json['createdAt']),
    );
  }

  static DateTime? _parseDate(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    return DateTime.tryParse('$value');
  }
}
