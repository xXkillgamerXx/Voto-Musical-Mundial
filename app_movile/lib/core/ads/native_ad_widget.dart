import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'ad_service.dart';
import 'admob_config.dart';

/// Native Advanced in-feed. Si falla la carga, no ocupa espacio.
class NativeAdWidget extends StatefulWidget {
  const NativeAdWidget({
    this.padding = const EdgeInsets.symmetric(vertical: 8),
    this.height,
    super.key,
  });

  final EdgeInsetsGeometry padding;
  final double? height;

  @override
  State<NativeAdWidget> createState() => _NativeAdWidgetState();
}

class _NativeAdWidgetState extends State<NativeAdWidget> {
  NativeAd? _ad;
  bool _loaded = false;
  bool _loading = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    unawaited(_loadIfNeeded());
  }

  Future<void> _loadIfNeeded() async {
    if (!AdMobConfig.nativeAdsEnabled || _loading || _ad != null) return;
    if (!AdService.isReady) {
      await AdService.initialize();
      if (!mounted || !AdService.isReady) return;
    }

    _loading = true;
    final ad = NativeAd(
      adUnitId: AdMobConfig.nativeAdUnitId,
      factoryId: AdMobConfig.nativeFactoryId,
      request: const AdRequest(),
      listener: NativeAdListener(
        onAdLoaded: (ad) {
          if (!mounted) {
            ad.dispose();
            return;
          }
          setState(() {
            _ad = ad as NativeAd;
            _loaded = true;
            _loading = false;
          });
        },
        onAdFailedToLoad: (ad, error) {
          debugPrint(
            'NativeAd failed (${AdMobConfig.nativeAdUnitId}): $error',
          );
          ad.dispose();
          if (!mounted) {
            _loading = false;
            return;
          }
          setState(() {
            _ad = null;
            _loaded = false;
            _loading = false;
          });
        },
      ),
    );

    _ad = ad;
    await ad.load();
  }

  @override
  void dispose() {
    _ad?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!AdMobConfig.nativeAdsEnabled || !_loaded || _ad == null) {
      return const SizedBox.shrink();
    }

    final height = widget.height ?? AdMobConfig.nativeAdHeight;

    return Padding(
      padding: widget.padding,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: ColoredBox(
          color: const Color(0xFF120A2B),
          child: SizedBox(
            width: double.infinity,
            height: height,
            child: AdWidget(ad: _ad!),
          ),
        ),
      ),
    );
  }
}
