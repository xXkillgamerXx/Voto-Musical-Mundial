import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'ad_service.dart';
import 'admob_config.dart';

/// App Open: al abrir o volver a la app, con cooldown y sin apilar fullscreen.
class AppOpenAdService {
  AppOpenAdService._();

  static AppOpenAd? _ad;
  static bool _loading = false;
  static bool _showing = false;
  static DateTime? _loadedAt;
  static DateTime? _lastShownAt;
  static DateTime? _pausedAt;
  static bool _coldStartPending = true;

  /// App Open caduca tras 4h (recomendación AdMob).
  static const Duration _maxAdAge = Duration(hours: 4);

  static Future<void> preload() async {
    if (!AdMobConfig.appOpenAdsEnabled || _ad != null || _loading) return;
    if (!AdService.isReady) {
      await AdService.initialize();
      if (!AdService.isReady) return;
    }

    _loading = true;
    final completer = Completer<void>();

    await AppOpenAd.load(
      adUnitId: AdMobConfig.appOpenAdUnitId,
      request: const AdRequest(),
      adLoadCallback: AppOpenAdLoadCallback(
        onAdLoaded: (ad) {
          _ad = ad;
          _loadedAt = DateTime.now();
          _loading = false;
          if (!completer.isCompleted) completer.complete();
        },
        onAdFailedToLoad: (error) {
          debugPrint('AppOpenAd failed to load: $error');
          _ad = null;
          _loadedAt = null;
          _loading = false;
          if (!completer.isCompleted) completer.complete();
        },
      ),
    );

    await completer.future;
  }

  static bool get _adFresh {
    final loaded = _loadedAt;
    if (loaded == null || _ad == null) return false;
    return DateTime.now().difference(loaded) < _maxAdAge;
  }

  static bool get _cooldownOk {
    final last = _lastShownAt;
    if (last == null) return true;
    return DateTime.now().difference(last).inSeconds >=
        AdMobConfig.appOpenCooldownSeconds;
  }

  static void onAppPaused() {
    if (_showing) return;
    _pausedAt = DateTime.now();
  }

  /// Tras cold start: espera un momento y muestra 1 App Open si hay fill.
  static Future<void> showAfterColdStart() async {
    if (!_coldStartPending || !AdMobConfig.appOpenAdsEnabled) return;
    _coldStartPending = false;
    await Future<void>.delayed(const Duration(milliseconds: 1800));
    await showIfAvailable();
  }

  /// Al volver del background (si estuvo fuera lo suficiente).
  static Future<void> showOnResume() async {
    if (!AdMobConfig.appOpenAdsEnabled || _showing) return;

    final paused = _pausedAt;
    _pausedAt = null;
    if (paused == null) return;

    final awaySeconds = DateTime.now().difference(paused).inSeconds;
    if (awaySeconds < AdMobConfig.appOpenMinBackgroundSeconds) return;

    await showIfAvailable();
  }

  static Future<bool> showIfAvailable() async {
    if (!AdMobConfig.appOpenAdsEnabled || _showing || !_cooldownOk) {
      return false;
    }

    if (!_adFresh) {
      _ad?.dispose();
      _ad = null;
      await preload();
    }

    final ad = _ad;
    if (ad == null || !_adFresh) return false;

    _ad = null;
    _loadedAt = null;
    _showing = true;
    final completer = Completer<bool>();

    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        AdService.hideFullscreenCover();
        ad.dispose();
        _showing = false;
        unawaited(preload());
        if (!completer.isCompleted) completer.complete(true);
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        debugPrint('AppOpenAd failed to show: $error');
        AdService.hideFullscreenCover();
        ad.dispose();
        _showing = false;
        unawaited(preload());
        if (!completer.isCompleted) completer.complete(false);
      },
    );

    await ad.setImmersiveMode(true);
    AdService.showFullscreenCover();
    await Future<void>.delayed(const Duration(milliseconds: 16));
    _lastShownAt = DateTime.now();
    await ad.show();
    return completer.future;
  }
}
