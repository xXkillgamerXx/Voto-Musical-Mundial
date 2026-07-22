import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../core/i18n/app_locale.dart';
import '../features/auth/data/auth_service.dart';
import '../features/auth/presentation/pages/auth_gate.dart';
import 'app_theme.dart';

class VotoMusicApp extends StatelessWidget {
  const VotoMusicApp({
    required this.authService,
    super.key,
  });

  final AuthService authService;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: AppLocale.instance,
      builder: (context, _) {
        return MaterialApp(
          title: 'Music Mundial VOTE',
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
          home: AuthGate(authService: authService),
        );
      },
    );
  }
}
