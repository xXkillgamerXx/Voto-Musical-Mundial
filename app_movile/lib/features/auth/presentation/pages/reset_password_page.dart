import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';
import '../../data/auth_service.dart';
import '../widgets/auth_controls.dart';
import '../widgets/auth_scaffold.dart';

class ResetPasswordPage extends StatefulWidget {
  const ResetPasswordPage({
    required this.authService,
    this.initialToken = '',
    super.key,
  });

  final AuthService authService;
  final String initialToken;

  @override
  State<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends State<ResetPasswordPage> {
  late final TextEditingController _tokenController;
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  var _loading = false;
  String _error = '';
  String _success = '';

  @override
  void initState() {
    super.initState();
    _tokenController = TextEditingController(text: widget.initialToken);
  }

  @override
  void dispose() {
    _tokenController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = '';
      _success = '';
    });
    final token = _tokenController.text.trim().toLowerCase();
    final password = _passwordController.text;
    if (!RegExp(r'^[a-f0-9]{64}$').hasMatch(token)) {
      setState(() => _error = tr('auth.invalidToken'));
      return;
    }
    if (password.length < 8) {
      setState(() => _error = tr('auth.passwordMinLength'));
      return;
    }
    if (password != _confirmController.text) {
      setState(() => _error = tr('auth.passwordsDontMatch'));
      return;
    }
    setState(() => _loading = true);
    try {
      await widget.authService.resetPassword(token: token, password: password);
      if (!mounted) return;
      setState(() {
        _success = tr('auth.passwordUpdated');
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = AuthService.friendlyError(error);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: tr('auth.resetPasswordTitle'),
      subtitle: tr('auth.resetPasswordSubtitle'),
      showBackButton: true,
      showBrandHeader: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthFieldLabel(tr('auth.resetToken')),
          const SizedBox(height: 10),
          TextField(
            controller: _tokenController,
            enabled: !_loading,
            decoration: InputDecoration(
              hintText: tr('auth.resetToken'),
            ),
          ),
          const SizedBox(height: 16),
          AuthFieldLabel(tr('auth.newPassword')),
          const SizedBox(height: 10),
          TextField(
            controller: _passwordController,
            obscureText: true,
            enabled: !_loading,
            decoration: InputDecoration(
              hintText: tr('auth.newPassword'),
            ),
          ),
          const SizedBox(height: 16),
          AuthFieldLabel(tr('auth.confirmNewPassword')),
          const SizedBox(height: 10),
          TextField(
            controller: _confirmController,
            obscureText: true,
            enabled: !_loading,
            decoration: InputDecoration(
              hintText: tr('auth.confirmNewPassword'),
            ),
          ),
          const SizedBox(height: 16),
          if (_error.isNotEmpty) ...[
            Text(
              _error,
              style: const TextStyle(
                color: Color(0xFFFCA5A5),
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (_success.isNotEmpty) ...[
            Text(
              _success,
              style: const TextStyle(
                color: Color(0xFF86EFAC),
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
          ],
          AuthGradientButton(
            label: tr('auth.savePassword'),
            onPressed: _submit,
            isLoading: _loading,
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(tr('auth.backToLogin')),
          ),
        ],
      ),
    );
  }
}
