import 'dart:ui';

import 'package:flutter/material.dart';

class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    required this.title,
    required this.subtitle,
    required this.child,
    this.footer,
    this.showBackButton = false,
    this.showBrandHeader = true,
    this.onBackPressed,
    super.key,
  });

  final String title;
  final String subtitle;
  final Widget child;
  final Widget? footer;
  final bool showBackButton;
  final bool showBrandHeader;
  final VoidCallback? onBackPressed;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final isDark = colorScheme.brightness == Brightness.dark;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: showBackButton
          ? AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              scrolledUnderElevation: 0,
              surfaceTintColor: Colors.transparent,
              forceMaterialTransparency: true,
              leading: IconButton(
                onPressed:
                    onBackPressed ?? () => Navigator.of(context).maybePop(),
                icon: Icon(
                  Icons.arrow_back_ios_new_rounded,
                  color: colorScheme.onSurface,
                ),
              ),
            )
          : null,
      body: _AnimatedAuthBackground(
        isDark: isDark,
        child: SafeArea(
          top: !showBackButton,
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 26,
                  vertical: 18,
                ),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: constraints.maxHeight - 36,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (showBrandHeader) ...[
                        const _BrandHeader(),
                        const SizedBox(height: 22),
                      ],
                      Text(
                        title,
                        textAlign: TextAlign.center,
                        style: textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.6,
                          height: 1,
                        ),
                      ),
                      const SizedBox(height: 24),
                      child,
                      if (footer != null) ...[
                        const SizedBox(height: 22),
                        footer!,
                      ],
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _BrandHeader extends StatelessWidget {
  const _BrandHeader();

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Image.asset(
          'assets/icons/logo-votos.png',
          width: 128,
          fit: BoxFit.contain,
        ),
        const SizedBox(height: 8),
        Text(
          'VOTOS MUSICA MUNDIAL',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.6,
            height: 1,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          'AWARDS GLOBALES',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: colorScheme.onSurfaceVariant,
            fontSize: 14,
            fontWeight: FontWeight.w700,
            letterSpacing: 4,
            height: 1,
          ),
        ),
      ],
    );
  }
}

class _AnimatedAuthBackground extends StatefulWidget {
  const _AnimatedAuthBackground({required this.isDark, required this.child});

  final bool isDark;
  final Widget child;

  @override
  State<_AnimatedAuthBackground> createState() =>
      _AnimatedAuthBackgroundState();
}

class _AnimatedAuthBackgroundState extends State<_AnimatedAuthBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            if (widget.isDark) ...[
              const Color(0xFF1A0B2E),
              const Color(0xFF050713),
              const Color(0xFF062033),
            ] else ...[
              const Color(0xFFFFFFFF),
              const Color(0xFFFCFAFF),
              const Color(0xFFF8FBFF),
            ],
          ],
        ),
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: IgnorePointer(
              child: AnimatedBuilder(
                animation: _controller,
                builder: (context, _) {
                  final value = Curves.easeInOut.transform(_controller.value);

                  return ImageFiltered(
                    imageFilter: ImageFilter.blur(sigmaX: 36, sigmaY: 36),
                    child: Stack(
                      children: [
                        _GlowCircle(
                          size: 330,
                          color: const Color(0xFF7C4DFF),
                          opacity: widget.isDark ? 0.34 : 0.18,
                          left: -105 + (value * 42),
                          top: 45 + (value * 28),
                        ),
                        _GlowCircle(
                          size: 360,
                          color: const Color(0xFFFF21C8),
                          opacity: widget.isDark ? 0.28 : 0.16,
                          right: -130 + (value * 36),
                          top: 220 - (value * 42),
                        ),
                        _GlowCircle(
                          size: 320,
                          color: const Color(0xFF00C2FF),
                          opacity: widget.isDark ? 0.24 : 0.13,
                          right: -10 - (value * 48),
                          bottom: -120 + (value * 44),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
          widget.child,
        ],
      ),
    );
  }
}

class _GlowCircle extends StatelessWidget {
  const _GlowCircle({
    required this.size,
    required this.color,
    required this.opacity,
    this.left,
    this.top,
    this.right,
    this.bottom,
  });

  final double size;
  final Color color;
  final double opacity;
  final double? left;
  final double? top;
  final double? right;
  final double? bottom;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: left,
      top: top,
      right: right,
      bottom: bottom,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              color.withValues(alpha: opacity),
              color.withValues(alpha: 0),
            ],
          ),
        ),
      ),
    );
  }
}
