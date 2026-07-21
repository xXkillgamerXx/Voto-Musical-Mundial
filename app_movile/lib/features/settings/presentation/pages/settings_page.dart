import 'package:flutter/material.dart';

import '../../../../core/i18n/app_locale.dart';
import '../../../../core/i18n/tr.dart';
import '../../../auth/data/auth_service.dart';
import '../../../users/presentation/pages/edit_profile_page.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({required this.authService, super.key});

  final AuthService authService;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF05010E),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(tr('settings.title')),
      ),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            _SectionTitle(text: tr('settings.account')),
            _SettingsCard(
              child: _SettingsTile(
                icon: Icons.person_outline,
                title: tr('settings.editProfile'),
                subtitle: tr('settings.editProfileSubtitle'),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => EditProfilePage(authService: authService),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 24),
            _SectionTitle(text: tr('settings.preferences')),
            _SettingsCard(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.language,
                          color: Color(0xFFC084FC),
                          size: 22,
                        ),
                        const SizedBox(width: 12),
                        Text(
                          tr('settings.language'),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    AnimatedBuilder(
                      animation: AppLocale.instance,
                      builder: (context, _) {
                        final preference = AppLocale.instance.preference;
                        return Column(
                          children: [
                            _LangOption(
                              label: tr('settings.languageSystem'),
                              icon: Icons.smartphone,
                              selected: preference == 'system',
                              onTap: () =>
                                  AppLocale.instance.setPreference('system'),
                            ),
                            const SizedBox(height: 10),
                            _LangOption(
                              label: tr('settings.languageSpanish'),
                              flag: '🇪🇸',
                              selected: preference == 'es',
                              onTap: () =>
                                  AppLocale.instance.setPreference('es'),
                            ),
                            const SizedBox(height: 10),
                            _LangOption(
                              label: tr('settings.languageEnglish'),
                              flag: '🇺🇸',
                              selected: preference == 'en',
                              onTap: () =>
                                  AppLocale.instance.setPreference('en'),
                            ),
                          ],
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 28),
            Center(
              child: Text(
                '${tr('settings.version')} 1.0.0',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.4),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 10),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          color: Color(0xFFC084FC),
          fontSize: 11,
          fontWeight: FontWeight.w900,
          letterSpacing: 1.4,
        ),
      ),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: child,
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(icon, color: const Color(0xFFC084FC), size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.5),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: Colors.white.withValues(alpha: 0.35),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LangOption extends StatelessWidget {
  const _LangOption({
    required this.label,
    required this.selected,
    required this.onTap,
    this.flag,
    this.icon,
  });

  final String label;
  final String? flag;
  final IconData? icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          gradient: selected
              ? const LinearGradient(
                  colors: [Color(0xFF8B5CF6), Color(0xFFD946EF)],
                )
              : null,
          color: selected ? null : Colors.white.withValues(alpha: 0.05),
          border: Border.all(
            color: selected
                ? Colors.transparent
                : Colors.white.withValues(alpha: 0.12),
          ),
        ),
        child: Row(
          children: [
            if (flag != null)
              Text(flag!, style: const TextStyle(fontSize: 18))
            else if (icon != null)
              Icon(
                icon,
                size: 18,
                color: selected
                    ? Colors.white
                    : Colors.white.withValues(alpha: 0.7),
              ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: selected
                      ? Colors.white
                      : Colors.white.withValues(alpha: 0.75),
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            if (selected)
              const Icon(Icons.check_circle, size: 18, color: Colors.white),
          ],
        ),
      ),
    );
  }
}
