import 'package:flutter/material.dart';

/// Highlights vote / percent text for a moment whenever [text] changes,
/// so live updates feel noticeable.
class PulsingStatText extends StatefulWidget {
  const PulsingStatText({
    required this.text,
    required this.style,
    this.pulseColor = const Color(0xFFFEF08A),
    this.maxLines = 1,
    this.overflow = TextOverflow.ellipsis,
    this.textAlign,
    super.key,
  });

  final String text;
  final TextStyle style;
  final Color pulseColor;
  final int? maxLines;
  final TextOverflow overflow;
  final TextAlign? textAlign;

  @override
  State<PulsingStatText> createState() => _PulsingStatTextState();
}

class _PulsingStatTextState extends State<PulsingStatText>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  String _previousText = '';

  @override
  void initState() {
    super.initState();
    _previousText = widget.text;
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 980),
    );
    _scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1, end: 1.2), weight: 22),
      TweenSequenceItem(tween: Tween(begin: 1.2, end: 1.06), weight: 28),
      TweenSequenceItem(tween: Tween(begin: 1.06, end: 1), weight: 50),
    ]).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));
  }

  @override
  void didUpdateWidget(covariant PulsingStatText oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.text != _previousText && widget.text.isNotEmpty) {
      _previousText = widget.text;
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;
        final pulsing = _controller.isAnimating;
        final blend = pulsing
            ? (t < 0.5 ? (t * 2).clamp(0.0, 1.0) : ((1 - t) * 2).clamp(0.0, 1.0))
            : 0.0;
        return Transform.scale(
          scale: pulsing ? _scale.value : 1,
          child: Text(
            widget.text,
            maxLines: widget.maxLines,
            overflow: widget.overflow,
            textAlign: widget.textAlign,
            style: widget.style.copyWith(
              color: Color.lerp(widget.style.color, widget.pulseColor, blend),
              shadows: pulsing
                  ? [
                      Shadow(
                        color: widget.pulseColor.withValues(alpha: 0.55),
                        blurRadius: 14,
                      ),
                    ]
                  : widget.style.shadows,
            ),
          ),
        );
      },
    );
  }
}
