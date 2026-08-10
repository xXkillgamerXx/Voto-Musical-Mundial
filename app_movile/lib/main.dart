import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'app/voto_music_app.dart';
import 'core/ads/ad_service.dart';
import 'core/auth/auth_session.dart';
import 'core/cache/response_cache.dart';
import 'core/i18n/app_locale.dart';
import 'core/i18n/i18n_registry.dart';
import 'core/navigation/app_deep_link.dart';
import 'features/auth/data/auth_service.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  await ResponseCache.init();
  await AdService.initialize();

  initI18n();
  await AppLocale.instance.load();
  await AppDeepLinkService.instance.startReferralCapture();

  final authSession = AuthSession();
  await authSession.load();

  final authService = AuthService(authSession);

  runApp(
    VotoMusicApp(
      authService: authService,
    ),
  );
}
