import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../artists/data/artist.dart';
import '../../../artists/presentation/pages/artist_profile_page.dart';
import '../../../artists/presentation/widgets/artist_avatar.dart';
import '../../../../core/widgets/skeleton_box.dart';
import '../../../auth/data/auth_service.dart';
import '../../../home/data/polls_api.dart';
import '../../data/hall_of_fame_api.dart';

class HallOfFameScreen extends StatelessWidget {
  const HallOfFameScreen({required this.authService, super.key});

  final AuthService authService;

  static Future<void> open(
    BuildContext context, {
    required AuthService authService,
  }) {
    return Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => HallOfFameScreen(authService: authService),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF050213), Color(0xFF09061B), Color(0xFF120A2B)],
        ),
      ),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          surfaceTintColor: Colors.transparent,
          foregroundColor: Colors.white,
          title: const Text(
            'Salón de la fama',
            style: TextStyle(fontWeight: FontWeight.w900),
          ),
        ),
        body: HallOfFamePage(authService: authService),
      ),
    );
  }
}

class HallOfFamePage extends StatefulWidget {
  const HallOfFamePage({required this.authService, super.key});

  final AuthService authService;

  @override
  State<HallOfFamePage> createState() => _HallOfFamePageState();
}

class _HallOfFamePageState extends State<HallOfFamePage> {
  late final HallOfFameApi _hallOfFameApi;
  late Future<List<HallOfFameYearGroup>> _groupsFuture;

  @override
  void initState() {
    super.initState();
    _hallOfFameApi = HallOfFameApi(PollsApi(widget.authService.client));
    _groupsFuture = _hallOfFameApi.loadWinners();
  }

  void _openArtist(Artist artist) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ArtistProfilePage(
          artist: artist,
          authService: widget.authService,
        ),
      ),
    );
  }

  Future<void> _openPoll(HallOfFameEntry entry) async {
    final year = entry.year ?? entry.poll.year;
    final slug = entry.poll.slug.isNotEmpty ? entry.poll.slug : entry.poll.id;
    final uri = Uri.parse('https://vote.musicmundial.com/votacion/$year/$slug');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<HallOfFameYearGroup>>(
      future: _groupsFuture,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return const _HallOfFameMessage(
            icon: Icons.error_outline_rounded,
            title: 'No se pudo cargar el salón de la fama.',
          );
        }

        if (!snapshot.hasData) {
          return const HallOfFameLoadingView();
        }

        final groups = snapshot.data!;
        if (groups.isEmpty) {
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
            children: const [
              _HallOfFameHero(),
              SizedBox(height: 18),
              _HallOfFameEmptyState(),
            ],
          );
        }

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
          children: [
            const _HallOfFameHero(),
            const SizedBox(height: 18),
            for (final group in groups) ...[
              _HallOfFameYearSection(
                group: group,
                onArtistTap: _openArtist,
                onPollTap: _openPoll,
              ),
              const SizedBox(height: 18),
            ],
          ],
        );
      },
    );
  }
}

class _HallOfFameHero extends StatelessWidget {
  const _HallOfFameHero();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF080A18),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(0xFFFCD34D).withValues(alpha: 0.25),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF78350F).withValues(alpha: 0.18),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            right: -24,
            top: -24,
            child: Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFFBBF24).withValues(alpha: 0.14),
              ),
            ),
          ),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'GANADORES',
                style: TextStyle(
                  color: Color(0xFFFDE68A),
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2.4,
                ),
              ),
              SizedBox(height: 8),
              Text(
                'Salón de la fama',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  height: 1,
                ),
              ),
              SizedBox(height: 8),
              Text(
                'Artistas que llegaron al primer lugar en votaciones finalizadas.',
                style: TextStyle(
                  color: Color(0xFFCBD5E1),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HallOfFameYearSection extends StatelessWidget {
  const _HallOfFameYearSection({
    required this.group,
    required this.onArtistTap,
    required this.onPollTap,
  });

  final HallOfFameYearGroup group;
  final ValueChanged<Artist> onArtistTap;
  final ValueChanged<HallOfFameEntry> onPollTap;

  @override
  Widget build(BuildContext context) {
    final yearLabel = group.year?.toString() ?? 'Historial';
    final count = group.entries.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'AÑO',
                    style: TextStyle(
                      color: Color(0xFFFDE68A),
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    yearLabel,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFFBBF24).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: const Color(0xFFFCD34D).withValues(alpha: 0.2),
                ),
              ),
              child: Text(
                '$count GANADORES',
                style: const TextStyle(
                  color: Color(0xFFFEF3C7),
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.6,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        for (var index = 0; index < group.entries.length; index++) ...[
          if (index > 0) const SizedBox(height: 12),
          _HallOfFameWinnerCard(
            entry: group.entries[index],
            rank: index + 1,
            onArtistTap: () => onArtistTap(group.entries[index].artist),
            onPollTap: () => onPollTap(group.entries[index]),
          ),
        ],
      ],
    );
  }
}

class _HallOfFameWinnerCard extends StatelessWidget {
  const _HallOfFameWinnerCard({
    required this.entry,
    required this.rank,
    required this.onArtistTap,
    required this.onPollTap,
  });

  final HallOfFameEntry entry;
  final int rank;
  final VoidCallback onArtistTap;
  final VoidCallback onPollTap;

  @override
  Widget build(BuildContext context) {
    final imageUrl = resolveArtistBanner(entry.artist);

    return Material(
      color: Colors.transparent,
      clipBehavior: Clip.antiAlias,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        onTap: onArtistTap,
        borderRadius: BorderRadius.circular(22),
        child: Ink(
          height: 240,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: const Color(0xFFFCD34D).withValues(alpha: 0.18),
            ),
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      const Color(0xFFFBBF24).withValues(alpha: 0.24),
                      const Color(0xFFD946EF).withValues(alpha: 0.16),
                      const Color(0xFF020617),
                    ],
                  ),
                ),
              ),
              if (imageUrl.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(22),
                  child: CachedNetworkImage(
                    imageUrl: imageUrl,
                    fit: BoxFit.cover,
                    alignment: Alignment.topCenter,
                    errorWidget: (_, _, _) => const SizedBox.shrink(),
                  ),
                ),
              DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.08),
                      const Color(0xFF080A18).withValues(alpha: 0.88),
                      const Color(0xFF080A18).withValues(alpha: 0.98),
                    ],
                    stops: const [0.0, 0.55, 1.0],
                  ),
                ),
              ),
              Positioned(
                left: 12,
                top: 12,
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    color: const Color(0xFFFBBF24).withValues(alpha: 0.22),
                    border: Border.all(
                      color: const Color(0xFFFCD34D).withValues(alpha: 0.35),
                    ),
                  ),
                  child: Center(
                    child: Text(
                      '#$rank',
                      style: const TextStyle(
                        color: Color(0xFFFEF3C7),
                        fontWeight: FontWeight.w900,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 14,
                right: 14,
                bottom: 14,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.categoryTitle.toUpperCase(),
                      style: const TextStyle(
                        color: Color(0xFFFDE68A),
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      entry.artist.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        height: 1.05,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      entry.poll.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.72),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 10),
                    GestureDetector(
                      onTap: onPollTap,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFD946EF).withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: const Color(0xFFF0ABFC).withValues(alpha: 0.28),
                          ),
                        ),
                        child: const Text(
                          'VER VOTACIÓN',
                          style: TextStyle(
                            color: Color(0xFFF5D0FE),
                            fontWeight: FontWeight.w900,
                            fontSize: 10,
                            letterSpacing: 0.4,
                          ),
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
    );
  }
}

class _HallOfFameEmptyState extends StatelessWidget {
  const _HallOfFameEmptyState();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF090B19).withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: const Color(0xFFFCD34D).withValues(alpha: 0.15),
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              color: const Color(0xFFFBBF24).withValues(alpha: 0.12),
              border: Border.all(
                color: const Color(0xFFFCD34D).withValues(alpha: 0.2),
              ),
            ),
            child: const Icon(
              Icons.workspace_premium_rounded,
              color: Color(0xFFFDE68A),
              size: 30,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'SALÓN DE LA FAMA EN PREPARACIÓN',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Cuando una votación cerrada tenga ganador, aparecerá aquí como parte del historial oficial.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.55),
              fontWeight: FontWeight.w600,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}

class _HallOfFameMessage extends StatelessWidget {
  const _HallOfFameMessage({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: const Color(0xFFFDE68A), size: 42),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFFCBD5E1),
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
