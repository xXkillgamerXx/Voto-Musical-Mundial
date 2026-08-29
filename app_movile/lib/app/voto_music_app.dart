import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../core/ads/admob_config.dart';
import '../core/ads/app_open_ad_service.dart';
import '../core/i18n/app_locale.dart';
import '../features/auth/data/auth_service.dart';
import '../features/auth/presentation/pages/auth_gate.dart';
import 'app_theme.dart';

class VotoMusicApp extends StatefulWidget {
  const VotoMusicApp({
    required this.authService,
    super.key,
  });

  final AuthService authService;

  @override
  State<VotoMusicApp> createState() => _VotoMusicAppState();
}

class _VotoMusicAppState extends State<VotoMusicApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (AdMobConfig.appOpenAdsEnabled) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaited(AppOpenAdService.showAfterColdStart());
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!AdMobConfig.appOpenAdsEnabled) return;

    // No usar `inactive`: también dispara al abrir el propio App Open.
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      AppOpenAdService.onAppPaused();
      return;
    }

    if (state == AppLifecycleState.resumed) {
      unawaited(AppOpenAdService.showOnResume());
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: AppLocale.instance,
      builder: (context, _) {
        return MaterialApp(
          title: 'Music Mundial VOTING',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.dark,
          darkTheme: AppTheme.dark,
          themeMode: ThemeMode.dark,
          locale: AppLocale.instance.locale,
          supportedLocales: const [Locale('es'), Locale('en')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: AuthGate(authService: widget.authService),
        );
      },
    );
  }
}
