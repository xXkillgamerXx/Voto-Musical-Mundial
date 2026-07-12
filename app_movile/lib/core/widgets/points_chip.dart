import 'package:flutter/material.dart';

import '../auth/auth_session.dart';

class PointsChip extends StatefulWidget {
  const PointsChip({required this.session, this.compact = false, super.key});

  final AuthSession session;
  final bool compact;

  @override
  State<PointsChip> createState() => _PointsChipState();
}

class _PointsChipState extends State<PointsChip> with TickerProviderStateMixin {
  late final AnimationController _bounceController;
  late final AnimationController _countController;
  late final AnimationController _spentController;
  int? _lastKnownPoints;
  int _animateFrom = 0;
  int _animateTo = 0;
  int _spentDelta = 0;

  @override
  void initState() {
    super.initState();
    _lastKnownPoints = widget.session.user?.points;
    _animateTo = _lastKnownPoints ?? 0;
    _bounceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 620),
    );
    _countController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _spentController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 850),
    );
    widget.session.addListener(_onSessionChanged);
  }

  @override
  void dispose() {
    widget.session.removeListener(_onSessionChanged);
    _bounceController.dispose();
    _countController.dispose();
    _spentController.dispose();
    super.dispose();
  }

  void _onSessionChanged() {
    final next = widget.session.user?.points;
    final prev = _lastKnownPoints;
    if (next == null || prev == null || next == prev) {
      return;
    }

    _animateFrom = prev;
    _animateTo = next;
    _spentDelta = next < prev ? prev - next : 0;
    _lastKnownPoints = next;
    _bounceController.forward(from: 0);
    _countController.forward(from: 0);
    if (_spentDelta > 0) {
      _spentController.forward(from: 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([
        widget.session,
        _bounceController,
        _countController,
        _spentController,
      ]),
      builder: (context, _) {
        final targetPoints = widget.session.user?.points ?? 0;
        final bounce = Curves.elasticOut.transform(_bounceController.value);
        final scale = 1 + (bounce * 0.14);
        final countProgress = Curves.easeOutCubic.transform(
          _countController.value,
        );
        final isCounting =
            _countController.isAnimating || _countController.value < 1;
        final displayedPoints = isCounting
            ? (_animateFrom + ((_animateTo - _animateFrom) * countProgress))
                  .round()
            : targetPoints;
        final spentProgress = _spentController.value;
        final spentLift = (1 - spentProgress) * 10;

        return Transform.scale(
          scale: scale,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              Container(
                margin: EdgeInsets.only(right: widget.compact ? 0 : 4),
                padding: EdgeInsets.symmetric(
                  horizontal: widget.compact ? 10 : 12,
                  vertical: widget.compact ? 6 : 7,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFFBBF24).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: Color.lerp(
                      const Color(0xFFFCD34D).withValues(alpha: 0.24),
                      const Color(0xFFFCA5A5).withValues(alpha: 0.55),
                      _bounceController.value.clamp(0, 1),
                    )!,
                  ),
                  boxShadow: _bounceController.value > 0
                      ? [
                          BoxShadow(
                            color: const Color(
                              0xFFFBBF24,
                            ).withValues(alpha: 0.22 * _bounceController.value),
                            blurRadius: 14,
                            spreadRadius: 1,
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.bolt_rounded,
                      size: widget.compact ? 14 : 15,
                      color: const Color(0xFFFDE68A),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${formatPoints(displayedPoints)} pts',
                      style: TextStyle(
                        color: const Color(0xFFFEF3C7),
                        fontSize: widget.compact ? 11 : 12,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ],
                ),
              ),
              if (_spentDelta > 0 && spentProgress > 0)
                Positioned(
                  top: -18 - spentLift,
                  child: Opacity(
                    opacity: spentProgress.clamp(0, 1),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFF7F1D1D).withValues(alpha: 0.92),
                        borderRadius: BorderRadius.circular(99),
                        border: Border.all(
                          color: const Color(0xFFFCA5A5).withValues(alpha: 0.5),
                        ),
                      ),
                      child: Text(
                        '-${formatPoints(_spentDelta)}',
                        style: const TextStyle(
                          color: Color(0xFFFECACA),
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
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
}

String formatPoints(int value) {
  return value.toString().replaceAllMapped(
    RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
    (match) => '${match[1]}.',
  );
}
