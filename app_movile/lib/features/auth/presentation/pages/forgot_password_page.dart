import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';
import '../widgets/auth_controls.dart';
import '../widgets/auth_scaffold.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({this.initialEmail = '', super.key});

  final String initialEmail;

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  late final TextEditingController _emailController;
  bool _isLoading = false;
  String _errorMessage = '';
  String _successMessage = '';

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.initialEmail);
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleResetPassword() async {
    setState(() {
      _errorMessage = '';
      _successMessage = '';
    });

    final email = _emailController.text.trim().toLowerCase();

    if (email.isEmpty) {
      setState(() => _errorMessage = tr('auth.enterEmail'));
      return;
    }

    setState(() => _isLoading = true);

    try {
      if (!mounted) return;
      setState(
        () => _successMessage = tr('auth.resetPending'),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: tr('auth.forgotTitle'),
      subtitle: tr('auth.forgotSubtitle'),
      showBackButton: true,
      showBrandHeader: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthFieldLabel(tr('auth.emailLabel')),
          const SizedBox(height: 14),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            enabled: !_isLoading,
            decoration: InputDecoration(
              labelText: tr('auth.emailFullHint'),
              prefixIcon: const Icon(Icons.mail_outline),
            ),
          ),
          const SizedBox(height: 18),
          if (_errorMessage.isNotEmpty) ...[
            _AuthMessage(message: _errorMessage, isError: true),
            const SizedBox(height: 12),
          ],
          if (_successMessage.isNotEmpty) ...[
            _AuthMessage(message: _successMessage, isError: false),
            const SizedBox(height: 12),
          ],
          AuthGradientButton(
            label: tr('auth.sendLink'),
            onPressed: _handleResetPassword,
            isLoading: _isLoading,
          ),
          const SizedBox(height: 16),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(tr('auth.backToLogin')),
          ),
        ],
      ),
    );
  }
}

class _AuthMessage extends StatelessWidget {
  const _AuthMessage({required this.message, required this.isError});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? Colors.redAccent : Colors.greenAccent;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        message,
        style: TextStyle(color: color, fontWeight: FontWeight.w700),
      ),
    );
  }
}
