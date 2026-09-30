import 'dart:io';

import 'package:flutter/foundation.dart';

import '../fan/fan_perks.dart';

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

  /// App ID real de iOS (AdMob → Apps → app iOS → Configuración).
  /// Vacío = en iOS se usan unidades de **prueba** (coinciden con Info.plist).
  /// Cuando lo pegues, actualiza también `GADApplicationIdentifier` en Info.plist.
  static const String prodIosAppId = '';

  static const String prodAndroidAppId =
      'ca-app-pub-6893073726792422~4091397597';

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

  // Ad units reales. iOS vacío = no se muestra ese anuncio en release.
  static const String prodAndroidBannerId =
      'ca-app-pub-6893073726792422/2624356965';
  static const String prodIosBannerId =
      'ca-app-pub-6893073726792422/2243609207';
  static const String prodAndroidInterstitialId =
      'ca-app-pub-6893073726792422/5965987556';
  static const String prodIosInterstitialId = '';
  static const String prodAndroidRewardedId =
      'ca-app-pub-6893073726792422/6238998458';
  static const String prodIosRewardedId =
      'ca-app-pub-6893073726792422/4559790519';

  // Native Advanced de prueba oficiales.
  static const String testAndroidNativeId =
      'ca-app-pub-3940256099942544/2247696110';
  static const String testIosNativeId =
      'ca-app-pub-3940256099942544/3986624511';

  // Native Advanced reales. Pega aquí el ID de AdMob (Android).
  static const String prodAndroidNativeId =
      'ca-app-pub-6893073726792422/6177043411';
  static const String prodIosNativeId =
      'ca-app-pub-6893073726792422/1682345736';

  // App Open de prueba oficiales.
  static const String testAndroidAppOpenId =
      'ca-app-pub-3940256099942544/9257395921';
  static const String testIosAppOpenId =
      'ca-app-pub-3940256099942544/5575463023';

  // App Open reales.
  static const String prodAndroidAppOpenId =
      'ca-app-pub-6893073726792422/2145661036';
  static const String prodIosAppOpenId =
      'ca-app-pub-6893073726792422/9369264061';

  /// Segundos mínimos entre App Open (evita saturar al cambiar de app).
  static const int appOpenCooldownSeconds = 180;

  /// Segundos mínimos en background antes de mostrar App Open al volver.
  static const int appOpenMinBackgroundSeconds = 15;

  static bool get adsEnabled {
    if (hideAds) return false;
    if (FanPerks.instance.hideAds) return false;
    if (kIsWeb) return false;
    if (!(Platform.isAndroid || Platform.isIOS)) return false;
    return bannerAdsEnabled ||
        rewardedAdsEnabled ||
        interstitialAdsEnabled ||
        nativeAdsEnabled ||
        appOpenAdsEnabled;
  }

  /// En iOS, sin App ID real en Info.plist las unidades prod no cargan.
  static bool get _useTestAdUnits {
    if (useTestAds || kDebugMode) return true;
    if (Platform.isIOS && prodIosAppId.isEmpty) return true;
    return false;
  }

  /// Sin ID → no se muestra (no cae a anuncios de prueba en release).
  static String get bannerAdUnitId {
    if (_useTestAdUnits) {
      return Platform.isIOS ? testIosBannerId : testAndroidBannerId;
    }
    return Platform.isIOS ? prodIosBannerId : prodAndroidBannerId;
  }

  static String get interstitialAdUnitId {
    if (_useTestAdUnits) {
      return Platform.isIOS
          ? testIosInterstitialId
          : testAndroidInterstitialId;
    }
    return Platform.isIOS ? prodIosInterstitialId : prodAndroidInterstitialId;
  }

  static String get rewardedAdUnitId {
    if (_useTestAdUnits) {
      return Platform.isIOS ? testIosRewardedId : testAndroidRewardedId;
    }
    return Platform.isIOS ? prodIosRewardedId : prodAndroidRewardedId;
  }

  static String get nativeAdUnitId {
    if (_useTestAdUnits) {
      return Platform.isIOS ? testIosNativeId : testAndroidNativeId;
    }
    return Platform.isIOS ? prodIosNativeId : prodAndroidNativeId;
  }

  static String get appOpenAdUnitId {
    if (_useTestAdUnits) {
      return Platform.isIOS ? testIosAppOpenId : testAndroidAppOpenId;
    }
    return Platform.isIOS ? prodIosAppOpenId : prodAndroidAppOpenId;
  }

  static bool get bannerAdsEnabled =>
      !hideAds &&
      !FanPerks.instance.hideAds &&
      !kIsWeb &&
      bannerAdUnitId.isNotEmpty;

  static bool get interstitialAdsEnabled =>
      !hideAds &&
      !FanPerks.instance.hideAds &&
      !kIsWeb &&
      interstitialAdUnitId.isNotEmpty;

  static bool get rewardedAdsEnabled =>
      !hideAds &&
      !FanPerks.instance.hideAds &&
      !kIsWeb &&
      rewardedAdUnitId.isNotEmpty;

  /// Nativos requieren factory nativa (solo Android hoy).
  static bool get nativeAdsEnabled {
    if (hideAds || FanPerks.instance.hideAds || kIsWeb) return false;
    if (Platform.isIOS) return false;
    return nativeAdUnitId.isNotEmpty;
  }

  static bool get appOpenAdsEnabled =>
      !hideAds &&
      !FanPerks.instance.hideAds &&
      !kIsWeb &&
      appOpenAdUnitId.isNotEmpty;
}
