import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';
import '../../../auth/data/auth_service.dart';
import '../../data/fan_api.dart';
import '../../data/fan_models.dart';
import 'fan_badge.dart';
import '../pages/fan_store_page.dart';

class SupportersBoard extends StatefulWidget {
  const SupportersBoard({
    required this.artistId,
    required this.authService,
    super.key,
  });

  final String artistId;
  final AuthService authService;

  @override
  State<SupportersBoard> createState() => _SupportersBoardState();
}

class _SupportersBoardState extends State<SupportersBoard> {
  late Future<List<ArtistSupporter>> _future;

  @override
  void initState() {
    super.initState();
    _future = FanApi(widget.authService.client).listSupporters(widget.artistId);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                tr('fan.supporters'),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(context, rootNavigator: true).push(
                  MaterialPageRoute(
                    builder: (_) => FanStorePage(
                      authService: widget.authService,
                      preselectedArtistId: widget.artistId,
                    ),
                  ),
                );
              },
              child: Text(tr('fan.supportCta')),
            ),
          ],
        ),
        const SizedBox(height: 8),
        FutureBuilder<List<ArtistSupporter>>(
          future: _future,
          builder: (context, snapshot) {
            if (!snapshot.hasData) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: Center(
                  child: CircularProgressIndicator(color: Color(0xFFFF21C8)),
                ),
              );
            }
            final rows = snapshot.data!;
            if (rows.isEmpty) {
              return Text(
                tr('fan.noSupporters'),
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.55),
                  fontWeight: FontWeight.w600,
                ),
              );
            }
            return Column(
              children: [
                for (var i = 0; i < rows.length; i++)
                  _SupporterTile(
                    rank: i + 1,
                    supporter: rows[i],
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _SupporterTile extends StatelessWidget {
  const _SupporterTile({
    required this.rank,
    required this.supporter,
  });

  final int rank;
  final ArtistSupporter supporter;

  @override
  Widget build(BuildContext context) {
    final gold = supporter.sku == 'MEGA';
    final magenta = supporter.sku == 'SUPER';
    final border = gold
        ? const Color(0xFFFBBF24)
        : magenta
        ? const Color(0xFFE879F9)
        : Colors.white.withValues(alpha: 0.1);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: gold
            ? const Color(0xFFFBBF24).withValues(alpha: 0.08)
            : magenta
            ? const Color(0xFFE879F9).withValues(alpha: 0.08)
            : Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: null,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: border),
            ),
            child: Row(
              children: [
                Text(
                  '#$rank',
                  style: TextStyle(
                    color: gold ? const Color(0xFFFBBF24) : Colors.white70,
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(width: 10),
                CircleAvatar(
                  radius: 18,
                  backgroundColor: const Color(0xFF2A1848),
                  backgroundImage: supporter.photo.isNotEmpty
                      ? CachedNetworkImageProvider(supporter.photo)
                      : null,
                  child: supporter.photo.isEmpty
                      ? Text(
                          supporter.name.isEmpty
                              ? 'F'
                              : supporter.name[0].toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                          ),
                        )
                      : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        supporter.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      FanBadge(sku: supporter.sku, compact: true),
                    ],
                  ),
                ),
                Text(
                  '${supporter.points}',
                  style: const TextStyle(
                    color: Color(0xFFF5D0FE),
                    fontWeight: FontWeight.w900,
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
