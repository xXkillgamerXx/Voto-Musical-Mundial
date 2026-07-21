import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';
import '../widgets/auth_scaffold.dart';

class TermsConditionsPage extends StatelessWidget {
  const TermsConditionsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: tr('auth.termsTitle'),
      subtitle: '',
      showBackButton: true,
      showBrandHeader: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _TermsCard(
            title: tr('auth.termsCard1Title'),
            body: tr('auth.termsCard1Body'),
          ),
          const SizedBox(height: 14),
          _TermsCard(
            title: tr('auth.termsCard2Title'),
            body: tr('auth.termsCard2Body'),
          ),
          const SizedBox(height: 14),
          _TermsCard(
            title: tr('auth.termsCard3Title'),
            body: tr('auth.termsCard3Body'),
          ),
        ],
      ),
    );
  }
}

class _TermsCard extends StatelessWidget {
  const _TermsCard({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: colorScheme.outlineVariant.withValues(alpha: 0.5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Text(
            body,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}
