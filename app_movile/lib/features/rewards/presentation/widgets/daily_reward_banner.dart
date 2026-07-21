import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';
import '../../../auth/data/auth_service.dart';
import '../../data/rewards_api.dart';
import 'daily_reward_modal.dart';

class DailyRewardBanner extends StatelessWidget {
  const DailyRewardBanner({
    required this.authService,
    super.key,
  });

  final AuthService authService;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: authService.session,
      builder: (context, _) {
        final user = authService.session.user;
        final claimed = user?.hasClaimedDailyRewardToday ?? false;
        final streak = user?.dailyRewardStreak ?? 0;
        final activeDay = rewardDayFromStreak(
          nextStreakForClaim(
            lastClaimDate: user?.lastDailyRewardClaimDate ?? '',
            currentStreak: streak,
          ),
        );

        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 28, 16, 0),
          child: Material(
            color: Colors.transparent,
            clipBehavior: Clip.antiAlias,
            borderRadius: BorderRadius.circular(24),
            child: InkWell(
              onTap: () => DailyRewardModal.show(
                context,
                authService: authService,
              ),
              borderRadius: BorderRadius.circular(24),
              child: Ink(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      const Color(0xFF164E63).withValues(alpha: 0.55),
                      const Color(0xFF701A75).withValues(alpha: 0.45),
                      const Color(0xFF090B19),
                    ],
                  ),
                  border: Border.all(
                    color: const Color(0xFF67E8F9).withValues(alpha: 0.25),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(18),
                        color: const Color(0xFF22D3EE).withValues(alpha: 0.15),
                        border: Border.all(
                          color: const Color(0xFF67E8F9).withValues(alpha: 0.25),
                        ),
                      ),
                      child: Icon(
                        claimed ? Icons.check_circle_rounded : Icons.bolt_rounded,
                        color: claimed
                            ? const Color(0xFF6EE7B7)
                            : const Color(0xFF67E8F9),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tr('home.dailyReward'),
                            style: const TextStyle(
                              color: Color(0xFF67E8F9),
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.8,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            tr('home.sevenDayStreak'),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            claimed
                                ? trp('home.alreadyClaimedDay', {
                                    'day': activeDay,
                                  })
                                : tr('home.claimFreePoints'),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.58),
                              fontWeight: FontWeight.w600,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: claimed
                            ? const Color(0xFF34D399).withValues(alpha: 0.15)
                            : const Color(0xFFD946EF).withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: claimed
                              ? const Color(0xFF6EE7B7).withValues(alpha: 0.25)
                              : const Color(0xFFF0ABFC).withValues(alpha: 0.25),
                        ),
                      ),
                      child: Text(
                        claimed ? tr('home.done') : tr('home.open'),
                        style: TextStyle(
                          color: claimed
                              ? const Color(0xFF6EE7B7)
                              : const Color(0xFFF5D0FE),
                          fontWeight: FontWeight.w900,
                          fontSize: 10,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
