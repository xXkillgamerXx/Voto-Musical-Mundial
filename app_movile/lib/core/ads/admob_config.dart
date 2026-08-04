import 'dart:io';

import 'package:flutter/foundation.dart';

/// IDs de AdMob.
///
/// Mientras [useTestAds] sea true se usan los IDs de prueba oficiales de Google.
/// Cuando tengas la app en AdMob:
/// 1. Pon tus App IDs reales en AndroidManifest.xml e Info.plist
/// 2. Rellena los prod*Id
/// 3. Cambia [useTestAds] a false
class AdMobConfig {
  AdMobConfig._();

  /// Mantener en true hasta publicar con IDs reales.
  static const bool useTestAds = true;

  /// Oculta todos los anuncios (true = no se muestran).
  static const bool hideAds = false;

  /// Puntos de demo al completar un rewarded en modo test.
  static const int testRewardPoints = 5;

  // App IDs de prueba (también en AndroidManifest / Info.plist).
  static const String testAndroidAppId =
      'ca-app-pub-3940256099942544~3347511713';
  static const String testIosAppId = 'ca-app-pub-3940256099942544~1458002511';

  // Banner de prueba oficiales.
  static const String testAndroidBannerId =
      'ca-app-pub-3940256099942544/6300978111';
  static const String testIosBannerId =
      'ca-app-pub-3940256099942544/2934735716';

  // Rewarded de prueba oficiales.
  static const String testAndroidRewardedId =
      'ca-app-pub-3940256099942544/5224354917';
  static const String testIosRewardedId =
      'ca-app-pub-3940256099942544/1712485313';

  // TODO: reemplazar con tus ad units reales de AdMob.
  static const String prodAndroidBannerId = '';
  static const String prodIosBannerId = '';
  static const String prodAndroidRewardedId = '';
  static const String prodIosRewardedId = '';

  static bool get adsEnabled {
    if (hideAds) return false;
    if (kIsWeb) return false;
    if (!(Platform.isAndroid || Platform.isIOS)) return false;
    if (useTestAds) return true;
    return bannerAdUnitId.isNotEmpty || rewardedAdUnitId.isNotEmpty;
  }

  static String get bannerAdUnitId {
    if (useTestAds || kDebugMode) {
      return Platform.isIOS ? testIosBannerId : testAndroidBannerId;
    }
    final prod = Platform.isIOS ? prodIosBannerId : prodAndroidBannerId;
    if (prod.isEmpty) {
      return Platform.isIOS ? testIosBannerId : testAndroidBannerId;
    }
    return prod;
  }

  static String get rewardedAdUnitId {
    if (useTestAds || kDebugMode) {
      return Platform.isIOS ? testIosRewardedId : testAndroidRewardedId;
    }
    final prod = Platform.isIOS ? prodIosRewardedId : prodAndroidRewardedId;
    if (prod.isEmpty) {
      return Platform.isIOS ? testIosRewardedId : testAndroidRewardedId;
    }
    return prod;
  }
}
