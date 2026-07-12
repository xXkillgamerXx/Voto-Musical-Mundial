import 'package:flutter/material.dart';

class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    this.height,
    this.width,
    this.borderRadius = const BorderRadius.all(Radius.circular(12)),
    super.key,
  });

  final double? height;
  final double? width;
  final BorderRadius borderRadius;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: width,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: borderRadius,
      ),
    );
  }
}

class NewsCardSkeleton extends StatelessWidget {
  const NewsCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF090B19).withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(0xFF8B5CF6).withValues(alpha: 0.1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: const [
          SkeletonBox(
            height: 168,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          Padding(
            padding: EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(height: 18, width: double.infinity),
                SizedBox(height: 8),
                SkeletonBox(height: 18, width: 220),
                SizedBox(height: 12),
                SkeletonBox(height: 12, width: double.infinity),
                SizedBox(height: 6),
                SkeletonBox(height: 12, width: 180),
                SizedBox(height: 14),
                SkeletonBox(height: 10, width: 120),
                SizedBox(height: 14),
                SkeletonBox(height: 48),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ArtistCardSkeleton extends StatelessWidget {
  const ArtistCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF090B19).withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: const [
          SkeletonBox(
            height: 200,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(18, 16, 18, 18),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(
                  height: 72,
                  width: 72,
                  borderRadius: BorderRadius.all(Radius.circular(22)),
                ),
                SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SkeletonBox(height: 20, width: double.infinity),
                      SizedBox(height: 8),
                      SkeletonBox(height: 14, width: 120),
                      SizedBox(height: 10),
                      SkeletonBox(height: 12, width: double.infinity),
                      SizedBox(height: 6),
                      SkeletonBox(height: 12, width: 180),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class HallOfFameLoadingView extends StatelessWidget {
  const HallOfFameLoadingView({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
      children: const [
        SkeletonBox(height: 148, borderRadius: BorderRadius.all(Radius.circular(24))),
        SizedBox(height: 18),
        SkeletonBox(height: 28, width: 80),
        SizedBox(height: 12),
        SkeletonBox(height: 240, borderRadius: BorderRadius.all(Radius.circular(22))),
        SizedBox(height: 12),
        SkeletonBox(height: 240, borderRadius: BorderRadius.all(Radius.circular(22))),
        SizedBox(height: 18),
        SkeletonBox(height: 28, width: 80),
        SizedBox(height: 12),
        SkeletonBox(height: 240, borderRadius: BorderRadius.all(Radius.circular(22))),
      ],
    );
  }
}

class ArtistsLoadingView extends StatelessWidget {
  const ArtistsLoadingView({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(18, 0, 18, 0),
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 10),
                SkeletonBox(
                  height: 32,
                  width: 280,
                  borderRadius: BorderRadius.all(Radius.circular(8)),
                ),
                const SizedBox(height: 8),
                SkeletonBox(
                  height: 14,
                  width: double.infinity,
                  borderRadius: BorderRadius.all(Radius.circular(8)),
                ),
                const SizedBox(height: 16),
                SkeletonBox(height: 48, borderRadius: BorderRadius.all(Radius.circular(16))),
                const SizedBox(height: 16),
              ],
            ),
          ),
          SliverList.separated(
            itemCount: 4,
            separatorBuilder: (_, _) => const SizedBox(height: 14),
            itemBuilder: (_, _) => const ArtistCardSkeleton(),
          ),
        ],
      ),
    );
  }
}

class NewsLoadingView extends StatelessWidget {
  const NewsLoadingView({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(18, 0, 18, 0),
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: const [
                SizedBox(height: 10),
                SkeletonBox(height: 32, width: 140),
                SizedBox(height: 8),
                SkeletonBox(height: 14, width: double.infinity),
                SizedBox(height: 16),
                SkeletonBox(height: 48),
                SizedBox(height: 16),
              ],
            ),
          ),
          SliverList.separated(
            itemCount: 4,
            separatorBuilder: (_, _) => const SizedBox(height: 14),
            itemBuilder: (_, _) => const NewsCardSkeleton(),
          ),
        ],
      ),
    );
  }
}
