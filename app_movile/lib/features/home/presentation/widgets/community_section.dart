import 'package:flutter/material.dart';

class CommunityLink {
  const CommunityLink({
    required this.title,
    required this.description,
    required this.label,
    required this.url,
    required this.icon,
    required this.gradient,
  });

  final String title;
  final String description;
  final String label;
  final String url;
  final IconData icon;
  final List<Color> gradient;
}

class CommunitySection extends StatelessWidget {
  const CommunitySection({
    required this.onOpenLink,
    super.key,
  });

  final Future<void> Function(String url) onOpenLink;

  static const _links = [
    CommunityLink(
      title: 'Comunidad Startly',
      description:
          'Entra al hub de Music Mundial para descubrir enlaces, novedades y contenido destacado.',
      label: 'Link oficial',
      url: 'https://startlyapp.com/musicmundial',
      icon: Icons.link_rounded,
      gradient: [Color(0xFF701A75), Color(0xFF581C87), Color(0xFF020617)],
    ),
    CommunityLink(
      title: 'Music Mundial en X',
      description:
          'Sigue noticias, votaciones, tendencias KPOP y actualizaciones de la comunidad.',
      label: '43.5K seguidores',
      url: 'https://x.com/MusicMundial',
      icon: Icons.tag_rounded,
      gradient: [Color(0xFF020617), Color(0xFF2E1065), Color(0xFF000000)],
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 28, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'COMUNIDAD',
            style: TextStyle(
              color: Color(0xFF67E8F9),
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.8,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Music Mundial',
            style: TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 18),
          for (var index = 0; index < _links.length; index++) ...[
            if (index > 0) const SizedBox(height: 14),
            _CommunityCard(
              link: _links[index],
              onTap: () => onOpenLink(_links[index].url),
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
                        color: Colors.white.withValues(alpha: 0.1),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.15),
                        ),
                      ),
                      child: Icon(link.icon, color: Colors.white, size: 28),
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
                                'ABRIR COMUNIDAD',
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
