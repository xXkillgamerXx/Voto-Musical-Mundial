import 'dart:io';

import 'package:flutter/foundation.dart';

/// IDs de AdMob.
///
/// - `flutter run` (debug): App ID + unidades de **prueba** de Google → siempre
///   salen "Anuncio de prueba".
/// - `flutter build apk --release`: App ID + unidades **reales** tuyas.
///
/// Tus IDs reales están en [prodAndroid*]. No hace falta tocar [useTestAds]
/// para desarrollo diario.
class AdMobConfig {
  AdMobConfig._();

  /// false = en release usa IDs reales. En debug siempre se usan test units.
  static const bool useTestAds = false;

  /// Oculta todos los anuncios (true = no se muestran).
  static const bool hideAds = false;

  /// Puntos al completar un video rewarded (UI de regalo).
  static const int rewardedVideoPoints = 5;

  /// En lista estándar, inserta un banner cada N artistas.
  static const int bannerEveryNContestants = 4;

  /// En rondas versus, inserta un banner cada N duelos.
  static const int bannerEveryNVersus = 2;

  /// En Artistas: banner cada N cards.
  static const int bannerEveryNArtists = 4;

  /// En Votaciones: banner cada N poll cards.
  static const int bannerEveryNPolls = 4;

  /// En Artistas: anuncio cuadrado (300x250) cada N cards.
  static const int squareEveryNArtists = 4;

  /// Segundos mínimos entre interstitials.
  static const int interstitialCooldownSeconds = 90;

  // App IDs de prueba (también en AndroidManifest / Info.plist).
  static const String testAndroidAppId =
      'ca-app-pub-3940256099942544~3347511713';
  static const String testIosAppId = 'ca-app-pub-3940256099942544~1458002511';

  // Banner de prueba oficiales.
  static const String testAndroidBannerId =
      'ca-app-pub-3940256099942544/6300978111';
  static const String testIosBannerId =
      'ca-app-pub-3940256099942544/2934735716';

  // Interstitial de prueba oficiales.
  static const String testAndroidInterstitialId =
      'ca-app-pub-3940256099942544/1033173712';
  static const String testIosInterstitialId =
      'ca-app-pub-3940256099942544/4411468910';

  // Rewarded de prueba oficiales.
  static const String testAndroidRewardedId =
      'ca-app-pub-3940256099942544/5224354917';
  static const String testIosRewardedId =
      'ca-app-pub-3940256099942544/1712485313';

  // Ad units reales (Android). iOS pendiente.
  static const String prodAndroidBannerId =
      'ca-app-pub-6893073726792422/8526516377';
  static const String prodIosBannerId = '';
  static const String prodAndroidInterstitialId =
      'ca-app-pub-6893073726792422/5965987556';
  static const String prodIosInterstitialId = '';
  static const String prodAndroidRewardedId =
      'ca-app-pub-6893073726792422/6238998458';
  static const String prodIosRewardedId = '';

  static bool get adsEnabled {
    if (hideAds) return false;
    if (kIsWeb) return false;
    if (!(Platform.isAndroid || Platform.isIOS)) return false;
    if (useTestAds) return true;
    return bannerAdUnitId.isNotEmpty ||
        rewardedAdUnitId.isNotEmpty ||
        interstitialAdUnitId.isNotEmpty;
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

  static String get interstitialAdUnitId {
    if (useTestAds || kDebugMode) {
      return Platform.isIOS
          ? testIosInterstitialId
          : testAndroidInterstitialId;
    }
    final prod =
        Platform.isIOS ? prodIosInterstitialId : prodAndroidInterstitialId;
    if (prod.isEmpty) {
      return Platform.isIOS
          ? testIosInterstitialId
          : testAndroidInterstitialId;
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
