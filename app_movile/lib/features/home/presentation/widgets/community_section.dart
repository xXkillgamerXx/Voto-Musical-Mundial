import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';

class CommunityLink {
  const CommunityLink({
    required this.title,
    required this.description,
    required this.label,
    required this.url,
    required this.gradient,
    this.icon,
    this.imageAsset,
  });

  final String title;
  final String description;
  final String label;
  final String url;
  final IconData? icon;
  final String? imageAsset;
  final List<Color> gradient;
}

class CommunitySection extends StatelessWidget {
  const CommunitySection({
    required this.onOpenLink,
    super.key,
  });

  final Future<void> Function(String url) onOpenLink;

  static List<CommunityLink> get _links => [
    CommunityLink(
      title: tr('home.communityStartlyTitle'),
      description: tr('home.communityStartlyDescription'),
      label: tr('home.officialLink'),
      url: 'https://startlyapp.com/musicmundial',
      imageAsset: 'assets/branding/startly-icon.png',
      gradient: const [
        Color(0xFF701A75),
        Color(0xFF581C87),
        Color(0xFF020617),
      ],
    ),
    CommunityLink(
      title: tr('home.communityXTitle'),
      description: tr('home.communityXDescription'),
      label: tr('home.communityXFollowers'),
      url: 'https://x.com/MusicMundial',
      icon: Icons.tag_rounded,
      gradient: const [
        Color(0xFF020617),
        Color(0xFF2E1065),
        Color(0xFF000000),
      ],
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final links = _links;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 28, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr('home.community'),
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
          const SizedBox(height: 18),
          for (var index = 0; index < links.length; index++) ...[
            if (index > 0) const SizedBox(height: 14),
            _CommunityCard(
              link: links[index],
              onTap: () => onOpenLink(links[index].url),
            ),
          ],
        ],
      ),
    );
  }
}

class _CommunityCard extends StatelessWidget {
  const _CommunityCard({required this.link, required this.onTap});

  final CommunityLink link;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      clipBehavior: Clip.antiAlias,
      borderRadius: BorderRadius.circular(28),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(28),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            border: Border.all(
              color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
            ),
            color: const Color(0xFF080A18).withValues(alpha: 0.9),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF4C1D95).withValues(alpha: 0.2),
                blurRadius: 22,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Stack(
            children: [
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: link.gradient,
                    ),
                  ),
                ),
              ),
              Positioned(
                right: -30,
                top: -30,
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFFD946EF).withValues(alpha: 0.18),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(18),
                child: Row(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(22),
                        color: link.imageAsset != null
                            ? Colors.black.withValues(alpha: 0.45)
                            : Colors.white.withValues(alpha: 0.1),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.15),
                        ),
                      ),
                      child: link.imageAsset != null
                          ? Padding(
                              padding: const EdgeInsets.all(14),
                              child: Image.asset(
                                link.imageAsset!,
                                fit: BoxFit.contain,
                              ),
                            )
                          : Icon(link.icon, color: Colors.white, size: 28),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.1),
                              ),
                            ),
                            child: Text(
                              link.label.toUpperCase(),
                              style: const TextStyle(
                                color: Color(0xFFF5D0FE),
                                fontSize: 9,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1,
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            link.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              height: 1.05,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            link.description,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.72),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              height: 1.35,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Text(
                                tr('home.openCommunity'),
                                style: TextStyle(
                                  color: const Color(0xFFF0ABFC).withValues(alpha: 0.95),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.4,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Icon(
                                Icons.open_in_new_rounded,
                                size: 14,
                                color: const Color(0xFFF0ABFC).withValues(alpha: 0.95),
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
      ),
    );
  }
}
