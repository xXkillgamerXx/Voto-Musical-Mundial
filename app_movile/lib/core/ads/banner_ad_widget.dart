import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'ad_service.dart';
import 'admob_config.dart';

/// Banner adaptativo con esquinas redondeadas. Si falla la carga, no ocupa espacio.
class BannerAdWidget extends StatefulWidget {
  const BannerAdWidget({
    this.padding = const EdgeInsets.symmetric(vertical: 4),
    super.key,
  });

  final EdgeInsetsGeometry padding;

  @override
  State<BannerAdWidget> createState() => _BannerAdWidgetState();
}

class _BannerAdWidgetState extends State<BannerAdWidget> {
  BannerAd? _banner;
  bool _loaded = false;
  bool _loading = false;
  int _attempt = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    unawaited(_loadIfNeeded());
  }

  Future<void> _loadIfNeeded({bool force = false}) async {
    if (!AdMobConfig.adsEnabled || _loading) return;
    if (!force && (_banner != null || _loaded)) return;
    if (!AdService.isReady) {
      await AdService.initialize();
      if (!mounted || !AdService.isReady) return;
    }

    _loading = true;
    _attempt += 1;

    final mediaWidth = MediaQuery.sizeOf(context).width;
    final horizontalPad = widget.padding.resolve(Directionality.of(context));
    final width =
        (mediaWidth - horizontalPad.horizontal).truncate().clamp(1, 9999);

    // 1er intento: adaptive. Si falla / no fill → banner fijo 320x50.
    AdSize? size;
    if (_attempt <= 1) {
      size = await AdSize.getAnchoredAdaptiveBannerAdSize(
        Orientation.portrait,
        width,
      );
    }
    size ??= AdSize.banner;
    if (!mounted) {
      _loading = false;
      return;
    }

    final ad = BannerAd(
      size: size,
      adUnitId: AdMobConfig.bannerAdUnitId,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (ad) {
          if (!mounted) {
            ad.dispose();
            return;
          }
          setState(() {
            _banner = ad as BannerAd;
            _loaded = true;
            _loading = false;
          });
        },
        onAdFailedToLoad: (ad, error) {
          debugPrint(
            'BannerAd failed (attempt $_attempt, '
            '${AdMobConfig.bannerAdUnitId}): $error',
          );
          ad.dispose();
          if (!mounted) {
            _loading = false;
            return;
          }
          setState(() {
            _banner = null;
            _loaded = false;
            _loading = false;
          });
          // Reintento una vez con tamaño fijo (o tras breve espera si fue no-fill).
          if (_attempt < 2) {
            unawaited(
              Future<void>.delayed(const Duration(seconds: 2), () {
                if (mounted) unawaited(_loadIfNeeded(force: true));
              }),
            );
          }
        },
      ),
    );

    _banner = ad;
    await ad.load();
  }

  @override
  void dispose() {
    _banner?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!AdMobConfig.adsEnabled || !_loaded || _banner == null) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: widget.padding,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: double.infinity,
          height: _banner!.size.height.toDouble(),
          child: AdWidget(ad: _banner!),
        ),
      ),
    );
  }
}
