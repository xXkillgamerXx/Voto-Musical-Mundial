import 'package:flutter/material.dart';

import '../../../../core/i18n/app_locale.dart';
import '../../../../core/i18n/tr.dart';
import '../../../auth/data/auth_service.dart';
import '../../../users/data/users_api.dart';
import '../../../users/presentation/pages/edit_profile_page.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({required this.authService, super.key});

  final AuthService authService;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late final UsersApi _usersApi;
  bool _emailCampaigns = true;
  bool _loadingEmailPref = true;
  bool _savingEmailPref = false;

  @override
  void initState() {
    super.initState();
    _usersApi = UsersApi(widget.authService.client);
    _loadEmailPreference();
  }

  Future<void> _loadEmailPreference() async {
    try {
      final profile = await _usersApi.getMeProfile();
      if (!mounted) return;
      setState(() {
        _emailCampaigns = profile.emailCampaigns;
        _loadingEmailPref = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingEmailPref = false);
    }
  }

  Future<void> _setEmailCampaigns(bool value) async {
    setState(() {
      _emailCampaigns = value;
      _savingEmailPref = true;
    });
    try {
      final updated = await _usersApi.updateProfile(emailCampaigns: value);
      if (!mounted) return;
      setState(() {
        _emailCampaigns = updated.emailCampaigns;
        _savingEmailPref = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _emailCampaigns = !value;
        _savingEmailPref = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('settings.emailCampaignsError'))),
      );
    }
  }

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
                      builder: (_) =>
                          EditProfilePage(authService: widget.authService),
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
            const SizedBox(height: 16),
            _SettingsCard(
              child: SwitchListTile(
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                secondary: const Icon(
                  Icons.mark_email_read_outlined,
                  color: Color(0xFF22D3EE),
                ),
                title: Text(
                  tr('settings.emailCampaigns'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    tr('settings.emailCampaignsHelp'),
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.55),
                      fontSize: 12,
                      height: 1.4,
                    ),
                  ),
                ),
                value: _emailCampaigns,
                activeThumbColor: const Color(0xFF22D3EE),
                onChanged: (_loadingEmailPref || _savingEmailPref)
                    ? null
                    : _setEmailCampaigns,
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
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
                      const SizedBox(height: 4),
                      Text(
                        subtitle!,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.5),
                          fontSize: 12,
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
    this.icon,
    this.flag,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;
  final String? flag;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: selected
                ? const Color(0xFF7C3AED).withValues(alpha: 0.25)
                : Colors.white.withValues(alpha: 0.03),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected
                  ? const Color(0xFFC084FC).withValues(alpha: 0.5)
                  : Colors.white.withValues(alpha: 0.08),
            ),
          ),
          child: Row(
            children: [
              if (flag != null)
                Text(flag!, style: const TextStyle(fontSize: 18))
              else if (icon != null)
                Icon(icon, color: const Color(0xFFC084FC), size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (selected)
                const Icon(Icons.check_circle, color: Color(0xFFC084FC), size: 20),
            ],
          ),
        ),
      ),
    );
  }
}
