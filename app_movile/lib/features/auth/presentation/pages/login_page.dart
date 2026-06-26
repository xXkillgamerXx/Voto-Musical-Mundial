import 'package:flutter/material.dart';

import '../widgets/auth_controls.dart';
import '../widgets/auth_scaffold.dart';
import 'forgot_password_page.dart';
import 'register_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  bool _obscurePassword = true;
  bool _rememberPassword = true;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return AuthScaffold(
      title: 'Iniciar sesion',
      subtitle:
          'Inicia en tu cuenta para votar, recibir recompensas y seguir a tus artistas.',
      footer: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          const Text('No tienes cuenta?'),
          TextButton(
            onPressed: () {
              Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const RegisterPage()));
            },
            child: const Text('Crear cuenta'),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AuthGoogleButton(),
          const SizedBox(height: 10),
          const AuthDivider(),
          const SizedBox(height: 10),
          const AuthFieldLabel('Correo'),
          const SizedBox(height: 10),
          const TextField(
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              labelText: 'Correo electronico',
              prefixIcon: Icon(Icons.mail_outline),
            ),
          ),
          const SizedBox(height: 18),
          const AuthFieldLabel('Contrasena'),
          const SizedBox(height: 10),
          TextField(
            obscureText: _obscurePassword,
            decoration: InputDecoration(
              labelText: 'Contrasena',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                onPressed: () {
                  setState(() => _obscurePassword = !_obscurePassword);
                },
                icon: Icon(
                  _obscurePassword
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              SizedBox(
                width: 24,
                height: 24,
                child: Checkbox(
                  value: _rememberPassword,
                  activeColor: colorScheme.primary,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  onChanged: (value) {
                    setState(() => _rememberPassword = value ?? false);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Recordar contrasena',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
              TextButton(
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const ForgotPasswordPage(),
                    ),
                  );
                },
                child: const FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text('Olvidaste tu contrasena?'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          AuthGradientButton(label: 'Iniciar sesion', onPressed: () {}),
        ],
      ),
    );
  }
}
