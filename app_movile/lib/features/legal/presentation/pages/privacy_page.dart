import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';
import '../../../../core/utils/strip_html.dart';
import '../../../auth/data/auth_service.dart';
import '../../../fan/data/fan_api.dart';
import '../../../fan/data/fan_models.dart';

class PrivacyPage extends StatefulWidget {
  const PrivacyPage({required this.authService, super.key});

  final AuthService authService;

  @override
  State<PrivacyPage> createState() => _PrivacyPageState();
}

class _PrivacyPageState extends State<PrivacyPage> {
  late Future<PrivacyPolicy> _future;

  @override
  void initState() {
    super.initState();
    _future = FanApi(widget.authService.client).getPrivacy();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF05010E),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: Text(tr('settings.privacy')),
      ),
      body: FutureBuilder<PrivacyPolicy>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  tr('privacy.loadError'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70),
                ),
              ),
            );
          }
          if (!snapshot.hasData) {
            return const Center(
              child: CircularProgressIndicator(color: Color(0xFFFF21C8)),
            );
          }
          final policy = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              Text(
                policy.title.isEmpty ? tr('settings.privacy') : policy.title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
              if (policy.intro.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  policy.intro,
                  style: const TextStyle(
                    color: Color(0xFFCBD5E1),
                    height: 1.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              const SizedBox(height: 18),
              Text(
                stripHtml(policy.bodyHtml),
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.78),
                  height: 1.55,
                  fontSize: 14,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
