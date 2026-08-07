import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'ad_service.dart';
import 'admob_config.dart';

/// Interstitial full-screen. Se muestra de vez en cuando con cooldown.
class InterstitialAdService {
  InterstitialAdService._();

  static InterstitialAd? _ad;
  static bool _loading = false;
  static DateTime? _lastShownAt;

  static Future<void> preload() async {
    if (!AdMobConfig.adsEnabled || _ad != null || _loading) return;
    if (!AdService.isReady) {
      await AdService.initialize();
      if (!AdService.isReady) return;
    }

    _loading = true;
    final completer = Completer<void>();

    await InterstitialAd.load(
      adUnitId: AdMobConfig.interstitialAdUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          _ad = ad;
          _loading = false;
          if (!completer.isCompleted) completer.complete();
        },
        onAdFailedToLoad: (error) {
          debugPrint('InterstitialAd failed to load: $error');
          _ad = null;
          _loading = false;
          if (!completer.isCompleted) completer.complete();
        },
      ),
    );

    await completer.future;
  }

  static bool get _cooldownOk {
    final last = _lastShownAt;
    if (last == null) return true;
    return DateTime.now().difference(last).inSeconds >=
        AdMobConfig.interstitialCooldownSeconds;
  }

  /// Muestra interstitial si hay uno listo y pasó el cooldown.
  static Future<bool> showIfAvailable() async {
    if (!AdMobConfig.adsEnabled || !_cooldownOk) return false;

    if (_ad == null) {
      await preload();
    }

    final ad = _ad;
    if (ad == null) return false;

    _ad = null;
    final completer = Completer<bool>();

    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        AdService.hideFullscreenCover();
        ad.dispose();
        unawaited(preload());
        if (!completer.isCompleted) completer.complete(true);
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        debugPrint('InterstitialAd failed to show: $error');
        AdService.hideFullscreenCover();
        ad.dispose();
        unawaited(preload());
        if (!completer.isCompleted) completer.complete(false);
      },
    );

    // Cubre status bar / notch; evita que se vea el header de la app detrás.
    await ad.setImmersiveMode(true);
    AdService.showFullscreenCover();
    // Dale un frame al overlay negro antes de abrir el AdActivity.
    await Future<void>.delayed(const Duration(milliseconds: 16));
    _lastShownAt = DateTime.now();
    await ad.show();
    return completer.future;
  }
}
