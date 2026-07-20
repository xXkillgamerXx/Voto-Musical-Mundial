import '../../../core/api/api_client.dart';

class VoteActivity {
  const VoteActivity({
    required this.id,
    required this.createdAt,
    required this.amount,
    required this.pollId,
    required this.pollTitle,
    required this.artistId,
    required this.artistName,
    required this.artistPhotoUrl,
    required this.userId,
    required this.username,
    required this.userDisplayName,
    required this.userPhotoUrl,
  });

  final String id;
  final DateTime? createdAt;
  final int amount;
  final String pollId;
  final String pollTitle;
  final String artistId;
  final String artistName;
  final String artistPhotoUrl;
  final String userId;
  final String username;
  final String userDisplayName;
  final String userPhotoUrl;

  factory VoteActivity.fromJson(Map<String, dynamic> json) {
    final username = _stringValue([json['username']]);
    return VoteActivity(
      id: '${json['id'] ?? ''}',
      createdAt: _parseDate(json['createdAt']),
      amount: _intValue(json['amount'], 1),
      pollId: '${json['pollId'] ?? ''}',
      pollTitle: _stringValue([json['pollTitle']]),
      artistId: '${json['artistId'] ?? ''}',
      artistName: _stringValue([json['artistName']]).ifEmpty('Artista'),
      artistPhotoUrl: _stringValue([json['artistPhotoUrl']]),
      userId: '${json['userId'] ?? ''}',
      username: username,
      userDisplayName: _stringValue([
        json['userDisplayName'],
        username,
      ]).ifEmpty('Fan'),
      userPhotoUrl: _stringValue([json['userPhotoUrl']]),
    );
  }

  factory VoteActivity.fromRealtimePayload(Map<String, dynamic> json) {
    final createdAt = _parseDate(json['createdAt']) ?? DateTime.now();
    final pollId = '${json['pollId'] ?? ''}';
    final userId = '${json['userId'] ?? ''}';
    final artistId = '${json['artistId'] ?? ''}';
    final username = _stringValue([json['username']]);
    final isAnonymous =
        json['isAnonymous'] == true || json['isAnonymous'] == '1';
    final isStaffVote = json['staffVote'] == true || json['staffVote'] == '1';

    if (isAnonymous || isStaffVote || userId.isEmpty) {
      return VoteActivity(
        id: '',
        createdAt: createdAt,
        amount: 0,
        pollId: pollId,
        pollTitle: _stringValue([json['pollTitle']]),
        artistId: artistId,
        artistName: _stringValue([json['artistName']]).ifEmpty('Artista'),
        artistPhotoUrl: '',
        userId: '',
        username: '',
        userDisplayName: '',
        userPhotoUrl: '',
      );
    }

    return VoteActivity(
      id: '$pollId-$userId-$artistId-${createdAt.millisecondsSinceEpoch}',
      createdAt: createdAt,
      amount: _intValue(json['amount'], 1).clamp(1, 5),
      pollId: pollId,
      pollTitle: _stringValue([json['pollTitle']]),
      artistId: artistId,
      artistName: _stringValue([json['artistName']]).ifEmpty('Artista'),
      artistPhotoUrl: _stringValue([json['artistPhotoUrl']]),
      userId: userId,
      username: username,
      userDisplayName: _stringValue([
        json['userDisplayName'],
        username,
      ]).ifEmpty('Fan'),
      userPhotoUrl: _stringValue([json['userPhotoUrl']]),
    );
  }

  VoteActivity copyWith({DateTime? createdAt, int? amount}) {
    return VoteActivity(
      id: id,
      createdAt: createdAt ?? this.createdAt,
      amount: amount ?? this.amount,
      pollId: pollId,
      pollTitle: pollTitle,
      artistId: artistId,
      artistName: artistName,
      artistPhotoUrl: artistPhotoUrl,
      userId: userId,
      username: username,
      userDisplayName: userDisplayName,
      userPhotoUrl: userPhotoUrl,
    );
  }
}

class VotesApi {
  VotesApi(this._client);

  final ApiClient _client;

  Future<CastVoteResult> castVote({
    required String pollId,
    required String contestantId,
    String? roundId,
    int amount = 1,
    String? voteScope,
  }) async {
    final payload = await _client.request(
      '/votes',
      method: 'POST',
      token: _client.accessToken,
      body: {
        'pollId': pollId,
        'contestantId': contestantId,
        if (roundId != null && roundId.isNotEmpty) 'roundId': roundId,
        if (voteScope != null && voteScope.isNotEmpty) 'voteScope': voteScope,
        'amount': amount,
      },
    );
    return CastVoteResult.fromJson(payload as Map<String, dynamic>);
  }

  Future<List<VoteActivity>> getRecentActivity({
    int limit = 24,
    int hours = 168,
  }) async {
    final payload = await _client.request(
      '/votes/recent-activity?limit=$limit&hours=$hours',
    );

    if (payload is! List) {
      return const [];
    }

    return payload
        .whereType<Map<String, dynamic>>()
        .map(VoteActivity.fromJson)
        .toList(growable: false);
  }
}

class CastVoteResult {
  const CastVoteResult({
    required this.ok,
    required this.amount,
    required this.points,
    required this.spentPoints,
  });

  final bool ok;
  final int amount;
  final int? points;
  final int? spentPoints;

  factory CastVoteResult.fromJson(Map<String, dynamic> json) {
    final user = json['user'];
    final userMap = user is Map ? Map<String, dynamic>.from(user) : null;
    return CastVoteResult(
      ok: json['ok'] == true,
      amount: _intValue(json['amount'], 1),
      points: userMap == null ? null : _intValue(userMap['points']),
      spentPoints: userMap == null ? null : _intValue(userMap['spentPoints']),
    );
  }
}

String _stringValue(List<Object?> values) {
  for (final value in values) {
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }
  }

  return '';
}

int _intValue(Object? value, [int fallback = 0]) {
  if (value is int) {
    return value;
  }

  if (value is num) {
    return value.round();
  }

  return int.tryParse('$value') ?? fallback;
}

DateTime? _parseDate(Object? value) {
  if (value == null) {
    return null;
  }

  if (value is DateTime) {
    return value;
  }

  if (value is String && value.isNotEmpty) {
    return DateTime.tryParse(value);
  }

  return null;
}

extension _VoteString on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}
