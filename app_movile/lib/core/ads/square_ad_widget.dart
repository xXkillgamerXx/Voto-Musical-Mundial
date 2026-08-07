import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'ad_service.dart';
import 'admob_config.dart';

/// Anuncio cuadrado / medium rectangle (300x250), a ras sin marco.
class SquareAdWidget extends StatefulWidget {
  const SquareAdWidget({
    this.padding = const EdgeInsets.symmetric(vertical: 6),
    super.key,
  });

  final EdgeInsetsGeometry padding;

  @override
  State<SquareAdWidget> createState() => _SquareAdWidgetState();
}

class _SquareAdWidgetState extends State<SquareAdWidget> {
  BannerAd? _banner;
  bool _loaded = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _loadIfNeeded();
  }

  Future<void> _loadIfNeeded() async {
    if (_banner != null || !AdMobConfig.adsEnabled) return;
    if (!AdService.isReady) {
      await AdService.initialize();
      if (!mounted || !AdService.isReady) return;
    }

    final ad = BannerAd(
      size: AdSize.mediumRectangle,
      adUnitId: AdMobConfig.bannerAdUnitId,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (ad) {
          if (!mounted) {
            ad.dispose();
            return;
          }
          setState(() => _loaded = true);
        },
        onAdFailedToLoad: (ad, error) {
          debugPrint('SquareAd failed: $error');
          ad.dispose();
          if (mounted) {
            setState(() {
              _banner = null;
              _loaded = false;
            });
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
      child: Center(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            width: _banner!.size.width.toDouble(),
            height: _banner!.size.height.toDouble(),
            child: AdWidget(ad: _banner!),
          ),
        ),
      ),
    );
  }
}
