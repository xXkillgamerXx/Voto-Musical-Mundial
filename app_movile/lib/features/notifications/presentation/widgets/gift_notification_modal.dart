import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../auth/data/auth_service.dart';
import '../../data/app_notification.dart';
import '../../data/notification_display.dart';

class GiftNotificationModal extends StatefulWidget {
  const GiftNotificationModal({
    required this.notification,
    required this.authService,
    required this.onClose,
    super.key,
  });

  final AppNotification notification;
  final AuthService authService;
  final VoidCallback onClose;

  @override
  State<GiftNotificationModal> createState() => _GiftNotificationModalState();
}

class _GiftNotificationModalState extends State<GiftNotificationModal>
    with TickerProviderStateMixin {
  bool _revealed = false;
  int _displayPoints = 0;
  bool _showConfetti = false;

  late final AnimationController _entryController;
  late final AnimationController _bounceController;
  late final AnimationController _glowController;
  late final AnimationController _revealController;
  late final AnimationController _pointsController;

  late final Animation<double> _backdropFade;
  late final Animation<double> _cardScale;
  late final Animation<double> _cardFade;
  late final Animation<double> _revealBurst;

  bool get _isMission => widget.notification.type == 'mission_completed';

  int get _amount => giftAmount(widget.notification);

  int get _pointsAfter =>
      _toInt(widget.notification.payload['pointsAfter']) > 0
      ? _toInt(widget.notification.payload['pointsAfter'])
      : (widget.authService.session.user?.points ?? 0);

  int get _pointsBefore {
    final explicit = _toInt(widget.notification.payload['pointsBefore']);
    if (explicit > 0) {
      return explicit;
    }
    return _pointsAfter - _amount;
  }

  @override
  void initState() {
    super.initState();
    _displayPoints = _pointsBefore;

    _entryController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );
    _bounceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
    _revealController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _pointsController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );

    _backdropFade = CurvedAnimation(
      parent: _entryController,
      curve: const Interval(0, 0.55, curve: Curves.easeOut),
    );
    _cardFade = CurvedAnimation(
      parent: _entryController,
      curve: const Interval(0.1, 1, curve: Curves.easeOut),
    );
    _cardScale = CurvedAnimation(
      parent: _entryController,
      curve: const Interval(0.1, 1, curve: Curves.elasticOut),
    );
    _revealBurst = CurvedAnimation(
      parent: _revealController,
      curve: Curves.easeOutCubic,
    );

    _entryController.forward();
  }

  @override
  void dispose() {
    _entryController.dispose();
    _bounceController.dispose();
    _glowController.dispose();
    _revealController.dispose();
    _pointsController.dispose();
    super.dispose();
  }

  Future<void> _revealGift() async {
    if (_revealed) {
      return;
    }

    setState(() {
      _revealed = true;
      _showConfetti = true;
    });

    _bounceController.stop();
    _revealController.forward(from: 0);

    _pointsController.addListener(_onPointsTick);
    await _pointsController.forward(from: 0);
    _pointsController.removeListener(_onPointsTick);
    setState(() => _displayPoints = _pointsAfter);

    final user = widget.authService.session.user;
    if (user != null && _pointsAfter > 0) {
      await widget.authService.session.updateUser(
        user.copyWith(points: _pointsAfter),
      );
    }

    Future.delayed(const Duration(milliseconds: 1200), () {
      if (mounted) {
        setState(() => _showConfetti = false);
      }
    });
  }

  void _onPointsTick() {
    final value = _pointsController.value;
    final eased = Curves.easeOutCubic.transform(value);
    final next = (_pointsBefore + ((_pointsAfter - _pointsBefore) * eased)).round();
    if (next != _displayPoints) {
      setState(() => _displayPoints = next);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sender = giftSender(widget.notification);
    final message = widget.notification.payload['message']?.toString().trim();
    final body = message?.isNotEmpty == true
        ? message!
        : _isMission
        ? 'Completaste una misión y ganaste $_amount puntos.'
        : 'Recibiste $_amount puntos de regalo.';

    return AnimatedBuilder(
      animation: Listenable.merge([
        _entryController,
        _bounceController,
        _glowController,
        _revealController,
        _pointsController,
      ]),
      builder: (context, _) {
        final bounce = math.sin(_bounceController.value * math.pi) * 10;
        final glow = 0.55 + (_glowController.value * 0.45);

        return Material(
          color: Colors.black.withValues(alpha: 0.8 * _backdropFade.value),
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (_showConfetti)
                Positioned.fill(
                  child: IgnorePointer(
                    child: _ConfettiBurst(progress: _revealBurst.value),
                  ),
                ),
              Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Opacity(
                    opacity: _cardFade.value,
                    child: Transform.scale(
                      scale: 0.82 + (_cardScale.value * 0.18),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 520),
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: const Color(0xFF090B19),
                            borderRadius: BorderRadius.circular(28),
                            border: Border.all(
                              color: Color.lerp(
                                const Color(0xFFFCD34D).withValues(alpha: 0.22),
                                const Color(0xFFF0ABFC).withValues(alpha: 0.55),
                                _glowController.value,
                              )!,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF701A75)
                                    .withValues(alpha: 0.25 + (glow * 0.25)),
                                blurRadius: 28 + (glow * 12),
                                spreadRadius: glow * 2,
                              ),
                              BoxShadow(
                                color: const Color(0xFFFBBF24)
                                    .withValues(alpha: _revealed ? 0.18 : 0.08),
                                blurRadius: 40,
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(27),
                            child: Stack(
                              clipBehavior: Clip.hardEdge,
                              children: [
                                Positioned(
                                  left: -50,
                                  top: -50,
                                  child: _GlowOrb(
                                    size: 130,
                                    color: const Color(0xFFFBBF24),
                                    opacity: 0.12 * glow,
                                  ),
                                ),
                                Positioned(
                                  right: -50,
                                  bottom: -50,
                                  child: _GlowOrb(
                                    size: 130,
                                    color: const Color(0xFFEC4899),
                                    opacity: 0.14 * glow,
                                  ),
                                ),
                              Padding(
                                padding: const EdgeInsets.fromLTRB(22, 22, 22, 24),
                                child: Column(
                                  children: [
                                    Transform.translate(
                                      offset: Offset(0, _revealed ? 0 : -bounce),
                                      child: Transform.scale(
                                        scale: _revealed
                                            ? 1 + (_revealBurst.value * 0.12)
                                            : 1 + (bounce * 0.004),
                                        child: Container(
                                          width: 96,
                                          height: 96,
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(28),
                                            gradient: const LinearGradient(
                                              colors: [
                                                Color(0xFFFDE68A),
                                                Color(0xFFF0ABFC),
                                                Color(0xFF8B5CF6),
                                              ],
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: const Color(0xFFEC4899)
                                                    .withValues(alpha: 0.35 + (glow * 0.25)),
                                                blurRadius: 24 + (glow * 16),
                                              ),
                                            ],
                                          ),
                                          child: Icon(
                                            _revealed
                                                ? Icons.celebration_rounded
                                                : Icons.card_giftcard_rounded,
                                            color: const Color(0xFF0F172A),
                                            size: 42,
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 18),
                                    _AnimatedRevealText(
                                      revealed: _revealed,
                                      hidden: _isMission
                                          ? 'MISIÓN COMPLETADA'
                                          : 'TIENES UN REGALO',
                                      shown: _isMission
                                          ? 'PREMIO RECIBIDO'
                                          : 'REGALO ABIERTO',
                                    ),
                                    const SizedBox(height: 10),
                                    AnimatedSwitcher(
                                      duration: const Duration(milliseconds: 420),
                                      switchInCurve: Curves.elasticOut,
                                      switchOutCurve: Curves.easeIn,
                                      transitionBuilder: (child, animation) {
                                        return ScaleTransition(
                                          scale: animation,
                                          child: FadeTransition(
                                            opacity: animation,
                                            child: child,
                                          ),
                                        );
                                      },
                                      child: Text(
                                        _revealed
                                            ? '+$_amount pts'
                                            : (_isMission ? 'Premio' : 'Sorpresa'),
                                        key: ValueKey(_revealed),
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: _revealed ? 48 : 44,
                                          fontWeight: FontWeight.w900,
                                          height: 1,
                                          shadows: _revealed
                                              ? [
                                                  Shadow(
                                                    color: const Color(0xFFFBBF24)
                                                        .withValues(alpha: 0.45),
                                                    blurRadius: 18,
                                                  ),
                                                ]
                                              : null,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 10),
                                    AnimatedSwitcher(
                                      duration: const Duration(milliseconds: 320),
                                      child: Text(
                                        _revealed
                                            ? body
                                            : (_isMission
                                                  ? 'Completaste una misión. Abre tu premio para recibir los puntos.'
                                                  : 'Alguien del equipo te envió un regalo. Ábrelo para descubrir cuántos puntos recibiste.'),
                                        key: ValueKey('body-$_revealed'),
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          color: Colors.white.withValues(alpha: 0.62),
                                          fontWeight: FontWeight.w600,
                                          height: 1.45,
                                        ),
                                      ),
                                    ),
                                    AnimatedSize(
                                      duration: const Duration(milliseconds: 380),
                                      curve: Curves.easeOutCubic,
                                      alignment: Alignment.topCenter,
                                      child: _revealed
                                          ? Padding(
                                              padding: const EdgeInsets.only(top: 18),
                                              child: Row(
                                                children: [
                                                  Expanded(
                                                    child: _InfoTile(
                                                      label: 'Enviado por',
                                                      value: sender,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 10),
                                                  Expanded(
                                                    child: _InfoTile(
                                                      label: 'Nuevo saldo',
                                                      value: '$_displayPoints pts',
                                                      highlight: true,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            )
                                          : const SizedBox.shrink(),
                                    ),
                                    const SizedBox(height: 20),
                                    _PulseButton(
                                      pulse: !_revealed,
                                      child: SizedBox(
                                        width: double.infinity,
                                        height: 48,
                                        child: DecoratedBox(
                                          decoration: BoxDecoration(
                                            gradient: const LinearGradient(
                                              colors: [
                                                Color(0xFFFBBF24),
                                                Color(0xFFEC4899),
                                                Color(0xFF8B5CF6),
                                              ],
                                            ),
                                            borderRadius: BorderRadius.circular(18),
                                            boxShadow: [
                                              BoxShadow(
                                                color: const Color(0xFFEC4899)
                                                    .withValues(alpha: 0.35),
                                                blurRadius: _revealed ? 8 : 18,
                                                offset: const Offset(0, 6),
                                              ),
                                            ],
                                          ),
                                          child: Material(
                                            color: Colors.transparent,
                                            child: InkWell(
                                              onTap: _revealed ? widget.onClose : _revealGift,
                                              borderRadius: BorderRadius.circular(18),
                                              child: Center(
                                                child: Text(
                                                  _revealed ? 'LISTO' : 'ABRIR REGALO',
                                                  style: const TextStyle(
                                                    color: Colors.white,
                                                    fontWeight: FontWeight.w900,
                                                    letterSpacing: 0.5,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Positioned(
                                right: 4,
                                top: 4,
                                child: IconButton(
                                  onPressed: widget.onClose,
                                  icon: const Icon(Icons.close_rounded, color: Colors.white70),
                                ),
                              ),
                            ],
                          ),
                        ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  int _toInt(Object? value) {
    if (value is int) return value;
    if (value is num) return value.round();
    return int.tryParse('$value') ?? 0;
  }
}

class _AnimatedRevealText extends StatelessWidget {
  const _AnimatedRevealText({
    required this.revealed,
    required this.hidden,
    required this.shown,
  });

  final bool revealed;
  final String hidden;
  final String shown;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 350),
      transitionBuilder: (child, animation) {
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, 0.25),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
        );
      },
      child: Text(
        revealed ? shown : hidden,
        key: ValueKey(revealed),
        style: const TextStyle(
          color: Color(0xFFFDE68A),
          fontWeight: FontWeight.w900,
          fontSize: 11,
          letterSpacing: 2,
        ),
      ),
    );
  }
}

class _GlowOrb extends StatelessWidget {
  const _GlowOrb({
    required this.size,
    required this.color,
    required this.opacity,
  });

  final double size;
  final Color color;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color.withValues(alpha: opacity),
      ),
    );
  }
}

class _PulseButton extends StatefulWidget {
  const _PulseButton({required this.pulse, required this.child});

  final bool pulse;
  final Widget child;

  @override
  State<_PulseButton> createState() => _PulseButtonState();
}

class _PulseButtonState extends State<_PulseButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );
    if (widget.pulse) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(covariant _PulseButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.pulse && !_controller.isAnimating) {
      _controller.repeat(reverse: true);
    } else if (!widget.pulse) {
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.pulse) {
      return widget.child;
    }

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final scale = 1 + (_controller.value * 0.025);
        return Transform.scale(scale: scale, child: child);
      },
      child: widget.child,
    );
  }
}

class _ConfettiBurst extends StatelessWidget {
  const _ConfettiBurst({required this.progress});

  final double progress;

  static const _colors = [
    Color(0xFFFBBF24),
    Color(0xFFEC4899),
    Color(0xFF8B5CF6),
    Color(0xFF67E8F9),
    Color(0xFFFDE68A),
  ];

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _ConfettiPainter(progress: progress, colors: _colors),
      child: const SizedBox.expand(),
    );
  }
}

class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter({required this.progress, required this.colors});

  final double progress;
  final List<Color> colors;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0) {
      return;
    }

    final center = Offset(size.width / 2, size.height / 2);
    final random = math.Random(7);

    for (var i = 0; i < 28; i++) {
      final angle = (i / 28) * math.pi * 2;
      final speed = 80 + random.nextDouble() * 120;
      final distance = speed * progress;
      final dx = center.dx + math.cos(angle) * distance;
      final dy = center.dy + math.sin(angle) * distance - (progress * 40);
      final radius = (4 + random.nextDouble() * 4) * (1 - progress * 0.35);
      final paint = Paint()
        ..color = colors[i % colors.length].withValues(alpha: 1 - progress)
        ..style = PaintingStyle.fill;

      canvas.drawCircle(Offset(dx, dy), radius, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: highlight
            ? const Color(0xFFFBBF24).withValues(alpha: 0.12)
            : Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: highlight
              ? const Color(0xFFFCD34D).withValues(alpha: 0.25)
              : Colors.white.withValues(alpha: 0.1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.45),
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              color: highlight ? const Color(0xFFFEF3C7) : Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: 15,
            ),
          ),
        ],
      ),
    );
  }
}
