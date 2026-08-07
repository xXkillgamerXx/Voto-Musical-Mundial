import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/ads/banner_ad_widget.dart';
import '../../../../core/ads/admob_config.dart';
import '../../../../core/ads/ad_reward_gift.dart';
import '../../../../core/ads/rewarded_ad_service.dart';
import '../../../../core/api/api_config.dart';
import '../../../../core/api/api_exception.dart';
import '../../../../core/i18n/tr.dart';
import '../../../../core/widgets/points_chip.dart';
import '../../../../core/widgets/skeleton_box.dart';
import '../../../artists/data/artist.dart';
import '../../../artists/presentation/widgets/artist_avatar.dart';
import '../../../auth/data/auth_service.dart';
import '../../../home/data/missions_api.dart';
import '../../../home/data/poll.dart';
import '../../../home/data/polls_api.dart';
import '../../../home/data/votes_api.dart';
import '../../../home/presentation/pages/missions_page.dart';
import '../../data/poll_realtime_service.dart';
import 'poll_comments_page.dart';

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

  static Future<void> open(
    BuildContext context, {
    required AuthService authService,
    required String pollId,
    Poll? initialPoll,
  }) {
    const bg = Color(0xFF050213);
    return Navigator.of(context).push<void>(
      PageRouteBuilder<void>(
        opaque: true,
        pageBuilder: (context, animation, secondaryAnimation) {
          return ColoredBox(
            color: bg,
            child: PollDetailPage(
              authService: authService,
              pollId: pollId,
              initialPoll: initialPoll,
            ),
          );
        },
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(
            opacity: CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            ),
            child: child,
          );
        },
        transitionDuration: const Duration(milliseconds: 200),
      ),
    );
  }
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
  String? _voteFeedbackId;
  int _voteFeedbackAmount = 0;
  int _voteFeedbackToken = 0;
  Timer? _resultDebounce;
  Timer? _resultsTimer;
  Timer? _clock;
  Timer? _stateDebounce;
  Timer? _voteFeedbackTimer;
  DateTime _now = DateTime.now();
  DateTime _lastResultsRefreshAt = DateTime.fromMillisecondsSinceEpoch(0);
  /// Próximo voto gratis por scope (tiempo del admin).
  final Map<String, DateTime> _freeVoteUntilByScope = {};
  int? _pendingMissionsCount;
  bool _missionsBannerDismissed = false;

  String _freeVoteScopeKey(_VoteEntry entry) => entry.voteScope ?? '_root';

  bool get _userOutOfPoints {
    final user = widget.authService.session.user;
    if (user == null) return false;
    return user.points < _costPerVote;
  }

  bool get _freeVoteAvailable =>
      _poll?.freeVoteEnabled == true && _userOutOfPoints;

  bool get _isOnFreeVoteCooldown {
    if (!_freeVoteAvailable) return false;
    for (final until in _freeVoteUntilByScope.values) {
      if (until.isAfter(_now)) return true;
    }
    return false;
  }

  bool get _showMissionsCooldownBanner =>
      _isOnFreeVoteCooldown &&
      (_pendingMissionsCount ?? 0) > 0 &&
      !_missionsBannerDismissed;

  int _freeVoteRemainingMs(_VoteEntry entry) {
    final until = _freeVoteUntilByScope[_freeVoteScopeKey(entry)];
    if (until == null) return 0;
    final ms = until.difference(_now).inMilliseconds;
    return ms < 0 ? 0 : ms;
  }

  String _voteButtonLabel(_VoteEntry entry) {
    if (!_votingOpen) return tr('pollDetail.votingClosed');
    if (!_freeVoteAvailable) return tr('pollDetail.vote');
    final remaining = _freeVoteRemainingMs(entry);
    if (remaining > 0) {
      return trp('pollDetail.freeVoteCountdown', {
        'time': _formatFreeVoteWait(remaining),
      });
    }
    return tr('pollDetail.freeVote');
  }

  /// Con contador de voto gratis el botón sigue activo para abrir misiones.
  bool _canTapVoteButton(_VoteEntry entry) {
    if (!_votingOpen) return false;
    return true;
  }

  bool _isOnFreeVoteCooldownFor(_VoteEntry entry) {
    return _freeVoteAvailable && _freeVoteRemainingMs(entry) > 0;
  }

  Future<void> _refreshFreeVoteStatus([_VoteEntry? entry]) async {
    final poll = _poll;
    if (poll == null || !poll.freeVoteEnabled) return;
    if (!_userOutOfPoints) {
      if (_freeVoteUntilByScope.isNotEmpty && mounted) {
        setState(() => _freeVoteUntilByScope.clear());
      }
      return;
    }

    final scopes = <String?>{};
    if (entry != null) {
      scopes.add(entry.voteScope);
    } else {
      for (final e in _entries) {
        scopes.add(e.voteScope);
      }
      if (scopes.isEmpty) scopes.add(null);
    }

    final nextByScope = <String, DateTime>{};
    final clearKeys = <String>{};
    for (final scope in scopes) {
      try {
        final status = await _votesApi.getFreeVoteStatus(
          pollId: widget.pollId,
          roundId: _selectedRoundId.isEmpty ? null : _selectedRoundId,
          voteScope: scope,
        );
        final key = scope ?? '_root';
        if (status.canVoteNow || status.nextVoteAt == null) {
          clearKeys.add(key);
        } else {
          nextByScope[key] = status.nextVoteAt!;
        }
      } catch (_) {}
    }
    if (!mounted) return;
    setState(() {
      for (final key in clearKeys) {
        _freeVoteUntilByScope.remove(key);
      }
      _freeVoteUntilByScope.addAll(nextByScope);
    });
  }

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
    _voteFeedbackTimer?.cancel();
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
      unawaited(_refreshFreeVoteStatus());
      unawaited(_refreshPendingMissions());
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
      _freeVoteUntilByScope.clear();
    });
    await _loadResults();
    unawaited(_refreshFreeVoteStatus());
  }

  Future<void> _showVoteSheet(_VoteEntry entry) async {
    if (!_votingOpen) {
      _showMessage(tr('pollDetail.roundNotOpen'));
      return;
    }
    if (!_canTapVoteButton(entry)) return;
    if (_isOnFreeVoteCooldownFor(entry)) {
      await _showMissionsPromptModal(entry: entry);
      return;
    }
    final user = widget.authService.session.user;
    if (user == null) {
      _showMessage(tr('pollDetail.loginToVote'));
      return;
    }
    final maxVotes = user.points ~/ _costPerVote;
    if (maxVotes < 1) {
      await _showFreeVoteSheet(entry);
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
                                Text(
                                  tr('pollDetail.confirmVotes'),
                                  style: const TextStyle(
                                    color: Color(0xFFF0ABFC),
                                    fontSize: 9,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 2,
                                  ),
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  entry.artist?.name ?? tr('pollDetail.artist'),
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
                                  trp('pollDetail.pointsAvailable', {
                                    'points': _formatNumber(user.points),
                                  }),
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
                          Text(
                            tr('pollDetail.howManyVotes'),
                            style: const TextStyle(
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
                              trp('pollDetail.maxVotes', {'count': _formatNumber(sheetMaxVotes)}),
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
                              label: value == 1
                                  ? trp('pollDetail.voteSingular', {'count': value})
                                  : trp('pollDetail.votePlural', {'count': value}),
                              enabled: value <= sheetMaxVotes,
                              onTap: () => setDialogState(() => amount = value),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 11),
                    _VoteShareCard(onShare: _sharePoll),
                    const SizedBox(height: 11),
                    _VoteGradientButton(
                      enabled: true,
                      loading: false,
                      label: tr('pollDetail.vote'),
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

  Future<void> _showFreeVoteSheet(_VoteEntry entry) async {
    final poll = _poll;
    if (poll == null || !poll.freeVoteEnabled) {
      _showMessage(tr('pollDetail.notEnoughPoints'));
      return;
    }

    FreeVoteStatus? status;
    try {
      status = await _votesApi.getFreeVoteStatus(
        pollId: widget.pollId,
        roundId: _selectedRoundId.isEmpty ? null : _selectedRoundId,
        voteScope: entry.voteScope,
      );
    } catch (_) {}

    if (!mounted) return;

    if (status != null && !status.canVoteNow) {
      final nextAt = status.nextVoteAt;
      if (nextAt != null) {
        setState(() {
          _freeVoteUntilByScope[_freeVoteScopeKey(entry)] = nextAt;
        });
      }
      await _showMissionsPromptModal(entry: entry);
      return;
    }

    final cooldown = poll.freeVoteCooldownMinutes;
    final action = await _showAnimatedDialog<String>(
      builder: (dialogContext) {
        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: const Color(0xFF080817),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: const Color(0xFF67E8F9).withValues(alpha: 0.28),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  tr('pollDetail.freeVoteTitle'),
                  style: const TextStyle(
                    color: Color(0xFF67E8F9),
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.6,
                  ),
                ),
                const SizedBox(height: 10),
                _ModalArtistCard(entry: entry),
                const SizedBox(height: 12),
                Text(
                  tr('pollDetail.freeVoteDescription'),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontWeight: FontWeight.w600,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  trp('pollDetail.freeVoteCooldownHint', {
                    'minutes': '$cooldown',
                  }),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xFFFDE68A),
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 14),
                _VoteShareCard(onShare: _sharePoll),
                if (AdMobConfig.adsEnabled) ...[
                  const SizedBox(height: 10),
                  _WatchAdCard(
                    points: AdMobConfig.rewardedVideoPoints,
                    onTap: () => Navigator.pop(dialogContext, 'watchAd'),
                  ),
                ],
                const SizedBox(height: 14),
                _VoteGradientButton(
                  enabled: true,
                  loading: false,
                  label: tr('pollDetail.freeVoteConfirm'),
                  onTap: () => Navigator.pop(dialogContext, 'freeVote'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: Text(tr('pollDetail.commentsCancel')),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (action == 'freeVote') {
      await _castVote(entry, 1);
    } else if (action == 'watchAd') {
      await _watchAdForPoints();
    }
  }

  Future<void> _watchAdForPoints() async {
    if (!AdMobConfig.adsEnabled) return;
    _showMessage(tr('pollDetail.watchAdLoading'));
    final result = await RewardedAdService.show();
    if (!mounted) return;

    if (result != RewardedAdResult.earned) {
      if (result != RewardedAdResult.dismissed) {
        _showMessage(tr('pollDetail.watchAdFailed'));
      }
      return;
    }

    try {
      await claimAndShowAdRewardGift(
        context: context,
        authService: widget.authService,
      );
      if (mounted) setState(() {});
    } on ApiException catch (error) {
      if (mounted) _showMessage(error.message);
    } catch (_) {
      if (mounted) _showMessage(tr('pollDetail.watchAdFailed'));
    }
  }

  String _formatFreeVoteWait(int remainingMs) {
    final totalSeconds = (remainingMs / 1000).ceil().clamp(0, 24 * 60 * 60);
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    if (minutes <= 0) return '${seconds}s';
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
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
        voteScope: entry.voteScope,
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
      _showVoteFeedback(entry.contestantId, amount);
      if (result.freeVote) {
        if (result.nextVoteAt != null) {
          setState(() {
            _freeVoteUntilByScope[_freeVoteScopeKey(entry)] =
                result.nextVoteAt!;
          });
        }
        _missionsBannerDismissed = false;
        unawaited(_promptMissionsAfterFreeVote(entry));
      } else {
        unawaited(_refreshFreeVoteStatus(entry));
      }
      await _loadResults();
    } catch (error) {
      if (!mounted) return;
      final hadCooldown = _tryApplyCooldownFromError(entry, error);
      if (!hadCooldown) {
        _showMessage(_messageFor(error));
      }
    } finally {
      if (mounted) setState(() => _votingContestantId = null);
    }
  }

  Future<void> _refreshPendingMissions() async {
    if (!_userOutOfPoints) {
      if ((_pendingMissionsCount != null || _missionsBannerDismissed) &&
          mounted) {
        setState(() {
          _pendingMissionsCount = null;
          _missionsBannerDismissed = false;
        });
      }
      return;
    }

    try {
      final missions = await MissionsApi(
        widget.authService.client,
      ).getMissions(forceRefresh: true);
      if (!mounted) return;
      final pending = missions.where((mission) => !mission.isDone).length;
      setState(() => _pendingMissionsCount = pending);
    } catch (_) {
      if (!mounted) return;
      setState(() => _pendingMissionsCount = null);
    }
  }

  Future<void> _promptMissionsAfterFreeVote(_VoteEntry entry) async {
    // Tras votar: espera ~1s y luego abre el modal de misiones.
    await Future<void>.delayed(const Duration(milliseconds: 1000));
    if (!mounted) return;
    await _refreshPendingMissions();
    if (!mounted) return;
    await _showMissionsPromptModal(entry: entry);
  }

  Future<T?> _showAnimatedDialog<T>({
    required WidgetBuilder builder,
    bool barrierDismissible = true,
  }) {
    return showGeneralDialog<T>(
      context: context,
      barrierDismissible: barrierDismissible,
      barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
      barrierColor: Colors.black.withValues(alpha: 0.78),
      transitionDuration: const Duration(milliseconds: 260),
      pageBuilder: (context, animation, secondaryAnimation) {
        return builder(context);
      },
      transitionBuilder: (context, animation, secondaryAnimation, child) {
        final curved = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutCubic,
          reverseCurve: Curves.easeInCubic,
        );
        return FadeTransition(
          opacity: curved,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.92, end: 1).animate(curved),
            child: child,
          ),
        );
      },
    );
  }

  Future<void> _showMissionsPromptModal({_VoteEntry? entry}) async {
    if (!mounted) return;
    if (_pendingMissionsCount == null) {
      await _refreshPendingMissions();
      if (!mounted) return;
    }
    final pending = _pendingMissionsCount ?? 0;
    final nextAt = entry == null
        ? null
        : _freeVoteUntilByScope[_freeVoteScopeKey(entry)];
    final showClock =
        nextAt != null && nextAt.isAfter(DateTime.now());
    final canFreeVoteNow = entry != null &&
        _freeVoteAvailable &&
        !_isOnFreeVoteCooldownFor(entry);

    final action = await _showAnimatedDialog<String>(
      builder: (dialogContext) {
        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          child: Container(
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(28),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF2A0B3F), Color(0xFF120826)],
              ),
              border: Border.all(
                color: const Color(0xFFD946EF).withValues(alpha: 0.45),
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFD946EF).withValues(alpha: 0.28),
                  blurRadius: 24,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: SingleChildScrollView(
              child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (entry != null)
                  _ModalArtistCard(entry: entry)
                else
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFD946EF).withValues(alpha: 0.18),
                      border: Border.all(
                        color:
                            const Color(0xFFD946EF).withValues(alpha: 0.5),
                      ),
                    ),
                    child: const Icon(
                      Icons.flag_rounded,
                      color: Color(0xFFF0ABFC),
                      size: 28,
                    ),
                  ),
                const SizedBox(height: 12),
                Text(
                  tr('pollDetail.freeVoteMissionsTitle'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  tr('pollDetail.freeVoteMissionsBody'),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.75),
                    fontWeight: FontWeight.w600,
                    height: 1.35,
                  ),
                ),
                if (showClock) ...[
                  const SizedBox(height: 14),
                  _FreeVoteModalCountdown(until: nextAt),
                ],
                if (pending > 0) ...[
                  const SizedBox(height: 10),
                  Text(
                    trp('pollDetail.freeVoteMissionsPending', {
                      'count': '$pending',
                    }),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFFF0ABFC),
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                _VoteShareCard(
                  onShare: _sharePoll,
                  hint: tr('pollDetail.freeVoteMissionsShare'),
                ),
                if (AdMobConfig.adsEnabled) ...[
                  const SizedBox(height: 10),
                  _WatchAdCard(
                    points: AdMobConfig.rewardedVideoPoints,
                    onTap: () => Navigator.pop(dialogContext, 'watchAd'),
                  ),
                ],
                if (canFreeVoteNow) ...[
                  const SizedBox(height: 12),
                  _VoteGradientButton(
                    enabled: true,
                    loading: false,
                    label: tr('pollDetail.freeVoteConfirm'),
                    onTap: () => Navigator.pop(dialogContext, 'freeVote'),
                  ),
                ],
                const SizedBox(height: 12),
                _VoteGradientButton(
                  enabled: true,
                  loading: false,
                  label: tr('pollDetail.freeVoteMissionsGo'),
                  onTap: () => Navigator.pop(dialogContext, 'missions'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: Text(
                    tr('pollDetail.freeVoteMissionsLater'),
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.65),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            ),
          ),
        );
      },
    );

    if (!mounted) return;
    if (action == 'missions') {
      await _openMissionsFromPoll();
    } else if (action == 'freeVote' && entry != null) {
      await _castVote(entry, 1);
    } else if (action == 'watchAd') {
      await _watchAdForPoints();
    }
  }

  Future<void> _openMissionsFromPoll() async {
    await Navigator.of(context).push<void>(
      PageRouteBuilder<void>(
        opaque: true,
        pageBuilder: (context, animation, secondaryAnimation) {
          return ColoredBox(
            color: const Color(0xFF050213),
            child: Scaffold(
              backgroundColor: Colors.transparent,
              appBar: AppBar(
                backgroundColor: Colors.transparent,
                elevation: 0,
                foregroundColor: Colors.white,
                title: Text(tr('nav.missions')),
              ),
              body: MissionsPage(authService: widget.authService),
            ),
          );
        },
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(
            opacity: CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            ),
            child: child,
          );
        },
        transitionDuration: const Duration(milliseconds: 220),
      ),
    );
    if (mounted) {
      await widget.authService.getMe();
      await _refreshPendingMissions();
    }
  }

  bool _tryApplyCooldownFromError(_VoteEntry entry, Object error) {
    if (error is! ApiException) return false;
    final payload = error.payload;
    if (payload is! Map) return false;
    final map = Map<String, dynamic>.from(payload);
    final nested = map['message'];
    final source = nested is Map
        ? Map<String, dynamic>.from(nested)
        : map;
    DateTime? nextAt = DateTime.tryParse('${source['nextVoteAt'] ?? ''}');
    var remainingMs = 0;
    final remainingRaw = source['remainingMs'];
    if (remainingRaw is num) {
      remainingMs = remainingRaw.toInt();
    } else {
      remainingMs = int.tryParse('${remainingRaw ?? ''}') ?? 0;
    }
    if (nextAt == null && remainingMs > 0) {
      nextAt = DateTime.now().add(Duration(milliseconds: remainingMs));
    }
    final message = error.message.toLowerCase();
    final looksLikeCooldown =
        nextAt != null ||
        remainingMs > 0 ||
        error.statusCode == 429 ||
        message.contains('esperar') ||
        message.contains('wait');
    if (!looksLikeCooldown) return false;
    if (nextAt != null) {
      setState(() {
        _freeVoteUntilByScope[_freeVoteScopeKey(entry)] = nextAt!;
      });
    }
    return true;
  }

  void _showVoteFeedback(String contestantId, int amount) {
    _voteFeedbackTimer?.cancel();
    setState(() {
      _voteFeedbackId = contestantId;
      _voteFeedbackAmount = amount;
      _voteFeedbackToken++;
    });
    _voteFeedbackTimer = Timer(const Duration(milliseconds: 2800), () {
      if (!mounted) return;
      setState(() => _voteFeedbackId = null);
    });
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _sharePoll() async {
    final poll = _poll;
    if (poll == null) return;
    final slug = poll.slug.trim().isNotEmpty ? poll.slug.trim() : poll.id;
    final url = '${ApiConfig.uploadsOrigin}/votacion/${poll.year}/$slug';
    await SharePlus.instance.share(
      ShareParams(
        text: '${poll.title}\n$url',
        subject: poll.title,
        title: poll.title,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final poll = _poll;
    // Menú flotante del shell (~78) + aire para el último VOTAR.
    final navClearance = MediaQuery.paddingOf(context).bottom < 78
        ? 96.0
        : MediaQuery.paddingOf(context).bottom + 24;
    final showMissionsBanner = _showMissionsCooldownBanner;
    final bottomClearance =
        showMissionsBanner ? navClearance + 72 : navClearance;
    final title = poll?.title ?? tr('pollDetail.defaultTitle');
    final topActions = <Widget>[
      AppBarPointsAction(session: widget.authService.session),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF050213),
      appBar: poll == null
          ? AppBar(
              backgroundColor: const Color(0xFF09061B),
              foregroundColor: Colors.white,
              elevation: 0,
              scrolledUnderElevation: 0,
              surfaceTintColor: Colors.transparent,
              title: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              actions: topActions,
            )
          : null,
      body: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFF17052F),
                    Color(0xFF0B031B),
                    Color(0xFF050213),
                  ],
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
                          SliverAppBar(
                            pinned: true,
                            floating: false,
                            stretch: true,
                            backgroundColor: Colors.transparent,
                            foregroundColor: Colors.white,
                            expandedHeight: 220,
                            elevation: 0,
                            scrolledUnderElevation: 0,
                            forceElevated: false,
                            leading: const BackButton(color: Colors.white),
                            actions: topActions,
                            flexibleSpace: LayoutBuilder(
                              builder: (context, constraints) {
                                final settings = context
                                    .dependOnInheritedWidgetOfExactType<
                                        FlexibleSpaceBarSettings>();
                                final min =
                                    settings?.minExtent ?? kToolbarHeight;
                                final max = settings?.maxExtent ?? 220;
                                final current =
                                    settings?.currentExtent ?? max;
                                final range = (max - min).clamp(1.0, 400.0);
                                final t = ((max - current) / range)
                                    .clamp(0.0, 1.0);
                                final barTitleOpacity =
                                    Curves.easeOut.transform(
                                  ((t - 0.55) / 0.45).clamp(0.0, 1.0),
                                );
                                final heroTitleOpacity =
                                    (1.0 - (t / 0.55)).clamp(0.0, 1.0);
                                return Stack(
                                  fit: StackFit.expand,
                                  children: [
                                    _PollHero(
                                      poll: poll,
                                      titleOpacity: heroTitleOpacity,
                                    ),
                                    Positioned.fill(
                                      child: IgnorePointer(
                                        child: DecoratedBox(
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF09061B)
                                                .withValues(
                                              alpha: barTitleOpacity,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                    Positioned(
                                      left: 52,
                                      right: 88,
                                      bottom: 14,
                                      child: Opacity(
                                        opacity: barTitleOpacity,
                                        child: Text(
                                          title,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w900,
                                            fontSize: 16,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                );
                              },
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
                          const SliverToBoxAdapter(
                            child: BannerAdWidget(
                              padding: EdgeInsets.fromLTRB(18, 8, 18, 4),
                            ),
                          ),
                          if (_selectingWinners)
                            const SliverToBoxAdapter(
                              child: _CountingVotesPanel(),
                            )
                          else if (_entries.isEmpty && _loading)
                            const SliverToBoxAdapter(
                              child: _ContestantListSkeleton(),
                            )
                          else if (_entries.isEmpty)
                      SliverToBoxAdapter(
                        child: SizedBox(
                          height: 180,
                          child: Center(
                            child: Text(
                              tr('pollDetail.noParticipants'),
                              style: const TextStyle(
                                color: Color(0xFFCBD5E1),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      )
                    else if (_selectedRound?.type == 'versus')
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
                        sliver: Builder(
                          builder: (context) {
                            final slots = _pollFeedSlots(
                              _versusGroups(_entries).length,
                              includeShare: true,
                              everyN: AdMobConfig.bannerEveryNVersus,
                            );
                            return SliverList.separated(
                              itemCount: slots.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(height: 14),
                              itemBuilder: (context, index) {
                                final slot = slots[index];
                                if (slot.isBanner) {
                                  return BannerAdWidget(
                                    key: ValueKey('versus-banner-$index'),
                                    padding: EdgeInsets.zero,
                                  );
                                }
                                if (slot.isShare) {
                                  return _VoteShareCard(onShare: _sharePoll);
                                }
                                final groups = _versusGroups(_entries);
                                final group = groups[slot.entryIndex];
                                return _VersusMatch(
                                  number: slot.entryIndex + 1,
                                  entries: group,
                                  hideCounts: _hideCounts,
                                  votingOpen: _votingOpen,
                                  votingId: _votingContestantId,
                                  feedbackId: _voteFeedbackId,
                                  feedbackAmount: _voteFeedbackAmount,
                                  feedbackToken: _voteFeedbackToken,
                                  voteLabel: _voteButtonLabel,
                                  canVote: _canTapVoteButton,
                                  onVote: _showVoteSheet,
                                );
                              },
                            );
                          },
                        ),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
                        sliver: Builder(
                          builder: (context) {
                            final slots = _pollFeedSlots(
                              _entries.length,
                              includeShare: true,
                              everyN: AdMobConfig.bannerEveryNContestants,
                            );
                            return SliverList.separated(
                              itemCount: slots.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(height: 10),
                              itemBuilder: (context, index) {
                                final slot = slots[index];
                                if (slot.isBanner) {
                                  return BannerAdWidget(
                                    key: ValueKey('list-banner-$index'),
                                    padding: EdgeInsets.zero,
                                  );
                                }
                                if (slot.isShare) {
                                  return _VoteShareCard(onShare: _sharePoll);
                                }
                                final entry = _entries[slot.entryIndex];
                                return _ContestantCard(
                                  entry: entry,
                                  hideCounts: _hideCounts,
                                  votingOpen: _votingOpen,
                                  voting: _votingContestantId ==
                                      entry.contestantId,
                                  showFeedback:
                                      _voteFeedbackId == entry.contestantId,
                                  feedbackAmount: _voteFeedbackAmount,
                                  feedbackToken: _voteFeedbackToken,
                                  voteLabel: _voteButtonLabel(entry),
                                  voteEnabled: _canTapVoteButton(entry),
                                  onVote: () => _showVoteSheet(entry),
                                );
                              },
                            );
                          },
                        ),
                      ),
                    SliverToBoxAdapter(
                      child: PollCommentsEntry(
                        pollId: widget.pollId,
                        authService: widget.authService,
                        pollTitle: poll.title,
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: SizedBox(height: bottomClearance),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (showMissionsBanner)
            Positioned(
              left: 14,
              right: 14,
              bottom: navClearance - 10,
              child: _MissionsCooldownBanner(
                pendingCount: _pendingMissionsCount ?? 0,
                onOpen: _openMissionsFromPoll,
                onDismiss: () {
                  setState(() => _missionsBannerDismissed = true);
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _FreeVoteModalCountdown extends StatefulWidget {
  const _FreeVoteModalCountdown({required this.until});

  final DateTime until;

  @override
  State<_FreeVoteModalCountdown> createState() =>
      _FreeVoteModalCountdownState();
}

class _FreeVoteModalCountdownState extends State<_FreeVoteModalCountdown> {
  Timer? _timer;
  late int _remainingMs;

  @override
  void initState() {
    super.initState();
    _remainingMs = _computeRemaining();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _remainingMs = _computeRemaining());
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  int _computeRemaining() {
    final ms = widget.until.difference(DateTime.now()).inMilliseconds;
    return ms < 0 ? 0 : ms;
  }

  @override
  Widget build(BuildContext context) {
    final totalSeconds = (_remainingMs / 1000).ceil().clamp(0, 24 * 60 * 60);
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    final minText = minutes.toString().padLeft(2, '0');
    final secText = seconds.toString().padLeft(2, '0');

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
      decoration: BoxDecoration(
        color: const Color(0xFF0B031B).withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: const Color(0xFFFDE68A).withValues(alpha: 0.35),
        ),
      ),
      child: Column(
        children: [
          Text(
            () {
              final label = tr('pollDetail.freeVoteWaitLabel');
              return label == 'pollDetail.freeVoteWaitLabel'
                  ? 'PRÓXIMO VOTO GRATIS'
                  : label;
            }(),
            style: const TextStyle(
              color: Color(0xFFFDE68A),
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _FreeVoteTimeDigit(value: minText),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 6),
                child: Text(
                  ':',
                  style: TextStyle(
                    color: Color(0xFFFDE68A),
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    height: 1,
                  ),
                ),
              ),
              _FreeVoteTimeDigit(value: secText),
            ],
          ),
        ],
      ),
    );
  }
}

class _FreeVoteTimeDigit extends StatelessWidget {
  const _FreeVoteTimeDigit({required this.value});

  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 72),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF3B1D0A), Color(0xFF1A0A05)],
        ),
        border: Border.all(
          color: const Color(0xFFFDE68A).withValues(alpha: 0.55),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFDE68A).withValues(alpha: 0.18),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Text(
        value,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Color(0xFFFFF7C2),
          fontSize: 32,
          fontWeight: FontWeight.w900,
          letterSpacing: 2,
          height: 1,
          fontFeatures: [FontFeature.tabularFigures()],
        ),
      ),
    );
  }
}

class _MissionsCooldownBanner extends StatelessWidget {
  const _MissionsCooldownBanner({
    required this.pendingCount,
    required this.onOpen,
    required this.onDismiss,
  });

  final int pendingCount;
  final VoidCallback onOpen;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      elevation: 10,
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          padding: const EdgeInsets.fromLTRB(12, 12, 6, 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: const LinearGradient(
              colors: [Color(0xFF2A0B3F), Color(0xFF120826)],
            ),
            border: Border.all(
              color: const Color(0xFFD946EF).withValues(alpha: 0.45),
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFD946EF).withValues(alpha: 0.28),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFD946EF).withValues(alpha: 0.2),
                ),
                child: const Icon(
                  Icons.flag_rounded,
                  color: Color(0xFFF0ABFC),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      tr('pollDetail.freeVoteMissionsBanner'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 12.5,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      trp('pollDetail.freeVoteMissionsPending', {
                        'count': '$pendingCount',
                      }),
                      style: const TextStyle(
                        color: Color(0xFFFDE68A),
                        fontWeight: FontWeight.w700,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                tr('pollDetail.freeVoteMissionsGo'),
                style: const TextStyle(
                  color: Color(0xFFF0ABFC),
                  fontWeight: FontWeight.w900,
                  fontSize: 10,
                ),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                onPressed: onDismiss,
                icon: Icon(
                  Icons.close_rounded,
                  size: 18,
                  color: Colors.white.withValues(alpha: 0.55),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PollHero extends StatelessWidget {
  const _PollHero({
    required this.poll,
    this.titleOpacity = 1,
  });

  final Poll poll;
  final double titleOpacity;

  @override
  Widget build(BuildContext context) {
    final banner = resolvePollBanner(poll);
    final hasBanner = banner.isNotEmpty;
    final topPad = MediaQuery.paddingOf(context).top + kToolbarHeight + 8;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (hasBanner)
          CachedNetworkImage(
            imageUrl: banner,
            fit: BoxFit.cover,
            errorWidget: (_, _, _) =>
                const ColoredBox(color: Color(0xFF1A0B2E)),
          )
        else
          const ColoredBox(color: Color(0xFF1A0B2E)),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0x55050213),
                Color(0x22050213),
                Color(0xCC0B031B),
              ],
            ),
          ),
        ),
        if (titleOpacity > 0.01)
          Opacity(
            opacity: titleOpacity,
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, topPad, 16, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    tr('pollDetail.liveVoting'),
                    style: const TextStyle(
                      color: Color(0xFFF0ABFC),
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 3,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    poll.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      height: 1.05,
                      shadows: [
                        Shadow(color: Color(0xCC000000), blurRadius: 14),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
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
      (remaining.inDays.toString().padLeft(2, '0'), tr('pollDetail.days')),
      (remaining.inHours.remainder(24).toString().padLeft(2, '0'), tr('pollDetail.hours')),
      (remaining.inMinutes.remainder(60).toString().padLeft(2, '0'), tr('pollDetail.min')),
      (remaining.inSeconds.remainder(60).toString().padLeft(2, '0'), tr('pollDetail.sec')),
    ];
    return Container(
      alignment: Alignment.center,
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            tr('pollDetail.timeRemaining'),
            style: const TextStyle(
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
                ? trp('pollDetail.round', {'number': index + 1})
                : round.title;
            final status = live
                ? tr('pollDetail.live')
                : round.status == 'closed'
                    ? tr('pollDetail.closed')
                    : tr('pollDetail.upcoming');
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
          Text(
            tr('pollDetail.countingInProgress'),
            style: const TextStyle(
              color: Color(0xFFF0ABFC),
              fontSize: 9,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.2,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            tr('pollDetail.countingVotes'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 30,
              fontWeight: FontWeight.w900,
              height: 1.05,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            tr('pollDetail.countingDescription'),
            textAlign: TextAlign.center,
            style: const TextStyle(
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
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const _ProcessingDot(color: Color(0xFFF472B6)),
                const SizedBox(width: 6),
                const _ProcessingDot(color: Color(0xFF67E8F9)),
                const SizedBox(width: 6),
                const _ProcessingDot(color: Color(0xFFC4B5FD)),
                const SizedBox(width: 10),
                Text(
                  tr('pollDetail.processingResults'),
                  style: const TextStyle(
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

class _ModalArtistCard extends StatelessWidget {
  const _ModalArtistCard({required this.entry});

  final _VoteEntry entry;

  @override
  Widget build(BuildContext context) {
    final artist = entry.artist;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      decoration: BoxDecoration(
        color: const Color(0xFF21112F),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF67E8F9), Color(0xFFD946EF)],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFD946EF).withValues(alpha: 0.35),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: artist != null
                    ? ArtistAvatar(artist: artist, size: 58, radius: 16)
                    : const SizedBox(width: 58, height: 58),
              ),
              Positioned(
                left: -8,
                top: -6,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF120A27),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Text(
                    '#${entry.rank > 0 ? entry.rank : '-'}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  artist?.name ?? tr('pollDetail.artist'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if ((artist?.group ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    artist!.group,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFFE9D5FF),
                      fontWeight: FontWeight.w700,
                      fontSize: 11,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Text(
            '${entry.percent.toStringAsFixed(2)}%',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _VoteShareCard extends StatelessWidget {
  const _VoteShareCard({
    required this.onShare,
    this.hint,
  });

  final VoidCallback onShare;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return _VoteOptionTile(
      onTap: onShare,
      accent: const Color(0xFF67E8F9),
      // Similar al icono de compartir (caja + flecha hacia afuera).
      icon: Icons.ios_share_rounded,
      title: tr('pollDetail.share'),
      subtitle: hint ?? tr('pollDetail.shareCardHint'),
    );
  }
}

class _WatchAdCard extends StatelessWidget {
  const _WatchAdCard({
    required this.points,
    required this.onTap,
  });

  final int points;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _VoteOptionTile(
      onTap: onTap,
      accent: const Color(0xFFFBBF24),
      icon: Icons.play_circle_fill_rounded,
      title: trp('pollDetail.watchAdForPoints', {'points': '$points'}),
      subtitle: tr('pollDetail.watchAdHint'),
    );
  }
}

class _VoteOptionTile extends StatelessWidget {
  const _VoteOptionTile({
    required this.onTap,
    required this.accent,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final VoidCallback onTap;
  final Color accent;
  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF151725),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: accent.withValues(alpha: 0.28),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: accent.withValues(alpha: 0.12),
                ),
                child: Icon(icon, color: accent, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.62),
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: Colors.white.withValues(alpha: 0.45),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ContestantCard extends StatelessWidget {
  const _ContestantCard({
    required this.entry,
    required this.hideCounts,
    required this.votingOpen,
    required this.voting,
    required this.showFeedback,
    required this.feedbackAmount,
    required this.feedbackToken,
    required this.voteLabel,
    required this.voteEnabled,
    required this.onVote,
  });

  final _VoteEntry entry;
  final bool hideCounts;
  final bool votingOpen;
  final bool voting;
  final bool showFeedback;
  final int feedbackAmount;
  final int feedbackToken;
  final String voteLabel;
  final bool voteEnabled;
  final VoidCallback onVote;

  @override
  Widget build(BuildContext context) {
    final artist = entry.artist;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 420),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 13),
      decoration: BoxDecoration(
        color: showFeedback
            ? const Color(0xFF1A2F2A)
            : const Color(0xFF21112F),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: showFeedback
              ? const Color(0xFF34D399).withValues(alpha: 0.55)
              : Colors.white.withValues(alpha: 0.08),
        ),
        boxShadow: [
          if (showFeedback)
            BoxShadow(
              color: const Color(0xFF22D3EE).withValues(alpha: 0.28),
              blurRadius: 28,
              spreadRadius: 1,
            )
          else
            const BoxShadow(
              color: Color(0x33000000),
              blurRadius: 14,
              offset: Offset(0, 7),
            ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Column(
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
                      artist?.name ?? tr('pollDetail.artist'),
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
                        trp('pollDetail.votesUppercase', {
                          'count': _formatNumber(entry.totalVotes),
                        }),
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
            enabled: voteEnabled && !voting,
            loading: voting,
            label: voteLabel,
            onTap: onVote,
          ),
        ],
      ),
          if (showFeedback)
            Positioned(
              top: -8,
              right: 0,
              child: _VoteFeedbackBadge(
                key: ValueKey('fb-$feedbackToken'),
                amount: feedbackAmount,
              ),
            ),
        ],
      ),
    );
  }
}

class _VoteGradientButton extends StatefulWidget {
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
  State<_VoteGradientButton> createState() => _VoteGradientButtonState();
}

class _VoteGradientButtonState extends State<_VoteGradientButton>
    with TickerProviderStateMixin {
  late final AnimationController _shimmer;
  late final AnimationController _pulse;
  late final AnimationController _press;

  @override
  void initState() {
    super.initState();
    _shimmer = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );
    _press = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 140),
      reverseDuration: const Duration(milliseconds: 220),
    );
    _syncIdleAnimations();
  }

  @override
  void didUpdateWidget(covariant _VoteGradientButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.enabled != widget.enabled ||
        oldWidget.loading != widget.loading) {
      _syncIdleAnimations();
    }
  }

  void _syncIdleAnimations() {
    final active = widget.enabled && !widget.loading;
    if (active) {
      if (!_shimmer.isAnimating) _shimmer.repeat();
      if (!_pulse.isAnimating) _pulse.repeat(reverse: true);
    } else {
      _shimmer.stop();
      _pulse.stop();
      _shimmer.value = 0;
      _pulse.value = 0;
    }
  }

  @override
  void dispose() {
    _shimmer.dispose();
    _pulse.dispose();
    _press.dispose();
    super.dispose();
  }

  Future<void> _handleTap() async {
    if (!widget.enabled) return;
    await _press.forward();
    await _press.reverse();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_shimmer, _pulse, _press]),
      builder: (context, _) {
        final pulse = Curves.easeInOut.transform(_pulse.value);
        final pressScale = 1 - (_press.value * 0.06);
        final glow = widget.enabled
            ? 0.22 + (pulse * 0.2)
            : 0.0;
        return Opacity(
          opacity: widget.enabled || widget.loading ? 1 : 0.45,
          child: Transform.scale(
            scale: pressScale,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: widget.enabled ? _handleTap : null,
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
                    boxShadow: [
                      BoxShadow(
                        color: Color.fromRGBO(
                          192,
                          38,
                          211,
                          glow.clamp(0.0, 0.55),
                        ),
                        blurRadius: 16 + (pulse * 10),
                        spreadRadius: pulse * 1.5,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(15),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        if (widget.enabled && !widget.loading)
                          IgnorePointer(
                            child: Align(
                              alignment: Alignment(
                                -1.4 + (_shimmer.value * 2.8),
                                0,
                              ),
                              child: Container(
                                width: 56,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      Colors.white.withValues(alpha: 0),
                                      Colors.white.withValues(alpha: 0.35),
                                      Colors.white.withValues(alpha: 0),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        Center(
                          child: widget.loading
                              ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                              : Text(
                            widget.label,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _VoteFeedbackBadge extends StatefulWidget {
  const _VoteFeedbackBadge({
    required this.amount,
    super.key,
  });

  final int amount;

  @override
  State<_VoteFeedbackBadge> createState() => _VoteFeedbackBadgeState();
}

class _VoteFeedbackBadgeState extends State<_VoteFeedbackBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    )..forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;
        double opacity;
        double dy;
        double scale;
        if (t < 0.18) {
          final p = Curves.easeOut.transform(t / 0.18);
          opacity = p;
          dy = 8 * (1 - p);
          scale = 0.82 + (0.24 * p);
        } else if (t < 0.78) {
          final p = (t - 0.18) / 0.6;
          opacity = 1;
          dy = -4 * p;
          scale = 1.06 - (0.06 * p);
        } else {
          final p = Curves.easeIn.transform((t - 0.78) / 0.22);
          opacity = 1 - p;
          dy = -4 - (10 * p);
          scale = 1 - (0.04 * p);
        }
        return Opacity(
          opacity: opacity.clamp(0.0, 1.0),
          child: Transform.translate(
            offset: Offset(0, dy),
            child: Transform.scale(
              scale: scale,
              child: child,
            ),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: const Color(0xFF6EE7B7).withValues(alpha: 0.4),
          ),
          gradient: const LinearGradient(
            colors: [Color(0xFF10B981), Color(0xFF22D3EE)],
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF22D3EE).withValues(alpha: 0.35),
              blurRadius: 18,
            ),
          ],
        ),
        child: Text(
          widget.amount == 1
              ? trp('pollDetail.plusVoteSingular', {'count': widget.amount})
              : trp('pollDetail.plusVotePlural', {'count': widget.amount}),
          style: const TextStyle(
            color: Color(0xFF052E2B),
            fontSize: 10,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.6,
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
    required this.feedbackId,
    required this.feedbackAmount,
    required this.feedbackToken,
    required this.voteLabel,
    required this.canVote,
    required this.onVote,
  });

  final int number;
  final List<_VoteEntry> entries;
  final bool hideCounts;
  final bool votingOpen;
  final String? votingId;
  final String? feedbackId;
  final int feedbackAmount;
  final int feedbackToken;
  final String Function(_VoteEntry entry) voteLabel;
  final bool Function(_VoteEntry entry) canVote;
  final ValueChanged<_VoteEntry> onVote;

  @override
  Widget build(BuildContext context) {
    final showVs = entries.length >= 2;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1C1032), Color(0xFF150A27)],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(0xFF8B5CF6).withValues(alpha: 0.3),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            trp('pollDetail.duel', {'number': number}),
            style: const TextStyle(
              color: Color(0xFFF0ABFC),
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.8,
            ),
          ),
          const SizedBox(height: 14),
          Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              Row(
                children: [
                  for (var i = 0; i < entries.length; i++) ...[
                    if (i > 0) const SizedBox(width: 12),
                    Expanded(
                      child: _VersusImage(
                        entry: entries[i],
                        label: '${tr('pollDetail.option')} ${String.fromCharCode(65 + i)}',
                        showFeedback: feedbackId == entries[i].contestantId,
                      ),
                    ),
                  ],
                ],
              ),
              if (showVs) const _VersusBadge(),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < entries.length; i++) ...[
                if (i > 0) const SizedBox(width: 12),
                Expanded(
                  child: _VersusInfo(
                    entry: entries[i],
                    hideCounts: hideCounts,
                    votingOpen: votingOpen,
                    voting: votingId == entries[i].contestantId,
                    showFeedback: feedbackId == entries[i].contestantId,
                    feedbackAmount: feedbackAmount,
                    feedbackToken: feedbackToken,
                    voteLabel: voteLabel(entries[i]),
                    voteEnabled: canVote(entries[i]),
                    onVote: () => onVote(entries[i]),
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

class _VersusBadge extends StatelessWidget {
  const _VersusBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 42,
      height: 42,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const RadialGradient(
          colors: [Color(0xFF2A1840), Color(0xFF140A24)],
        ),
        border: Border.all(
          color: const Color(0xFFFBBF24).withValues(alpha: 0.9),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF59E0B).withValues(alpha: 0.5),
            blurRadius: 16,
            spreadRadius: 1,
          ),
          const BoxShadow(
            color: Color(0xCC000000),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
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
            fontSize: 17,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }
}

class _VersusImage extends StatelessWidget {
  const _VersusImage({
    required this.entry,
    required this.label,
    required this.showFeedback,
  });

  final _VoteEntry entry;
  final String label;
  final bool showFeedback;

  @override
  Widget build(BuildContext context) {
    final artist = entry.artist;
    final imageUrl = artist == null
        ? ''
        : resolveArtistMediaUrl(
            artist.banner.isNotEmpty ? artist.banner : artist.image,
          );
    return AspectRatio(
      aspectRatio: 1,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 320),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: showFeedback
                ? const Color(0xFF34D399).withValues(alpha: 0.7)
                : Colors.white.withValues(alpha: 0.1),
            width: showFeedback ? 2 : 1,
          ),
          boxShadow: showFeedback
              ? [
                  BoxShadow(
                    color: const Color(0xFF22D3EE).withValues(alpha: 0.3),
                    blurRadius: 24,
                    spreadRadius: 1,
                  ),
                ]
              : null,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (imageUrl.isEmpty)
                ColoredBox(
                  color: const Color(0xFF1A0B2E),
                  child: Center(
                    child: Text(
                      (artist?.name.characters.firstOrNull ?? 'A')
                          .toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 34,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                )
              else
                CachedNetworkImage(
                  imageUrl: imageUrl,
                  fit: BoxFit.cover,
                  errorWidget: (_, _, _) =>
                      const ColoredBox(color: Color(0xFF1A0B2E)),
                ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0x00000000),
                      Color(0x22000000),
                      Color(0x88000000),
                    ],
                  ),
                ),
              ),
              Positioned(
                left: 8,
                top: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0B0620).withValues(alpha: 0.72),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.18),
                    ),
                  ),
                  child: Text(
                    label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 8,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _VersusInfo extends StatelessWidget {
  const _VersusInfo({
    required this.entry,
    required this.hideCounts,
    required this.votingOpen,
    required this.voting,
    required this.showFeedback,
    required this.feedbackAmount,
    required this.feedbackToken,
    required this.voteLabel,
    required this.voteEnabled,
    required this.onVote,
  });

  final _VoteEntry entry;
  final bool hideCounts;
  final bool votingOpen;
  final bool voting;
  final bool showFeedback;
  final int feedbackAmount;
  final int feedbackToken;
  final String voteLabel;
  final bool voteEnabled;
  final VoidCallback onVote;

  @override
  Widget build(BuildContext context) {
    final artist = entry.artist;
    final group = artist?.group ?? '';
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    artist?.name ?? tr('pollDetail.artist'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 350),
                  style: TextStyle(
                    color: showFeedback
                        ? const Color(0xFF6EE7B7)
                        : const Color(0xFF67E8F9),
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                  child: Text('${entry.percent.toStringAsFixed(2)}%'),
                ),
              ],
            ),
            if (group.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(
                group.toUpperCase(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFFE9D5FF),
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                ),
              ),
            ],
            if (!hideCounts) ...[
              const SizedBox(height: 2),
              Text(
                trp('pollDetail.votesLower', {
                  'count': _formatNumber(entry.totalVotes),
                }),
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.5),
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  return Stack(
                    children: [
                      Container(
                        height: 6,
                        width: double.infinity,
                        color: Colors.white.withValues(alpha: 0.08),
                      ),
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 450),
                        height: 6,
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
            const SizedBox(height: 10),
            _VoteGradientButton(
              enabled: voteEnabled && !voting,
              loading: voting,
              label: voteLabel,
              onTap: onVote,
            ),
          ],
        ),
        if (showFeedback)
          Positioned(
            top: -22,
            right: 0,
            child: _VoteFeedbackBadge(
              key: ValueKey('vs-fb-$feedbackToken'),
              amount: feedbackAmount,
            ),
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
    return CustomScrollView(
      physics: const NeverScrollableScrollPhysics(),
      slivers: [
        const SliverToBoxAdapter(
          child: SkeletonBox(
            height: 220,
            borderRadius: BorderRadius.zero,
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Center(
                  child: SkeletonBox(
                    height: 36,
                    width: 200,
                    borderRadius: BorderRadius.all(Radius.circular(999)),
                  ),
                ),
                const SizedBox(height: 12),
                const SkeletonBox(
                  height: 50,
                  borderRadius: BorderRadius.all(Radius.circular(12)),
                ),
                const SizedBox(height: 14),
                const _ContestantCardSkeleton(),
                const SizedBox(height: 10),
                const _ContestantCardSkeleton(),
                const SizedBox(height: 10),
                const _ContestantCardSkeleton(),
                const SizedBox(height: 12),
                SkeletonBox(
                  height: 64,
                  borderRadius: const BorderRadius.all(Radius.circular(18)),
                  width: MediaQuery.sizeOf(context).width,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ContestantListSkeleton extends StatelessWidget {
  const _ContestantListSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(14, 4, 14, 8),
      child: Column(
        children: [
          _ContestantCardSkeleton(),
          SizedBox(height: 10),
          _ContestantCardSkeleton(),
          SizedBox(height: 10),
          _ContestantCardSkeleton(),
          SizedBox(height: 10),
          _ContestantCardSkeleton(),
        ],
      ),
    );
  }
}

class _ContestantCardSkeleton extends StatelessWidget {
  const _ContestantCardSkeleton();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF090B19).withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              SkeletonBox(
                height: 56,
                width: 56,
                borderRadius: BorderRadius.all(Radius.circular(16)),
              ),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonBox(height: 16, width: 140),
                    SizedBox(height: 8),
                    SkeletonBox(height: 12, width: 90),
                  ],
                ),
              ),
              SkeletonBox(height: 18, width: 52),
            ],
          ),
          SizedBox(height: 14),
          SkeletonBox(
            height: 8,
            borderRadius: BorderRadius.all(Radius.circular(999)),
          ),
          SizedBox(height: 14),
          SkeletonBox(
            height: 48,
            borderRadius: BorderRadius.all(Radius.circular(16)),
          ),
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
            FilledButton(onPressed: retry, child: Text(tr('pollDetail.retry'))),
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

  String? get voteScope =>
      matchGroup > 0 ? 'match_$matchGroup' : null;
}

class _PollFeedSlot {
  const _PollFeedSlot.entry(this.entryIndex)
      : isBanner = false,
        isShare = false;
  const _PollFeedSlot.banner()
      : entryIndex = -1,
        isBanner = true,
        isShare = false;
  const _PollFeedSlot.share()
      : entryIndex = -1,
        isBanner = false,
        isShare = true;

  final int entryIndex;
  final bool isBanner;
  final bool isShare;
}

/// Contestant/versus cards + share cerca del inicio + banner every [everyN] items.
List<_PollFeedSlot> _pollFeedSlots(
  int entryCount, {
  required bool includeShare,
  int? everyN,
}) {
  if (entryCount <= 0) return const [];

  final slots = <_PollFeedSlot>[];
  final every = AdMobConfig.adsEnabled
      ? (everyN ?? AdMobConfig.bannerEveryNContestants)
      : 0;
  // Después de la 2ª card (o la 1ª si solo hay una) para que se vea al votar.
  final shareAfter = !includeShare
      ? -1
      : (entryCount >= 2 ? 1 : 0);

  for (var i = 0; i < entryCount; i++) {
    slots.add(_PollFeedSlot.entry(i));
    if (i == shareAfter) {
      slots.add(const _PollFeedSlot.share());
    }
    if (every > 0 && (i + 1) % every == 0 && i < entryCount - 1) {
      slots.add(const _PollFeedSlot.banner());
    }
  }
  return slots;
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
  return tr('pollDetail.requestFailed');
}
