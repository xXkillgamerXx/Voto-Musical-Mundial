import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';
import '../../data/auth_service.dart';
import '../widgets/auth_controls.dart';
import '../widgets/auth_scaffold.dart';
import 'terms_conditions_page.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({required this.authService, super.key});

  final AuthService authService;

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _usernameController = TextEditingController();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _acceptedTerms = false;
  bool _isLoading = false;
  int _currentStep = 1;
  String _errorMessage = '';

  final _countries = const [
    _CountryOption('República Dominicana', 'DO', '🇩🇴', '+1'),
    _CountryOption('México', 'MX', '🇲🇽', '+52'),
    _CountryOption('Colombia', 'CO', '🇨🇴', '+57'),
    _CountryOption('Argentina', 'AR', '🇦🇷', '+54'),
    _CountryOption('Chile', 'CL', '🇨🇱', '+56'),
    _CountryOption('Perú', 'PE', '🇵🇪', '+51'),
    _CountryOption('Ecuador', 'EC', '🇪🇨', '+593'),
    _CountryOption('Venezuela', 'VE', '🇻🇪', '+58'),
    _CountryOption('Estados Unidos', 'US', '🇺🇸', '+1'),
    _CountryOption('España', 'ES', '🇪🇸', '+34'),
    _CountryOption('Puerto Rico', 'PR', '🇵🇷', '+1'),
    _CountryOption('Otro', 'OT', '🌎', ''),
  ];

  _CountryOption? _selectedCountry;
  _CountryOption? _selectedPhoneCountry;

  static const _totalSteps = 3;

  @override
  void dispose() {
    _usernameController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  String get _normalizedUsername =>
      _usernameController.text.trim().toLowerCase();

  String get _fullName =>
      '${_firstNameController.text.trim()} ${_lastNameController.text.trim()}'
          .trim();

  Future<void> _goNext() async {
    setState(() => _errorMessage = '');

    final isValid = switch (_currentStep) {
      1 => await _validateProfileStep(),
      2 => _validateContactStep(),
      _ => true,
    };

    if (!isValid) {
      return;
    }

    if (_currentStep < _totalSteps) {
      setState(() => _currentStep += 1);
    }
  }

  void _goPrevious() {
    if (_currentStep > 1) {
      setState(() {
        _errorMessage = '';
        _currentStep -= 1;
      });
    }
  }

  Future<bool> _validateProfileStep() async {
    if (_firstNameController.text.trim().isEmpty) {
      setState(() => _errorMessage = tr('auth.enterFirstName'));
      return false;
    }

    if (_lastNameController.text.trim().isEmpty) {
      setState(() => _errorMessage = tr('auth.enterLastName'));
      return false;
    }

    if (!RegExp(r'^[a-z0-9_]{3,20}$').hasMatch(_normalizedUsername)) {
      setState(
        () => _errorMessage = tr('auth.usernameRule').trim(),
      );
      return false;
    }

    return true;
  }

  bool _validateContactStep() {
    if (_emailController.text.trim().isEmpty) {
      setState(() => _errorMessage = tr('auth.enterEmail'));
      return false;
    }

    if (_selectedCountry == null) {
      setState(() => _errorMessage = tr('auth.selectCountry'));
      return false;
    }

    return true;
  }

  Future<void> _handleCreateAccount() async {
    setState(() => _errorMessage = '');

    if (!(await _validateProfileStep()) || !_validateContactStep()) {
      return;
    }

    if (_passwordController.text.length < 8) {
      setState(
        () => _errorMessage = tr('auth.passwordMinLength'),
      );
      return;
    }

    if (_passwordController.text != _confirmPasswordController.text) {
      setState(() => _errorMessage = tr('auth.passwordsDontMatch'));
      return;
    }

    if (!_acceptedTerms) {
      setState(
        () => _errorMessage = tr('auth.mustAcceptTerms'),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final selectedCountry = _selectedCountry;
      final phone = _phoneController.text.trim();
      final selectedPhoneCountry = phone.isEmpty
          ? _selectedPhoneCountry
          : (_selectedPhoneCountry ?? _countries.first);
      final phoneInternational =
          selectedPhoneCountry?.dialCode.isNotEmpty == true && phone.isNotEmpty
          ? '${selectedPhoneCountry!.dialCode} $phone'
          : phone;

      await widget.authService.register(
        email: _emailController.text.trim().toLowerCase(),
        password: _passwordController.text,
        username: _normalizedUsername,
        displayName: _fullName,
        metadata: {
          'firstName': _firstNameController.text.trim(),
          'lastName': _lastNameController.text.trim(),
          'country': selectedCountry?.name ?? '',
          'countryCode': selectedCountry?.code ?? '',
          'phoneCountry': selectedPhoneCountry?.name ?? '',
          'phoneCountryCode': selectedPhoneCountry?.code ?? '',
          'phoneDialCode': selectedPhoneCountry?.dialCode ?? '',
          'phone': phone,
          'phoneInternational': phoneInternational,
        },
      );

      if (!mounted) return;
      Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = AuthService.friendlyError(error));
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _currentStep == 1,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _currentStep > 1) {
          _goPrevious();
        }
      },
      child: AuthScaffold(
        title: tr('auth.createAccount'),
        subtitle: tr('auth.registerSubtitle'),
        showBackButton: true,
        showBrandHeader: false,
        onBackPressed: () {
          if (_currentStep > 1) {
            _goPrevious();
            return;
          }

          Navigator.of(context).maybePop();
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              tr('auth.registerIntro'),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                height: 1.45,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 22),
            _RegisterProgress(
              currentStep: _currentStep,
              totalSteps: _totalSteps,
            ),
            const SizedBox(height: 18),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              child: _buildStep(),
            ),
            const SizedBox(height: 24),
            if (_errorMessage.isNotEmpty) ...[
              _AuthMessage(message: _errorMessage),
              const SizedBox(height: 12),
            ],
            _RegisterActions(
              currentStep: _currentStep,
              totalSteps: _totalSteps,
              isLoading: _isLoading,
              onPrevious: _goPrevious,
              onNext: () => _goNext(),
              onCreateAccount: _handleCreateAccount,
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(tr('auth.alreadyHaveAccount')),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep() {
    return switch (_currentStep) {
      1 => _ProfileStep(
        key: const ValueKey('profile-step'),
        usernameController: _usernameController,
        firstNameController: _firstNameController,
        lastNameController: _lastNameController,
        enabled: !_isLoading,
      ),
      2 => _ContactStep(
        key: const ValueKey('contact-step'),
        countries: _countries,
        emailController: _emailController,
        phoneController: _phoneController,
        selectedCountry: _selectedCountry,
        selectedPhoneCountry: _selectedPhoneCountry,
        enabled: !_isLoading,
        onCountryChanged: (country) {
          setState(() => _selectedCountry = country);
        },
        onPhoneCountryChanged: (country) {
          setState(() => _selectedPhoneCountry = country);
        },
      ),
      _ => _SecurityStep(
        key: const ValueKey('security-step'),
        obscurePassword: _obscurePassword,
        obscureConfirmPassword: _obscureConfirmPassword,
        acceptedTerms: _acceptedTerms,
        passwordController: _passwordController,
        confirmPasswordController: _confirmPasswordController,
        enabled: !_isLoading,
        onTogglePassword: () {
          setState(() => _obscurePassword = !_obscurePassword);
        },
        onToggleConfirmPassword: () {
          setState(() => _obscureConfirmPassword = !_obscureConfirmPassword);
        },
        onTermsChanged: (value) {
          setState(() => _acceptedTerms = value ?? false);
        },
        onOpenTerms: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const TermsConditionsPage()),
          );
        },
      ),
    };
  }
}

class _RegisterProgress extends StatelessWidget {
  const _RegisterProgress({
    required this.currentStep,
    required this.totalSteps,
  });

  final int currentStep;
  final int totalSteps;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: AuthFieldLabel(
            trp('auth.stepProgress', {
              'current': currentStep,
              'total': totalSteps,
            }),
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: List.generate(totalSteps, (index) {
            final step = index + 1;

            return Expanded(
              child: Container(
                height: 7,
                margin: EdgeInsets.only(right: index == totalSteps - 1 ? 0 : 8),
                decoration: BoxDecoration(
                  color: step <= currentStep
                      ? const Color(0xFFFF4FD8)
                      : colorScheme.onSurface.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            );
          }),
        ),
      ],
    );
  }
}

class _AuthMessage extends StatelessWidget {
  const _AuthMessage({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.redAccent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.redAccent.withValues(alpha: 0.35)),
      ),
      child: Text(
        message,
        style: const TextStyle(
          color: Colors.redAccent,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _ProfileStep extends StatelessWidget {
  const _ProfileStep({
    required this.usernameController,
    required this.firstNameController,
    required this.lastNameController,
    required this.enabled,
    super.key,
  });

  final TextEditingController usernameController;
  final TextEditingController firstNameController;
  final TextEditingController lastNameController;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: key,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthFieldLabel(tr('auth.usernameLabel')),
        const SizedBox(height: 10),
        TextField(
          controller: usernameController,
          enabled: enabled,
          textInputAction: TextInputAction.next,
          decoration: InputDecoration(
            labelText: tr('auth.usernameHint'),
            prefixIcon: const Icon(Icons.person),
          ),
        ),
        const SizedBox(height: 18),
        AuthFieldLabel(tr('auth.firstNameLabel')),
        const SizedBox(height: 10),
        TextField(
          controller: firstNameController,
          enabled: enabled,
          textInputAction: TextInputAction.next,
          decoration: InputDecoration(
            labelText: tr('auth.firstNameHint'),
            prefixIcon: const Icon(Icons.person),
          ),
        ),
        const SizedBox(height: 18),
        AuthFieldLabel(tr('auth.lastNameLabel')),
        const SizedBox(height: 10),
        TextField(
          controller: lastNameController,
          enabled: enabled,
          decoration: InputDecoration(
            labelText: tr('auth.lastNameHint'),
            prefixIcon: const Icon(Icons.person),
          ),
        ),
      ],
    );
  }
}

class _ContactStep extends StatelessWidget {
  const _ContactStep({
    required this.countries,
    required this.emailController,
    required this.phoneController,
    required this.selectedCountry,
    required this.selectedPhoneCountry,
    required this.enabled,
    required this.onCountryChanged,
    required this.onPhoneCountryChanged,
    super.key,
  });

  final List<_CountryOption> countries;
  final TextEditingController emailController;
  final TextEditingController phoneController;
  final _CountryOption? selectedCountry;
  final _CountryOption? selectedPhoneCountry;
  final bool enabled;
  final ValueChanged<_CountryOption?> onCountryChanged;
  final ValueChanged<_CountryOption?> onPhoneCountryChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: key,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthFieldLabel(tr('auth.emailLabel')),
        const SizedBox(height: 10),
        TextField(
          controller: emailController,
          enabled: enabled,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          decoration: InputDecoration(
            labelText: tr('auth.emailLabel'),
            prefixIcon: const Icon(Icons.mail_outline),
          ),
        ),
        const SizedBox(height: 18),
        AuthFieldLabel(tr('auth.countryLabel')),
        const SizedBox(height: 10),
        _CountrySelectField(
          countries: countries,
          selectedCountry: selectedCountry,
          placeholder: tr('auth.selectCountryPlaceholder'),
          enabled: enabled,
          onChanged: onCountryChanged,
        ),
        const SizedBox(height: 18),
        AuthFieldLabel(tr('auth.phoneLabel')),
        const SizedBox(height: 10),
        _PhoneInputField(
          countries: countries,
          controller: phoneController,
          selectedCountry: selectedPhoneCountry,
          enabled: enabled,
          onCountryChanged: onPhoneCountryChanged,
        ),
      ],
    );
  }
}

class _CountryOption {
  const _CountryOption(this.name, this.code, this.flag, this.dialCode);

  final String name;
  final String code;
  final String flag;
  final String dialCode;

  bool matches(String query) {
    final normalizedQuery = query.trim().toLowerCase();

    return name.toLowerCase().contains(normalizedQuery) ||
        code.toLowerCase().contains(normalizedQuery) ||
        dialCode.contains(normalizedQuery);
  }
}

class _CountrySelectField extends StatelessWidget {
  const _CountrySelectField({
    required this.countries,
    required this.selectedCountry,
    required this.placeholder,
    required this.enabled,
    required this.onChanged,
  });

  final List<_CountryOption> countries;
  final _CountryOption? selectedCountry;
  final String placeholder;
  final bool enabled;
  final ValueChanged<_CountryOption?> onChanged;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return _PickerSurface(
      onTap: enabled
          ? () async {
              final country = await _showCountryPicker(
                context: context,
                countries: countries,
                title: tr('auth.searchCountry'),
                selectedCountry: selectedCountry,
              );

              if (country != null) {
                onChanged(country);
              }
            }
          : null,
      child: Row(
        children: [
          Icon(Icons.public, color: colorScheme.onSurfaceVariant),
          const SizedBox(width: 14),
          if (selectedCountry != null) ...[
            Text(selectedCountry!.flag, style: const TextStyle(fontSize: 22)),
            const SizedBox(width: 10),
            Expanded(child: Text(selectedCountry!.name)),
          ] else
            Expanded(
              child: Text(
                placeholder,
                style: TextStyle(color: colorScheme.onSurfaceVariant),
              ),
            ),
          Icon(Icons.keyboard_arrow_down_rounded, color: colorScheme.primary),
        ],
      ),
    );
  }
}

class _PhoneInputField extends StatelessWidget {
  const _PhoneInputField({
    required this.countries,
    required this.controller,
    required this.selectedCountry,
    required this.enabled,
    required this.onCountryChanged,
  });

  final List<_CountryOption> countries;
  final TextEditingController controller;
  final _CountryOption? selectedCountry;
  final bool enabled;
  final ValueChanged<_CountryOption?> onCountryChanged;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final country = selectedCountry ?? countries.first;

    return TextField(
      controller: controller,
      enabled: enabled,
      keyboardType: TextInputType.phone,
      decoration: InputDecoration(
        labelText: tr('auth.phoneHint'),
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        prefixIcon: InkWell(
          onTap: enabled
              ? () async {
                  final pickedCountry = await _showCountryPicker(
                    context: context,
                    countries: countries,
                    title: tr('auth.phoneCountryTitle'),
                    selectedCountry: selectedCountry,
                  );

                  if (pickedCountry != null) {
                    onCountryChanged(pickedCountry);
                  }
                }
              : null,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.only(left: 14, right: 10),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(country.flag, style: const TextStyle(fontSize: 18)),
                const SizedBox(width: 6),
                Text(
                  country.dialCode.isEmpty ? '--' : country.dialCode,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(width: 2),
                Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: colorScheme.primary,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Container(
                  width: 1,
                  height: 26,
                  color: colorScheme.outlineVariant.withValues(alpha: 0.7),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PickerSurface extends StatelessWidget {
  const _PickerSurface({required this.child, required this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = colorScheme.brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: isDark
                ? const Color(0xFF17192B).withValues(alpha: 0.84)
                : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: colorScheme.outlineVariant.withValues(alpha: 0.7),
            ),
          ),
          child: Center(child: child),
        ),
      ),
    );
  }
}

Future<_CountryOption?> _showCountryPicker({
  required BuildContext context,
  required List<_CountryOption> countries,
  required String title,
  required _CountryOption? selectedCountry,
}) {
  return Navigator.of(context).push<_CountryOption>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => _CountryPickerPage(
        countries: countries,
        title: title,
        selectedCountry: selectedCountry,
      ),
    ),
  );
}

class _CountryPickerPage extends StatefulWidget {
  const _CountryPickerPage({
    required this.countries,
    required this.title,
    required this.selectedCountry,
  });

  final List<_CountryOption> countries;
  final String title;
  final _CountryOption? selectedCountry;

  @override
  State<_CountryPickerPage> createState() => _CountryPickerPageState();
}

class _CountryPickerPageState extends State<_CountryPickerPage> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final filteredCountries = widget.countries
        .where((country) => country.matches(_query))
        .toList(growable: false);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        forceMaterialTransparency: true,
        leadingWidth: 52,
        leading: IconButton(
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
        ),
        titleSpacing: 0,
        title: Text(
          widget.title,
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
        ),
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              colorScheme.surface,
              colorScheme.surfaceContainerHighest.withValues(alpha: 0.55),
            ],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(22, 12, 22, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  autofocus: true,
                  decoration: InputDecoration(
                    labelText: tr('auth.searchCountry'),
                    prefixIcon: const Icon(Icons.search),
                  ),
                  onChanged: (value) => setState(() => _query = value),
                ),
                const SizedBox(height: 14),
                Expanded(
                  child: ListView.separated(
                    padding: EdgeInsets.zero,
                    itemCount: filteredCountries.length,
                    separatorBuilder: (context, index) => Divider(
                      height: 1,
                      color: colorScheme.outlineVariant.withValues(alpha: 0.45),
                    ),
                    itemBuilder: (context, index) {
                      final country = filteredCountries[index];
                      final isSelected =
                          widget.selectedCountry?.code == country.code;

                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(vertical: 4),
                        leading: Text(
                          country.flag,
                          style: const TextStyle(fontSize: 28),
                        ),
                        title: Text(
                          country.name,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        subtitle: country.dialCode.isEmpty
                            ? null
                            : Text(country.dialCode),
                        trailing: isSelected
                            ? Icon(
                                Icons.check_circle,
                                color: colorScheme.primary,
                              )
                            : null,
                        onTap: () => Navigator.of(context).pop(country),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SecurityStep extends StatelessWidget {
  const _SecurityStep({
    required this.obscurePassword,
    required this.obscureConfirmPassword,
    required this.acceptedTerms,
    required this.passwordController,
    required this.confirmPasswordController,
    required this.enabled,
    required this.onTogglePassword,
    required this.onToggleConfirmPassword,
    required this.onTermsChanged,
    required this.onOpenTerms,
    super.key,
  });

  final bool obscurePassword;
  final bool obscureConfirmPassword;
  final bool acceptedTerms;
  final TextEditingController passwordController;
  final TextEditingController confirmPasswordController;
  final bool enabled;
  final VoidCallback onTogglePassword;
  final VoidCallback onToggleConfirmPassword;
  final ValueChanged<bool?> onTermsChanged;
  final VoidCallback onOpenTerms;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: key,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthFieldLabel(tr('auth.passwordLabel')),
        const SizedBox(height: 10),
        TextField(
          controller: passwordController,
          enabled: enabled,
          obscureText: obscurePassword,
          decoration: InputDecoration(
            labelText: tr('auth.passwordMinHint'),
            prefixIcon: const Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              onPressed: enabled ? onTogglePassword : null,
              icon: Icon(
                obscurePassword
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
              ),
            ),
          ),
        ),
        const SizedBox(height: 18),
        AuthFieldLabel(tr('auth.confirmPasswordLabel')),
        const SizedBox(height: 10),
        TextField(
          controller: confirmPasswordController,
          enabled: enabled,
          obscureText: obscureConfirmPassword,
          decoration: InputDecoration(
            labelText: tr('auth.confirmPasswordHint'),
            prefixIcon: const Icon(Icons.lock_reset_outlined),
            suffixIcon: IconButton(
              onPressed: enabled ? onToggleConfirmPassword : null,
              icon: Icon(
                obscureConfirmPassword
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        InkWell(
          onTap: enabled ? () => onTermsChanged(!acceptedTerms) : null,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                SizedBox(
                  width: 24,
                  height: 24,
                  child: Checkbox(
                    value: acceptedTerms,
                    activeColor: Theme.of(context).colorScheme.primary,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    onChanged: enabled ? onTermsChanged : null,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(tr('auth.acceptPrefix')),
                      GestureDetector(
                        onTap: onOpenTerms,
                        child: Text(
                          tr('auth.termsLink'),
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.primary,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _RegisterActions extends StatelessWidget {
  const _RegisterActions({
    required this.currentStep,
    required this.totalSteps,
    required this.isLoading,
    required this.onPrevious,
    required this.onNext,
    required this.onCreateAccount,
  });

  final int currentStep;
  final int totalSteps;
  final bool isLoading;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onCreateAccount;

  @override
  Widget build(BuildContext context) {
    if (currentStep == 1) {
      return AuthGradientButton(
        label: tr('auth.next'),
        onPressed: onNext,
        isLoading: isLoading,
      );
    }

    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: isLoading ? null : onPrevious,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: Text(tr('auth.back')),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: AuthGradientButton(
            label: currentStep < totalSteps
                ? tr('auth.next')
                : tr('auth.createAccount'),
            onPressed: currentStep < totalSteps ? onNext : onCreateAccount,
            isLoading: isLoading,
          ),
        ),
      ],
    );
  }
}
