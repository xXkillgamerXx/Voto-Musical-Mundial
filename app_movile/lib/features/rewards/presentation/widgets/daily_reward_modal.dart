import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';
import '../../../auth/data/auth_service.dart';
import '../../../../core/auth/auth_models.dart';
import '../../../../core/storage/daily_reward_storage.dart';
import '../../data/rewards_api.dart';

class DailyRewardModal {
  static Future<void> show(
    BuildContext context, {
    required AuthService authService,
  }) {
    return showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.75),
      builder: (context) {
        return _DailyRewardDialog(authService: authService);
      },
    );
  }
}

class _DailyRewardDialog extends StatefulWidget {
  const _DailyRewardDialog({required this.authService});

  final AuthService authService;

  @override
  State<_DailyRewardDialog> createState() => _DailyRewardDialogState();
}

class _DailyRewardDialogState extends State<_DailyRewardDialog> {
  late final RewardsApi _rewardsApi;

  DailyRewardSchedule _schedule = const DailyRewardSchedule(
    days: DailyRewardSchedule.defaultDays,
    weeklyTotal: 155,
  );

  String _lastClaimDate = '';
  int _streak = 0;
  bool _claimed = false;
  bool _isClaiming = false;
  bool _showSuccess = false;
  String? _errorMessage;
  int _claimedPoints = 0;
  int _pointsAfterClaim = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _rewardsApi = RewardsApi(widget.authService.client);
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      final schedule = await _rewardsApi.getDailySchedule();
      final user = await widget.authService.getMe();
      if (!mounted) {
        return;
      }

      setState(() {
        _schedule = schedule;
        _syncFromUser(user);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() => _loading = false);
    }
  }

  void _syncFromUser(ApiUser? user) {
    _lastClaimDate = user?.lastDailyRewardClaimDate ?? '';
    _streak = user?.dailyRewardStreak ?? 0;
    _claimed = user?.hasClaimedDailyRewardToday ?? false;
  }

  int get _nextStreakForClaim => nextStreakForClaim(
    lastClaimDate: _lastClaimDate,
    currentStreak: _streak,
  );

  int get _activeRewardDay => rewardDayFromStreak(_nextStreakForClaim);

  DailyRewardDay get _todayReward {
    return _schedule.days.firstWhere(
      (day) => day.day == _activeRewardDay,
      orElse: () => _schedule.days.first,
    );
  }

  DailyRewardDay get _tomorrowReward {
    final nextDay = rewardDayFromStreak(_nextStreakForClaim + 1);
    return _schedule.days.firstWhere(
      (day) => day.day == nextDay,
      orElse: () => _schedule.days.last,
    );
  }

  Future<void> _close() async {
    await DailyRewardStorage.markDismissedToday();
    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _claim() async {
    if (_isClaiming || _claimed) {
      return;
    }

    setState(() {
      _isClaiming = true;
      _errorMessage = null;
    });

    try {
      final result = await _rewardsApi.claimDailyReward();

      final currentUser = widget.authService.session.user;
      if (currentUser != null) {
        await widget.authService.session.updateUser(
          currentUser.copyWith(
            points: result.userPoints,
            dailyRewardStreak: result.streak,
            dailyRewardStreakDay: result.streakDay,
            lastDailyRewardClaimDate: todayKey(),
          ),
        );
      } else {
        await widget.authService.getMe();
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _claimed = true;
        _showSuccess = true;
        _claimedPoints = result.points;
        _pointsAfterClaim = result.userPoints;
        _lastClaimDate = todayKey();
        _streak = result.streak;
        _isClaiming = false;
      });

      await DailyRewardStorage.markDismissedToday();
    } catch (error) {
      final message = error.toString();
      if (message.contains('Ya reclamaste')) {
        final user = await widget.authService.getMe();
        if (!mounted) {
          return;
        }

        setState(() {
          _syncFromUser(user);
          _claimed = true;
          _showSuccess = true;
          _claimedPoints = _todayReward.points;
          _pointsAfterClaim = user?.points ?? 0;
          _isClaiming = false;
        });
        return;
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _errorMessage = tr('home.rewardClaimError');
        _isClaiming = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: const Color(0xFF090B19),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(
              color: const Color(0xFFC4B5FD).withValues(alpha: 0.25),
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF701A75).withValues(alpha: 0.35),
                blurRadius: 28,
                offset: const Offset(0, 16),
              ),
            ],
          ),
          child: Stack(
            children: [
              Positioned(
                right: -40,
                top: -40,
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFFEC4899).withValues(alpha: 0.18),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
                child: _loading
                    ? const SizedBox(
                        height: 320,
                        child: Center(child: CircularProgressIndicator()),
                      )
                    : _showSuccess
                    ? _SuccessView(
                        points: _claimedPoints,
                        totalPoints: _pointsAfterClaim,
                        onContinue: _close,
                      )
                    : _MainView(
                        schedule: _schedule,
                        activeRewardDay: _activeRewardDay,
                        todayReward: _todayReward,
                        tomorrowReward: _tomorrowReward,
                        claimed: _claimed,
                        isClaiming: _isClaiming,
                        errorMessage: _errorMessage,
                        onClaim: _claim,
                        onClose: _close,
                      ),
              ),
              Positioned(
                right: 8,
                top: 8,
                child: IconButton(
                  onPressed: _close,
                  icon: const Icon(Icons.close_rounded, color: Colors.white70),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MainView extends StatelessWidget {
  const _MainView({
    required this.schedule,
    required this.activeRewardDay,
    required this.todayReward,
    required this.tomorrowReward,
    required this.claimed,
    required this.isClaiming,
    required this.errorMessage,
    required this.onClaim,
    required this.onClose,
  });

  final DailyRewardSchedule schedule;
  final int activeRewardDay;
  final DailyRewardDay todayReward;
  final DailyRewardDay tomorrowReward;
  final bool claimed;
  final bool isClaiming;
  final String? errorMessage;
  final VoidCallback onClaim;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          Text(
            tr('home.dailyReward'),
            style: const TextStyle(
              color: Color(0xFFF9A8D4),
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.4,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            tr('home.sevenDayStreak'),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w900,
              height: 1.05,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            tr('home.dailyRewardDescription'),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.62),
              fontWeight: FontWeight.w600,
              height: 1.4,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            trp('home.weeklyTotalPoints', {'total': schedule.weeklyTotal}),
            style: const TextStyle(
              color: Color(0xFFA7F3D0),
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            tr('home.streakRules'),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.42),
              fontWeight: FontWeight.w600,
              height: 1.35,
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 14),
          Align(
            alignment: Alignment.centerRight,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF34D399).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: const Color(0xFF6EE7B7).withValues(alpha: 0.25),
                ),
              ),
              child: Text(
                claimed
                    ? tr('home.todayClaimed')
                    : trp('home.todayPoints', {'points': todayReward.points}),
                style: const TextStyle(
                  color: Color(0xFFA7F3D0),
                  fontWeight: FontWeight.w900,
                  fontSize: 11,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 136,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: schedule.days.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final reward = schedule.days[index];
                final status = statusForDay(
                  day: reward.day,
                  activeRewardDay: activeRewardDay,
                  claimedToday: claimed,
                );

                return _DayCard(reward: reward, status: status, claimed: claimed);
              },
            ),
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF22D3EE).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: const Color(0xFF67E8F9).withValues(alpha: 0.2),
              ),
            ),
            child: Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFF34D399).withValues(alpha: 0.15),
                        border: Border.all(
                          color: const Color(0xFF6EE7B7).withValues(alpha: 0.3),
                        ),
                      ),
                      child: const Icon(
                        Icons.check_rounded,
                        color: Color(0xFF6EE7B7),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            claimed
                                ? trp('home.claimedTodayPoints', {
                                    'points': todayReward.points,
                                  })
                                : tr('home.rewardReady'),
                            style: const TextStyle(
                              color: Color(0xFFD1FAE5),
                              fontWeight: FontWeight.w900,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text.rich(
                            TextSpan(
                              text: tr('home.comeBackTomorrow'),
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.62),
                                fontWeight: FontWeight.w600,
                                fontSize: 12,
                              ),
                              children: [
                                TextSpan(
                                  text: trp('home.plusPoints', {
                                    'points': tomorrowReward.points,
                                  }),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                TextSpan(
                                  text: trp('home.dayLabel', {
                                    'day': tomorrowReward.day,
                                  }),
                                ),
                              ],
                            ),
                          ),
                          if (errorMessage != null) ...[
                            const SizedBox(height: 6),
                            Text(
                              errorMessage!,
                              style: const TextStyle(
                                color: Color(0xFFFECACA),
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                if (claimed)
                  Text(
                    tr('home.completed'),
                    style: const TextStyle(
                      color: Color(0xFF6EE7B7),
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                      letterSpacing: 0.8,
                    ),
                  )
                else
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF22D3EE), Color(0xFF8B5CF6)],
                        ),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: isClaiming ? null : onClaim,
                          borderRadius: BorderRadius.circular(18),
                          child: Center(
                            child: Text(
                              isClaiming
                                  ? tr('home.claiming')
                                  : tr('home.claimNow'),
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                                letterSpacing: 0.4,
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
        ],
      ),
    );
  }
}

class _DayCard extends StatelessWidget {
  const _DayCard({
    required this.reward,
    required this.status,
    required this.claimed,
  });

  final DailyRewardDay reward;
  final DailyRewardDayStatus status;
  final bool claimed;

  @override
  Widget build(BuildContext context) {
    final isToday = status == DailyRewardDayStatus.today;
    final isClaimed =
        status == DailyRewardDayStatus.claimed || (claimed && isToday);

    Color borderColor;
    Color backgroundColor;
    Color pointsColor;

    if (isClaimed) {
      borderColor = const Color(0xFF6EE7B7).withValues(alpha: 0.5);
      backgroundColor = const Color(0xFF34D399).withValues(alpha: 0.1);
      pointsColor = const Color(0xFFA7F3D0);
    } else if (isToday) {
      borderColor = const Color(0xFFF0ABFC).withValues(alpha: 0.7);
      backgroundColor = const Color(0xFFD946EF).withValues(alpha: 0.25);
      pointsColor = const Color(0xFFFBCFE8);
    } else {
      borderColor = Colors.white.withValues(alpha: 0.1);
      backgroundColor = Colors.black.withValues(alpha: 0.2);
      pointsColor = const Color(0xFF94A3B8);
    }

    return SizedBox(
      width: 92,
      height: double.infinity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: borderColor),
          boxShadow: isToday
              ? [
                  BoxShadow(
                    color: const Color(0xFFD946EF).withValues(alpha: 0.25),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  ),
                ]
              : null,
        ),
        child: Stack(
          children: [
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      reward.crown ? '♛' : '☆',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 20,
                        height: 1,
                        color: isToday ? Colors.white : const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      trp('home.dayUpper', {'day': reward.day}),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.45),
                        fontSize: 10,
                        height: 1.1,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '+${reward.points}',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: pointsColor,
                        fontSize: 18,
                        height: 1.1,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      tr('home.pts'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.35),
                        fontSize: 10,
                        height: 1.1,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (isClaimed)
              Positioned(
                top: 6,
                right: 6,
                child: Container(
                  width: 16,
                  height: 16,
                  decoration: const BoxDecoration(
                    color: Color(0xFF34D399),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_rounded,
                    size: 11,
                    color: Color(0xFF020617),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SuccessView extends StatelessWidget {
  const _SuccessView({
    required this.points,
    required this.totalPoints,
    required this.onContinue,
  });

  final int points;
  final int totalPoints;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 112,
            height: 112,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: [Color(0xFFFDE68A), Color(0xFFEC4899), Color(0xFF8B5CF6)],
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFEC4899).withValues(alpha: 0.45),
                  blurRadius: 28,
                ),
              ],
            ),
            child: Center(
              child: Text(
                '+$points',
                style: const TextStyle(
                  color: Color(0xFF0F172A),
                  fontSize: 34,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            tr('home.rewardClaimed'),
            style: const TextStyle(
              color: Color(0xFF6EE7B7),
              fontWeight: FontWeight.w900,
              fontSize: 11,
              letterSpacing: 1.6,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            trp('home.earnedPoints', {'points': points}),
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            tr('home.pointsAvailable'),
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.62),
              fontWeight: FontWeight.w600,
              height: 1.4,
            ),
          ),
          if (totalPoints > 0) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF34D399).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: const Color(0xFF6EE7B7).withValues(alpha: 0.25),
                ),
              ),
              child: Text(
                trp('home.currentTotal', {'total': totalPoints}),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFFD1FAE5),
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ],
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF22D3EE), Color(0xFF8B5CF6)],
                ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onContinue,
                  borderRadius: BorderRadius.circular(18),
                  child: Center(
                    child: Text(
                      tr('home.continueUpper'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
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
  }
}
