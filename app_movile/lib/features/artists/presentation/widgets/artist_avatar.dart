import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/api/api_config.dart';
import '../../data/artist.dart';

const defaultArtistBanner =
    'https://vote.musicmundial.com/uploads/admin/artist-banner/1782781525589-ceb83658-97de-42f4-9471-f0902c29c1c5.png';

String resolveArtistBanner(Artist artist) {
  final banner = resolveArtistMediaUrl(artist.banner);
  return banner.isNotEmpty ? banner : defaultArtistBanner;
}

String resolveArtistMediaUrl(String url) {
  if (url.isEmpty) {
    return '';
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  final origin = ApiConfig.uploadsOrigin;
  if (url.startsWith('/')) {
    return '$origin$url';
  }

  return '$origin/$url';
}

class ArtistAvatar extends StatelessWidget {
  const ArtistAvatar({
    required this.artist,
    this.size = 88,
    this.radius = 26,
    super.key,
  });

  final Artist artist;
  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final imageUrl = resolveArtistMediaUrl(artist.image);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF7C3AED), Color(0xFFFF21C8)],
        ),
        borderRadius: BorderRadius.circular(radius),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFF21C8).withValues(alpha: 0.24),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(2),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(radius - 2),
          child: imageUrl.isEmpty
              ? _ArtistInitial(name: artist.name)
              : CachedNetworkImage(
                  imageUrl: imageUrl,
                  fit: BoxFit.cover,
                  placeholder: (_, _) => _ArtistInitial(name: artist.name),
                  errorWidget: (_, _, _) => _ArtistInitial(name: artist.name),
                ),
        ),
      ),
    );
  }
}

class _ArtistInitial extends StatelessWidget {
  const _ArtistInitial({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        name.characters.firstOrNull ?? 'A',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 28,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}
