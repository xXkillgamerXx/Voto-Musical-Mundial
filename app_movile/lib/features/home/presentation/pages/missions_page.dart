import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';
import '../../../../core/ads/admob_config.dart';
import '../../../../core/ads/banner_ad_widget.dart';
import '../../../../core/ads/rewarded_ad_service.dart';
import '../../../../core/widgets/skeleton_box.dart';
import '../../../auth/data/auth_service.dart';
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
  late final MissionsApi _missionsApi;
  late Future<List<Mission>> _missionsFuture;
  bool _watchingAd = false;

  @override
  void initState() {
    super.initState();
    _missionsApi = MissionsApi(widget.authService.client);
    _missionsFuture = _missionsApi.getMissions();
  }

  Future<void> _reload({bool forceRefresh = true}) async {
    final future = _missionsApi.getMissions(forceRefresh: forceRefresh);
    setState(() => _missionsFuture = future);
    await future;
  }

  Future<void> _watchAdForPoints() async {
    if (_watchingAd || !AdMobConfig.adsEnabled) return;
    setState(() => _watchingAd = true);
    final result = await RewardedAdService.show();
    if (!mounted) return;
    setState(() => _watchingAd = false);

    if (result != RewardedAdResult.earned) {
      if (result != RewardedAdResult.dismissed) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('pollDetail.watchAdFailed'))),
        );
      }
      return;
    }

    final bonus = AdMobConfig.testRewardPoints;
    final user = widget.authService.session.user;
    if (user != null && AdMobConfig.useTestAds) {
      await widget.authService.session.updateUser(
        user.copyWith(points: user.points + bonus),
      );
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(trp('pollDetail.watchAdEarned', {'points': '$bonus'})),
      ),
    );
    setState(() {});
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
                padding: EdgeInsets.fromLTRB(16, 12, 16, 4),
              ),
              if (AdMobConfig.adsEnabled)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                  child: OutlinedButton.icon(
                    onPressed: _watchingAd ? null : _watchAdForPoints,
                    icon: _watchingAd
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.play_circle_outline_rounded),
                    label: Text(
                      _watchingAd
                          ? tr('pollDetail.watchAdLoading')
                          : trp('pollDetail.watchAdForPoints', {
                              'points': '${AdMobConfig.testRewardPoints}',
                            }),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFFDE68A),
                      side: BorderSide(
                        color: const Color(0xFFFDE68A).withValues(alpha: 0.45),
                      ),
                      minimumSize: const Size.fromHeight(48),
                    ),
                  ),
                ),
              MissionsSection(
                authService: widget.authService,
                missions: snapshot.data!,
                onMissionsChanged: () => _reload(),
              ),
            ],
          ),
        );
      },
    );
  }
}
