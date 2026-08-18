import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../artists/data/artist.dart';
import '../../../artists/presentation/pages/artist_profile_page.dart';
import '../../../artists/presentation/widgets/artist_avatar.dart';
import '../../../auth/data/auth_service.dart';
import '../../../../core/ads/banner_ad_widget.dart';
import '../../../../core/ads/native_ad_widget.dart';
import '../../../../core/i18n/tr.dart';
import '../../../polls/presentation/pages/poll_detail_page.dart';
import '../../../users/presentation/pages/user_profile_page.dart';
import '../../data/live_activity_feed.dart';
import '../../data/mission.dart';
import '../../data/missions_api.dart';
import '../../data/news_api.dart';
import '../../data/poll.dart';
import '../../data/poll_category.dart';
import '../../data/polls_api.dart';
import '../../data/votes_api.dart';
import '../widgets/community_section.dart';
import '../widgets/missions_section.dart';
import '../widgets/news_card.dart';
import '../../../rewards/presentation/widgets/daily_reward_banner.dart';

class HomePage extends StatefulWidget {
  const HomePage({
    required this.authService,
    required this.onNavigateToSection,
    required this.onOpenNews,
    required this.onOpenCategory,
    super.key,
  });

  final AuthService authService;
  final ValueChanged<String> onNavigateToSection;
  final VoidCallback onOpenNews;
  final ValueChanged<PollCategoryItem> onOpenCategory;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  static const _weekMs = 7 * 24 * 60 * 60 * 1000;
  static const _closedPollsLimit = 12;
  static const _weeklyRotationPoolSize = 12;

  late final PollsApi _pollsApi;
  late final VotesApi _votesApi;
  late final NewsApi _newsApi;
  late final MissionsApi _missionsApi;
  late final LiveActivityFeed _liveActivityFeed;
  late Future<_HomeData> _homeFuture;
  Timer? _heroAutoplayTimer;
  Timer? _countdownTimer;
  bool _liveFeedStarted = false;

  @override
  void initState() {
    super.initState();
    _pollsApi = PollsApi(widget.authService.client);
    _votesApi = VotesApi(widget.authService.client);
    _newsApi = NewsApi();
    _missionsApi = MissionsApi(widget.authService.client);
    _liveActivityFeed = LiveActivityFeed(_votesApi);
    _homeFuture = _loadHome();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _heroAutoplayTimer?.cancel();
    _countdownTimer?.cancel();
    _liveActivityFeed.dispose();
    super.dispose();
  }

  void _openPoll(Poll poll) {
    PollDetailPage.open(
      context,
      authService: widget.authService,
      pollId: poll.id,
      initialPoll: poll,
    );
  }

  Future<_HomeData> _loadHome({bool forceRefresh = false}) async {
    final livePollsFuture = _pollsApi.getLivePolls(
      limit: 12,
      forceRefresh: forceRefresh,
    );
    final allPollsFuture = _pollsApi.getPolls(
      limit: 100,
      forceRefresh: forceRefresh,
    );
    final newsFuture = _newsApi.getLatestNews(forceRefresh: forceRefresh);
    final missionsFuture = _missionsApi.getMissions(forceRefresh: forceRefresh);

    final livePolls = await livePollsFuture;
    final allPolls = await allPollsFuture;
    final newsItems = await newsFuture;
    final missions = await missionsFuture;
    final heroSlides = <_HeroSlide>[];

    for (var index = 0; index < livePolls.take(3).length; index++) {
      final poll = livePolls[index];
      PollResults? results;

      try {
        final roundId = poll.effectiveRoundId;
        results = await _pollsApi.getPollResults(
          poll.id,
          roundId: roundId.isEmpty ? null : roundId,
          cacheTtl: _pollsApi.resultsTtlForPoll(poll),
          forceRefresh: forceRefresh,
        );
      } catch (_) {
        results = null;
      }

      heroSlides.add(_HeroSlide.fromPoll(poll, results, index));
    }

    return _HomeData(
      heroSlides: heroSlides,
      livePolls: livePolls,
      closedPolls: allPolls
          .where((poll) => poll.status == 'closed')
          .take(_closedPollsLimit)
          .toList(growable: false),
      categories: extractCategoriesFromPolls(allPolls),
      topWeekly: await _loadWeeklyTopFromPolls(
        allPolls,
        forceRefresh: forceRefresh,
      ),
      livePollIds: livePolls.map((poll) => poll.id).toList(growable: false),
      newsItems: newsItems,
      missions: missions,
    );
  }

  Future<void> _reloadMissions() async {
    final missions = await _missionsApi.getMissions(forceRefresh: true);
    if (!mounted) {
      return;
    }

    final current = await _homeFuture;
    setState(() {
      _homeFuture = Future.value(
        _HomeData(
          heroSlides: current.heroSlides,
          livePolls: current.livePolls,
          closedPolls: current.closedPolls,
          categories: current.categories,
          topWeekly: current.topWeekly,
          livePollIds: current.livePollIds,
          newsItems: current.newsItems,
          missions: missions,
        ),
      );
    });
  }

  Future<void> _openExternalUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      return;
    }

    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  void _ensureLiveFeedStarted(_HomeData data) {
    if (_liveFeedStarted) {
      _liveActivityFeed.updateLivePollIds(data.livePollIds);
      return;
    }

    _liveFeedStarted = true;
    _liveActivityFeed.start(livePollIds: data.livePollIds);
  }

  Future<List<_WeeklyTopArtist>> _loadWeeklyTopFromPolls(
    List<Poll> pollRows, {
    bool forceRefresh = false,
  }) async {
    try {
      final cutoff = DateTime.now().millisecondsSinceEpoch - _weekMs;
      final weeklyClosedPolls =
          pollRows
              .where(
                (poll) =>
                    (_pollClosedAt(poll)?.millisecondsSinceEpoch ?? 0) >=
                    cutoff,
              )
              .toList(growable: false)
            ..sort(
              (a, b) =>
                  (_pollClosedAt(b)?.millisecondsSinceEpoch ?? 0) -
                  (_pollClosedAt(a)?.millisecondsSinceEpoch ?? 0),
            );

      final pollsToUse =
          (weeklyClosedPolls.isNotEmpty
                  ? weeklyClosedPolls
                  : (pollRows.toList(growable: false)..sort(
                      (a, b) =>
                          (_pollClosedAt(b)?.millisecondsSinceEpoch ?? 0) -
                          (_pollClosedAt(a)?.millisecondsSinceEpoch ?? 0),
                    )))
              .take(_closedPollsLimit)
              .toList(growable: false);

      final artistMap = <String, _WeeklyTopArtist>{};

      for (final poll in pollsToUse) {
        try {
          final payload = await _pollsApi.getPollResults(
            poll.id,
            cacheTtl: _pollsApi.resultsTtlForPoll(poll),
            forceRefresh: forceRefresh,
          );
          for (final row in payload.results) {
            final artistId = row.artistId.isNotEmpty
                ? row.artistId
                : row.artist?.id ?? '';
            if (artistId.isEmpty) {
              continue;
            }

            final current = artistMap[artistId];
            final artist =
                row.artist ??
                current?.artist ??
                Artist(
                  id: artistId,
                  name: tr('home.artistFallback'),
                  group: '',
                  country: '',
                  role: '',
                  image: '',
                  banner: '',
                  slug: artistId,
                  followersCount: current?.artist.followersCount ?? 0,
                  popularityScore: 0,
                  totalVotes: 0,
                );

            artistMap[artistId] = _WeeklyTopArtist(
              artist: Artist(
                id: artist.id,
                name: artist.name,
                group: artist.group,
                country: artist.country,
                role: artist.role,
                image: artist.image,
                banner: artist.banner,
                bioEs: artist.bioEs,
                bioEn: artist.bioEn,
                slug: artist.slug.isNotEmpty ? artist.slug : artist.id,
                followersCount: artist.followersCount,
                popularityScore: artist.popularityScore,
                totalVotes: (current?.pollVotes ?? 0) + row.totalVotes,
              ),
              pollVotes: (current?.pollVotes ?? 0) + row.totalVotes,
              closedPollCount: (current?.closedPollCount ?? 0) + 1,
            );
          }
        } catch (_) {
          // Ignore polls that fail to load results.
        }
      }

      final sorted =
          artistMap.values
              .where((entry) => entry.pollVotes > 0)
              .toList(growable: false)
            ..sort((a, b) {
              final votesCompare = b.pollVotes.compareTo(a.pollVotes);
              if (votesCompare != 0) {
                return votesCompare;
              }

              final pollCountCompare = b.closedPollCount.compareTo(
                a.closedPollCount,
              );
              if (pollCountCompare != 0) {
                return pollCountCompare;
              }

              return a.artist.name.compareTo(b.artist.name);
            });

      final rotated = _rotateWeekly(
        sorted.take(_weeklyRotationPoolSize).toList(),
      );
      return rotated
          .take(3)
          .toList(growable: false)
          .asMap()
          .entries
          .map(
            (entry) => entry.value.copyWith(
              rank: entry.key + 1,
              featured: entry.key == 0,
            ),
          )
          .toList(growable: false);
    } catch (_) {
      return const [];
    }
  }

  DateTime? _pollClosedAt(Poll poll) {
    return poll.activeEndAt ?? poll.endAt ?? poll.updatedAt ?? poll.createdAt;
  }

  List<_WeeklyTopArtist> _rotateWeekly(List<_WeeklyTopArtist> items) {
    if (items.isEmpty) {
      return items;
    }

    final now = DateTime.now();
    final yearStart = DateTime(now.year);
    final weekNumber = now.difference(yearStart).inMilliseconds ~/ _weekMs;
    final offset = weekNumber % items.length;

    return [...items.sublist(offset), ...items.sublist(0, offset)];
  }

  Future<void> _refresh() async {
    try {
      final data = await _loadHome(forceRefresh: true);
      if (!mounted) return;
      setState(() {
        _homeFuture = Future.value(data);
      });
    } catch (_) {
      // Mantener datos actuales si el refresh falla.
    }
  }

  void _openProfile(Artist artist) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            ArtistProfilePage(artist: artist, authService: widget.authService),
      ),
    );
  }

  void _openUserProfile(String username) {
    final normalized = username.trim().toLowerCase();
    if (normalized.isEmpty) return;

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => UserProfilePage(
          authService: widget.authService,
          username: normalized,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: const Color(0xFFFF21C8),
      backgroundColor: const Color(0xFF120A2B),
      onRefresh: _refresh,
      child: FutureBuilder<_HomeData>(
        future: _homeFuture,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                const SizedBox(height: 120),
                _HomeStateMessage(
                  icon: Icons.error_outline_rounded,
                  title: tr('home.loadError'),
                ),
              ],
            );
          }

          if (!snapshot.hasData) {
            return const _HomeLoadingView();
          }

          final data = snapshot.data!;
          _ensureLiveFeedStarted(data);

          return CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              SliverToBoxAdapter(
                child: _HomeHeroBanner(
                  slides: data.heroSlides,
                  onVoteTap: (poll) {
                    if (poll != null) {
                      _openPoll(poll);
                    } else {
                      widget.onNavigateToSection('Votaciones');
                    }
                  },
                  onRankingTap: () =>
                      widget.onNavigateToSection('Ranking Popularity'),
                  onAutoplayReady: _startHeroAutoplay,
                ),
              ),
              SliverToBoxAdapter(
                child: _ActivePollsSection(
                  openPolls: data.livePolls,
                  closedPolls: data.closedPolls,
                  onVoteTap: _openPoll,
                  onRankingTap: () =>
                      widget.onNavigateToSection('Ranking Popularity'),
                  onViewAllTap: () =>
                      widget.onNavigateToSection('Votaciones'),
                ),
              ),
              const SliverToBoxAdapter(
                child: NativeAdWidget(
                  padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
                ),
              ),
              if (data.categories.isNotEmpty)
                SliverToBoxAdapter(
                  child: _MainCategoriesSection(
                    categories: data.categories,
                    onViewAllTap: () =>
                        widget.onNavigateToSection('Votaciones'),
                    onCategoryTap: widget.onOpenCategory,
                  ),
                ),
              SliverToBoxAdapter(
                child: _TopRankingSection(
                  artists: data.topWeekly,
                  onArtistTap: _openProfile,
                  onViewArtistsTap: () =>
                      widget.onNavigateToSection('Artistas'),
                ),
              ),
              SliverToBoxAdapter(
                child: ListenableBuilder(
                  listenable: _liveActivityFeed,
                  builder: (context, _) {
                    return _LiveActivitySection(
                      feed: _liveActivityFeed,
                      onUserTap: _openUserProfile,
                    );
                  },
                ),
              ),
              SliverToBoxAdapter(
                child: _LatestNewsSection(
                  newsItems: data.newsItems,
                  onViewAllTap: widget.onOpenNews,
                  onOpenArticle: _openExternalUrl,
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 15)),
              const SliverToBoxAdapter(
                child: BannerAdWidget(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                ),
              ),

              SliverToBoxAdapter(
                child: DailyRewardBanner(authService: widget.authService),
              ),
              SliverToBoxAdapter(
                child: MissionsSection(
                  authService: widget.authService,
                  missions: data.missions,
                  onMissionsChanged: _reloadMissions,
                ),
              ),
              SliverToBoxAdapter(
                child: CommunitySection(onOpenLink: _openExternalUrl),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 96)),
            ],
          );
        },
      ),
    );
  }

  void _startHeroAutoplay(VoidCallback goNext, int slideCount) {
    _heroAutoplayTimer?.cancel();
    if (slideCount <= 1) {
      return;
    }

    _heroAutoplayTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      goNext();
    });
  }
}

class _HomeData {
  const _HomeData({
    required this.heroSlides,
    required this.livePolls,
    required this.closedPolls,
    required this.categories,
    required this.topWeekly,
    required this.livePollIds,
    required this.newsItems,
    required this.missions,
  });

  final List<_HeroSlide> heroSlides;
  final List<Poll> livePolls;
  final List<Poll> closedPolls;
  final List<PollCategoryItem> categories;
  final List<_WeeklyTopArtist> topWeekly;
  final List<String> livePollIds;
  final List<NewsItem> newsItems;
  final List<Mission> missions;
}

class _HeroSlide {
  const _HeroSlide({
    required this.poll,
    required this.badge,
    required this.status,
    required this.eyebrow,
    required this.title,
    required this.description,
    required this.leaderVotes,
    required this.totalVotes,
    required this.percent,
    required this.progress,
    required this.hideVoteCounts,
    required this.contestantCount,
    required this.isEmpty,
    this.bannerUrl = '',
  });

  final Poll? poll;
  final String badge;
  final String status;
  final String eyebrow;
  final String title;
  final String description;
  final int leaderVotes;
  final int totalVotes;
  final double percent;
  final double progress;
  final bool hideVoteCounts;
  final int contestantCount;
  final bool isEmpty;
  final String bannerUrl;

  factory _HeroSlide.empty() {
    return _HeroSlide(
      poll: null,
      badge: tr('home.heroEmptyBadge'),
      status: tr('home.heroEmptyStatus'),
      eyebrow: tr('home.heroEmptyEyebrow'),
      title: tr('home.heroEmptyTitle'),
      description: tr('home.heroEmptyDescription'),
      leaderVotes: 0,
      totalVotes: 0,
      percent: 0,
      progress: 0,
      hideVoteCounts: false,
      contestantCount: 0,
      isEmpty: true,
      bannerUrl: '',
    );
  }

  factory _HeroSlide.fromPoll(Poll poll, PollResults? results, int index) {
    final totalVotes = results?.totalVotes ?? poll.totalVotes;
    final leaderVotes = results?.leaderVotes ?? poll.leaderVotes;
    final percent = totalVotes > 0 ? (leaderVotes / totalVotes) * 100 : 0.0;
    final leaderId = results?.leaderArtistId ?? poll.leaderArtistId;
    var leaderName = tr('home.favoriteArtist');

    if (leaderId != null && leaderId.isNotEmpty) {
      for (final row in results?.results ?? const <PollResultRow>[]) {
        if (row.artistId == leaderId && row.artist != null) {
          leaderName = row.artist!.name;
          break;
        }
      }
    }

    final contestantCount = results?.results.length ?? 0;
    final hideVoteCounts = poll.hideVoteCounts;
    final isSelecting = poll.status == 'selecting_winners';

    return _HeroSlide(
      poll: poll,
      badge: index == 0 ? tr('home.heroBadgeTop') : tr('home.heroBadgeLive'),
      status: isSelecting
          ? tr('home.heroStatusInProcess')
          : tr('home.heroStatusLive'),
      eyebrow: poll.title,
      title: leaderId != null && leaderId.isNotEmpty
          ? trp('home.heroLeaderTitle', {'name': leaderName})
          : poll.title,
      description: poll.description.isNotEmpty
          ? poll.description
          : tr('home.heroDefaultDescription'),
      leaderVotes: leaderVotes,
      totalVotes: totalVotes,
      percent: percent,
      progress: totalVotes > 0 ? percent.clamp(4, 100) : 0,
      hideVoteCounts: hideVoteCounts,
      contestantCount: contestantCount,
      isEmpty: false,
      bannerUrl: resolvePollBanner(poll),
    );
  }
}

class _WeeklyTopArtist {
  const _WeeklyTopArtist({
    required this.artist,
    required this.pollVotes,
    required this.closedPollCount,
    this.rank = 0,
    this.featured = false,
  });

  final Artist artist;
  final int pollVotes;
  final int closedPollCount;
  final int rank;
  final bool featured;

  _WeeklyTopArtist copyWith({int? rank, bool? featured}) {
    return _WeeklyTopArtist(
      artist: artist,
      pollVotes: pollVotes,
      closedPollCount: closedPollCount,
      rank: rank ?? this.rank,
      featured: featured ?? this.featured,
    );
  }
}

class _HomeHeroBanner extends StatefulWidget {
  const _HomeHeroBanner({
    required this.slides,
    required this.onVoteTap,
    required this.onRankingTap,
    required this.onAutoplayReady,
  });

  final List<_HeroSlide> slides;
  final ValueChanged<Poll?> onVoteTap;
  final VoidCallback onRankingTap;
  final void Function(VoidCallback goNext, int slideCount) onAutoplayReady;

  @override
  State<_HomeHeroBanner> createState() => _HomeHeroBannerState();
}

class _HomeHeroBannerState extends State<_HomeHeroBanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _statsController;
  int _activeSlide = 0;

  List<_HeroSlide> get _bannerSlides =>
      widget.slides.isNotEmpty ? widget.slides : [_HeroSlide.empty()];

  _HeroSlide get _currentSlide => _bannerSlides[_activeSlide];

  @override
  void initState() {
    super.initState();
    _statsController =
        AnimationController(
            vsync: this,
            duration: const Duration(milliseconds: 1300),
          )
          ..addListener(() {
            if (mounted) {
              setState(() {});
            }
          })
          ..forward();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.onAutoplayReady(_goNextSlide, _bannerSlides.length);
    });
  }

  @override
  void didUpdateWidget(covariant _HomeHeroBanner oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.slides != widget.slides) {
      _activeSlide = _activeSlide.clamp(0, _bannerSlides.length - 1);
      _statsController
        ..reset()
        ..forward();
      widget.onAutoplayReady(_goNextSlide, _bannerSlides.length);
    }
  }

  @override
  void dispose() {
    _statsController.dispose();
    super.dispose();
  }

  void _goNextSlide() => _goToSlide(_activeSlide + 1);

  void _goToSlide(int index) {
    if (!mounted || _bannerSlides.isEmpty) return;
    final next = index % _bannerSlides.length;
    if (next == _activeSlide) return;
    setState(() => _activeSlide = next);
    _statsController
      ..reset()
      ..forward();
  }

  void _onHorizontalDragEnd(DragEndDetails details) {
    if (_bannerSlides.length <= 1) return;
    final vx = details.primaryVelocity ?? 0;
    if (vx < -200) {
      _goToSlide(_activeSlide + 1);
    } else if (vx > 200) {
      _goToSlide(_activeSlide - 1 + _bannerSlides.length);
    }
  }

  @override
  Widget build(BuildContext context) {
    final slide = _currentSlide;
    final eased = Curves.easeOutCubic.transform(_statsController.value);
    final animatedLeaderVotes = (slide.leaderVotes * eased).round();
    final animatedPercent = slide.percent * eased;
    final animatedProgress = slide.progress * eased;

    return Container(
      margin: const EdgeInsets.fromLTRB(0, 10, 0, 8),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
          bottom: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
        ),
        gradient: const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [Color(0xFF030712), Color(0xFF0B0718)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4C1D95).withValues(alpha: 0.4),
            blurRadius: 32,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 420),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              child: slide.bannerUrl.isEmpty
                  ? const SizedBox.shrink(key: ValueKey('hero-no-banner'))
                  : KeyedSubtree(
                      key: ValueKey('hero-banner-${slide.bannerUrl}'),
                      child: CachedNetworkImage(
                        imageUrl: slide.bannerUrl,
                        fit: BoxFit.cover,
                        width: double.infinity,
                        height: double.infinity,
                        fadeInDuration: const Duration(milliseconds: 280),
                        errorWidget: (_, __, ___) => const SizedBox.shrink(),
                        placeholder: (_, __) => const SizedBox.shrink(),
                      ),
                    ),
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    const Color(0xFF030712).withValues(alpha: 0.55),
                    const Color(0xFF0B0718).withValues(alpha: 0.82),
                    const Color(0xFF030712).withValues(alpha: 0.96),
                  ],
                ),
              ),
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(-0.2, 0),
                  radius: 1.2,
                  colors: [
                    const Color(0xFFD946EF).withValues(alpha: 0.18),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          GestureDetector(
            onHorizontalDragEnd: _onHorizontalDragEnd,
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
              child: AnimatedSize(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                alignment: Alignment.topCenter,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _HeroBadge(
                          label: slide.badge,
                          background: const Color(0xFFFCD34D),
                          foreground: const Color(0xFF0F172A),
                        ),
                        _HeroBadge(
                          label: slide.status,
                          background: const Color(
                            0xFF34D399,
                          ).withValues(alpha: 0.15),
                          foreground: const Color(0xFF6EE7B7),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      slide.eyebrow.toUpperCase(),
                      style: const TextStyle(
                        color: Color(0xFFF0ABFC),
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 3.2,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      slide.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 34,
                        fontWeight: FontWeight.w900,
                        height: 1.05,
                        letterSpacing: -0.6,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      slide.description,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.72),
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        height: 1.45,
                      ),
                    ),
                    if (!slide.isEmpty) ...[
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 20,
                        runSpacing: 12,
                        crossAxisAlignment: WrapCrossAlignment.end,
                        children: [
                          if (!slide.hideVoteCounts)
                            _HeroStatBlock(
                              label: tr('home.leaderVotes'),
                              value: _formatNumber(animatedLeaderVotes),
                              valueSize: 34,
                            ),
                          _HeroStatBlock(
                            label: slide.hideVoteCounts
                                ? tr('home.leading')
                                : tr('home.participation'),
                            value: '${animatedPercent.toStringAsFixed(2)}%',
                            valueColor: const Color(0xFFF0ABFC),
                            valueSize: 28,
                          ),
                          if (!slide.hideVoteCounts && slide.totalVotes > 0)
                            _HeroStatBlock(
                              label: tr('home.totalVotes'),
                              value: _formatNumber(slide.totalVotes),
                              valueSize: 20,
                            ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          minHeight: 8,
                          value: animatedProgress / 100,
                          backgroundColor: Colors.white.withValues(alpha: 0.1),
                          valueColor: const AlwaysStoppedAnimation<Color>(
                            Color(0xFFC084FC),
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: _GradientButton(
                            label: slide.isEmpty
                                ? tr('home.viewPolls')
                                : tr('home.voteNow'),
                            onTap: () => widget.onVoteTap(slide.poll),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: widget.onRankingTap,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFFE2E8F0),
                              side: BorderSide(
                                color: Colors.white.withValues(alpha: 0.15),
                              ),
                              minimumSize: const Size.fromHeight(54),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(18),
                              ),
                            ),
                            child: Text(
                              tr('home.viewRankings'),
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (_bannerSlides.length > 1) ...[
                      const SizedBox(height: 14),
                      Row(
                        children: List.generate(_bannerSlides.length, (index) {
                          final isActive = index == _activeSlide;
                          return GestureDetector(
                            onTap: () => _goToSlide(index),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 220),
                              margin: const EdgeInsets.only(right: 8),
                              width: isActive ? 28 : 8,
                              height: 8,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(999),
                                color: isActive
                                    ? const Color(0xFFF0ABFC)
                                    : Colors.white.withValues(alpha: 0.25),
                              ),
                            ),
                          );
                        }),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroBadge extends StatelessWidget {
  const _HeroBadge({
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: foreground,
          fontSize: 10,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

class _HeroStatBlock extends StatelessWidget {
  const _HeroStatBlock({
    required this.label,
    required this.value,
    this.valueColor = Colors.white,
    this.valueSize = 28,
  });

  final String label;
  final String value;
  final Color valueColor;
  final double valueSize;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.45),
            fontSize: 10,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.4,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: valueSize,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _ActivePollsSection extends StatelessWidget {
  const _ActivePollsSection({
    required this.openPolls,
    required this.closedPolls,
    required this.onVoteTap,
    required this.onRankingTap,
    required this.onViewAllTap,
  });

  final List<Poll> openPolls;
  final List<Poll> closedPolls;
  final ValueChanged<Poll> onVoteTap;
  final VoidCallback onRankingTap;
  final VoidCallback onViewAllTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr('home.activePollsEyebrow'),
            style: const TextStyle(
              color: Color(0xFF67E8F9),
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.8,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            tr('home.voteNowTitle'),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            tr('home.activePollsSubtitle'),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.55),
              fontSize: 13,
              fontWeight: FontWeight.w600,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 18),
          _HomePollsBlockTitle(
            title: tr('home.openPollsSection'),
            count: openPolls.length,
          ),
          const SizedBox(height: 12),
          if (openPolls.isEmpty)
            _ActivePollsEmpty(onRankingTap: onRankingTap)
          else
            _PollsHorizontalCarousel(
              height: 472,
              cardWidthFactor: 0.82,
              polls: openPolls,
              compact: false,
              onVoteTap: onVoteTap,
            ),
          const SizedBox(height: 24),
          _HomePollsBlockTitle(
            title: tr('home.closedPollsSection'),
            count: closedPolls.length,
            trailing: TextButton(
              onPressed: onViewAllTap,
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFFF0ABFC),
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(
                tr('home.viewPolls'),
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (closedPolls.isEmpty)
            const _ClosedPollsEmptyCard()
          else
            _PollsHorizontalCarousel(
              height: 308,
              cardWidthFactor: 0.74,
              polls: closedPolls,
              compact: true,
              onVoteTap: onVoteTap,
            ),
        ],
      ),
    );
  }
}

class _PollsHorizontalCarousel extends StatefulWidget {
  const _PollsHorizontalCarousel({
    required this.polls,
    required this.onVoteTap,
    required this.height,
    required this.cardWidthFactor,
    required this.compact,
  });

  final List<Poll> polls;
  final ValueChanged<Poll> onVoteTap;
  final double height;
  final double cardWidthFactor;
  final bool compact;

  @override
  State<_PollsHorizontalCarousel> createState() =>
      _PollsHorizontalCarouselState();
}

class _PollsHorizontalCarouselState extends State<_PollsHorizontalCarousel> {
  final _controller = ScrollController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_controller.hasClients) return;
    final cardWidth =
        MediaQuery.sizeOf(context).width * widget.cardWidthFactor + 14;
    final next = (_controller.offset / cardWidth).round().clamp(
      0,
      widget.polls.length - 1,
    );
    if (next != _index) {
      setState(() => _index = next);
    }
  }

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onScroll);
  }

  @override
  Widget build(BuildContext context) {
    final showHint = widget.polls.length > 1;
    final cardWidth = MediaQuery.sizeOf(context).width * widget.cardWidthFactor;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showHint) ...[
          Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 10, right: 2),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    tr('home.swipePollsHint'),
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.55),
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    Icons.arrow_forward_ios_rounded,
                    color: Colors.white.withValues(alpha: 0.45),
                    size: 12,
                  ),
                ],
              ),
            ),
          ),
        ],
        SizedBox(
          height: widget.height,
          child: Stack(
            children: [
              ListView.separated(
                controller: _controller,
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.only(right: 28),
                itemCount: widget.polls.length,
                separatorBuilder: (_, _) => const SizedBox(width: 14),
                itemBuilder: (context, index) {
                  return SizedBox(
                    width: cardWidth,
                    child: _ActivePollCard(
                      poll: widget.polls[index],
                      visualIndex: index,
                      compact: widget.compact,
                      onVoteTap: () => widget.onVoteTap(widget.polls[index]),
                    ),
                  );
                },
              ),
              if (showHint && _index < widget.polls.length - 1)
                Positioned(
                  right: 0,
                  top: 0,
                  bottom: 0,
                  child: IgnorePointer(
                    child: Container(
                      width: 36,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                          colors: [
                            const Color(0xFF050213).withValues(alpha: 0),
                            const Color(0xFF050213).withValues(alpha: 0.72),
                          ],
                        ),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.chevron_right_rounded,
                        color: Color(0xFFF0ABFC),
                        size: 28,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (showHint) ...[
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(widget.polls.length, (i) {
              final active = i == _index;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: active ? 18 : 7,
                height: 7,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  color: active
                      ? const Color(0xFFF012D6)
                      : Colors.white.withValues(alpha: 0.22),
                ),
              );
            }),
          ),
        ],
      ],
    );
  }
}

class _HomePollsBlockTitle extends StatelessWidget {
  const _HomePollsBlockTitle({
    required this.title,
    required this.count,
    this.trailing,
  });

  final String title;
  final int count;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          title,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xFFD946EF).withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            '$count',
            style: const TextStyle(
              color: Color(0xFFF0ABFC),
              fontSize: 11,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const Spacer(),
        if (trailing != null) trailing!,
      ],
    );
  }
}

class _ActivePollCard extends StatelessWidget {
  const _ActivePollCard({
    required this.poll,
    required this.visualIndex,
    required this.onVoteTap,
    this.compact = false,
  });

  final Poll poll;
  final int visualIndex;
  final VoidCallback onVoteTap;
  final bool compact;

  static const _visualGradients = [
    [Color(0xFF4C1D95), Color(0xFFC026D3), Color(0xFF312E81)],
    [Color(0xFF1E293B), Color(0xFF6D28D9), Color(0xFF020617)],
    [Color(0xFF701A75), Color(0xFFDB2777), Color(0xFF020617)],
  ];

  @override
  Widget build(BuildContext context) {
    final gradient = _visualGradients[visualIndex % _visualGradients.length];
    final banner = resolvePollBanner(poll);
    final isSelecting = poll.status == 'selecting_winners';
    final isClosed = poll.status == 'closed';
    final bannerHeight = compact ? 118.0 : 176.0;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF090B19).withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF8B5CF6).withValues(alpha: 0.1),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4C1D95).withValues(alpha: 0.25),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: bannerHeight,
            child: Stack(
              fit: StackFit.expand,
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: gradient,
                    ),
                  ),
                ),
                if (banner.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: banner,
                    fit: BoxFit.cover,
                    errorWidget: (_, _, _) => const SizedBox.shrink(),
                  ),
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.white.withValues(alpha: 0.05),
                        Colors.transparent,
                        const Color(0xFF080A17),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: EdgeInsets.fromLTRB(20, compact ? 12 : 14, 20, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    poll.title.toUpperCase(),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: compact ? 16 : 18,
                      fontWeight: FontWeight.w900,
                      height: 1.12,
                    ),
                  ),
                  if (!compact) ...[
                    const SizedBox(height: 4),
                    Text(
                      isSelecting
                          ? tr('home.countingVotes')
                          : (poll.description.isNotEmpty
                                ? poll.description
                                : tr('home.whoLeadsPoll')),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.55),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _PollCountdown(poll: poll),
                    const SizedBox(height: 10),
                  ] else ...[
                    const SizedBox(height: 10),
                  ],
                  const Spacer(),
                  _GradientButton(
                    label: isClosed
                        ? tr('catalog.pollActionViewResults')
                        : isSelecting
                            ? tr('home.viewProcess')
                            : tr('home.vote'),
                    onTap: onVoteTap,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PollCountdown extends StatefulWidget {
  const _PollCountdown({required this.poll});

  final Poll poll;

  @override
  State<_PollCountdown> createState() => _PollCountdownState();
}

class _PollCountdownState extends State<_PollCountdown> {
  Timer? _timer;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final poll = widget.poll;

    if (poll.status == 'selecting_winners') {
      return _PollCountdownShell(
        child: Row(
          children: const [
            _CountdownCell(value: 'EN', label: ''),
            SizedBox(width: 8),
            _CountdownCell(value: 'PRO', label: ''),
            SizedBox(width: 8),
            _CountdownCell(value: 'CE', label: ''),
            SizedBox(width: 8),
            _CountdownCell(value: 'SO', label: ''),
          ],
        ),
      );
    }

    if (poll.hideCountdown) {
      return const _LiveBadge();
    }

    final endDate = poll.countdownEndAt;
    if (endDate == null) {
      return const _LiveBadge();
    }

    final remaining = endDate.difference(_now);
    if (remaining.isNegative && poll.status == 'live') {
      return const _LiveBadge();
    }

    final days = remaining.inDays.clamp(0, 999);
    final hours = remaining.inHours.remainder(24).clamp(0, 23);
    final minutes = remaining.inMinutes.remainder(60).clamp(0, 59);
    final seconds = remaining.inSeconds.remainder(60).clamp(0, 59);

    return _PollCountdownShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr('home.timeRemaining'),
            style: const TextStyle(
              color: Color(0xFFFDE68A),
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _CountdownCell(value: _pad(days), label: tr('home.days')),
              const SizedBox(width: 8),
              _CountdownCell(value: _pad(hours), label: tr('home.hours')),
              const SizedBox(width: 8),
              _CountdownCell(
                value: _pad(minutes),
                label: tr('home.minutesShort'),
              ),
              const SizedBox(width: 8),
              _CountdownCell(
                value: _pad(seconds),
                label: tr('home.secondsShort'),
                accent: true,
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _pad(int value) => value.toString().padLeft(2, '0');
}

class _PollCountdownShell extends StatelessWidget {
  const _PollCountdownShell({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF1A1230), Color(0xFF0C0818)],
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: const Color(0xFFFDE68A).withValues(alpha: 0.28),
          ),
        ),
        child: child,
      ),
    );
  }
}

class _LiveBadge extends StatelessWidget {
  const _LiveBadge();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(0xFF34D399).withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: const Color(0xFF6EE7B7).withValues(alpha: 0.2),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              tr('home.liveNow'),
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFFD1FAE5),
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              tr('home.noCloseDefined'),
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFF6EE7B7),
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CountdownCell extends StatelessWidget {
  const _CountdownCell({
    required this.value,
    required this.label,
    this.accent = false,
  });

  final String value;
  final String label;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: accent
              ? const Color(0xFF3B1D0A).withValues(alpha: 0.85)
              : Colors.black.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: accent
                ? const Color(0xFFFDE68A).withValues(alpha: 0.45)
                : Colors.white.withValues(alpha: 0.12),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              transitionBuilder: (child, animation) {
                return FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0, 0.25),
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
                );
              },
              child: Text(
                value,
                key: ValueKey(value),
                style: TextStyle(
                  color: accent ? const Color(0xFFFFF7C2) : Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  height: 1,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
            if (label.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                label.toUpperCase(),
                style: TextStyle(
                  color: accent
                      ? const Color(0xFFFDE68A).withValues(alpha: 0.85)
                      : Colors.white.withValues(alpha: 0.5),
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ClosedPollsEmptyCard extends StatelessWidget {
  const _ClosedPollsEmptyCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF15122A), Color(0xFF0B0918)],
        ),
        border: Border.all(
          color: const Color(0xFF8B5CF6).withValues(alpha: 0.22),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4C1D95).withValues(alpha: 0.18),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: const Color(0xFFD946EF).withValues(alpha: 0.12),
              border: Border.all(
                color: const Color(0xFFD946EF).withValues(alpha: 0.28),
              ),
            ),
            child: const Icon(
              Icons.inventory_2_outlined,
              color: Color(0xFFF0ABFC),
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr('home.noClosedPollsTitle'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  tr('home.noClosedPollsDescription'),
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.55),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    height: 1.4,
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

class _ActivePollsEmpty extends StatelessWidget {
  const _ActivePollsEmpty({required this.onRankingTap});

  final VoidCallback onRankingTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _HeroBadge(
                label: tr('home.soon'),
                background: const Color(0xFFFBBF24).withValues(alpha: 0.1),
                foreground: const Color(0xFFFEF3C7),
              ),
              _HeroBadge(
                label: tr('home.noLivePolls'),
                background: Colors.white.withValues(alpha: 0.06),
                foreground: const Color(0xFFCBD5E1),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            tr('home.noActivePollsTitle'),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            tr('home.noActivePollsDescription'),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.55),
              fontSize: 13,
              fontWeight: FontWeight.w600,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: onRankingTap,
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
              minimumSize: const Size.fromHeight(44),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            child: Text(
              tr('home.viewRanking'),
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }
}

class _TopRankingSection extends StatelessWidget {
  const _TopRankingSection({
    required this.artists,
    required this.onArtistTap,
    required this.onViewArtistsTap,
  });

  final List<_WeeklyTopArtist> artists;
  final ValueChanged<Artist> onArtistTap;
  final VoidCallback onViewArtistsTap;

  static const _accents = [
    ([Color(0xFFFCD34D), Color(0xFFEC4899)], Color(0x73FCD34D)),
    ([Color(0xFF38BDF8), Color(0xFF8B5CF6)], Color(0x5938BDF8)),
    ([Color(0xFFFB923C), Color(0xFFEC4899)], Color(0x66FB923C)),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 28, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr('home.ofTheWeek'),
                      style: const TextStyle(
                        color: Color(0xFF67E8F9),
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2.8,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      tr('home.topVotedClosed'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        height: 1.1,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      tr('home.topVotedSubtitle'),
                      style: const TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: onViewArtistsTap,
                child: Text(
                  tr('home.viewArtists'),
                  style: const TextStyle(
                    color: Color(0xFFC4B5FD),
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          if (artists.isEmpty)
            _HomeEmptyPanel(
              icon: Icons.emoji_events_rounded,
              iconColor: Color(0xFFFCD34D),
              title: tr('home.noClosedPollsTitle'),
              description: tr('home.noClosedPollsDescription'),
            )
          else
            SizedBox(
              height: 430,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: artists.length,
                separatorBuilder: (_, __) => const SizedBox(width: 14),
                itemBuilder: (context, index) {
                  final entry = artists[index];
                  final accent = _accents[index % _accents.length];
                  return _TopRankingCard(
                    entry: entry,
                    accentColors: accent.$1,
                    borderColor: accent.$2,
                    onTap: () => onArtistTap(entry.artist),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _MainCategoriesSection extends StatelessWidget {
  const _MainCategoriesSection({
    required this.categories,
    required this.onViewAllTap,
    required this.onCategoryTap,
  });

  final List<PollCategoryItem> categories;
  final VoidCallback onViewAllTap;
  final ValueChanged<PollCategoryItem> onCategoryTap;

  static const _gradients = [
    [Color(0xFF4C1D95), Color(0xFFC026D3), Color(0xFF312E81)],
    [Color(0xFF1E293B), Color(0xFF6D28D9), Color(0xFF020617)],
    [Color(0xFF701A75), Color(0xFFDB2777), Color(0xFF020617)],
    [Color(0xFF312E81), Color(0xFF7C3AED), Color(0xFF701A75)],
    [Color(0xFF064E3B), Color(0xFF0891B2), Color(0xFF020617)],
    [Color(0xFF78350F), Color(0xFFE11D48), Color(0xFF701A75)],
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 28, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr('home.explore'),
                      style: const TextStyle(
                        color: Color(0xFF67E8F9),
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2.8,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      tr('home.mainCategories'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: onViewAllTap,
                child: Text(
                  tr('home.viewAll'),
                  style: const TextStyle(
                    color: Color(0xFFC4B5FD),
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            height: 318,
            child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: categories.length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (context, index) {
                  final category = categories[index];
                  final gradient =
                      _gradients[category.gradientIndex % _gradients.length];

                  return SizedBox(
                    width: MediaQuery.sizeOf(context).width * 0.52,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => onCategoryTap(category),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: const Color(
                            0xFF090B19,
                          ).withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: const Color(
                              0xFF8B5CF6,
                            ).withValues(alpha: 0.1),
                          ),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(
                                child: Stack(
                                  fit: StackFit.expand,
                                  children: [
                                    DecoratedBox(
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                          colors: gradient,
                                        ),
                                      ),
                                    ),
                                    Center(
                                      child: Container(
                                        width: 72,
                                        height: 72,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: Colors.black.withValues(
                                            alpha: 0.35,
                                          ),
                                          border: Border.all(
                                            color: Colors.white.withValues(
                                              alpha: 0.25,
                                            ),
                                          ),
                                          boxShadow: [
                                            BoxShadow(
                                              color: const Color(
                                                0xFFD946EF,
                                              ).withValues(alpha: 0.35),
                                              blurRadius: 24,
                                            ),
                                          ],
                                        ),
                                        alignment: Alignment.center,
                                        child: Text(
                                          category.iconLabel.length <= 2
                                              ? category.iconLabel
                                              : '⭐',
                                          style: const TextStyle(fontSize: 32),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      category.iconLabel.length <= 2
                                          ? category.iconLabel
                                          : '⭐',
                                      style: const TextStyle(
                                        color: Color(0xFFF0ABFC),
                                        fontSize: 22,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      category.name.toUpperCase(),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w900,
                                        height: 1.15,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      category.pollCount == 1
                                          ? tr('home.categoryPollSingular')
                                          : trp('home.categoryPollPlural', {
                                              'count': '${category.pollCount}',
                                            }),
                                      style: TextStyle(
                                        color: Colors.white.withValues(
                                          alpha: 0.55,
                                        ),
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      tr('home.viewCategory'),
                                      style: const TextStyle(
                                        color: Color(0xFFF0ABFC),
                                        fontSize: 11,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 0.4,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _LiveActivitySection extends StatelessWidget {
  const _LiveActivitySection({
    required this.feed,
    required this.onUserTap,
  });

  final LiveActivityFeed feed;
  final ValueChanged<String> onUserTap;

  @override
  Widget build(BuildContext context) {
    final activities = feed.activities;
    final isConnected = feed.isConnected;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 28, 16, 0),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF070918).withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(28),
          border: Border.all(
            color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF4C1D95).withValues(alpha: 0.2),
              blurRadius: 28,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD946EF).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: const Color(0xFFF0ABFC).withValues(alpha: 0.25),
                    ),
                  ),
                  child: const Icon(
                    Icons.podcasts_rounded,
                    color: Color(0xFFF5D0FE),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            tr('home.realTime'),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: isConnected
                                  ? const Color(
                                      0xFFEF4444,
                                    ).withValues(alpha: 0.15)
                                  : const Color(
                                      0xFFF59E0B,
                                    ).withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: isConnected
                                    ? const Color(
                                        0xFFFCA5A5,
                                      ).withValues(alpha: 0.3)
                                    : const Color(
                                        0xFFFCD34D,
                                      ).withValues(alpha: 0.25),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: BoxDecoration(
                                    color: isConnected
                                        ? const Color(0xFFFCA5A5)
                                        : const Color(0xFFFCD34D),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  isConnected
                                      ? tr('home.liveTag')
                                      : tr('home.connecting'),
                                  style: TextStyle(
                                    color: isConnected
                                        ? const Color(0xFFFEE2E2)
                                        : const Color(0xFFFEF3C7),
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        tr('home.realTimeSubtitle'),
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.55),
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (activities.isEmpty)
              _HomeEmptyPanel(
                icon: Icons.person_search_rounded,
                iconColor: Color(0xFF67E8F9),
                title: tr('home.noRecentActivityTitle'),
                description: tr('home.noRecentActivityDescription'),
                compact: true,
              )
            else
              ...activities
                  .take(6)
                  .map(
                    (activity) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _LiveActivityCard(
                        activity: activity,
                        onUserTap: onUserTap,
                      ),
                    ),
                  ),
          ],
        ),
      ),
    );
  }
}

class _LiveActivityCard extends StatelessWidget {
  const _LiveActivityCard({
    required this.activity,
    required this.onUserTap,
  });

  final VoteActivity activity;
  final ValueChanged<String> onUserTap;

  @override
  Widget build(BuildContext context) {
    final userPhoto = resolveArtistMediaUrl(activity.userPhotoUrl);
    final artistPhoto = resolveArtistMediaUrl(activity.artistPhotoUrl);
    final canOpenProfile = activity.username.trim().isNotEmpty;

    return Material(
      color: const Color(0xFF070B1A).withValues(alpha: 0.9),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: canOpenProfile
            ? () => onUserTap(activity.username)
            : null,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [Color(0xFFEC4899), Color(0xFF8B5CF6)],
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(2),
                  child: CircleAvatar(
                    backgroundColor: const Color(0xFF0B071C),
                    backgroundImage: userPhoto.isNotEmpty
                        ? NetworkImage(userPhoto)
                        : null,
                    child: userPhoto.isEmpty
                        ? Text(
                            activity.userDisplayName.characters.first
                                .toUpperCase(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                            ),
                          )
                        : null,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      activity.userDisplayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFF8B5CF6).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: const Color(
                            0xFFC4B5FD,
                          ).withValues(alpha: 0.2),
                        ),
                      ),
                      child: Text(
                        activity.pollTitle.isNotEmpty
                            ? activity.pollTitle
                            : tr('home.pollFallback'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFFDDD6FE),
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      trp('home.justVotedFor', {'name': activity.artistName}),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.72),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD946EF).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: const Color(0xFFF5D0FE).withValues(alpha: 0.2),
                            ),
                          ),
                          child: Text(
                            trp('home.votesCount', {'count': '${activity.amount}'}),
                            style: const TextStyle(
                              color: Color(0xFFF5D0FE),
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        Text(
                          _formatActivityTime(activity.createdAt),
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.45),
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    colors: [Color(0xFF020617), Color(0xFF312E81)],
                  ),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.15),
                  ),
                ),
                clipBehavior: Clip.antiAlias,
                child: artistPhoto.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: artistPhoto,
                        fit: BoxFit.cover,
                        errorWidget: (_, _, _) => Center(
                          child: Text(
                            activity.artistName.characters.first.toUpperCase(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 20,
                            ),
                          ),
                        ),
                      )
                    : Center(
                        child: Text(
                          activity.artistName.characters.first.toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 20,
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

class _LatestNewsSection extends StatelessWidget {
  const _LatestNewsSection({
    required this.newsItems,
    required this.onViewAllTap,
    required this.onOpenArticle,
  });

  final List<NewsItem> newsItems;
  final VoidCallback onViewAllTap;
  final Future<void> Function(String url) onOpenArticle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 28, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr('home.news'),
                      style: const TextStyle(
                        color: Color(0xFF67E8F9),
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2.8,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      tr('home.musicMundial'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: onViewAllTap,
                child: Text(
                  tr('home.seeMore'),
                  style: const TextStyle(
                    color: Color(0xFFC4B5FD),
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            height: 390,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: newsItems.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, index) {
                final item = newsItems[index];
                return SizedBox(
                  width: MediaQuery.sizeOf(context).width * 0.88,
                  height: 390,
                  child: NewsCard(
                    item: item,
                    compact: true,
                    imageHeight: 156,
                    onTap: () => onOpenArticle(item.link),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeEmptyPanel extends StatelessWidget {
  const _HomeEmptyPanel({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.description,
    this.compact = false,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String description;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(compact ? 20 : 28),
      decoration: BoxDecoration(
        color: const Color(0xFF090B19).withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(compact ? 20 : 28),
        border: Border.all(
          color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
        ),
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(compact ? 20 : 28),
                gradient: RadialGradient(
                  center: Alignment.topCenter,
                  radius: 1.2,
                  colors: [
                    const Color(0xFFD946EF).withValues(alpha: 0.12),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Column(
            children: [
              Container(
                width: compact ? 56 : 64,
                height: compact ? 56 : 64,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: iconColor.withValues(alpha: 0.2)),
                ),
                child: Icon(icon, color: iconColor, size: compact ? 26 : 30),
              ),
              SizedBox(height: compact ? 14 : 18),
              Text(
                title.toUpperCase(),
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: compact ? 17 : 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                description,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.55),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  height: 1.45,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TopRankingCard extends StatelessWidget {
  const _TopRankingCard({
    required this.entry,
    required this.accentColors,
    required this.borderColor,
    required this.onTap,
  });

  final _WeeklyTopArtist entry;
  final List<Color> accentColors;
  final Color borderColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final imageUrl = resolveArtistAvatarUrl(entry.artist);
    final cardHeight = entry.featured ? 430.0 : 390.0;
    final photoHeight = entry.featured ? 300.0 : 250.0;

    return SizedBox(
      width: MediaQuery.sizeOf(context).width * 0.88,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(24),
          child: Ink(
            height: cardHeight,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: borderColor),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.4),
                  blurRadius: 24,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  height: photoHeight,
                  child: ClipRRect(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(24),
                    ),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: accentColors,
                            ),
                          ),
                        ),
                        if (imageUrl.isNotEmpty)
                          CachedNetworkImage(
                            imageUrl: imageUrl,
                            fit: BoxFit.cover,
                            alignment: Alignment.topCenter,
                            errorWidget: (_, _, _) => Center(
                              child: Text(
                                entry.artist.name.characters.first
                                    .toUpperCase(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 48,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          )
                        else
                          Center(
                            child: Text(
                              entry.artist.name.characters.first.toUpperCase(),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 48,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                        DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.white.withValues(alpha: 0.04),
                                Colors.black.withValues(alpha: 0.42),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Transform.translate(
                      offset: const Offset(0, -24),
                      child: Container(
                        width: 58,
                        height: 58,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(colors: accentColors),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.35),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(
                                0xFFA855F7,
                              ).withValues(alpha: 0.65),
                              blurRadius: 22,
                            ),
                          ],
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '${entry.rank}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.92),
                          Colors.black.withValues(alpha: 0.65),
                          Colors.transparent,
                        ],
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          entry.artist.name.toUpperCase(),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                            height: 1,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          entry.artist.group.isNotEmpty
                              ? entry.artist.group.toUpperCase()
                              : tr('home.noGroup'),
                          style: const TextStyle(
                            color: Color(0xFFF5D0FE),
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.6,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(
                              child: _TopRankingStat(
                                value: _formatNumber(
                                  entry.artist.followersCount,
                                ),
                                label: tr('home.followers'),
                                valueColor: entry.rank == 1
                                    ? const Color(0xFFFCD34D)
                                    : const Color(0xFFDDD6FE),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _TopRankingStat(
                                value: _formatNumber(entry.pollVotes),
                                label: tr('home.votes'),
                                valueColor: entry.rank == 1
                                    ? const Color(0xFFF5D0FE)
                                    : const Color(0xFFA5F3FC),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TopRankingStat extends StatelessWidget {
  const _TopRankingStat({
    required this.value,
    required this.label,
    required this.valueColor,
  });

  final String value;
  final String label;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              color: valueColor,
              fontSize: 22,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.55),
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
            ),
          ),
        ],
      ),
    );
  }
}

class _GradientButton extends StatelessWidget {
  const _GradientButton({
    required this.label,
    required this.onTap,
    this.compact = false,
  });

  final String label;
  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final height = compact ? 46.0 : 52.0;

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF8B5CF6), Color(0xFFEC4899)],
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFEC4899).withValues(alpha: 0.25),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: SizedBox(
            height: height,
            child: Center(
              child: Text(
                label.toUpperCase(),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.6,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HomeLoadingView extends StatelessWidget {
  const _HomeLoadingView();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      children: const [
        _HomeSkeleton(height: 500, radius: 0),
        SizedBox(height: 24),
        _HomeSkeleton(height: 28, width: 180),
        SizedBox(height: 10),
        _HomeSkeleton(height: 36, width: 220),
        SizedBox(height: 18),
        _HomeSkeleton(height: 380),
        SizedBox(height: 28),
        _HomeSkeleton(height: 28, width: 180),
        SizedBox(height: 18),
        _HomeSkeleton(height: 380),
        SizedBox(height: 28),
        _HomeSkeleton(height: 28, width: 160),
        SizedBox(height: 18),
        _HomeSkeleton(height: 320),
      ],
    );
  }
}

class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton({required this.height, this.width, this.radius = 24});

  final double height;
  final double? width;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width ?? double.infinity,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: LinearGradient(
          colors: [
            Colors.white.withValues(alpha: 0.05),
            Colors.white.withValues(alpha: 0.09),
            Colors.white.withValues(alpha: 0.05),
          ],
        ),
      ),
    );
  }
}

class _HomeStateMessage extends StatelessWidget {
  const _HomeStateMessage({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          Icon(icon, size: 56, color: const Color(0xFFCBD5E1)),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFFCBD5E1),
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

String _formatNumber(int value) {
  final text = value.toString();
  final buffer = StringBuffer();

  for (var index = 0; index < text.length; index++) {
    buffer.write(text[index]);
    final remaining = text.length - index - 1;
    if (remaining > 0 && remaining % 3 == 0) {
      buffer.write('.');
    }
  }

  return buffer.toString();
}

String _formatActivityTime(DateTime? createdAt) {
  if (createdAt == null) {
    return tr('home.timeNow');
  }

  final seconds = DateTime.now()
      .difference(createdAt)
      .inSeconds
      .clamp(0, 999999);
  if (seconds < 60) {
    return trp('home.timeSecondsAgo', {'count': seconds == 0 ? 1 : seconds});
  }

  final minutes = seconds ~/ 60;
  if (minutes < 60) {
    return trp('home.timeMinutesAgo', {'count': minutes});
  }

  final hours = minutes ~/ 60;
  if (hours < 24) {
    return trp('home.timeHoursAgo', {'count': hours});
  }

  return trp('home.timeDaysAgo', {'count': hours ~/ 24});
}
