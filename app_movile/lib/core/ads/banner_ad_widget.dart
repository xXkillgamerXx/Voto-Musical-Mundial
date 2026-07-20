import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'ad_service.dart';
import 'admob_config.dart';

/// Banner adaptativo. Si falla la carga, no ocupa espacio.
class BannerAdWidget extends StatefulWidget {
  const BannerAdWidget({
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
    super.key,
  });

  final EdgeInsetsGeometry padding;

  @override
  State<BannerAdWidget> createState() => _BannerAdWidgetState();
}

class _BannerAdWidgetState extends State<BannerAdWidget> {
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

    final width = MediaQuery.sizeOf(context).width.truncate();
    final size = await AdSize.getLargeAnchoredAdaptiveBannerAdSize(width);
    if (!mounted || size == null) return;

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
          setState(() => _loaded = true);
        },
        onAdFailedToLoad: (ad, error) {
          debugPrint('BannerAd failed: $error');
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
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: SizedBox(
              width: _banner!.size.width.toDouble(),
              height: _banner!.size.height.toDouble(),
              child: AdWidget(ad: _banner!),
            ),
          ),
        ),
      ),
    );
  }
}
