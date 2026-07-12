import '../../artists/data/artist.dart';
import '../../home/data/poll.dart';
import '../../home/data/polls_api.dart';

class HallOfFameEntry {
  const HallOfFameEntry({
    required this.poll,
    required this.artist,
    required this.categoryTitle,
    required this.year,
  });

  final Poll poll;
  final Artist artist;
  final String categoryTitle;
  final int? year;
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

  Future<HallOfFameEntry?> _hydrateWinner(
    Poll poll, {
    bool forceRefresh = false,
  }) async {
    try {
      final roundId = poll.effectiveRoundId;
      final results = await _pollsApi.getPollResults(
        poll.id,
        roundId: roundId.isEmpty ? null : roundId,
        cacheTtl: _pollsApi.resultsTtlForPoll(poll),
        forceRefresh: forceRefresh,
      );

      if (results.results.isEmpty) {
        return null;
      }

      final winner = results.results.first.artist;
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
