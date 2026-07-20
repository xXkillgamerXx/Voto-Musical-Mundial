import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/ads/banner_ad_widget.dart';
import '../../../../core/api/api_exception.dart';
import '../../../../core/widgets/points_chip.dart';
import '../../../../core/widgets/skeleton_box.dart';
import '../../../artists/data/artist.dart';
import '../../../artists/presentation/widgets/artist_avatar.dart';
import '../../../auth/data/auth_service.dart';
import '../../../home/data/poll.dart';
import '../../../home/data/polls_api.dart';
import '../../../home/data/votes_api.dart';
import '../../data/poll_realtime_service.dart';

class PollDetailPage extends StatefulWidget {
  const PollDetailPage({
    required this.authService,
    required this.pollId,
    this.initialPoll,
    super.key,
  });

  final AuthService authService;
  final String pollId;
  final Poll? initialPoll;

  @override
  State<PollDetailPage> createState() => _PollDetailPageState();
}

class _PollDetailPageState extends State<PollDetailPage> {
  late final PollsApi _pollsApi;
  late final VotesApi _votesApi;
  final PollRealtimeService _realtime = PollRealtimeService();

  Poll? _poll;
  PollResults? _results;
  String _selectedRoundId = '';
  bool _loading = true;
  bool _refreshingResults = false;
  bool _resultsRefreshQueued = false;
  String? _error;
  String? _votingContestantId;
  Timer? _resultDebounce;
  Timer? _resultsTimer;
  Timer? _clock;
  Timer? _stateDebounce;
  DateTime _now = DateTime.now();
  DateTime _lastResultsRefreshAt = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void initState() {
    super.initState();
    _pollsApi = PollsApi(widget.authService.client);
    _votesApi = VotesApi(widget.authService.client);
    _poll = widget.initialPoll;
    _selectedRoundId = widget.initialPoll?.effectiveRoundId ?? '';
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
    _resultsTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => unawaited(_loadResults()),
    );
    unawaited(widget.authService.getMe());
    _load();
  }

  @override
  void dispose() {
    _resultDebounce?.cancel();
    _resultsTimer?.cancel();
    _clock?.cancel();
    _stateDebounce?.cancel();
    _realtime.dispose();
    super.dispose();
  }

  Future<void> _load({bool force = false}) async {
    if (_poll == null && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      unawaited(widget.authService.getMe());
      final poll = await _pollsApi.getPoll(widget.pollId, forceRefresh: force);
      var roundId = _selectedRoundId;
      if (roundId.isEmpty || !poll.rounds.any((round) => round.id == roundId)) {
        roundId = poll.effectiveRoundId;
      }
      final pollResults = await _pollsApi.getPollResults(
        poll.id,
        roundId: roundId.isEmpty ? null : roundId,
        forceRefresh: true,
      );
      if (!mounted) return;
      setState(() {
        _poll = poll;
        _selectedRoundId = roundId;
        _results = pollResults;
        _loading = false;
        _error = null;
      });
      _subscribeRealtime(poll.id);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = _messageFor(error);
      });
    }
  }

  void _subscribeRealtime(String pollId) {
    _realtime.subscribe(
      pollId: pollId,
      onVoteDelta: (event) {
        if (!_isEventForSelectedRound(event)) return;
        _applyOptimisticVoteDelta(event);
        _scheduleResultsRefresh();
      },
      onResultsDirty: (event) {
        if (!_isEventForSelectedRound(event)) return;
        _scheduleResultsRefresh();
      },
      onPollStateChanged: (event) {
        final eventPollId = '${event['pollId'] ?? ''}';
        if (eventPollId.isNotEmpty && eventPollId != pollId) return;
        _scheduleStateReload();
      },
    );
  }

  bool _isEventForSelectedRound(Map<String, dynamic> event) {
    final eventRoundId = '${event['roundId'] ?? ''}';
    if (eventRoundId.isEmpty || _selectedRoundId.isEmpty) return true;
    return eventRoundId == _selectedRoundId;
  }

  void _scheduleResultsRefresh() {
    final now = DateTime.now();
    if (now.difference(_lastResultsRefreshAt).inMilliseconds < 250) {
      _resultDebounce?.cancel();
      _resultDebounce = Timer(
        const Duration(milliseconds: 280),
        () => unawaited(_loadResults()),
      );
      return;
    }

    _resultDebounce?.cancel();
    _resultDebounce = Timer(
      const Duration(milliseconds: 180),
      () => unawaited(_loadResults()),
    );
  }

  void _scheduleStateReload() {
    _stateDebounce?.cancel();
    _stateDebounce = Timer(
      const Duration(milliseconds: 600),
      () => unawaited(_load(force: true)),
    );
  }

  void _applyOptimisticVoteDelta(Map<String, dynamic> event) {
    final results = _results;
    if (results == null || !mounted) return;

    final contestantId = '${event['contestantId'] ?? ''}';
    final amount = int.tryParse('${event['amount'] ?? 1}') ?? 1;
    if (contestantId.isEmpty || amount < 1) return;

    final nextRows = results.results.map((row) {
      if (row.contestantId != contestantId) return row;
      return PollResultRow(
        artistId: row.artistId,
        totalVotes: row.totalVotes + amount,
        rank: row.rank,
        percent: row.percent,
        contestantId: row.contestantId,
        matchGroup: row.matchGroup,
        matchOrder: row.matchOrder,
        artist: row.artist,
      );
    }).toList(growable: false);

    if (nextRows.every((row) => row.contestantId != contestantId)) {
      return;
    }

    final totalVotes = nextRows.fold<int>(0, (sum, row) => sum + row.totalVotes);
    final ranked = [...nextRows]
      ..sort((a, b) => b.totalVotes.compareTo(a.totalVotes));
    final withPercents = <PollResultRow>[];
    for (var index = 0; index < ranked.length; index++) {
      final row = ranked[index];
      withPercents.add(
        PollResultRow(
          artistId: row.artistId,
          totalVotes: row.totalVotes,
          rank: index + 1,
          percent: totalVotes <= 0 ? 0 : (row.totalVotes * 100) / totalVotes,
          contestantId: row.contestantId,
          matchGroup: row.matchGroup,
          matchOrder: row.matchOrder,
          artist: row.artist,
        ),
      );
    }

    setState(() {
      _results = PollResults(
        pollId: results.pollId,
        totalVotes: totalVotes,
        leaderArtistId: withPercents.isEmpty
            ? results.leaderArtistId
            : withPercents.first.artistId,
        leaderVotes: withPercents.isEmpty ? 0 : withPercents.first.totalVotes,
        results: withPercents,
      );
    });
  }

  Future<void> _loadResults() async {
    final poll = _poll;
    if (poll == null) return;
    if (_refreshingResults) {
      _resultsRefreshQueued = true;
      return;
    }

    _refreshingResults = true;
    _lastResultsRefreshAt = DateTime.now();
    try {
      final results = await _pollsApi.getPollResults(
        poll.id,
        roundId: _selectedRoundId.isEmpty ? null : _selectedRoundId,
        forceRefresh: true,
      );
      if (mounted) setState(() => _results = results);
    } catch (_) {
      // Keep the latest result while Socket.IO or polling recovers.
    } finally {
      _refreshingResults = false;
      if (_resultsRefreshQueued) {
        _resultsRefreshQueued = false;
        unawaited(_loadResults());
      }
    }
  }

  PollRound? get _selectedRound {
    final poll = _poll;
    if (poll == null) return null;
    for (final round in poll.rounds) {
      if (round.id == _selectedRoundId) return round;
    }
    return null;
  }

  bool get _votingOpen {
    final poll = _poll;
    if (poll == null || poll.status != 'live') return false;
    final round = _selectedRound;
    if (round != null &&
        round.status.isNotEmpty &&
        round.status != 'live') {
      return false;
    }
    return true;
  }

  bool get _selectingWinners {
    final poll = _poll;
    final round = _selectedRound;
    return poll?.status == 'selecting_winners' ||
        round?.status == 'selecting_winners';
  }

  bool get _countdownHidden =>
      _poll?.hideCountdown == true || _selectedRound?.hideCountdown == true;

  bool get _hideCounts =>
      _poll?.hideVoteCounts == true || _selectedRound?.hideVoteCounts == true;

  bool get _showCountdown {
    if (_countdownHidden) return false;
    final endAt = _selectedRound?.endAt ?? _poll?.countdownEndAt;
    if (endAt == null) return false;
    return endAt.isAfter(_now);
  }

  int get _costPerVote {
    final roundCost = _selectedRound?.configuredCostPerVote;
    return roundCost ?? _poll?.costPerVote ?? 1;
  }

  List<_VoteEntry> get _entries {
    final poll = _poll;
    if (poll == null) return const [];

    final contestants = poll.contestants.where((contestant) {
      if (_selectedRoundId.isEmpty) return contestant.roundId.isEmpty;
      return contestant.roundId == _selectedRoundId;
    }).toList();
    final resultByContestant = {
      for (final result in _results?.results ?? const <PollResultRow>[])
        result.contestantId: result,
    };
    final entries = contestants.map((contestant) {
      final result = resultByContestant[contestant.id];
      return _VoteEntry(
        contestantId: contestant.id,
        artist: result?.artist ?? contestant.artist,
        totalVotes: result?.totalVotes ?? contestant.totalVotes,
        percent: result?.percent ?? 0,
        rank: result?.rank ?? 0,
        matchGroup: contestant.matchGroup,
        matchOrder: contestant.matchOrder,
      );
    }).toList();

    if (entries.isEmpty) {
      entries.addAll(
        (_results?.results ?? const <PollResultRow>[]).map(
          (result) => _VoteEntry(
            contestantId: result.contestantId,
            artist: result.artist,
            totalVotes: result.totalVotes,
            percent: result.percent,
            rank: result.rank,
            matchGroup: result.matchGroup,
            matchOrder: result.matchOrder,
          ),
        ),
      );
    }
    entries.sort((a, b) {
      if (_selectedRound?.type == 'versus') {
        final group = a.matchGroup.compareTo(b.matchGroup);
        return group != 0 ? group : a.matchOrder.compareTo(b.matchOrder);
      }
      return b.totalVotes.compareTo(a.totalVotes);
    });
    return entries;
  }

  Future<void> _selectRound(PollRound round) async {
    if (_selectedRoundId == round.id) return;
    setState(() {
      _selectedRoundId = round.id;
      _results = null;
    });
    await _loadResults();
  }

  Future<void> _showVoteSheet(_VoteEntry entry) async {
    if (!_votingOpen) {
      _showMessage('Esta ronda no estÃ¡ abierta para votar.');
      return;
    }
    final user = widget.authService.session.user;
    if (user == null) {
      _showMessage('Inicia sesiÃ³n para votar.');
      return;
    }
    final maxVotes = user.points ~/ _costPerVote;
    if (maxVotes < 1) {
      _showMessage('No tienes puntos suficientes para votar.');
      return;
    }

    var amount = 1;
    final sheetMaxVotes = maxVotes.clamp(1, 100000);
    final accepted = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withValues(alpha: 0.78),
      builder: (dialogContext) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
        child: StatefulBuilder(
          builder: (context, setDialogState) {
            return Container(
              padding: EdgeInsets.fromLTRB(
                16,
                16,
                16,
                16 + MediaQuery.viewInsetsOf(context).bottom,
              ),
              decoration: BoxDecoration(
                color: const Color(0xFF080817),
                borderRadius: BorderRadius.circular(28),
                border: Border.all(
                  color: const Color(0xFFC026D3).withValues(alpha: 0.28),
                ),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(13),
                      decoration: BoxDecoration(
                        color: const Color(0xFF151725),
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.08),
                        ),
                      ),
                      child: Row(
                        children: [
                          if (entry.artist != null)
                            Container(
                              padding: const EdgeInsets.all(2),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(20),
                                gradient: const LinearGradient(
                                  colors: [
                                    Color(0xFF67E8F9),
                                    Color(0xFFD946EF),
                                  ],
                                ),
                              ),
                              child: ArtistAvatar(
                                artist: entry.artist!,
                                size: 68,
                                radius: 18,
                              ),
                            ),
                          const SizedBox(width: 13),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'CONFIRMAR VOTOS',
                                  style: TextStyle(
                                    color: Color(0xFFF0ABFC),
                                    fontSize: 9,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 2,
                                  ),
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  entry.artist?.name ?? 'Artista',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 21,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  'Tienes ${_formatNumber(user.points)} pts disponibles',
                                  style: const TextStyle(
                                    color: Color(0xFFFDE68A),
                                    fontSize: 11,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton.filled(
                            onPressed: () => Navigator.pop(dialogContext),
                            style: IconButton.styleFrom(
                              backgroundColor: Colors.white.withValues(
                                alpha: 0.07,
                              ),
                            ),
                            icon: const Icon(
                              Icons.close_rounded,
                              color: Color(0xFFCBD5E1),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF151725),
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.08),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Â¿CUÃNTOS VOTOS QUIERES DAR?',
                            style: TextStyle(
                              color: Color(0xFFCBD5E1),
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.1,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              _AmountButton(
                                icon: Icons.remove_rounded,
                                enabled: amount > 1,
                                onTap: () => setDialogState(() => amount--),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Container(
                                  height: 58,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF060619),
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: const Color(
                                        0xFF8B5CF6,
                                      ).withValues(alpha: 0.35),
                                    ),
                                  ),
                                  child: Text(
                                    '$amount',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 28,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              _AmountButton(
                                icon: Icons.add_rounded,
                                enabled: amount < sheetMaxVotes,
                                onTap: () => setDialogState(() => amount++),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Center(
                            child: Text(
                              'MÃ¡ximo: ${_formatNumber(sheetMaxVotes)} votos',
                              style: const TextStyle(
                                color: Color(0xFF94A3B8),
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        for (final value in const [1, 5, 10, 25]) ...[
                          if (value != 1) const SizedBox(width: 6),
                          Expanded(
                            child: _QuickVoteButton(
                              label: '$value voto${value == 1 ? '' : 's'}',
                              enabled: value <= sheetMaxVotes,
                              onTap: () => setDialogState(() => amount = value),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 11),
                    _VoteGradientButton(
                      enabled: true,
                      loading: false,
                      label: 'VOTAR',
                      onTap: () => Navigator.pop(dialogContext, true),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
    if (accepted == true) await _castVote(entry, amount);
  }

  Future<void> _castVote(_VoteEntry entry, int amount) async {
    if (_votingContestantId != null) return;
    setState(() => _votingContestantId = entry.contestantId);
    try {
      final result = await _votesApi.castVote(
        pollId: _poll!.id,
        roundId: _selectedRoundId.isEmpty ? null : _selectedRoundId,
        contestantId: entry.contestantId,
        amount: amount,
      );
      final user = widget.authService.session.user;
      if (user != null && result.points != null) {
        await widget.authService.session.updateUser(
          user.copyWith(points: result.points, spentPoints: result.spentPoints),
        );
      }
      if (!mounted) return;
      // Optimistic local bump so bars move immediately, then sync from API/socket.
      _applyOptimisticVoteDelta({
        'contestantId': entry.contestantId,
        'amount': amount,
        'roundId': _selectedRoundId,
      });
      await _loadResults();
    } catch (error) {
      if (mounted) _showMessage(_messageFor(error));
    } finally {
      if (mounted) setState(() => _votingContestantId = null);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final poll = _poll;
    return Scaffold(
      backgroundColor: const Color(0xFF050213),
      appBar: AppBar(
        backgroundColor: const Color(0xFF09061B),
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: Text(
          poll?.title ?? 'Votación',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w900),
        ),
        actions: [
          AppBarPointsAction(session: widget.authService.session),
        ],
      ),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF17052F), Color(0xFF0B031B), Color(0xFF050213)],
          ),
        ),
        child: _loading && poll == null
            ? const _DetailSkeleton()
            : _error != null && poll == null
            ? _DetailError(message: _error!, retry: _load)
            : poll == null
            ? const SizedBox.shrink()
            : RefreshIndicator(
                onRefresh: () => _load(force: true),
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics(),
                  ),
                  slivers: [
                    // Banner tipo Sliver: al bajar se recoge y deja sitio a votar.
                    SliverAppBar(
                      pinned: false,
                      floating: false,
                      stretch: true,
                      automaticallyImplyLeading: false,
                      backgroundColor: const Color(0xFF09061B),
                      expandedHeight: 200,
                      elevation: 0,
                      scrolledUnderElevation: 0,
                      flexibleSpace: FlexibleSpaceBar(
                        collapseMode: CollapseMode.parallax,
                        background: _PollHero(poll: poll),
                      ),
                    ),
                    if (_showCountdown)
                      SliverPersistentHeader(
                        pinned: true,
                        delegate: _CountdownHeaderDelegate(state: this),
                      ),
                    if (poll.rounds.isNotEmpty)
                      SliverToBoxAdapter(
                        child: _RoundTabs(
                          rounds: poll.rounds,
                          selectedId: _selectedRoundId,
                          onSelected: _selectRound,
                        ),
                      ),
                    const SliverToBoxAdapter(child: BannerAdWidget()),
                    if (_selectingWinners)
                      const SliverToBoxAdapter(child: _CountingVotesPanel())
                    else if (_entries.isEmpty)
                      const SliverToBoxAdapter(
                        child: SizedBox(
                          height: 180,
                          child: Center(
                            child: Text(
                              'Esta ronda todavía no tiene participantes.',
                              style: TextStyle(
                                color: Color(0xFFCBD5E1),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      )
                    else if (_selectedRound?.type == 'versus')
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(14, 4, 14, 18),
                        sliver: SliverList.separated(
                          itemCount: _versusGroups(_entries).length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: 14),
                          itemBuilder: (context, index) {
                            final group = _versusGroups(_entries)[index];
                            return _VersusMatch(
                              number: index + 1,
                              entries: group,
                              hideCounts: _hideCounts,
                              votingOpen: _votingOpen,
                              votingId: _votingContestantId,
                              onVote: _showVoteSheet,
                            );
                          },
                        ),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(14, 4, 14, 18),
                        sliver: SliverList.separated(
                          itemCount: _entries.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final entry = _entries[index];
                            return _ContestantCard(
                              entry: entry,
                              hideCounts: _hideCounts,
                              votingOpen: _votingOpen,
                              voting: _votingContestantId == entry.contestantId,
                              onVote: () => _showVoteSheet(entry),
                            );
                          },
                        ),
                      ),
                    const SliverToBoxAdapter(child: SizedBox(height: 28)),
                  ],
                ),
              ),
      ),
    );
  }
}

class _PollHero extends StatelessWidget {
  const _PollHero({required this.poll});

  final Poll poll;

  @override
  Widget build(BuildContext context) {
    final banner = resolvePollBanner(poll);
    final description = _stripHtml(poll.description);
    return Stack(
      fit: StackFit.expand,
      children: [
        if (banner.isNotEmpty)
          CachedNetworkImage(
            imageUrl: banner,
            fit: BoxFit.cover,
            errorWidget: (_, _, _) => const SizedBox.shrink(),
          )
        else
          const ColoredBox(color: Color(0xFF1A0B2E)),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0x44050213),
                Color(0xAA13052E),
                Color(0xFF120625),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              const Text(
                'VOTACIÓN EN VIVO',
                style: TextStyle(
                  color: Color(0xFFF0ABFC),
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 3,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                poll.title,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  height: 1.05,
                  shadows: [Shadow(color: Color(0x99000000), blurRadius: 12)],
                ),
              ),
              if (description.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.72),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

String _stripHtml(String value) {
  return value
      .replaceAll(RegExp(r'<[^>]*>'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

class _CountdownHeaderDelegate extends SliverPersistentHeaderDelegate {
  _CountdownHeaderDelegate({required this.state});

  final _PollDetailPageState state;

  static const double _height = 96;

  @override
  double get minExtent => _height;

  @override
  double get maxExtent => _height;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Material(
      color: const Color(0xFF0B031B),
      elevation: overlapsContent || shrinkOffset > 0 ? 6 : 0,
      shadowColor: Colors.black54,
      child: _CountdownPanel(state: state),
    );
  }

  @override
  bool shouldRebuild(covariant _CountdownHeaderDelegate oldDelegate) {
    return oldDelegate.state._now != state._now ||
        oldDelegate.state._selectedRoundId != state._selectedRoundId ||
        oldDelegate.state._poll?.id != state._poll?.id;
  }
}

class _CountdownPanel extends StatelessWidget {
  const _CountdownPanel({required this.state});

  final _PollDetailPageState state;

  @override
  Widget build(BuildContext context) {
    final endAt = state._selectedRound?.endAt ?? state._poll?.countdownEndAt;
    if (endAt == null) return const SizedBox.shrink();
    final difference = endAt.difference(state._now);
    if (difference.isNegative) return const SizedBox.shrink();
    final remaining = difference;
    final values = [
      (remaining.inDays.toString().padLeft(2, '0'), 'DÍAS'),
      (remaining.inHours.remainder(24).toString().padLeft(2, '0'), 'HORAS'),
      (remaining.inMinutes.remainder(60).toString().padLeft(2, '0'), 'MIN'),
      (remaining.inSeconds.remainder(60).toString().padLeft(2, '0'), 'SEG'),
    ];
    return Container(
      alignment: Alignment.center,
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'TIEMPO RESTANTE',
            style: TextStyle(
              color: Color(0xFF67E8F9),
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.2,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              for (var index = 0; index < values.length; index++) ...[
                if (index > 0) const SizedBox(width: 6),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2B124A),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.08),
                      ),
                    ),
                    child: Column(
                      children: [
                        Text(
                          values[index].$1,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            height: 1,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          values[index].$2,
                          style: const TextStyle(
                            color: Color(0xFF94A3B8),
                            fontSize: 8,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

/// Rondas como tabs/chips horizontales (sin carrusel de círculos).
class _RoundTabs extends StatelessWidget {
  const _RoundTabs({
    required this.rounds,
    required this.selectedId,
    required this.onSelected,
  });

  final List<PollRound> rounds;
  final String selectedId;
  final ValueChanged<PollRound> onSelected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 4, 0, 8),
      child: SizedBox(
        height: 40,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          itemCount: rounds.length,
          separatorBuilder: (_, _) => const SizedBox(width: 8),
          itemBuilder: (_, index) {
            final round = rounds[index];
            final selected = round.id == selectedId;
            final live = round.status == 'live';
            final label = round.title.isEmpty
                ? 'Ronda ${index + 1}'
                : round.title;
            final status = live
                ? 'EN VIVO'
                : round.status == 'closed'
                    ? 'CERRADA'
                    : 'PRÓXIMA';
            return Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => onSelected(round),
                borderRadius: BorderRadius.circular(20),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: selected
                        ? const Color(0xFF245073)
                        : const Color(0xFF2A1248),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: selected
                          ? const Color(0xFF67E8F9)
                          : Colors.white.withValues(alpha: 0.1),
                      width: selected ? 1.4 : 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        label,
                        style: TextStyle(
                          color: selected
                              ? Colors.white
                              : Colors.white.withValues(alpha: 0.85),
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        status,
                        style: TextStyle(
                          color: live
                              ? const Color(0xFF67E8F9)
                              : const Color(0xFF9F8BB8),
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _CountingVotesPanel extends StatefulWidget {
  const _CountingVotesPanel();

  @override
  State<_CountingVotesPanel> createState() => _CountingVotesPanelState();
}

class _CountingVotesPanelState extends State<_CountingVotesPanel>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 10, 14, 20),
      padding: const EdgeInsets.fromLTRB(22, 34, 22, 30),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(27),
        border: Border.all(
          color: const Color(0xFFD946EF).withValues(alpha: 0.22),
        ),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2C0D3B), Color(0xFF090817), Color(0xFF062A35)],
        ),
      ),
      child: Column(
        children: [
          AnimatedBuilder(
            animation: _controller,
            builder: (context, child) => Transform.scale(
              scale: 0.92 + (_controller.value * 0.1),
              child: child,
            ),
            child: Container(
              width: 78,
              height: 78,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.035),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: const Color(0xFFF0ABFC).withValues(alpha: 0.25),
                ),
              ),
              child: const Icon(
                Icons.auto_awesome_rounded,
                color: Colors.white,
                size: 30,
              ),
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            'CONTEO EN PROCESO',
            style: TextStyle(
              color: Color(0xFFF0ABFC),
              fontSize: 9,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.2,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Estamos contando los votos',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 30,
              fontWeight: FontWeight.w900,
              height: 1.05,
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'La votación terminó. Estamos revisando los resultados en tiempo real y eligiendo a los ganadores. Espera un momento.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFFCBD5E1),
              fontSize: 12,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 22),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(99),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _ProcessingDot(color: Color(0xFFF472B6)),
                SizedBox(width: 6),
                _ProcessingDot(color: Color(0xFF67E8F9)),
                SizedBox(width: 6),
                _ProcessingDot(color: Color(0xFFC4B5FD)),
                SizedBox(width: 10),
                Text(
                  'PROCESANDO RESULTADOS EN VIVO',
                  style: TextStyle(
                    color: Color(0xFFE2E8F0),
                    fontSize: 8,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.7,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProcessingDot extends StatelessWidget {
  const _ProcessingDot({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 6,
      height: 6,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

class _ContestantCard extends StatelessWidget {
  const _ContestantCard({
    required this.entry,
    required this.hideCounts,
    required this.votingOpen,
    required this.voting,
    required this.onVote,
  });

  final _VoteEntry entry;
  final bool hideCounts;
  final bool votingOpen;
  final bool voting;
  final VoidCallback onVote;

  @override
  Widget build(BuildContext context) {
    final artist = entry.artist;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 13),
      decoration: BoxDecoration(
        color: const Color(0xFF21112F),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 14,
            offset: Offset(0, 7),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(23),
                      gradient: const LinearGradient(
                        colors: [Color(0xFF67E8F9), Color(0xFFD946EF)],
                      ),
                    ),
                    child: artist != null
                        ? ArtistAvatar(artist: artist, size: 76, radius: 21)
                        : const SizedBox(width: 76, height: 76),
                  ),
                  Positioned(
                    left: -9,
                    top: -7,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFF120A27),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Text(
                        '#${entry.rank > 0 ? entry.rank : '-'}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      artist?.name ?? 'Artista',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if ((artist?.group ?? '').isNotEmpty)
                      Text(
                        artist!.group,
                        style: const TextStyle(
                          color: Color(0xFFE9D5FF),
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                        ),
                      ),
                  ],
                ),
              ),
              Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (!hideCounts)
                      Text(
                        '${_formatNumber(entry.totalVotes)} VOTOS',
                        style: const TextStyle(
                          color: Color(0xFFE2E8F0),
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    Text(
                      '${entry.percent.toStringAsFixed(2)}%',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 23,
                        fontWeight: FontWeight.w900,
                        height: 1.05,
                      ),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: SizedBox(
              height: 10,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  return Stack(
                    children: [
                      Container(color: Colors.white.withValues(alpha: 0.08)),
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 450),
                        width:
                            constraints.maxWidth *
                            (entry.percent / 100).clamp(0, 1),
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Color(0xFF22D3EE), Color(0xFFE879F9)],
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 13),
          _VoteGradientButton(
            enabled: votingOpen && !voting,
            loading: voting,
            label: votingOpen ? 'VOTAR' : 'VOTACIÓN CERRADA',
            onTap: onVote,
          ),
        ],
      ),
    );
  }
}

class _VoteGradientButton extends StatelessWidget {
  const _VoteGradientButton({
    required this.enabled,
    required this.loading,
    required this.label,
    required this.onTap,
  });

  final bool enabled;
  final bool loading;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Opacity(
        opacity: enabled || loading ? 1 : 0.45,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: enabled ? onTap : null,
            borderRadius: BorderRadius.circular(15),
            child: Ink(
              height: 48,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(15),
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFF8B3DFF),
                    Color(0xFFC026D3),
                    Color(0xFFF012D6),
                  ],
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x553C0B66),
                    blurRadius: 14,
                    offset: Offset(0, 6),
                  ),
                ],
              ),
              child: Center(
                child: loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text(
                        label,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.4,
                        ),
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _VersusMatch extends StatelessWidget {
  const _VersusMatch({
    required this.number,
    required this.entries,
    required this.hideCounts,
    required this.votingOpen,
    required this.votingId,
    required this.onVote,
  });

  final int number;
  final List<_VoteEntry> entries;
  final bool hideCounts;
  final bool votingOpen;
  final String? votingId;
  final ValueChanged<_VoteEntry> onVote;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF21112F),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(0xFF8B5CF6).withValues(alpha: 0.32),
        ),
      ),
      child: Column(
        children: [
          Text(
            'DUELO $number',
            style: const TextStyle(
              color: Color(0xFFF0ABFC),
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.8,
            ),
          ),
          const SizedBox(height: 16),
          Stack(
            alignment: Alignment.topCenter,
            clipBehavior: Clip.none,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final entry in entries)
                    Expanded(
                      child: _VersusArtist(
                        entry: entry,
                        hideCounts: hideCounts,
                        votingOpen: votingOpen,
                        voting: votingId == entry.contestantId,
                        onVote: () => onVote(entry),
                      ),
                    ),
                ],
              ),
              if (entries.length >= 2)
                Positioned(
                  top: 62,
                  child: Transform.scale(
                    scale: 1.3,
                    child: ShaderMask(
                      blendMode: BlendMode.srcIn,
                      shaderCallback: (bounds) => const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Color(0xFFFFF7D6),
                          Color(0xFFFBBF24),
                          Color(0xFFF59E0B),
                          Color(0xFFD97706),
                        ],
                        stops: [0.0, 0.35, 0.7, 1.0],
                      ).createShader(bounds),
                      child: const Text(
                        'VS',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          shadows: [
                            Shadow(
                              color: Color(0xCC000000),
                              blurRadius: 10,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _VersusArtist extends StatelessWidget {
  const _VersusArtist({
    required this.entry,
    required this.hideCounts,
    required this.votingOpen,
    required this.voting,
    required this.onVote,
  });

  final _VoteEntry entry;
  final bool hideCounts;
  final bool votingOpen;
  final bool voting;
  final VoidCallback onVote;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (entry.artist != null)
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(30),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFFF21C8).withValues(alpha: 0.35),
                  blurRadius: 22,
                  spreadRadius: 1,
                ),
              ],
            ),
            child: ArtistAvatar(artist: entry.artist!, size: 165, radius: 30),
          ),
        const SizedBox(height: 12),
        Text(
          entry.artist?.name ?? 'Artista',
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '${entry.percent.toStringAsFixed(2)}%',
          style: const TextStyle(
            color: Color(0xFFFDE68A),
            fontSize: 16,
            fontWeight: FontWeight.w900,
          ),
        ),
        if (!hideCounts) ...[
          const SizedBox(height: 2),
          Text(
            '${_formatNumber(entry.totalVotes)} votos',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.55),
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
        const SizedBox(height: 10),
        _VoteGradientButton(
          enabled: votingOpen && !voting,
          loading: voting,
          label: votingOpen ? 'VOTAR' : 'CERRADA',
          onTap: onVote,
        ),
      ],
    );
  }
}

class _QuickVoteButton extends StatelessWidget {
  const _QuickVoteButton({
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: enabled ? onTap : null,
      style: OutlinedButton.styleFrom(
        foregroundColor: Colors.white,
        backgroundColor: const Color(0xFF151725),
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
        side: BorderSide(color: Colors.white.withValues(alpha: 0.09)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      child: Text(
        label,
        maxLines: 1,
        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900),
      ),
    );
  }
}

class _AmountButton extends StatelessWidget {
  const _AmountButton({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          width: 50,
          height: 58,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: enabled
                ? const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF7C3AED), Color(0xFFC026D3)],
                  )
                : null,
            color: enabled ? null : const Color(0xFF1E1633),
            border: Border.all(
              color: enabled
                  ? const Color(0xFFF0ABFC).withValues(alpha: 0.45)
                  : Colors.white.withValues(alpha: 0.08),
            ),
            boxShadow: enabled
                ? const [
                    BoxShadow(
                      color: Color(0x559333EA),
                      blurRadius: 10,
                      offset: Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Icon(
            icon,
            size: 28,
            color: enabled ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }
}

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(18),
      child: Column(
        children: [
          SkeletonBox(
            height: 230,
            borderRadius: BorderRadius.all(Radius.circular(24)),
          ),
          SizedBox(height: 16),
          SkeletonBox(height: 86),
          SizedBox(height: 12),
          SkeletonBox(height: 110),
          SizedBox(height: 12),
          SkeletonBox(height: 110),
        ],
      ),
    );
  }
}

class _DetailError extends StatelessWidget {
  const _DetailError({required this.message, required this.retry});

  final String message;
  final VoidCallback retry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              color: Color(0xFFF0ABFC),
              size: 48,
            ),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFFCBD5E1)),
            ),
            const SizedBox(height: 14),
            FilledButton(onPressed: retry, child: const Text('REINTENTAR')),
          ],
        ),
      ),
    );
  }
}

class _VoteEntry {
  const _VoteEntry({
    required this.contestantId,
    required this.artist,
    required this.totalVotes,
    required this.percent,
    required this.rank,
    required this.matchGroup,
    required this.matchOrder,
  });

  final String contestantId;
  final Artist? artist;
  final int totalVotes;
  final double percent;
  final int rank;
  final int matchGroup;
  final int matchOrder;
}

List<List<_VoteEntry>> _versusGroups(List<_VoteEntry> entries) {
  final grouped = <int, List<_VoteEntry>>{};
  for (final entry in entries) {
    if (entry.matchGroup > 0) {
      grouped.putIfAbsent(entry.matchGroup, () => []).add(entry);
    }
  }
  if (grouped.isNotEmpty) {
    final keys = grouped.keys.toList()..sort();
    return keys.map((key) => grouped[key]!).toList();
  }
  final pairs = <List<_VoteEntry>>[];
  for (var index = 0; index < entries.length; index += 2) {
    pairs.add(entries.skip(index).take(2).toList());
  }
  return pairs;
}

String _formatNumber(int value) {
  return value.toString().replaceAllMapped(
    RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
    (match) => '${match[1]}.',
  );
}

String _messageFor(Object error) {
  if (error is ApiException) return error.message;
  return 'No se pudo completar la solicitud.';
}
