class Mission {
  const Mission({
    required this.id,
    required this.title,
    required this.description,
    required this.type,
    required this.icon,
    required this.actionUrl,
    required this.rewardPoints,
    required this.target,
    required this.progress,
    required this.featured,
    this.completedAt,
    this.rewardedAt,
  });

  final String id;
  final String title;
  final String description;
  final String type;
  final String icon;
  final String? actionUrl;
  final int rewardPoints;
  final int target;
  final int progress;
  final bool featured;
  final String? completedAt;
  final String? rewardedAt;

  bool get isDone =>
      completedAt != null || rewardedAt != null || progress >= target;

  int get safeTarget => target < 1 ? 1 : target;

  int get currentProgress {
    final value = progress.clamp(0, safeTarget);
    return value;
  }

  int get percent => ((currentProgress / safeTarget) * 100).round();

  String get progressLabel => '$currentProgress/$safeTarget';

  String get rewardLabel => '+$rewardPoints pts';

  factory Mission.fromJson(Map<String, dynamic> json) {
    return Mission(
      id: '${json['id'] ?? ''}',
      title: '${json['title'] ?? 'Misión'}'.trim(),
      description: '${json['description'] ?? ''}'.trim(),
      type: '${json['type'] ?? 'manual'}',
      icon: '${json['icon'] ?? 'fa-solid fa-bolt'}',
      actionUrl: _nullableString(json['actionUrl'] ?? json['action_url']),
      rewardPoints: _toInt(json['rewardPoints'] ?? json['reward_points']),
      target: _toInt(json['target'], fallback: 1),
      progress: _toInt(json['progress']),
      featured: json['featured'] == true,
      completedAt: _nullableString(json['completedAt'] ?? json['completed_at']),
      rewardedAt: _nullableString(json['rewardedAt'] ?? json['rewarded_at']),
    );
  }

  Mission copyWith({
    int? progress,
    String? completedAt,
    String? rewardedAt,
  }) {
    return Mission(
      id: id,
      title: title,
      description: description,
      type: type,
      icon: icon,
      actionUrl: actionUrl,
      rewardPoints: rewardPoints,
      target: target,
      progress: progress ?? this.progress,
      featured: featured,
      completedAt: completedAt ?? this.completedAt,
      rewardedAt: rewardedAt ?? this.rewardedAt,
    );
  }

  static String? _nullableString(dynamic value) {
    final text = '$value'.trim();
    return text.isEmpty ? null : text;
  }

  static int _toInt(dynamic value, {int fallback = 0}) {
    if (value is int) {
      return value;
    }

    if (value is num) {
      return value.toInt();
    }

    return int.tryParse('$value') ?? fallback;
  }
}
