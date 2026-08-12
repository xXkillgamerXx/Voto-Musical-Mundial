import 'package:flutter/material.dart';

/// Enlaces oficiales de Music Mundial Awards (app + sitio).
class MusicMundialSocial {
  const MusicMundialSocial({
    required this.id,
    required this.name,
    required this.handle,
    required this.url,
    required this.accent,
    required this.icon,
    this.imageAsset,
  });

  final String id;
  final String name;
  final String handle;
  final String url;
  final Color accent;
  final IconData icon;
  final String? imageAsset;
}

abstract final class MusicMundialSocials {
  static const instagramUrl =
      'https://www.instagram.com/musicmundial_awards/';
  static const tiktokUrl = 'https://www.tiktok.com/@musicmundial_awards';
  static const startlyUrl = 'https://startlyapp.com/musicmundial';
  static const websiteUrl = 'https://www.musicmundial.com/';
  static const feedUrl = 'https://www.musicmundial.com/en/feed/';

  static const List<MusicMundialSocial> followGrid = [
    MusicMundialSocial(
      id: 'instagram',
      name: 'Instagram',
      handle: '@musicmundial_awards',
      url: instagramUrl,
      accent: Color(0xFFE1306C),
      icon: Icons.camera_alt_rounded,
    ),
    MusicMundialSocial(
      id: 'tiktok',
      name: 'TikTok',
      handle: '@musicmundial_awards',
      url: tiktokUrl,
      accent: Color(0xFF25F4EE),
      icon: Icons.music_note_rounded,
    ),
    MusicMundialSocial(
      id: 'startly',
      name: 'Startly',
      handle: 'Community',
      url: startlyUrl,
      accent: Color(0xFFD946EF),
      icon: Icons.groups_rounded,
      imageAsset: 'assets/branding/startly-icon.png',
    ),
    MusicMundialSocial(
      id: 'web',
      name: 'Web',
      handle: 'musicmundial.com',
      url: websiteUrl,
      accent: Color(0xFF67E8F9),
      icon: Icons.language_rounded,
    ),
    MusicMundialSocial(
      id: 'feed',
      name: 'News',
      handle: 'RSS Feed',
      url: feedUrl,
      accent: Color(0xFFFBBF24),
      icon: Icons.rss_feed_rounded,
    ),
  ];
}
