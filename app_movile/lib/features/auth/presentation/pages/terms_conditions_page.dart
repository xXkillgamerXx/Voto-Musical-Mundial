import 'package:flutter/material.dart';

import '../widgets/auth_scaffold.dart';

class TermsConditionsPage extends StatelessWidget {
  const TermsConditionsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Términos y condiciones',
      subtitle: '',
      showBackButton: true,
      showBrandHeader: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: const [
          _TermsCard(
            title: 'Uso responsable',
            body:
                'Al crear una cuenta aceptas usar la plataforma de forma responsable y respetar las reglas de votación.',
          ),
          SizedBox(height: 14),
          _TermsCard(
            title: 'Puntos y recompensas',
            body:
                'Los puntos, recompensas y rachas pueden ajustarse si se detecta abuso, fraude o actividad automática.',
          ),
          SizedBox(height: 14),
          _TermsCard(
            title: 'Datos de cuenta',
            body:
                'Tu correo se usa para iniciar sesión, recuperar tu cuenta y guardar tu progreso dentro de la app.',
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
