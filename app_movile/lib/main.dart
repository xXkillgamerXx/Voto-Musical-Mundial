import 'package:flutter/material.dart';

import 'app/voto_music_app.dart';
import 'core/auth/auth_session.dart';
import 'features/auth/data/auth_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final authSession = AuthSession();
  await authSession.load();

  final authService = AuthService(authSession);

  runApp(
    VotoMusicApp(
      authService: authService,
    ),
  );
}
