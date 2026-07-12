import 'package:flutter/material.dart';

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
    return MaterialApp(
      title: 'Music Mundial VOTE',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      home: AuthGate(authService: authService),
    );
  }
}
