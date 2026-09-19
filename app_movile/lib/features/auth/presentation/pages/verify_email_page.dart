import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/i18n/tr.dart';
import '../../data/auth_service.dart';
import '../widgets/auth_controls.dart';
import '../widgets/auth_scaffold.dart';

class VerifyEmailPage extends StatefulWidget {
  const VerifyEmailPage({
    required this.authService,
    required this.email,
    super.key,
  });

  final AuthService authService;
  final String email;

  @override
  State<VerifyEmailPage> createState() => _VerifyEmailPageState();
}

class _VerifyEmailPageState extends State<VerifyEmailPage> {
  final _codeController = TextEditingController();
  var _loading = false;
  var _resending = false;
  String _error = '';
  String _info = '';

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final code = _codeController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _error = tr('auth.invalidCode'));
      return;
    }
    setState(() {
      _loading = true;
      _error = '';
      _info = '';
    });
    try {
      await widget.authService.verifyEmail(email: widget.email, code: code);
      if (!mounted) return;
      Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = AuthService.friendlyError(error);
        _loading = false;
      });
    }
  }

  Future<void> _resend() async {
    setState(() {
      _resending = true;
      _error = '';
    });
    try {
      await widget.authService.resendVerification(email: widget.email);
      if (!mounted) return;
      setState(() {
        _info = tr('auth.codeSent');
        _resending = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = AuthService.friendlyError(error);
        _resending = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: tr('auth.verifyTitle'),
      subtitle: trp('auth.verifySubtitle', {'email': widget.email}),
      showBackButton: true,
      showBrandHeader: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthFieldLabel(tr('auth.verifyCode')),
          const SizedBox(height: 14),
          TextField(
            controller: _codeController,
            keyboardType: TextInputType.number,
            maxLength: 6,
            enabled: !_loading,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: InputDecoration(
              hintText: tr('auth.verifyHint'),
              counterText: '',
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
          if (_info.isNotEmpty) ...[
            Text(
              _info,
              style: const TextStyle(
                color: Color(0xFF86EFAC),
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
          ],
          AuthGradientButton(
            label: tr('auth.verifyAction'),
            onPressed: _verify,
            isLoading: _loading,
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: _resending ? null : _resend,
            child: Text(
              _resending ? tr('common.loading') : tr('auth.resendCode'),
            ),
          ),
        ],
      ),
    );
  }
}
