import '../../artists/data/artist.dart';
import '../../home/data/poll.dart';
import '../../home/data/polls_api.dart';

class HallOfFameEntry {
  const HallOfFameEntry({
    required this.poll,
    required this.artist,
    required this.categoryTitle,
    required this.year,
    this.roundTitle = '',
    this.status = 'closed',
    this.votes = 0,
    this.percent = 0,
  });

  final Poll poll;
  final Artist artist;
  final String categoryTitle;
  final int? year;
  final String roundTitle;
  final String status;
  final int votes;
  final double percent;

  String get displayTitle {
    if (roundTitle.trim().isNotEmpty) return roundTitle.trim();
    if (poll.title.trim().isNotEmpty) return poll.title.trim();
    return categoryTitle;
  }
}

class HallOfFameYearGroup {
  const HallOfFameYearGroup({
    required this.year,
    required this.entries,
  });

  final int? year;
  final List<HallOfFameEntry> entries;
}

class HallOfFameApi {
  HallOfFameApi(this._pollsApi);

  final PollsApi _pollsApi;

  Future<List<HallOfFameYearGroup>> loadWinners({bool forceRefresh = false}) async {
    final polls = await _pollsApi.getPolls(limit: 100, forceRefresh: forceRefresh);
    final closedPolls = polls
        .where((poll) => poll.status == 'closed')
        .toList(growable: false);

    final entries = await Future.wait(
      closedPolls.map((poll) => _hydrateWinner(poll, forceRefresh: forceRefresh)),
    );

    final winners = entries.whereType<HallOfFameEntry>().toList(growable: false);
    return _groupByYear(winners);
  }

  /// Victorias del artista (votaciones cerradas donde está en winnerIds).
  Future<List<HallOfFameEntry>> loadWinsForArtist(
    String artistId, {
    required Artist artist,
    bool forceRefresh = false,
  }) async {
    final id = artistId.trim();
    if (id.isEmpty) return const [];

    final polls = await _pollsApi.getPolls(limit: 100, forceRefresh: forceRefresh);
    final closedPolls = polls
        .where((poll) => poll.status == 'closed')
        .toList(growable: false);

    final wins = <HallOfFameEntry>[];
    for (final poll in closedPolls) {
      final winnerIds = _winnerIdsFor(poll);
      if (!winnerIds.contains(id)) continue;

      final round = _finalRoundFor(poll);
      var votes = 0;
      var percent = 0.0;
      try {
        final results = await _pollsApi.getPollResults(
          poll.id,
          roundId: round?.id,
          cacheTtl: _pollsApi.resultsTtlForPoll(poll),
          forceRefresh: forceRefresh,
        );
        final total = results.totalVotes > 0
            ? results.totalVotes
            : results.results.fold<int>(0, (sum, row) => sum + row.totalVotes);
        for (final row in results.results) {
          if (row.artistId != id) continue;
          votes = row.totalVotes;
          percent = row.percent > 0
              ? row.percent
              : (total > 0 ? (votes / total) * 100 : 0);
          break;
        }
      } catch (_) {}

      wins.add(
        HallOfFameEntry(
          poll: poll,
          artist: artist,
          categoryTitle: poll.categoryName.isEmpty
              ? poll.title
              : poll.categoryName,
          year: _yearFor(poll),
          roundTitle: round?.title.isNotEmpty == true
              ? round!.title
              : poll.title,
          status: round?.status.isNotEmpty == true
              ? round!.status
              : poll.status,
          votes: votes,
          percent: percent,
        ),
      );
    }

    wins.sort((a, b) => (b.year ?? 0).compareTo(a.year ?? 0));
    return wins;
  }

  Future<HallOfFameEntry?> _hydrateWinner(
    Poll poll, {
    bool forceRefresh = false,
  }) async {
    try {
      final winnerIds = _winnerIdsFor(poll);
      final round = _finalRoundFor(poll);
      final roundId = round?.id ?? poll.effectiveRoundId;
      final results = await _pollsApi.getPollResults(
        poll.id,
        roundId: roundId.isEmpty ? null : roundId,
        cacheTtl: _pollsApi.resultsTtlForPoll(poll),
        forceRefresh: forceRefresh,
      );

      if (results.results.isEmpty) {
        return null;
      }

      Artist? winner;
      if (winnerIds.isNotEmpty) {
        for (final row in results.results) {
          if (winnerIds.contains(row.artistId) && row.artist != null) {
            winner = row.artist;
            break;
          }
        }
      }
      winner ??= results.results.first.artist;
      if (winner == null) {
        return null;
      }

      return HallOfFameEntry(
        poll: poll,
        artist: winner,
        categoryTitle: poll.categoryName.isEmpty
            ? 'Categoría'
            : poll.categoryName,
        year: _yearFor(poll),
      );
    } catch (_) {
      return null;
    }
  }

  static List<String> _winnerIdsFor(Poll poll) {
    if (poll.winnerIds.isNotEmpty) return poll.winnerIds;
    for (var i = poll.rounds.length - 1; i >= 0; i--) {
      final round = poll.rounds[i];
      if (round.status == 'closed' && round.winnerIds.isNotEmpty) {
        return round.winnerIds;
      }
    }
    return const [];
  }

  static PollRound? _finalRoundFor(Poll poll) {
    for (var i = poll.rounds.length - 1; i >= 0; i--) {
      final round = poll.rounds[i];
      if (round.status == 'closed' && round.winnerIds.isNotEmpty) {
        return round;
      }
    }
    for (var i = poll.rounds.length - 1; i >= 0; i--) {
      if (poll.rounds[i].status == 'closed') return poll.rounds[i];
    }
    return poll.rounds.isNotEmpty ? poll.rounds.last : null;
  }

  List<HallOfFameYearGroup> _groupByYear(List<HallOfFameEntry> entries) {
    final grouped = <int?, List<HallOfFameEntry>>{};

    for (final entry in entries) {
      grouped.putIfAbsent(entry.year, () => []).add(entry);
    }

    final groups = grouped.entries
        .map(
          (entry) => HallOfFameYearGroup(
            year: entry.key,
            entries: entry.value,
          ),
        )
        .toList(growable: false);

    groups.sort((a, b) => (b.year ?? 0).compareTo(a.year ?? 0));
    return groups;
  }

  int? _yearFor(Poll poll) {
    final year = poll.year;
    return year > 0 ? year : null;
  }
}
