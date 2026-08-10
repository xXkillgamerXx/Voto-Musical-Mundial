import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/api/api_config.dart';
import '../../../../core/i18n/tr.dart';
import '../../../auth/data/auth_service.dart';

/// Muestra el enlace de invitación propio, igual que la sección de misiones web.
class InviteFriendsCard extends StatefulWidget {
  const InviteFriendsCard({required this.authService, super.key});

  final AuthService authService;

  @override
  State<InviteFriendsCard> createState() => _InviteFriendsCardState();
}

class _InviteFriendsCardState extends State<InviteFriendsCard> {
  int? _signups;
  int? _points;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  String get _code {
    final user = widget.authService.session.user;
    final code = (user?.referralCode ?? '').trim();
    return code.isNotEmpty ? code : (user?.username ?? '').trim();
  }

  String get _inviteUrl => '${ApiConfig.uploadsOrigin}/registro?ref=$_code';

  Future<void> _loadStats() async {
    try {
      final payload = await widget.authService.client.request(
        '/users/me/referral',
        token: widget.authService.client.accessToken,
      );

      if (!mounted || payload is! Map<String, dynamic>) return;

      setState(() {
        _signups = int.tryParse('${payload['referralSignups'] ?? 0}') ?? 0;
        _points = int.tryParse('${payload['referralPoints'] ?? 0}') ?? 0;
      });
    } catch (_) {
      // Las estadísticas son opcionales; el enlace funciona igual.
    }
  }

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: _inviteUrl));
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(tr('referral.copied'))));
  }

  Future<void> _share() async {
    await SharePlus.instance.share(
      ShareParams(
        text: '${tr('referral.shareText')}\n$_inviteUrl',
        subject: tr('referral.title'),
        title: tr('referral.title'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_code.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2A1150), Color(0xFF13092E)],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFF0ABFC).withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFF0ABFC).withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.group_add_rounded,
                  color: Color(0xFFF0ABFC),
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  tr('referral.title'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            tr('referral.subtitle'),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.72),
              height: 1.4,
              fontSize: 12.5,
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.32),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr('referral.yourCode').toUpperCase(),
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.55),
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _code.toUpperCase(),
                  style: const TextStyle(
                    color: Color(0xFF67E8F9),
                    fontWeight: FontWeight.w900,
                    fontSize: 18,
                    letterSpacing: 0.6,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _inviteUrl,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.6),
                    fontSize: 11.5,
                  ),
                ),
              ],
            ),
          ),
          if (_signups != null) ...[
            const SizedBox(height: 10),
            Text(
              trp('referral.stats', {
                'count': _signups ?? 0,
                'points': _points ?? 0,
              }),
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.65),
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _copy,
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  label: Text(tr('referral.copy')),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(44),
                    side: BorderSide(
                      color: Colors.white.withValues(alpha: 0.22),
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _share,
                  icon: const Icon(Icons.ios_share_rounded, size: 18),
                  label: Text(tr('referral.share')),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFFF4FD8),
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(44),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
