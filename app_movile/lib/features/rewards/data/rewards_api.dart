import '../../../core/api/api_client.dart';

class DailyRewardDay {
  const DailyRewardDay({
    required this.day,
    required this.points,
    this.crown = false,
  });

  final int day;
  final int points;
  final bool crown;

  factory DailyRewardDay.fromJson(Map<String, dynamic> json) {
    final day = _toInt(json['day'], fallback: 1);
    return DailyRewardDay(
      day: day,
      points: _toInt(json['points']),
      crown: day == 7,
    );
  }
}

class DailyRewardSchedule {
  const DailyRewardSchedule({
    required this.days,
    required this.weeklyTotal,
  });

  final List<DailyRewardDay> days;
  final int weeklyTotal;

  static const defaultDays = [
    DailyRewardDay(day: 1, points: 5),
    DailyRewardDay(day: 2, points: 10),
    DailyRewardDay(day: 3, points: 15),
    DailyRewardDay(day: 4, points: 20),
    DailyRewardDay(day: 5, points: 25),
    DailyRewardDay(day: 6, points: 30),
    DailyRewardDay(day: 7, points: 50, crown: true),
  ];

  factory DailyRewardSchedule.fromJson(Map<String, dynamic> json) {
    final rawDays = json['days'];
    final days = rawDays is List
        ? rawDays
            .whereType<Map<String, dynamic>>()
            .map(DailyRewardDay.fromJson)
            .toList(growable: false)
        : defaultDays;

    return DailyRewardSchedule(
      days: days.isEmpty ? defaultDays : days,
      weeklyTotal: _toInt(
        json['weeklyTotal'],
        fallback: days.fold<int>(0, (total, day) => total + day.points),
      ),
    );
  }
}

class DailyRewardClaimResult {
  const DailyRewardClaimResult({
    required this.points,
    required this.streak,
    required this.streakDay,
    required this.userPoints,
    required this.missionRewardPoints,
  });

  final int points;
  final int streak;
  final int streakDay;
  final int userPoints;
  final int missionRewardPoints;

  factory DailyRewardClaimResult.fromJson(Map<String, dynamic> json) {
    final reward = json['reward'];
    final user = json['user'];

    return DailyRewardClaimResult(
      points: reward is Map<String, dynamic> ? _toInt(reward['points']) : 0,
      streak: reward is Map<String, dynamic> ? _toInt(reward['streak']) : 0,
      streakDay: reward is Map<String, dynamic> ? _toInt(reward['streakDay']) : 0,
      userPoints: user is Map<String, dynamic> ? _toInt(user['points']) : 0,
      missionRewardPoints: _toInt(json['missionRewardPoints']),
    );
  }
}

class RewardsApi {
  RewardsApi(this._client);

  final ApiClient _client;

  static const _scheduleTtl = Duration(hours: 1);

  Future<DailyRewardSchedule> getDailySchedule() async {
    final payload = await _client.cachedRequest(
      '/rewards/daily-schedule',
      ttl: _scheduleTtl,
    );

    if (payload is Map<String, dynamic>) {
      return DailyRewardSchedule.fromJson(payload);
    }

    return DailyRewardSchedule(
      days: DailyRewardSchedule.defaultDays,
      weeklyTotal: 155,
    );
  }

  Future<DailyRewardClaimResult> claimDailyReward() async {
    final payload = await _client.request(
      '/rewards/daily-claim',
      method: 'POST',
      token: _client.accessToken,
    );

    return DailyRewardClaimResult.fromJson(payload as Map<String, dynamic>);
  }

  Future<AdRewardStatus> getAdRewardStatus() async {
    final payload = await _client.request(
      '/rewards/ad-status',
      token: _client.accessToken,
    );
    return AdRewardStatus.fromJson(payload as Map<String, dynamic>);
  }

  Future<AdRewardClaimResult> claimAdReward() async {
    final payload = await _client.request(
      '/rewards/ad-claim',
      method: 'POST',
      token: _client.accessToken,
    );
    return AdRewardClaimResult.fromJson(payload as Map<String, dynamic>);
  }

  Future<AppFirstOpenClaimResult> claimAppFirstOpenReward() async {
    final payload = await _client.request(
      '/rewards/app-first-open-claim',
      method: 'POST',
      token: _client.accessToken,
    );
    return AppFirstOpenClaimResult.fromJson(payload as Map<String, dynamic>);
  }
}

class AdRewardStatus {
  const AdRewardStatus({
    required this.pointsPerClaim,
    required this.dailyLimit,
    required this.claimedToday,
    required this.remainingToday,
  });

  final int pointsPerClaim;
  final int dailyLimit;
  final int claimedToday;
  final int remainingToday;

  factory AdRewardStatus.fromJson(Map<String, dynamic> json) {
    return AdRewardStatus(
      pointsPerClaim: _toInt(json['pointsPerClaim'], fallback: 5),
      dailyLimit: _toInt(json['dailyLimit'], fallback: 5),
      claimedToday: _toInt(json['claimedToday']),
      remainingToday: _toInt(json['remainingToday']),
    );
  }
}

class AdRewardClaimResult {
  const AdRewardClaimResult({
    required this.pointsAwarded,
    required this.pointsBefore,
    required this.pointsAfter,
    required this.claimedToday,
    required this.remainingToday,
    required this.userPoints,
  });

  final int pointsAwarded;
  final int pointsBefore;
  final int pointsAfter;
  final int claimedToday;
  final int remainingToday;
  final int userPoints;

  factory AdRewardClaimResult.fromJson(Map<String, dynamic> json) {
    final user = json['user'];
    return AdRewardClaimResult(
      pointsAwarded: _toInt(json['pointsAwarded']),
      pointsBefore: _toInt(json['pointsBefore']),
      pointsAfter: _toInt(json['pointsAfter']),
      claimedToday: _toInt(json['claimedToday']),
      remainingToday: _toInt(json['remainingToday']),
      userPoints: user is Map<String, dynamic>
          ? _toInt(user['points'], fallback: _toInt(json['pointsAfter']))
          : _toInt(json['pointsAfter']),
    );
  }
}

class AppFirstOpenClaimResult {
  const AppFirstOpenClaimResult({
    required this.alreadyClaimed,
    required this.pointsAwarded,
    required this.pointsBefore,
    required this.pointsAfter,
    required this.userPoints,
  });

  final bool alreadyClaimed;
  final int pointsAwarded;
  final int pointsBefore;
  final int pointsAfter;
  final int userPoints;

  factory AppFirstOpenClaimResult.fromJson(Map<String, dynamic> json) {
    final user = json['user'];
    return AppFirstOpenClaimResult(
      alreadyClaimed: json['alreadyClaimed'] == true,
      pointsAwarded: _toInt(json['pointsAwarded']),
      pointsBefore: _toInt(json['pointsBefore']),
      pointsAfter: _toInt(json['pointsAfter']),
      userPoints: user is Map<String, dynamic>
          ? _toInt(user['points'], fallback: _toInt(json['pointsAfter']))
          : _toInt(json['pointsAfter']),
    );
  }
}

int _toInt(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse('$value') ?? fallback;
}

String todayKey() {
  final now = DateTime.now();
  final month = now.month.toString().padLeft(2, '0');
  final day = now.day.toString().padLeft(2, '0');
  return '${now.year}-$month-$day';
}

String yesterdayKey() {
  final yesterday = DateTime.now().subtract(const Duration(days: 1));
  final month = yesterday.month.toString().padLeft(2, '0');
  final day = yesterday.day.toString().padLeft(2, '0');
  return '${yesterday.year}-$month-$day';
}

int daysBetween(String nextDateKey, String previousDateKey) {
  if (nextDateKey.isEmpty || previousDateKey.isEmpty) {
    return 9999;
  }

  final next = DateTime.tryParse('${nextDateKey}T00:00:00');
  final previous = DateTime.tryParse('${previousDateKey}T00:00:00');
  if (next == null || previous == null) {
    return 9999;
  }

  return next.difference(previous).inDays;
}

int rewardDayFromStreak(int streak) {
  final normalized = streak < 1 ? 1 : streak;
  return ((normalized - 1) % 7) + 1;
}

int nextStreakForClaim({
  required String lastClaimDate,
  required int currentStreak,
}) {
  final today = todayKey();

  if (lastClaimDate == today) {
    return currentStreak < 1 ? 1 : currentStreak;
  }

  if (daysBetween(today, lastClaimDate) == 1) {
    return currentStreak + 1;
  }

  return 1;
}

enum DailyRewardDayStatus { claimed, today, locked }

DailyRewardDayStatus statusForDay({
  required int day,
  required int activeRewardDay,
  required bool claimedToday,
}) {
  if (day < activeRewardDay) {
    return DailyRewardDayStatus.claimed;
  }

  if (day == activeRewardDay) {
    return DailyRewardDayStatus.today;
  }

  return DailyRewardDayStatus.locked;
}
