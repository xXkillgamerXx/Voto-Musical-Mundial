import 'package:flutter/material.dart';

import '../features/auth/presentation/pages/login_page.dart';
import 'app_theme.dart';

class VotoMusicApp extends StatelessWidget {
  const VotoMusicApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Voto Musical Mundial',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      home: const LoginPage(),
    );
  }
}
