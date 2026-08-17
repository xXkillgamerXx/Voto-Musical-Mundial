import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/ads/admob_config.dart';
import '../../../../core/ads/banner_ad_widget.dart';
import '../../../../core/ads/interstitial_ad_service.dart';
import '../../../../core/ads/native_ad_widget.dart';
import '../../../../core/i18n/tr.dart';
import '../../../../core/widgets/skeleton_box.dart';
import '../../../auth/data/auth_service.dart';
import '../../data/artist.dart';
import '../../data/artists_api.dart';
import 'artist_profile_page.dart';
import '../widgets/artist_card.dart';

class ArtistsPage extends StatefulWidget {
  const ArtistsPage({required this.authService, super.key});

  final AuthService authService;

  @override
  State<ArtistsPage> createState() => _ArtistsPageState();
}

class _ArtistsPageState extends State<ArtistsPage> {
  final _searchController = TextEditingController();
  String _query = '';
  late final ArtistsApi _artistsApi;
  late Future<List<Artist>> _artistsFuture;

  @override
  void initState() {
    super.initState();
    _artistsApi = ArtistsApi(widget.authService.client);
    _artistsFuture = _artistsApi.getPopularityRanking(limit: 50);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_maybeShowInterstitial());
    });
  }

  Future<void> _maybeShowInterstitial() async {
    if (!mounted || !AdMobConfig.adsEnabled) return;
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (!mounted) return;
    await InterstitialAdService.showIfAvailable();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<_ArtistsFeedSlot> _buildSlots(List<Artist> artists) {
    if (artists.isEmpty) return const [];
    final slots = <_ArtistsFeedSlot>[];
    final bannerEvery =
        AdMobConfig.adsEnabled ? AdMobConfig.bannerEveryNArtists : 0;
    final nativeEvery =
        AdMobConfig.nativeAdsEnabled ? AdMobConfig.nativeEveryNArtists : 0;
    var nativeCount = 0;

    for (var i = 0; i < artists.length; i++) {
      slots.add(_ArtistsFeedSlot.artist(i));
      final n = i + 1;
      final isLast = i == artists.length - 1;
      if (isLast) continue;
      if (nativeEvery > 0 && n % nativeEvery == 0) {
        slots.add(const _ArtistsFeedSlot.native());
        nativeCount++;
      } else if (bannerEvery > 0 && n % bannerEvery == 0) {
        slots.add(const _ArtistsFeedSlot.banner());
      }
    }

    // Con pocas cards nunca llega al "cada N": garantiza al menos 1 nativo.
    if (nativeEvery > 0 && nativeCount == 0) {
      slots.insert(1, const _ArtistsFeedSlot.native());
    }
    return slots;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Artist>>(
      future: _artistsFuture,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return _ArtistsStateMessage(
            icon: Icons.error_outline_rounded,
            title: tr('catalog.artistsLoadError'),
          );
        }

        if (!snapshot.hasData) {
          return const ArtistsLoadingView();
        }

        final artists = snapshot.data!
            .where(_matchesQuery)
            .toList()
          ..sort((current, next) {
            final popularity = next.followersCount.compareTo(
              current.followersCount,
            );

            if (popularity != 0) {
              return popularity;
            }

            return current.name.compareTo(next.name);
          });

        final slots = _buildSlots(artists);

        return Container(
          margin: const EdgeInsets.fromLTRB(18, 0, 18, 0),
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 10),
                    Text(
                      tr('catalog.artistsTitle'),
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      tr('catalog.artistsSubtitle'),
                      style: const TextStyle(
                        color: Color(0xFFB9B2D8),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
              SliverPersistentHeader(
                pinned: true,
                delegate: _ArtistsSearchHeader(
                  controller: _searchController,
                  count: artists.length,
                  onChanged: (value) => setState(() => _query = value),
                  onClear: _query.isEmpty
                      ? null
                      : () {
                          _searchController.clear();
                          setState(() => _query = '');
                        },
                ),
              ),
              const SliverToBoxAdapter(
                child: BannerAdWidget(
                  padding: EdgeInsets.fromLTRB(0, 12, 0, 4),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 12)),
              if (artists.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _ArtistsStateMessage(
                    icon: Icons.person_search_rounded,
                    title: tr('catalog.artistsSearchEmpty'),
                  ),
                )
              else
                SliverList.separated(
                  itemCount: slots.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 14),
                  itemBuilder: (context, index) {
                    final slot = slots[index];
                    if (slot.isNative) {
                      return NativeAdWidget(
                        key: ValueKey('artists-native-$index'),
                        padding: const EdgeInsets.fromLTRB(0, 4, 0, 4),
                      );
                    }
                    if (slot.isBanner) {
                      return BannerAdWidget(
                        key: ValueKey('artists-banner-$index'),
                        padding: const EdgeInsets.fromLTRB(0, 8, 0, 4),
                      );
                    }
                    final artist = artists[slot.artistIndex];
                    return ArtistCard(
                      artist: artist,
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ArtistProfilePage(
                              artist: artist,
                              authService: widget.authService,
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
              const SliverToBoxAdapter(child: SizedBox(height: 96)),
            ],
          ),
        );
      },
    );
  }

  bool _matchesQuery(Artist artist) {
    final normalizedQuery = _query.trim().toLowerCase();

    if (normalizedQuery.isEmpty) {
      return true;
    }

    return [
      artist.name,
      artist.group,
      artist.country,
      artist.role,
      artist.bio,
    ].join(' ').toLowerCase().contains(normalizedQuery);
  }
}

class _ArtistsFeedSlot {
  const _ArtistsFeedSlot.artist(this.artistIndex)
      : isBanner = false,
        isNative = false;
  const _ArtistsFeedSlot.banner()
      : artistIndex = -1,
        isBanner = true,
        isNative = false;
  const _ArtistsFeedSlot.native()
      : artistIndex = -1,
        isBanner = false,
        isNative = true;

  final int artistIndex;
  final bool isBanner;
  final bool isNative;
}

class _ArtistSearchField extends StatelessWidget {
  const _ArtistSearchField({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
      decoration: InputDecoration(
        labelText: tr('catalog.artistsSearchLabel'),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        prefixIcon: const Icon(Icons.search_rounded, size: 22),
        prefixIconConstraints: const BoxConstraints(minWidth: 44),
        suffixIcon: onClear == null
            ? null
            : IconButton(
                onPressed: onClear,
                icon: const Icon(Icons.close_rounded, size: 20),
              ),
      ),
    );
  }
}

class _ArtistsSearchHeader extends SliverPersistentHeaderDelegate {
  const _ArtistsSearchHeader({
    required this.controller,
    required this.count,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final int count;
  final ValueChanged<String> onChanged;
  final VoidCallback? onClear;

  @override
  double get minExtent => 80;

  @override
  double get maxExtent => 80;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Container(
      padding: const EdgeInsets.only(top: 2, bottom: 2),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF050213), Color(0xFF09061B)],
        ),
        boxShadow: overlapsContent
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.35),
                  blurRadius: 18,
                  offset: const Offset(0, 10),
                ),
              ]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ArtistSearchField(
            controller: controller,
            onChanged: onChanged,
            onClear: onClear,
          ),
          const SizedBox(height: 5),
          Text(
            trp('catalog.artistsAvailableCount', {'count': count}),
            style: const TextStyle(
              color: Color(0xFF8E86B9),
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _ArtistsSearchHeader oldDelegate) {
    return controller != oldDelegate.controller ||
        count != oldDelegate.count ||
        onClear != oldDelegate.onClear;
  }
}

class _ArtistsStateMessage extends StatelessWidget {
  const _ArtistsStateMessage({required this.icon, required this.title});

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
