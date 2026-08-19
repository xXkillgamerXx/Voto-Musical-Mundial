import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/i18n/tr.dart';
import '../../../../core/referrals/referral_storage.dart';
import '../../data/auth_service.dart';
import '../widgets/auth_controls.dart';
import '../widgets/auth_scaffold.dart';
import 'forgot_password_page.dart';
import 'register_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({required this.authService, super.key});

  final AuthService authService;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _rememberPassword = true;
  bool _isLoading = false;
  String _errorMessage = '';

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleEmailLogin() async {
    setState(() => _errorMessage = '');

    if (_emailController.text.trim().isEmpty ||
        _passwordController.text.isEmpty) {
      setState(() => _errorMessage = tr('auth.loginEnterEmailPassword'));
      return;
    }

    setState(() => _isLoading = true);

    try {
      await widget.authService.login(
        identifier: _emailController.text.trim().toLowerCase(),
        password: _passwordController.text,
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = AuthService.friendlyError(error));
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleGoogleLogin() async {
    setState(() {
      _errorMessage = '';
      _isLoading = true;
    });

    try {
      final referralCode = await ReferralStorage.read();
      await widget.authService.signInWithGoogle(referralCode: referralCode);
      await ReferralStorage.clear();
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = AuthService.friendlyError(error));
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleRootBack() async {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    final shouldExit = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: const Color(0xFF120A2B),
          title: Text(
            tr('misc.exitAppTitle'),
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
          content: Text(
            tr('misc.exitAppConfirm'),
            style: const TextStyle(
              color: Color(0xFFD8D3F7),
              fontWeight: FontWeight.w600,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: Text(tr('misc.exitAppCancel')),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(tr('misc.exitAppYes')),
            ),
          ],
        );
      },
    );
    if (shouldExit == true && mounted) {
      SystemNavigator.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        unawaited(_handleRootBack());
      },
      child: AuthScaffold(
      title: tr('auth.loginTitle'),
      subtitle: tr('auth.loginSubtitle'),
      footer: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text(tr('auth.noAccountQuestion')),
          TextButton(
            onPressed: _isLoading
                ? null
                : () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => RegisterPage(
                          authService: widget.authService,
                        ),
                      ),
                    );
                  },
            child: Text(tr('auth.createAccount')),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthGoogleButton(
            onPressed: _handleGoogleLogin,
            isLoading: _isLoading,
          ),
          const SizedBox(height: 10),
          const AuthDivider(),
          const SizedBox(height: 10),
          AuthFieldLabel(tr('auth.emailOrUsernameLabel')),
          const SizedBox(height: 10),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            enabled: !_isLoading,
            decoration: InputDecoration(
              labelText: tr('auth.emailOrUsernameHint'),
              prefixIcon: const Icon(Icons.mail_outline),
            ),
          ),
          const SizedBox(height: 18),
          AuthFieldLabel(tr('auth.loginPasswordLabel')),
          const SizedBox(height: 10),
          TextField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            enabled: !_isLoading,
            onSubmitted: (_) => _handleEmailLogin(),
            decoration: InputDecoration(
              labelText: tr('auth.loginPasswordLabel'),
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
                  onChanged: _isLoading
                      ? null
                      : (value) {
                          setState(() => _rememberPassword = value ?? false);
                        },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  tr('auth.rememberPassword'),
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
                onPressed: _isLoading
                    ? null
                    : () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ForgotPasswordPage(
                              authService: widget.authService,
                              initialEmail: _emailController.text.trim(),
                            ),
                          ),
                        );
                      },
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(tr('auth.forgotPasswordQuestion')),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (_errorMessage.isNotEmpty) ...[
            _AuthMessage(message: _errorMessage, isError: true),
            const SizedBox(height: 12),
          ],
          AuthGradientButton(
            label: tr('auth.loginTitle'),
            onPressed: _handleEmailLogin,
            isLoading: _isLoading,
          ),
        ],
      ),
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
