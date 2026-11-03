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
  static Future<void>? _initializing;

  /// Fondo negro bajo anuncios fullscreen (tapando el header de la app).
  static final ValueNotifier<bool> fullscreenCover =
      ValueNotifier<bool>(false);

  static void showFullscreenCover() {
    fullscreenCover.value = true;
  }

  static void hideFullscreenCover() {
    fullscreenCover.value = false;
  }

  static Future<void> initialize() {
    if (_initialized || kIsWeb) return Future.value();
    return _initializing ??= _initialize();
  }

  static Future<void> _initialize() async {
    try {
      // Inicializa siempre el SDK; la visibilidad la controla AdMobConfig.
      // En emulador la llamada a Google puede colgarse; no esperamos más de 8s.
      await MobileAds.instance.initialize().timeout(const Duration(seconds: 8));
      _initialized = true;
      if (AdMobConfig.adsEnabled) {
        unawaited(RewardedAdService.preload());
        unawaited(InterstitialAdService.preload());
        unawaited(AppOpenAdService.preload());
      }
    } catch (error, stack) {
      _initializing = null;
      debugPrint('AdMob init failed: $error\n$stack');
    }
  }

  static bool get isReady => _initialized;
}
