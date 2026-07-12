import '../../artists/data/artist.dart';
import '../../artists/presentation/widgets/artist_avatar.dart';

class PollRound {
  const PollRound({
    required this.id,
    required this.title,
    required this.type,
    required this.status,
    required this.config,
    required this.winnerIds,
    this.endAt,
    this.startAt,
    this.hideVoteCounts = false,
  });

  final String id;
  final String title;
  final String type;
  final String status;
  final Map<String, dynamic> config;
  final List<String> winnerIds;
  final DateTime? endAt;
  final DateTime? startAt;
  final bool hideVoteCounts;

  int? get configuredCostPerVote {
    final voting = config['voting'];
    final raw = voting is Map ? voting['costPerVote'] : config['costPerVote'];
    if (raw == null) return null;
    return _intValue(raw, 1).clamp(1, 1000);
  }

  factory PollRound.fromJson(Map<String, dynamic> json) {
    final config = _mapValue(json['config']);
    final metadata = _mapValue(json['metadata']);
    return PollRound(
      id: '${json['id'] ?? ''}',
      title: _stringValue([json['title'], metadata['title']]),
      type: _stringValue([json['type'], metadata['type']]).ifEmpty('standard'),
      status: _stringValue([json['status']]),
      config: config,
      winnerIds: _stringList(
        config['winnerIds'] ?? metadata['winnerIds'] ?? json['winnerIds'],
      ),
      endAt: _parseDate(json['endAt'] ?? json['endsAt']),
      startAt: _parseDate(json['startAt'] ?? json['startsAt']),
      hideVoteCounts:
          json['hideVoteCounts'] == true ||
          config['hideVoteCounts'] == true ||
          metadata['hideVoteCounts'] == true,
    );
  }
}

class PollContestant {
  const PollContestant({
    required this.id,
    required this.artistId,
    required this.roundId,
    required this.votes,
    required this.manualVotes,
    required this.matchGroup,
    required this.matchOrder,
    required this.order,
    required this.artist,
  });

  final String id;
  final String artistId;
  final String roundId;
  final int votes;
  final int manualVotes;
  final int matchGroup;
  final int matchOrder;
  final int order;
  final Artist? artist;

  int get totalVotes => votes + manualVotes;

  factory PollContestant.fromJson(Map<String, dynamic> json) {
    final artistJson = json['artist'];
    return PollContestant(
      id: '${json['id'] ?? ''}',
      artistId: '${json['artistId'] ?? ''}',
      roundId: '${json['roundId'] ?? ''}',
      votes: _intValue(json['votes']),
      manualVotes: _intValue(json['manualVotes']),
      matchGroup: _intValue(json['matchGroup']),
      matchOrder: _intValue(json['matchOrder']),
      order: _intValue(json['order']),
      artist: artistJson is Map
          ? Artist.fromJson(Map<String, dynamic>.from(artistJson))
          : null,
    );
  }
}

class Poll {
  const Poll({
    required this.id,
    required this.slug,
    required this.title,
    required this.description,
    required this.status,
    required this.banner,
    required this.categoryName,
    required this.categoryId,
    required this.categoryIcon,
    required this.year,
    required this.activeRoundId,
    required this.totalVotes,
    required this.leaderArtistId,
    required this.leaderVotes,
    required this.hideVoteCounts,
    required this.rounds,
    required this.contestants,
    required this.config,
    this.activeEndAt,
    this.endAt,
    this.updatedAt,
    this.createdAt,
  });

  final String id;
  final String slug;
  final String title;
  final String description;
  final String status;
  final String banner;
  final String categoryName;
  final String categoryId;
  final String categoryIcon;
  final int year;
  final String activeRoundId;
  final int totalVotes;
  final String? leaderArtistId;
  final int leaderVotes;
  final bool hideVoteCounts;
  final List<PollRound> rounds;
  final List<PollContestant> contestants;
  final Map<String, dynamic> config;
  final DateTime? activeEndAt;
  final DateTime? endAt;
  final DateTime? updatedAt;
  final DateTime? createdAt;

  String get effectiveRoundId {
    if (activeRoundId.isNotEmpty) {
      return activeRoundId;
    }

    for (final round in rounds) {
      if (round.status == 'live') {
        return round.id;
      }
    }

    return rounds.isNotEmpty ? rounds.first.id : '';
  }

  DateTime? get countdownEndAt {
    return activeEndAt ?? endAt ?? _activeRoundEndAt;
  }

  int get costPerVote {
    PollRound? activeRound;
    for (final round in rounds) {
      if (round.id == effectiveRoundId) {
        activeRound = round;
        break;
      }
    }
    final voting = config['voting'];
    final raw =
        activeRound?.configuredCostPerVote ??
        (voting is Map ? voting['costPerVote'] : config['costPerVote']);
    return _intValue(raw, 1).clamp(1, 1000);
  }

  DateTime? get _activeRoundEndAt {
    if (activeRoundId.isEmpty) {
      return null;
    }

    for (final round in rounds) {
      if (round.id == activeRoundId) {
        return round.endAt;
      }
    }

    return null;
  }

  factory Poll.fromJson(Map<String, dynamic> json) {
    final config = _mapValue(json['config']);
    final parsedMetadata = _mapValue(json['metadata']);
    final metadata = parsedMetadata.isNotEmpty ? parsedMetadata : config;
    final category = json['category'];
    final categoryName = category is Map<String, dynamic>
        ? _stringValue([category['name']])
        : _stringValue([
            json['categoryName'],
            metadata['categoryName'],
            metadata['category'],
          ]);
    final categoryId = category is Map<String, dynamic>
        ? _stringValue([category['id']])
        : _stringValue([
            json['categoryId'],
            metadata['categoryId'],
            categoryName,
          ]);
    final categoryIcon = category is Map<String, dynamic>
        ? _stringValue([category['icon']])
        : _stringValue([metadata['categoryIcon'], json['categoryIcon']]);
    final rounds = (json['rounds'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map((item) => PollRound.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
    final contestants = (json['contestants'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map((item) => PollContestant.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
    PollRound? liveRound;
    for (final round in rounds) {
      if (round.status == 'live') {
        liveRound = round;
        break;
      }
    }
    liveRound ??= rounds.isNotEmpty ? rounds.first : null;
    final activeRoundId = _stringValue([
      json['activeRoundId'],
      metadata['activeRoundId'],
      liveRound?.id,
    ]);
    PollRound? activeRound;
    for (final round in rounds) {
      if (round.id == activeRoundId) {
        activeRound = round;
        break;
      }
    }

    final banner = _stringValue([
      json['banner'],
      json['bannerUrl'],
      json['cover'],
      json['coverImage'],
      metadata['banner'],
      metadata['bannerUrl'],
      metadata['cover'],
      metadata['coverImage'],
    ]);

    return Poll(
      id: '${json['id'] ?? ''}',
      slug: _stringValue([json['slug'], metadata['slug']]),
      title: _stringValue([
        json['title'],
        metadata['title'],
      ]).ifEmpty('Votación'),
      description: _stringValue([json['description'], metadata['description']]),
      status: _stringValue([json['status']]),
      banner: banner,
      categoryName: categoryName,
      categoryId: categoryId,
      categoryIcon: categoryIcon,
      year: _intValue(metadata['year'] ?? json['year'], DateTime.now().year),
      activeRoundId: activeRoundId,
      totalVotes: _intValue(json['totalVotes'] ?? metadata['totalVotes']),
      leaderArtistId: _nullableString([
        json['leaderArtistId'],
        metadata['leaderArtistId'],
      ]),
      leaderVotes: _intValue(json['leaderVotes'] ?? metadata['leaderVotes']),
      hideVoteCounts:
          json['hideVoteCounts'] == true ||
          activeRound?.hideVoteCounts == true ||
          metadata['hideVoteCounts'] == true,
      rounds: rounds,
      contestants: contestants,
      config: config,
      activeEndAt: _parseDate(json['activeEndAt'] ?? metadata['activeEndAt']),
      endAt: _parseDate(
        json['endsAt'] ??
            json['endAt'] ??
            metadata['endsAt'] ??
            metadata['endAt'],
      ),
      updatedAt: _parseDate(json['updatedAt']),
      createdAt: _parseDate(json['createdAt']),
    );
  }
}

class PollResultRow {
  const PollResultRow({
    required this.artistId,
    required this.totalVotes,
    required this.rank,
    required this.percent,
    required this.contestantId,
    required this.matchGroup,
    required this.matchOrder,
    this.artist,
  });

  final String artistId;
  final int totalVotes;
  final int rank;
  final double percent;
  final String contestantId;
  final int matchGroup;
  final int matchOrder;
  final Artist? artist;

  factory PollResultRow.fromJson(Map<String, dynamic> json) {
    final artistJson = json['artist'];
    return PollResultRow(
      artistId: '${json['artistId'] ?? ''}',
      totalVotes: _intValue(json['totalVotes']),
      rank: _intValue(json['rank'], 0),
      percent: _doubleValue(json['percent']),
      contestantId: '${json['contestantId'] ?? json['id'] ?? ''}',
      matchGroup: _intValue(json['matchGroup']),
      matchOrder: _intValue(json['matchOrder']),
      artist: artistJson is Map<String, dynamic>
          ? Artist.fromJson(artistJson)
          : null,
    );
  }
}

Map<String, dynamic> _mapValue(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return const {};
}

List<String> _stringList(Object? value) {
  if (value is! List) return const [];
  return value.map((item) => '$item').where((item) => item.isNotEmpty).toList();
}

class PollResults {
  const PollResults({
    required this.pollId,
    required this.totalVotes,
    required this.leaderArtistId,
    required this.leaderVotes,
    required this.results,
  });

  final String pollId;
  final int totalVotes;
  final String? leaderArtistId;
  final int leaderVotes;
  final List<PollResultRow> results;

  factory PollResults.fromJson(Map<String, dynamic> json) {
    return PollResults(
      pollId: '${json['pollId'] ?? ''}',
      totalVotes: _intValue(json['totalVotes']),
      leaderArtistId: _nullableString([json['leaderArtistId']]),
      leaderVotes: _intValue(json['leaderVotes']),
      results: (json['results'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PollResultRow.fromJson)
          .toList(growable: false),
    );
  }
}

String resolvePollBanner(Poll poll) {
  return resolveArtistMediaUrl(poll.banner);
}

String _stringValue(List<Object?> values) {
  for (final value in values) {
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }
  }

  return '';
}

String? _nullableString(List<Object?> values) {
  final value = _stringValue(values);
  return value.isEmpty ? null : value;
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

double _doubleValue(Object? value) {
  if (value is double) {
    return value;
  }

  if (value is num) {
    return value.toDouble();
  }

  return double.tryParse('$value') ?? 0;
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

extension _PollString on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}
