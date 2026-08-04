import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'admob_config.dart';
import 'rewarded_ad_service.dart';

class AdService {
  AdService._();

  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized || !AdMobConfig.adsEnabled) return;
    try {
      await MobileAds.instance.initialize();
      _initialized = true;
      unawaited(RewardedAdService.preload());
    } catch (error, stack) {
      debugPrint('AdMob init failed: $error\n$stack');
    }
  }

  static bool get isReady => _initialized && AdMobConfig.adsEnabled;
}
