import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';
import '../../data/news_api.dart';

class NewsCard extends StatelessWidget {
  const NewsCard({
    required this.item,
    required this.onTap,
    this.width,
    this.imageHeight = 168,
    this.compact = false,
  });

  final NewsItem item;
  final VoidCallback onTap;
  final double? width;
  final double imageHeight;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final gradient = NewsApi.gradientColorsFor(item.gradientIndex);

    return SizedBox(
      width: width,
      child: Material(
        color: Colors.transparent,
        clipBehavior: Clip.antiAlias,
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(24),
          child: Ink(
            decoration: BoxDecoration(
              color: const Color(0xFF090B19).withValues(alpha: 0.85),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: const Color(0xFF8B5CF6).withValues(alpha: 0.1),
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF4C1D95).withValues(alpha: 0.22),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: imageHeight,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: gradient
                                .map((color) => Color(color))
                                .toList(growable: false),
                          ),
                        ),
                      ),
                      if (item.imageUrl.isNotEmpty)
                        CachedNetworkImage(
                          imageUrl: item.imageUrl,
                          fit: BoxFit.cover,
                          errorWidget: (_, _, _) => const SizedBox.shrink(),
                        ),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              const Color(0xFF080A17).withValues(alpha: 0.92),
                            ],
                          ),
                        ),
                      ),
                      Positioned(
                        left: 14,
                        top: 14,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.35),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            item.tag.toUpperCase(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.6,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (compact)
                  Expanded(
                    child: _NewsCardBody(
                      item: item,
                      onTap: onTap,
                      compact: true,
                    ),
                  )
                else
                  _NewsCardBody(
                    item: item,
                    onTap: onTap,
                    compact: false,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NewsCardBody extends StatelessWidget {
  const _NewsCardBody({
    required this.item,
    required this.onTap,
    required this.compact,
  });

  final NewsItem item;
  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.all(compact ? 16 : 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: Colors.white,
              fontSize: compact ? 17 : 18,
              fontWeight: FontWeight.w900,
              height: 1.12,
            ),
          ),
          if (item.description.isNotEmpty) ...[
            SizedBox(height: compact ? 6 : 8),
            Text(
              item.description,
              maxLines: compact ? 2 : 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.55),
                fontSize: compact ? 12 : 13,
                fontWeight: FontWeight.w600,
                height: 1.35,
              ),
            ),
          ],
          if (compact) const Spacer(),
          SizedBox(height: compact ? 8 : 10),
          Text(
            item.time.toUpperCase(),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.45),
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
            ),
          ),
          SizedBox(height: compact ? 10 : 14),
          _NewsReadButton(onTap: onTap, compact: compact),
        ],
      ),
    );
  }
}

class _NewsReadButton extends StatelessWidget {
  const _NewsReadButton({required this.onTap, required this.compact});

  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF8B5CF6), Color(0xFFEC4899)],
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFEC4899).withValues(alpha: 0.22),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: SizedBox(
            height: compact ? 44 : 48,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  tr('home.readNews'),
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: compact ? 11 : 12,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(width: 6),
                const Icon(Icons.open_in_new_rounded, color: Colors.white, size: 14),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
