class ApiUser {
  const ApiUser({
    required this.id,
    required this.username,
    required this.email,
    required this.displayName,
    required this.photoUrl,
    required this.role,
    required this.points,
    required this.spentPoints,
    required this.referralCode,
    this.dailyRewardStreak = 0,
    this.dailyRewardStreakDay = 0,
    this.lastDailyRewardClaimDate,
  });

  final String id;
  final String username;
  final String email;
  final String displayName;
  final String? photoUrl;
  final String role;
  final int points;
  final int spentPoints;
  final String referralCode;
  final int dailyRewardStreak;
  final int dailyRewardStreakDay;
  final String? lastDailyRewardClaimDate;

  bool get hasClaimedDailyRewardToday =>
      lastDailyRewardClaimDate == _todayKey();

  factory ApiUser.fromJson(Map<String, dynamic> json) {
    return ApiUser(
      id: '${json['id'] ?? ''}',
      username: '${json['username'] ?? ''}',
      email: '${json['email'] ?? ''}',
      displayName: '${json['displayName'] ?? ''}',
      photoUrl: json['photoUrl'] as String?,
      role: '${json['role'] ?? 'fan'}',
      points: _toInt(json['points']),
      spentPoints: _toInt(json['spentPoints']),
      referralCode: '${json['referralCode'] ?? ''}',
      dailyRewardStreak: _toInt(json['dailyRewardStreak']),
      dailyRewardStreakDay: _toInt(json['dailyRewardStreakDay']),
      lastDailyRewardClaimDate: _nullableString(
        json['lastDailyRewardClaimDate'],
      ),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'email': email,
    'displayName': displayName,
    'photoUrl': photoUrl,
    'role': role,
    'points': points,
    'spentPoints': spentPoints,
    'referralCode': referralCode,
    'dailyRewardStreak': dailyRewardStreak,
    'dailyRewardStreakDay': dailyRewardStreakDay,
    'lastDailyRewardClaimDate': lastDailyRewardClaimDate,
  };

  ApiUser copyWith({
    String? username,
    String? displayName,
    String? photoUrl,
    int? points,
    int? spentPoints,
    int? dailyRewardStreak,
    int? dailyRewardStreakDay,
    String? lastDailyRewardClaimDate,
  }) {
    return ApiUser(
      id: id,
      username: username ?? this.username,
      email: email,
      displayName: displayName ?? this.displayName,
      photoUrl: photoUrl ?? this.photoUrl,
      role: role,
      points: points ?? this.points,
      spentPoints: spentPoints ?? this.spentPoints,
      referralCode: referralCode,
      dailyRewardStreak: dailyRewardStreak ?? this.dailyRewardStreak,
      dailyRewardStreakDay: dailyRewardStreakDay ?? this.dailyRewardStreakDay,
      lastDailyRewardClaimDate:
          lastDailyRewardClaimDate ?? this.lastDailyRewardClaimDate,
    );
  }

  String get name =>
      displayName.trim().isNotEmpty ? displayName.trim() : username;
}

String _todayKey() {
  final now = DateTime.now();
  final month = now.month.toString().padLeft(2, '0');
  final day = now.day.toString().padLeft(2, '0');
  return '${now.year}-$month-$day';
}

String? _nullableString(dynamic value) {
  final text = '$value'.trim();
  return text.isEmpty ? null : text;
}

class ApiAuth {
  const ApiAuth({
    required this.user,
    required this.accessToken,
    required this.refreshToken,
  });

  final ApiUser user;
  final String accessToken;
  final String refreshToken;

  factory ApiAuth.fromJson(Map<String, dynamic> json) {
    return ApiAuth(
      user: ApiUser.fromJson(json['user'] as Map<String, dynamic>? ?? {}),
      accessToken: '${json['accessToken'] ?? ''}',
      refreshToken: '${json['refreshToken'] ?? ''}',
    );
  }

  Map<String, dynamic> toJson() => {
    'user': user.toJson(),
    'accessToken': accessToken,
    'refreshToken': refreshToken,
  };

  ApiAuth copyWith({ApiUser? user}) {
    return ApiAuth(
      user: user ?? this.user,
      accessToken: accessToken,
      refreshToken: refreshToken,
    );
  }
}

int _toInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse('$value') ?? 0;
}
