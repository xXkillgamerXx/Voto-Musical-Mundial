import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'ad_service.dart';
import 'admob_config.dart';

enum RewardedAdResult {
  earned,
  dismissed,
  failed,
  unavailable,
}

/// Carga y muestra anuncios rewarded (video por puntos).
class RewardedAdService {
  RewardedAdService._();

  static RewardedAd? _ad;
  static bool _loading = false;

  static bool get isReady => _ad != null;

  static Future<void> preload() async {
    if (!AdMobConfig.adsEnabled || _ad != null || _loading) return;
    if (!AdService.isReady) {
      await AdService.initialize();
      if (!AdService.isReady) return;
    }

    _loading = true;
    final completer = Completer<void>();

    await RewardedAd.load(
      adUnitId: AdMobConfig.rewardedAdUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          _ad = ad;
          _loading = false;
          if (!completer.isCompleted) completer.complete();
        },
        onAdFailedToLoad: (error) {
          debugPrint('RewardedAd failed to load: $error');
          _ad = null;
          _loading = false;
          if (!completer.isCompleted) completer.complete();
        },
      ),
    );

    await completer.future;
  }

  static Future<RewardedAdResult> show() async {
    if (!AdMobConfig.adsEnabled) return RewardedAdResult.unavailable;

    if (_ad == null) {
      await preload();
    }

    final ad = _ad;
    if (ad == null) return RewardedAdResult.unavailable;

    _ad = null;
    final completer = Completer<RewardedAdResult>();
    var earned = false;

    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        ad.dispose();
        unawaited(preload());
        if (!completer.isCompleted) {
          completer.complete(
            earned ? RewardedAdResult.earned : RewardedAdResult.dismissed,
          );
        }
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        debugPrint('RewardedAd failed to show: $error');
        ad.dispose();
        unawaited(preload());
        if (!completer.isCompleted) {
          completer.complete(RewardedAdResult.failed);
        }
      },
    );

    await ad.show(
      onUserEarnedReward: (ad, reward) {
        earned = true;
      },
    );

    return completer.future;
  }
}
