import 'dart:async';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/api/api_config.dart';
import '../../../../core/i18n/tr.dart';
import '../../../auth/data/auth_service.dart';
import '../../data/mission.dart';
import '../../data/missions_api.dart';

class MissionsSection extends StatefulWidget {
  const MissionsSection({
    required this.authService,
    required this.missions,
    required this.onMissionsChanged,
    super.key,
  });

  final AuthService authService;
  final List<Mission> missions;
  final VoidCallback onMissionsChanged;

  @override
  State<MissionsSection> createState() => _MissionsSectionState();
}

class _MissionsSectionState extends State<MissionsSection> {
  late List<Mission> _missions;

  @override
  void initState() {
    super.initState();
    _missions = widget.missions;
  }

  @override
  void didUpdateWidget(covariant MissionsSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.missions != widget.missions) {
      _missions = widget.missions;
    }
  }

  List<Mission> get _visibleMissions {
    final incomplete = _missions.where((m) => !m.isDone).toList();
    final complete = _missions.where((m) => m.isDone).toList();
    return [...incomplete, ...complete].take(8).toList(growable: false);
  }

  Future<void> _openMissionSheet(Mission mission) async {
    await showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.65),
      builder: (context) {
        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 20),
          child: _MissionSheet(
            mission: mission,
            authService: widget.authService,
            onCompleted: () {
              widget.onMissionsChanged();
              Navigator.of(context).pop();
            },
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr('home.earnExtraPoints'),
            style: const TextStyle(
              color: Color(0xFF67E8F9),
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.8,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            tr('home.missionsTitle'),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w900,
              height: 1.05,
            ),
          ),
          const SizedBox(height: 16),
          if (_visibleMissions.isEmpty)
            const _MissionsEmptyState()
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _visibleMissions.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final mission = _visibleMissions[index];
                return _MissionMiniCard(
                  mission: mission,
                  onTap: () => _openMissionSheet(mission),
                );
              },
            ),
        ],
      ),
    );
  }
}

class _MissionMiniCard extends StatelessWidget {
  const _MissionMiniCard({required this.mission, required this.onTap});

  final Mission mission;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final done = mission.isDone;
    final featured = mission.featured && !done;
    final accent = done
        ? const Color(0xFF34D399)
        : featured
        ? const Color(0xFFFBBF24)
        : const Color(0xFF22D3EE);
    final rewardColor = done
        ? const Color(0xFF6EE7B7)
        : featured
        ? const Color(0xFFFDE68A)
        : const Color(0xFF67E8F9);

    return Material(
      color: Colors.transparent,
      elevation: 0,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            color: done
                ? const Color(0xFF0B2A22)
                : featured
                ? const Color(0xFF1A150C)
                : const Color(0xFF12141F),
            border: Border.all(
              width: 1.5,
              color: accent.withValues(alpha: done ? 0.55 : 0.4),
            ),
            boxShadow: [
              BoxShadow(
                color: accent.withValues(alpha: 0.18),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.35),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      color: accent.withValues(alpha: 0.14),
                      border: Border.all(
                        color: accent.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Icon(
                      done
                          ? Icons.check_rounded
                          : _missionIcon(mission.icon),
                      size: 22,
                      color: rewardColor,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          mission.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            height: 1.2,
                          ),
                        ),
                        if (mission.description.trim().isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            mission.description,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.55),
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              height: 1.25,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 9,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: accent.withValues(alpha: 0.16),
                      border: Border.all(
                        color: accent.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Text(
                      mission.rewardLabel,
                      style: TextStyle(
                        color: rewardColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        minHeight: 6,
                        value: mission.percent / 100,
                        backgroundColor: Colors.white.withValues(alpha: 0.1),
                        valueColor: AlwaysStoppedAnimation<Color>(accent),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    mission.progressLabel,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.75),
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                  const SizedBox(width: 6),
                  Icon(
                    done
                        ? Icons.check_circle_rounded
                        : Icons.chevron_right_rounded,
                    size: 20,
                    color: done
                        ? const Color(0xFF34D399)
                        : Colors.white.withValues(alpha: 0.4),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MissionsEmptyState extends StatelessWidget {
  const _MissionsEmptyState();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        color: const Color(0xFF090B19).withValues(alpha: 0.9),
        border: Border.all(
          color: const Color(0xFF22D3EE).withValues(alpha: 0.15),
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              color: const Color(0xFF22D3EE).withValues(alpha: 0.12),
              border: Border.all(
                color: const Color(0xFF22D3EE).withValues(alpha: 0.2),
              ),
            ),
            child: const Icon(
              Icons.bolt_rounded,
              color: Color(0xFF67E8F9),
              size: 30,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            tr('home.newMissionsSoon'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            tr('home.missionsEmptyDescription'),
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.55),
              fontWeight: FontWeight.w600,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}

class _MissionSheet extends StatefulWidget {
  const _MissionSheet({
    required this.mission,
    required this.authService,
    required this.onCompleted,
  });

  final Mission mission;
  final AuthService authService;
  final VoidCallback onCompleted;

  @override
  State<_MissionSheet> createState() => _MissionSheetState();
}

class _MissionSheetState extends State<_MissionSheet> {
  bool _working = false;
  String? _message;

  Future<void> _performAction() async {
    if (_working || widget.mission.isDone) {
      return;
    }

    final mission = widget.mission;
    final isShareMission =
        mission.type.startsWith('share_') || mission.type == 'share_poll';

    if (isShareMission) {
      await _shareAndClaim(mission);
      return;
    }

    final url = mission.actionUrl;
    if (url != null && url.isNotEmpty) {
      final uri = Uri.tryParse(url);
      if (uri != null) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }

      if (mission.type == 'follow_social') {
        await _claimAfterDelay(mission, const Duration(seconds: 3));
      }

      return;
    }

    setState(() {
      _message = tr('home.missionAutoValidate');
    });
  }

  Future<void> _shareAndClaim(Mission mission) async {
    final shareUrl = ApiConfig.uploadsOrigin;
    final text = '${mission.title}\n$shareUrl';

    try {
      if (mission.type == 'share_whatsapp') {
        final uri = Uri.parse(
          'https://wa.me/?text=${Uri.encodeComponent(text)}',
        );
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else if (mission.type == 'share_facebook') {
        final uri = Uri.parse(
          'https://www.facebook.com/sharer/sharer.php?u=${Uri.encodeComponent(shareUrl)}',
        );
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else if (mission.type == 'share_twitter') {
        final uri = Uri.parse(
          'https://twitter.com/intent/tweet?text=${Uri.encodeComponent(mission.title)}&url=${Uri.encodeComponent(shareUrl)}',
        );
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        await SharePlus.instance.share(
          ShareParams(
            text: text,
            subject: mission.title,
            title: mission.title,
          ),
        );
      }
    } catch (_) {
      // Usuario canceló o no hay app de share.
    }

    await _claimAfterDelay(mission, const Duration(seconds: 2));
  }

  Future<void> _claimAfterDelay(Mission mission, Duration delay) async {
    setState(() {
      _working = true;
      _message = tr('home.verifyingMission');
    });

    await Future<void>.delayed(delay);

    try {
      await MissionsApi(widget.authService.client).completeMission(mission.id);
      if (!mounted) {
        return;
      }

      setState(() {
        _message = tr('home.missionCompletedMessage');
      });
      widget.onCompleted();
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _message = tr('home.missionRegisterError');
      });
    } finally {
      if (mounted) {
        setState(() => _working = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final mission = widget.mission;

    return Container(
      padding: const EdgeInsets.fromLTRB(0, 20, 20, 0),
      decoration: BoxDecoration(
        color: const Color(0xFF090B19),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: const Color(0xFFF0ABFC).withValues(alpha: 0.25),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: Colors.white.withValues(alpha: 0.05),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                ),
                child: Icon(
                  _missionIcon(mission.icon),
                  color: const Color(0xFFF0ABFC),
                ),
              ),
              const Spacer(),
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded, color: Colors.white70),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            tr('home.earnExtraPoints'),
            style: const TextStyle(
              color: Color(0xFF67E8F9),
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.4,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            mission.title.toUpperCase(),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            mission.description,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.55),
              fontWeight: FontWeight.w600,
              height: 1.4,
            ),
          ),
          if (_message != null) ...[
            const SizedBox(height: 12),
            Text(
              _message!,
              style: const TextStyle(
                color: Color(0xFF6EE7B7),
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Text(
                mission.progressLabel,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const Spacer(),
              Text(
                mission.rewardLabel,
                style: const TextStyle(
                  color: Color(0xFFF0ABFC),
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              minHeight: 8,
              value: mission.percent / 100,
              backgroundColor: Colors.white.withValues(alpha: 0.1),
              valueColor: const AlwaysStoppedAnimation<Color>(
                Color(0xFF22D3EE),
              ),
            ),
          ),
          const SizedBox(height: 18),
          if (mission.isDone)
            Center(
              child: Text(
                tr('home.completed'),
                style: const TextStyle(
                  color: Color(0xFF6EE7B7),
                  fontWeight: FontWeight.w900,
                  fontSize: 13,
                  letterSpacing: 0.8,
                ),
              ),
            )
          else
            SizedBox(
              width: double.infinity,
              height: 48,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF8B5CF6), Color(0xFFEC4899)],
                  ),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: _working ? null : _performAction,
                    borderRadius: BorderRadius.circular(18),
                    child: Center(
                      child: Text(
                        _working ? tr('home.validating') : tr('home.doMission'),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

IconData _missionIcon(String icon) {
  final normalized = icon.toLowerCase();

  if (normalized.contains('vote')) {
    return Icons.how_to_vote_rounded;
  }
  if (normalized.contains('share')) {
    return Icons.share_rounded;
  }
  if (normalized.contains('heart') || normalized.contains('like')) {
    return Icons.favorite_rounded;
  }
  if (normalized.contains('user') || normalized.contains('follow')) {
    return Icons.person_add_rounded;
  }
  if (normalized.contains('gift')) {
    return Icons.card_giftcard_rounded;
  }

  return Icons.bolt_rounded;
}
