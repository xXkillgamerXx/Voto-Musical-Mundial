import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';
import '../../../../core/ads/admob_config.dart';
import '../../../../core/ads/ad_reward_gift.dart';
import '../../../../core/ads/banner_ad_widget.dart';
import '../../../../core/ads/rewarded_ad_service.dart';
import '../../../../core/api/api_exception.dart';
import '../../../../core/widgets/skeleton_box.dart';
import '../../../auth/data/auth_service.dart';
import '../../../rewards/data/rewards_api.dart';
import '../../data/mission.dart';
import '../../data/missions_api.dart';
import '../widgets/missions_section.dart';

class MissionsPage extends StatefulWidget {
  const MissionsPage({required this.authService, super.key});

  final AuthService authService;

  @override
  State<MissionsPage> createState() => _MissionsPageState();
}

class _MissionsPageState extends State<MissionsPage> {
  static const _dailyWatchLimit = 5;

  late final MissionsApi _missionsApi;
  late final RewardsApi _rewardsApi;
  late Future<List<Mission>> _missionsFuture;
  bool _watchingAd = false;
  int _watchedToday = 0;

  @override
  void initState() {
    super.initState();
    _missionsApi = MissionsApi(widget.authService.client);
    _rewardsApi = RewardsApi(widget.authService.client);
    _missionsFuture = _missionsApi.getMissions();
    _loadAdStatus();
  }

  Future<void> _loadAdStatus() async {
    if (!AdMobConfig.adsEnabled) return;
    try {
      final status = await _rewardsApi.getAdRewardStatus();
      if (!mounted) return;
      setState(() {
        _watchedToday = status.claimedToday.clamp(0, status.dailyLimit);
      });
    } catch (_) {
      // Si falla el status, se mantiene el contador local.
    }
  }

  Future<void> _reload({bool forceRefresh = true}) async {
    final future = _missionsApi.getMissions(forceRefresh: forceRefresh);
    setState(() => _missionsFuture = future);
    await Future.wait([future, _loadAdStatus()]);
  }

  Future<void> _watchAdForPoints() async {
    if (_watchingAd || !AdMobConfig.adsEnabled) return;
    if (_watchedToday >= _dailyWatchLimit) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('pollDetail.watchAdFailed'))),
      );
      return;
    }

    setState(() => _watchingAd = true);
    final result = await RewardedAdService.show();
    if (!mounted) return;

    if (result != RewardedAdResult.earned) {
      setState(() => _watchingAd = false);
      if (result != RewardedAdResult.dismissed) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('pollDetail.watchAdFailed'))),
        );
      }
      return;
    }

    try {
      final claim = await claimAndShowAdRewardGift(
        context: context,
        authService: widget.authService,
      );
      if (!mounted) return;
      setState(() {
        _watchingAd = false;
        if (claim != null) {
          _watchedToday = claim.claimedToday.clamp(0, _dailyWatchLimit);
        } else {
          _watchedToday = (_watchedToday + 1).clamp(0, _dailyWatchLimit);
        }
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _watchingAd = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
      await _loadAdStatus();
    } catch (_) {
      if (!mounted) return;
      setState(() => _watchingAd = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('pollDetail.watchAdFailed'))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Mission>>(
      future: _missionsFuture,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    color: Color(0xFFF0ABFC),
                    size: 42,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    tr('home.missionsLoadError'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => _reload(),
                    child: Text(tr('home.retry')),
                  ),
                ],
              ),
            ),
          );
        }

        if (!snapshot.hasData) {
          return const Padding(
            padding: EdgeInsets.fromLTRB(16, 24, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: SkeletonBox(height: 12, width: 140),
                ),
                SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: SkeletonBox(height: 28, width: 180),
                ),
                SizedBox(height: 18),
                SkeletonBox(height: 320),
              ],
            ),
          );
        }

        return RefreshIndicator(
          color: const Color(0xFFF0ABFC),
          backgroundColor: const Color(0xFF120A2B),
          onRefresh: () => _reload(),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.only(bottom: 120),
            children: [
              const BannerAdWidget(
                padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
              ),
              MissionsSection(
                authService: widget.authService,
                missions: snapshot.data!,
                onMissionsChanged: () => _reload(),
                listHeader: AdMobConfig.adsEnabled
                    ? _WatchAdMissionCard(
                        points: AdMobConfig.rewardedVideoPoints,
                        watched: _watchedToday,
                        limit: _dailyWatchLimit,
                        loading: _watchingAd,
                        onTap: _watchAdForPoints,
                      )
                    : null,
              ),
            ],
          ),
        );
      },
    );
  }
}

class _WatchAdMissionCard extends StatelessWidget {
  const _WatchAdMissionCard({
    required this.points,
    required this.watched,
    required this.limit,
    required this.loading,
    required this.onTap,
  });

  final int points;
  final int watched;
  final int limit;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final done = watched >= limit;
    const accent = Color(0xFFFBBF24);
    const rewardColor = Color(0xFFFDE68A);
    final progress = (watched / limit).clamp(0.0, 1.0);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: done || loading ? null : onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            color: done ? const Color(0xFF0B2A22) : const Color(0xFF1A150C),
            border: Border.all(
              width: 1.5,
              color: (done ? const Color(0xFF34D399) : accent)
                  .withValues(alpha: done ? 0.55 : 0.4),
            ),
            boxShadow: [
              BoxShadow(
                color: accent.withValues(alpha: 0.18),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.35),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      color: accent.withValues(alpha: 0.14),
                      border: Border.all(
                        color: accent.withValues(alpha: 0.35),
                      ),
                    ),
                    child: loading
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: rewardColor,
                            ),
                          )
                        : Icon(
                            done
                                ? Icons.check_rounded
                                : Icons.play_circle_fill_rounded,
                            size: 24,
                            color: done
                                ? const Color(0xFF6EE7B7)
                                : rewardColor,
                          ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          loading
                              ? tr('pollDetail.watchAdLoading')
                              : tr('pollDetail.watchAdMissionTitle'),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            height: 1.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          tr('pollDetail.watchAdMissionDescription'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.55),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            height: 1.25,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 9,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: accent.withValues(alpha: 0.16),
                      border: Border.all(
                        color: accent.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Text(
                      '+$points pts',
                      style: const TextStyle(
                        color: rewardColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        minHeight: 6,
                        value: progress,
                        backgroundColor: Colors.white.withValues(alpha: 0.1),
                        valueColor: AlwaysStoppedAnimation<Color>(
                          done ? const Color(0xFF34D399) : accent,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    '$watched/$limit',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.75),
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                  const SizedBox(width: 6),
                  Icon(
                    done
                        ? Icons.check_circle_rounded
                        : Icons.chevron_right_rounded,
                    size: 20,
                    color: done
                        ? const Color(0xFF34D399)
                        : Colors.white.withValues(alpha: 0.4),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
