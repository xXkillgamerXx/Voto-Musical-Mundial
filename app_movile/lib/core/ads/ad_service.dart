import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'admob_config.dart';
import 'app_open_ad_service.dart';
import 'interstitial_ad_service.dart';
import 'rewarded_ad_service.dart';

class AdService {
  AdService._();

  static bool _initialized = false;

  /// Fondo negro bajo anuncios fullscreen (tapando el header de la app).
  static final ValueNotifier<bool> fullscreenCover =
      ValueNotifier<bool>(false);

  static void showFullscreenCover() {
    fullscreenCover.value = true;
  }

  static void hideFullscreenCover() {
    fullscreenCover.value = false;
  }

  static Future<void> initialize() async {
    if (_initialized || !AdMobConfig.adsEnabled) return;
    try {
      await MobileAds.instance.initialize();
      _initialized = true;
      unawaited(RewardedAdService.preload());
      unawaited(InterstitialAdService.preload());
      unawaited(AppOpenAdService.preload());
    } catch (error, stack) {
      debugPrint('AdMob init failed: $error\n$stack');
    }
  }

  static bool get isReady => _initialized && AdMobConfig.adsEnabled;
}
