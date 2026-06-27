import 'package:flutter/material.dart';

import '../../data/artist.dart';

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
          child: artist.image.isEmpty
              ? _ArtistInitial(name: artist.name)
              : Image.network(
                  artist.image,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) =>
                      _ArtistInitial(name: artist.name),
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
