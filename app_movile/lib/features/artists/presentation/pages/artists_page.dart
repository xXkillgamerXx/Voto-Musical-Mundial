import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../data/artist.dart';
import 'artist_profile_page.dart';
import '../widgets/artist_avatar.dart';

class ArtistsPage extends StatefulWidget {
  const ArtistsPage({super.key});

  @override
  State<ArtistsPage> createState() => _ArtistsPageState();
}

class _ArtistsPageState extends State<ArtistsPage> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('artists')
          .orderBy('popularityScore', descending: true)
          .limit(50)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return const _ArtistsStateMessage(
            icon: Icons.error_outline_rounded,
            title: 'No se pudieron cargar los artistas.',
          );
        }

        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final artists =
            snapshot.data!.docs
                .map(Artist.fromDoc)
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
                      'Artistas populares de la semana',
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Ranking público por fans. Abre cada perfil para ver popularidad, votos y apoyo del fandom.',
                      style: TextStyle(
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
              const SliverToBoxAdapter(child: SizedBox(height: 16)),
              if (artists.isEmpty)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: _ArtistsStateMessage(
                    icon: Icons.person_search_rounded,
                    title: 'No encontramos artistas con esa búsqueda.',
                  ),
                )
              else
                SliverList.separated(
                  itemCount: artists.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 14),
                  itemBuilder: (context, index) {
                    final artist = artists[index];

                    return _ArtistCard(
                      artist: artist,
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ArtistProfilePage(artist: artist),
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
        labelText: 'Buscar artista',
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
            '$count artistas disponibles',
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

class _ArtistCard extends StatelessWidget {
  const _ArtistCard({required this.artist, required this.onTap});

  final Artist artist;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final followersCount = artist.followersCount;
    final popularityScore = artist.popularityScore > 0
        ? artist.popularityScore
        : followersCount * 10;

    return Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(28),
            child: Ink(
              height: 390,
              decoration: BoxDecoration(
                color: const Color(0xFF090B19).withValues(alpha: 0.92),
                borderRadius: BorderRadius.circular(28),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF7C3AED).withValues(alpha: 0.14),
                    blurRadius: 24,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    DecoratedBox(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF1E1B4B), Color(0xFF701A75)],
                        ),
                      ),
                      child: artist.banner.isEmpty
                          ? const SizedBox.shrink()
                          : Image.network(
                              artist.banner,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) =>
                                  const SizedBox.shrink(),
                            ),
                    ),
                    const Positioned.fill(
                      bottom: 132,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Colors.transparent, Color(0x22080416)],
                          ),
                        ),
                      ),
                    ),
                    const Positioned.fill(
                      top: 150,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Color(0xFF080416), Color(0xFF080416)],
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      right: 18,
                      top: 18,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 9,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.38),
                          borderRadius: BorderRadius.circular(99),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.14),
                          ),
                        ),
                        child: const Text(
                          'POPULAR',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 22,
                      right: 22,
                      bottom: 20,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              ArtistAvatar(
                                artist: artist,
                                size: 74,
                                radius: 22,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      artist.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 28,
                                        fontWeight: FontWeight.w900,
                                        height: 1,
                                      ),
                                    ),
                                    const SizedBox(height: 5),
                                    Text(
                                      artist.group.isEmpty
                                          ? 'Sin grupo'
                                          : artist.group,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: Color(0xFFF0ABFC),
                                        fontSize: 12,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 1.2,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),
                          Text(
                            artist.bio.isEmpty
                                ? 'Perfil público con actividad, fans y popularidad.'
                                : artist.bio,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.76),
                              height: 1.55,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 22),
                          Row(
                            children: [
                              Expanded(
                                child: _ArtistStat(
                                  label: 'Seguidores',
                                  value: _formatCount(followersCount),
                                  color: const Color(0xFF22D3EE),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _ArtistStat(
                                  label: 'Popularidad',
                                  value: _formatCount(popularityScore),
                                  color: const Color(0xFFFBBF24),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Container(
                            height: 38,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF7C3AED), Color(0xFFFF21C8)],
                              ),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Text(
                              'VER PERFIL',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.6,
                              ),
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
  }
}

class _ArtistStat extends StatelessWidget {
  const _ArtistStat({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: color.withValues(alpha: 0.88),
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
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

String _formatCount(int value) {
  if (value >= 1000000) {
    return '${(value / 1000000).toStringAsFixed(1)}M';
  }

  if (value >= 1000) {
    return '${(value / 1000).toStringAsFixed(1)}K';
  }

  return value.toString();
}
