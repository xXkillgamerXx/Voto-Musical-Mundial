import 'package:flutter/material.dart';

import '../widgets/auth_controls.dart';
import '../widgets/auth_scaffold.dart';

class ForgotPasswordPage extends StatelessWidget {
  const ForgotPasswordPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Recuperar contrasena',
      subtitle: 'Te enviaremos un enlace para volver a entrar a tu cuenta.',
      showBackButton: true,
      showBrandHeader: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AuthFieldLabel('Correo'),
          const SizedBox(height: 14),
          const TextField(
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              labelText: 'Correo electronico',
              prefixIcon: Icon(Icons.mail_outline),
            ),
          ),
          const SizedBox(height: 26),
          AuthGradientButton(label: 'Enviar enlace', onPressed: () {}),
          const SizedBox(height: 16),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Volver a iniciar sesion'),
          ),
        ],
      ),
    );
  }
}
