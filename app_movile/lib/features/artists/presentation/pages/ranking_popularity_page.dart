import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';
import '../../../../core/ads/banner_ad_widget.dart';
import '../../../auth/data/auth_service.dart';
import '../../data/artist.dart';
import '../../data/artists_api.dart';
import '../widgets/artist_avatar.dart';
import 'artist_profile_page.dart';

class RankingPopularityPage extends StatefulWidget {
  const RankingPopularityPage({required this.authService, super.key});

  final AuthService authService;

  @override
  State<RankingPopularityPage> createState() => _RankingPopularityPageState();
}

class _RankingPopularityPageState extends State<RankingPopularityPage> {
  late final ArtistsApi _artistsApi;
  late Future<List<_RankedArtist>> _rankingFuture;

  @override
  void initState() {
    super.initState();
    _artistsApi = ArtistsApi(widget.authService.client);
    _rankingFuture = _loadRanking();
  }

  Future<List<_RankedArtist>> _loadRanking() async {
    final artists = await _artistsApi.getPopularityRanking(limit: 50);
    return _RankedArtist.fromArtists(artists);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<_RankedArtist>>(
      future: _rankingFuture,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return _RankingStateMessage(
            icon: Icons.error_outline_rounded,
            title: tr('catalog.rankingLoadError'),
          );
        }

        if (!snapshot.hasData) {
          return const _RankingLoadingView();
        }

        final rankedArtists = snapshot.data!;
        final topThree = rankedArtists.take(3).toList(growable: false);

        if (rankedArtists.isEmpty) {
          return const _RankingEmptyState();
        }

        final totalVotes = rankedArtists.fold<int>(
          0,
          (total, artist) => total + artist.artist.totalVotes,
        );
        final maxScore = rankedArtists
            .map((artist) => artist.artist.popularityScore)
            .reduce((a, b) => a > b ? a : b);

        return CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: _RankingHeroCard(
                  artistCount: rankedArtists.length,
                  totalVotes: totalVotes,
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(top: 20),
                child: _TopThreeCarousel(
                  artists: topThree,
                  maxScore: maxScore,
                  onArtistTap: _openProfile,
                ),
              ),
            ),
            const SliverToBoxAdapter(child: BannerAdWidget()),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: _FullChartSection(
                  artists: rankedArtists,
                  maxScore: maxScore,
                  onArtistTap: _openProfile,
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 96)),
          ],
        );
      },
    );
  }

  void _openProfile(Artist artist) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ArtistProfilePage(
          artist: artist,
          authService: widget.authService,
        ),
      ),
    );
  }
}

class _FullChartSection extends StatefulWidget {
  const _FullChartSection({
    required this.artists,
    required this.maxScore,
    required this.onArtistTap,
  });

  final List<_RankedArtist> artists;
  final int maxScore;
  final ValueChanged<Artist> onArtistTap;

  @override
  State<_FullChartSection> createState() => _FullChartSectionState();
}

class _FullChartSectionState extends State<_FullChartSection> {
  static const _pageSize = 10;

  int _visibleCount = _pageSize;

  @override
  void didUpdateWidget(covariant _FullChartSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.artists.length != widget.artists.length) {
      _visibleCount = _pageSize;
    }
  }

  void _loadMore() {
    setState(() {
      _visibleCount = (_visibleCount + _pageSize).clamp(0, widget.artists.length);
    });
  }

  @override
  Widget build(BuildContext context) {
    final visibleArtists = widget.artists.take(_visibleCount).toList(growable: false);
    final hasMore = _visibleCount < widget.artists.length;
    final showingLabel = trp('catalog.rankingShowing', {
      'shown': visibleArtists.length,
      'total': widget.artists.length,
    });

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF080A18).withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    tr('catalog.rankingFullChart'),
                    style: const TextStyle(
                      color: Color(0xFFF0ABFC),
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2.4,
                    ),
                  ),
                ),
                Text(
                  showingLabel,
                  style: const TextStyle(
                    color: Color(0xFF64748B),
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          for (var index = 0; index < visibleArtists.length; index++)
            _RankingChartRow(
              ranked: visibleArtists[index],
              maxScore: widget.maxScore,
              showDivider: index < visibleArtists.length - 1 || hasMore,
              onTap: () => widget.onArtistTap(visibleArtists[index].artist),
            ),
          if (hasMore)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: SizedBox(
                width: double.infinity,
                height: 46,
                child: OutlinedButton(
                  onPressed: _loadMore,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFF0ABFC),
                    side: BorderSide(
                      color: const Color(0xFFF0ABFC).withValues(alpha: 0.35),
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                  child: Text(
                    trp('catalog.rankingLoadMore', {
                      'count': widget.artists.length - _visibleCount,
                    }),
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _RankedArtist {
  const _RankedArtist({
    required this.artist,
    required this.rank,
    required this.lastWeekRank,
    required this.peakPosition,
    required this.weeksOnChart,
    required this.accent,
  });

  final Artist artist;
  final int rank;
  final String lastWeekRank;
  final int peakPosition;
  final int weeksOnChart;
  final _RankingAccent accent;

  static List<_RankedArtist> fromArtists(List<Artist> artists) {
    final sorted = [...artists]
      ..sort((current, next) {
        final byScore = next.popularityScore.compareTo(current.popularityScore);
        if (byScore != 0) return byScore;

        final byVotes = next.totalVotes.compareTo(current.totalVotes);
        if (byVotes != 0) return byVotes;

        final byFollowers = next.followersCount.compareTo(current.followersCount);
        if (byFollowers != 0) return byFollowers;

        return current.name.compareTo(next.name);
      });

    return sorted.asMap().entries.map((entry) {
      final index = entry.key;
      final artist = entry.value;

      return _RankedArtist(
        artist: artist,
        rank: index + 1,
        lastWeekRank: tr('catalog.rankingNew'),
        peakPosition: index + 1,
        weeksOnChart: 1,
        accent: _RankingAccent.forIndex(index),
      );
    }).toList(growable: false);
  }
}

class _RankingAccent {
  const _RankingAccent({
    required this.ring,
    required this.text,
    required this.bar,
  });

  final Color ring;
  final Color text;
  final List<Color> bar;

  static _RankingAccent forIndex(int index) {
    const accents = [
      _RankingAccent(
        ring: Color(0xFFFCD34D),
        text: Color(0xFFFDE68A),
        bar: [Color(0xFFFCD34D), Color(0xFFF472B6), Color(0xFFD946EF)],
      ),
      _RankingAccent(
        ring: Color(0xFF67E8F9),
        text: Color(0xFFA5F3FC),
        bar: [Color(0xFF67E8F9), Color(0xFF38BDF8), Color(0xFF8B5CF6)],
      ),
      _RankingAccent(
        ring: Color(0xFFFB923C),
        text: Color(0xFFFDBA74),
        bar: [Color(0xFFFB923C), Color(0xFFFB7185), Color(0xFFEC4899)],
      ),
    ];

    return accents[index % accents.length];
  }
}

class _RankingHeroCard extends StatelessWidget {
  const _RankingHeroCard({
    required this.artistCount,
    required this.totalVotes,
  });

  final int artistCount;
  final int totalVotes;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFF060713),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: const Color(0xFFF0ABFC).withValues(alpha: 0.15),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4A044E).withValues(alpha: 0.25),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Stack(
          children: [
            Positioned(
              right: -60,
              top: -60,
              child: Container(
                width: 180,
                height: 180,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFD946EF).withValues(alpha: 0.18),
                ),
              ),
            ),
            Positioned(
              left: 16,
              bottom: -70,
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF22D3EE).withValues(alpha: 0.08),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    tr('catalog.rankingBillboardStyle'),
                    style: const TextStyle(
                      color: Color(0xFFFCD34D),
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2.8,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    tr('catalog.rankingTitle'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 34,
                      fontWeight: FontWeight.w900,
                      height: 0.95,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    tr('catalog.rankingHeroSubtitle'),
                    style: const TextStyle(
                      color: Color(0xFFCBD5E1),
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      height: 1.55,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFCD34D).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(99),
                      border: Border.all(
                        color: const Color(0xFFFCD34D).withValues(alpha: 0.25),
                      ),
                    ),
                    child: Text(
                      _currentChartWeekLabel(),
                      style: const TextStyle(
                        color: Color(0xFFFEF3C7),
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          tr('catalog.rankingChartMetrics'),
                          style: const TextStyle(
                            color: Color(0xFFF5D0FE),
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 2,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(
                              child: _MetricTile(
                                label: tr('catalog.rankingMetricArtists'),
                                value: '$artistCount',
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _MetricTile(
                                label: tr('catalog.rankingMetricVotes'),
                                value: _formatRankingCount(totalVotes),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopThreeCarousel extends StatefulWidget {
  const _TopThreeCarousel({
    required this.artists,
    required this.maxScore,
    required this.onArtistTap,
  });

  final List<_RankedArtist> artists;
  final int maxScore;
  final ValueChanged<Artist> onArtistTap;

  @override
  State<_TopThreeCarousel> createState() => _TopThreeCarouselState();
}

class _TopThreeCarouselState extends State<_TopThreeCarousel> {
  static const _carouselHeight = 388.0;

  late final PageController _pageController;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(viewportFraction: 0.88);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _goToPage(int index) {
    if (index < 0 || index >= widget.artists.length) {
      return;
    }

    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.artists.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: _TopThreeHeader(
            selectedIndex: _currentPage,
            onRankSelected: _goToPage,
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: _carouselHeight,
          child: PageView.builder(
            controller: _pageController,
            itemCount: widget.artists.length,
            onPageChanged: (index) => setState(() => _currentPage = index),
            itemBuilder: (context, index) {
              final ranked = widget.artists[index];

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: _FeaturedRankingCard(
                  ranked: ranked,
                  maxScore: widget.maxScore,
                  compact: true,
                  onTap: () => widget.onArtistTap(ranked.artist),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(widget.artists.length, (index) {
            final active = index == _currentPage;

            return AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: active ? 22 : 8,
              height: 8,
              decoration: BoxDecoration(
                color: active
                    ? const Color(0xFFF0ABFC)
                    : Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(99),
              ),
            );
          }),
        ),
      ],
    );
  }
}

class _TopThreeHeader extends StatelessWidget {
  const _TopThreeHeader({
    this.selectedIndex = 0,
    this.onRankSelected,
  });

  final int selectedIndex;
  final ValueChanged<int>? onRankSelected;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                tr('catalog.rankingTop3'),
                style: const TextStyle(
                  color: Color(0xFFFCD34D),
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2.8,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                tr('catalog.rankingHotArtists'),
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ),
        _RankChip(
          label: '#1',
          colors: const [Color(0xFFFCD34D), Color(0xFFF59E0B)],
          selected: selectedIndex == 0,
          onTap: onRankSelected == null ? null : () => onRankSelected!(0),
        ),
        const SizedBox(width: 6),
        _RankChip(
          label: '#2',
          colors: const [Color(0xFFCBD5E1), Color(0xFF94A3B8)],
          selected: selectedIndex == 1,
          onTap: onRankSelected == null ? null : () => onRankSelected!(1),
        ),
        const SizedBox(width: 6),
        _RankChip(
          label: '#3',
          colors: const [Color(0xFFFB923C), Color(0xFFF97316)],
          selected: selectedIndex == 2,
          onTap: onRankSelected == null ? null : () => onRankSelected!(2),
        ),
      ],
    );
  }
}

class _RankChip extends StatelessWidget {
  const _RankChip({
    required this.label,
    required this.colors,
    this.selected = false,
    this.onTap,
  });

  final String label;
  final List<Color> colors;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final chip = AnimatedOpacity(
      duration: const Duration(milliseconds: 200),
      opacity: selected ? 1 : 0.55,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: colors),
          borderRadius: BorderRadius.circular(12),
          border: selected
              ? Border.all(color: Colors.white.withValues(alpha: 0.55), width: 1.5)
              : null,
          boxShadow: [
            BoxShadow(
              color: colors.last.withValues(alpha: selected ? 0.35 : 0.18),
              blurRadius: selected ? 14 : 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Text(
          label,
          style: const TextStyle(
            color: Color(0xFF090B19),
            fontSize: 12,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );

    if (onTap == null) {
      return chip;
    }

    return GestureDetector(onTap: onTap, child: chip);
  }
}

class _RankBadge extends StatelessWidget {
  const _RankBadge({required this.rank});

  final int rank;

  @override
  Widget build(BuildContext context) {
    final colors = switch (rank) {
      1 => const [Color(0xFFFCD34D), Color(0xFFF59E0B)],
      2 => const [Color(0xFFE2E8F0), Color(0xFF94A3B8)],
      3 => const [Color(0xFFFB923C), Color(0xFFF97316)],
      _ => [Colors.white.withValues(alpha: 0.2), Colors.white.withValues(alpha: 0.08)],
    };

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: rank <= 3 ? 16 : 14,
        vertical: rank <= 3 ? 10 : 8,
      ),
      decoration: BoxDecoration(
        gradient: rank <= 3 ? LinearGradient(colors: colors) : null,
        color: rank <= 3 ? null : Colors.black.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(
          color: rank <= 3
              ? Colors.white.withValues(alpha: 0.35)
              : Colors.white.withValues(alpha: 0.2),
        ),
        boxShadow: rank <= 3
            ? [
                BoxShadow(
                  color: colors.last.withValues(alpha: 0.35),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ]
            : null,
      ),
      child: Text(
        '#$rank',
        style: TextStyle(
          color: rank <= 3 ? const Color(0xFF090B19) : Colors.white,
          fontWeight: FontWeight.w900,
          fontSize: rank <= 3 ? 16 : 13,
          letterSpacing: 1,
        ),
      ),
    );
  }
}

class _RankingLoadingView extends StatelessWidget {
  const _RankingLoadingView();

  static const _carouselHeight = _TopThreeCarouselState._carouselHeight;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: _SkeletonBox(
              height: 320,
              borderRadius: BorderRadius.circular(28),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: _TopThreeHeader(),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: _carouselHeight,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      SizedBox(
                        width: MediaQuery.sizeOf(context).width * 0.88,
                        child: const _FeaturedRankingCardSkeleton(rank: 1),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
            child: Column(
              children: [
                for (var index = 0; index < 5; index++) ...[
                  _ChartRowSkeleton(showDivider: index < 4),
                ],
              ],
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 96)),
      ],
    );
  }
}

class _FeaturedRankingCardSkeleton extends StatelessWidget {
  const _FeaturedRankingCardSkeleton({required this.rank});

  final int rank;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF090B19),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 168,
            child: Stack(
              children: [
                const _SkeletonBox(height: 168),
                Positioned(
                  left: 16,
                  top: 16,
                  child: _RankBadge(rank: rank),
                ),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 16,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      _SkeletonBox(
                        width: 80,
                        height: 80,
                        borderRadius: BorderRadius.circular(24),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            _SkeletonBox(height: 10, width: 72),
                            SizedBox(height: 8),
                            _SkeletonBox(height: 22, width: double.infinity),
                            SizedBox(height: 8),
                            _SkeletonBox(height: 12, width: 120),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: const [
                Row(
                  children: [
                    Expanded(
                      child: _SkeletonBox(height: 48),
                    ),
                    SizedBox(width: 12),
                    _SkeletonBox(height: 36, width: 96),
                  ],
                ),
                SizedBox(height: 14),
                _SkeletonBox(height: 8),
                SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(child: _SkeletonBox(height: 64)),
                    SizedBox(width: 10),
                    Expanded(child: _SkeletonBox(height: 64)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ChartRowSkeleton extends StatelessWidget {
  const _ChartRowSkeleton({required this.showDivider});

  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        border: showDivider
            ? Border(
                bottom: BorderSide(color: Colors.white.withValues(alpha: 0.06)),
              )
            : null,
      ),
      child: Column(
        children: const [
          Row(
            children: [
              _SkeletonBox(height: 28, width: 40),
              SizedBox(width: 12),
              _SkeletonBox(height: 56, width: 56, borderRadius: BorderRadius.all(Radius.circular(16))),
              SizedBox(width: 12),
              Expanded(child: _SkeletonBox(height: 42)),
              SizedBox(width: 12),
              _SkeletonBox(height: 36, width: 56),
            ],
          ),
          SizedBox(height: 10),
          _SkeletonBox(height: 8),
        ],
      ),
    );
  }
}

class _SkeletonBox extends StatelessWidget {
  const _SkeletonBox({
    this.height,
    this.width,
    this.borderRadius = const BorderRadius.all(Radius.circular(12)),
  });

  final double? height;
  final double? width;
  final BorderRadius borderRadius;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: width,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: borderRadius,
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: Color(0xFF64748B),
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _FeaturedRankingCard extends StatelessWidget {
  const _FeaturedRankingCard({
    required this.ranked,
    required this.maxScore,
    required this.onTap,
    this.compact = false,
  });

  final _RankedArtist ranked;
  final int maxScore;
  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final artist = ranked.artist;
    final groupLabel = artist.group.isEmpty ? tr('catalog.noGroup') : artist.group;
    final bannerUrl = resolveArtistBanner(artist);
    final heroHeight = compact ? 168.0 : 220.0;
    final avatarSize = compact ? 64.0 : 80.0;
    final nameSize = compact ? 20.0 : 24.0;
    final scoreSize = compact ? 28.0 : 34.0;
    final bodyPadding = compact ? 14.0 : 16.0;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(28),
        child: Ink(
          decoration: BoxDecoration(
            color: const Color(0xFF090B19),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: ranked.accent.ring.withValues(alpha: 0.45)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF4C1D95).withValues(alpha: 0.2),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: heroHeight,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      CachedNetworkImage(
                        imageUrl: bannerUrl,
                        fit: BoxFit.cover,
                        color: Colors.white.withValues(alpha: 0.7),
                        colorBlendMode: BlendMode.modulate,
                        errorWidget: (context, error, stackTrace) =>
                            const ColoredBox(color: Color(0xFF4C1D95)),
                      ),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              const Color(0xFF060713).withValues(alpha: 0.92),
                            ],
                          ),
                        ),
                      ),
                      Positioned(
                        left: 16,
                        top: 16,
                        child: _RankBadge(rank: ranked.rank),
                      ),
                      Positioned(
                        left: 16,
                        right: 16,
                        bottom: 16,
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            ArtistAvatar(
                              artist: artist,
                              size: avatarSize,
                              radius: compact ? 20 : 24,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    tr('catalog.rankingHotArtist'),
                                    style: TextStyle(
                                      color: ranked.accent.text,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 2,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    artist.name.toUpperCase(),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: nameSize,
                                      fontWeight: FontWeight.w900,
                                      height: 1,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    groupLabel.toUpperCase(),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Color(0xFFF5D0FE),
                                      fontSize: 12,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 1,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: EdgeInsets.all(bodyPadding),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  tr('catalog.rankingPopularityScore'),
                                  style: const TextStyle(
                                    color: Color(0xFF64748B),
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1.2,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _formatRankingCount(artist.popularityScore),
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: scoreSize,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: EdgeInsets.symmetric(
                              horizontal: compact ? 10 : 12,
                              vertical: compact ? 6 : 8,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: Text(
                              trp('catalog.votesCount', {
                                'count': _formatRankingCount(artist.totalVotes),
                              }),
                              style: const TextStyle(
                                color: Color(0xFFCBD5E1),
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: compact ? 10 : 14),
                      _RankingProgressBar(
                        value: artist.popularityScore,
                        maxValue: maxScore,
                        colors: ranked.accent.bar,
                      ),
                      SizedBox(height: compact ? 10 : 14),
                      Row(
                        children: [
                          Expanded(
                            child: _MiniStat(
                              label: tr('catalog.followers'),
                              value: _formatRankingCount(artist.followersCount),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _MiniStat(
                              label: tr('catalog.rankingLastWeek'),
                              value: ranked.lastWeekRank,
                            ),
                          ),
                        ],
                      ),
                      if (!compact) ...[
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: _MiniStat(
                                label: tr('catalog.rankingPeak'),
                                value: '#${ranked.peakPosition}',
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _MiniStat(
                                label: tr('catalog.rankingWeeks'),
                                value: '${ranked.weeksOnChart}',
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
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

class _RankingChartRow extends StatelessWidget {
  const _RankingChartRow({
    required this.ranked,
    required this.maxScore,
    required this.showDivider,
    required this.onTap,
  });

  final _RankedArtist ranked;
  final int maxScore;
  final bool showDivider;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final artist = ranked.artist;
    final groupLabel = artist.group.isEmpty ? tr('catalog.noGroup') : artist.group;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          decoration: BoxDecoration(
            border: showDivider
                ? Border(
                    bottom: BorderSide(
                      color: Colors.white.withValues(alpha: 0.08),
                    ),
                  )
                : null,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '#${ranked.rank}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(width: 12),
                  ArtistAvatar(artist: artist, size: 56, radius: 16),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          artist.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          trp('catalog.rankingChartRowMeta', {
                            'group': groupLabel,
                            'followers':
                                _formatRankingCount(artist.followersCount),
                            'votes': _formatRankingCount(artist.totalVotes),
                          }),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.4,
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        tr('catalog.rankingScore'),
                        style: const TextStyle(
                          color: Color(0xFF64748B),
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _formatRankingCount(artist.popularityScore),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),
              _RankingProgressBar(
                value: artist.popularityScore,
                maxValue: maxScore,
                colors: ranked.accent.bar,
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  _RowMetric(
                    label: tr('catalog.rankingLast'),
                    value: ranked.lastWeekRank,
                  ),
                  const SizedBox(width: 16),
                  _RowMetric(
                    label: tr('catalog.rankingPeak'),
                    value: '#${ranked.peakPosition}',
                  ),
                  const SizedBox(width: 16),
                  _RowMetric(
                    label: tr('catalog.rankingWeeks'),
                    value: '${ranked.weeksOnChart}',
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RankingProgressBar extends StatelessWidget {
  const _RankingProgressBar({
    required this.value,
    required this.maxValue,
    required this.colors,
  });

  final int value;
  final int maxValue;
  final List<Color> colors;

  @override
  Widget build(BuildContext context) {
    final widthFactor = maxValue <= 0
        ? 0.07
        : (value / maxValue).clamp(0.07, 1.0);

    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: SizedBox(
        height: 8,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ColoredBox(color: Colors.white.withValues(alpha: 0.1)),
            FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: widthFactor,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: colors),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: Color(0xFF94A3B8),
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _RowMetric extends StatelessWidget {
  const _RowMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            color: Color(0xFF64748B),
            fontSize: 9,
            fontWeight: FontWeight.w900,
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _RankingEmptyState extends StatelessWidget {
  const _RankingEmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFF090B19).withValues(alpha: 0.9),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(
              color: const Color(0xFFFCD34D).withValues(alpha: 0.15),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: const Color(0xFFFCD34D).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: const Color(0xFFFCD34D).withValues(alpha: 0.2),
                  ),
                ),
                child: const Icon(
                  Icons.show_chart_rounded,
                  color: Color(0xFFFDE68A),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                tr('catalog.rankingEmptyTitle'),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                tr('catalog.rankingEmptyBody'),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RankingStateMessage extends StatelessWidget {
  const _RankingStateMessage({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(26),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: const Color(0xFFFF4FD8), size: 54),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFFD8D3F7),
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _currentChartWeekLabel() {
  final now = DateTime.now();
  final firstDayOfYear = DateTime(now.year, 1, 1);
  final pastDays = now.difference(firstDayOfYear).inDays;
  final weekNumber = ((pastDays + firstDayOfYear.weekday) / 7).ceil();
  final week = weekNumber.toString().padLeft(2, '0');

  return trp('catalog.rankingWeekLabel', {'year': now.year, 'week': week});
}

String _formatRankingCount(int value) {
  if (value >= 1000000) {
    return '${(value / 1000000).toStringAsFixed(1)}M';
  }

  if (value >= 1000) {
    return '${(value / 1000).toStringAsFixed(1)}K';
  }

  return value.toString();
}
