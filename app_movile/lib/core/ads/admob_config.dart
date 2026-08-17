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

  /// En lista estándar: 0 = un solo banner fijo en la vista (no en el feed).
  static const int bannerEveryNContestants = 0;

  /// En rondas versus: 0 = sin banners repetidos en el feed.
  static const int bannerEveryNVersus = 0;

  /// En Artistas: 0 = un banner por pantalla (no cada N cards).
  static const int bannerEveryNArtists = 0;

  /// En Votaciones: 0 = un banner por pantalla.
  static const int bannerEveryNPolls = 0;

  /// En Artistas: anuncio cuadrado (300x250) cada N cards.
  static const int squareEveryNArtists = 4;

  /// Nativo avanzado en listas de Artistas (0 = off).
  /// Regla segura: cada 4–6 ítems + máximo ~2–3 visibles.
  static const int nativeEveryNArtists = 5;

  /// Nativo avanzado en listas de Votaciones (0 = off).
  static const int nativeEveryNPolls = 4;

  /// Nativo en noticias (0 = off).
  static const int nativeEveryNNews = 5;

  /// factoryId registrado en MainActivity (Android).
  static const String nativeFactoryId = 'listNative';

  /// Altura del nativo in-feed (media + CTA).
  static const double nativeAdHeight = 340;

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
      'ca-app-pub-6893073726792422/2624356965';
  static const String prodIosBannerId = '';
  static const String prodAndroidInterstitialId =
      'ca-app-pub-6893073726792422/5965987556';
  static const String prodIosInterstitialId = '';
  static const String prodAndroidRewardedId =
      'ca-app-pub-6893073726792422/6238998458';
  static const String prodIosRewardedId = '';

  // Native Advanced de prueba oficiales.
  static const String testAndroidNativeId =
      'ca-app-pub-3940256099942544/2247696110';
  static const String testIosNativeId =
      'ca-app-pub-3940256099942544/3986624511';

  // Native Advanced reales. Pega aquí el ID de AdMob (Android).
  static const String prodAndroidNativeId =
      'ca-app-pub-6893073726792422/6177043411';
  static const String prodIosNativeId = '';

  // App Open de prueba oficiales.
  static const String testAndroidAppOpenId =
      'ca-app-pub-3940256099942544/9257395921';
  static const String testIosAppOpenId =
      'ca-app-pub-3940256099942544/5575463023';

  // App Open reales.
  static const String prodAndroidAppOpenId =
      'ca-app-pub-6893073726792422/2145661036';
  static const String prodIosAppOpenId = '';

  /// Segundos mínimos entre App Open (evita saturar al cambiar de app).
  static const int appOpenCooldownSeconds = 180;

  /// Segundos mínimos en background antes de mostrar App Open al volver.
  static const int appOpenMinBackgroundSeconds = 15;

  static bool get adsEnabled {
    if (hideAds) return false;
    if (kIsWeb) return false;
    if (!(Platform.isAndroid || Platform.isIOS)) return false;
    if (useTestAds) return true;
    return bannerAdUnitId.isNotEmpty ||
        rewardedAdUnitId.isNotEmpty ||
        interstitialAdUnitId.isNotEmpty ||
        nativeAdUnitId.isNotEmpty ||
        appOpenAdUnitId.isNotEmpty;
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

  static String get nativeAdUnitId {
    if (useTestAds || kDebugMode) {
      return Platform.isIOS ? testIosNativeId : testAndroidNativeId;
    }
    return Platform.isIOS ? prodIosNativeId : prodAndroidNativeId;
  }

  static String get appOpenAdUnitId {
    if (useTestAds || kDebugMode) {
      return Platform.isIOS ? testIosAppOpenId : testAndroidAppOpenId;
    }
    final prod = Platform.isIOS ? prodIosAppOpenId : prodAndroidAppOpenId;
    if (prod.isEmpty) {
      return Platform.isIOS ? testIosAppOpenId : testAndroidAppOpenId;
    }
    return prod;
  }

  /// Solo activo en debug (test) o cuando ya pegaste el ID real de producción.
  static bool get nativeAdsEnabled {
    if (!adsEnabled || kIsWeb) return false;
    if (useTestAds || kDebugMode) return true;
    return nativeAdUnitId.isNotEmpty;
  }

  static bool get appOpenAdsEnabled {
    if (!adsEnabled || kIsWeb) return false;
    if (useTestAds || kDebugMode) return true;
    final prod = Platform.isIOS ? prodIosAppOpenId : prodAndroidAppOpenId;
    return prod.isNotEmpty;
  }
}
