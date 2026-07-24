import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

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
      padding: const EdgeInsets.fromLTRB(16, 28, 16, 0),
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
          const SizedBox(height: 8),
          Text(
            tr('home.missionsTitle'),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 18),
          if (_visibleMissions.isEmpty)
            const _MissionsEmptyState()
          else
            SizedBox(
              height: 340,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _visibleMissions.length,
                separatorBuilder: (_, _) => const SizedBox(width: 14),
                itemBuilder: (context, index) {
                  final mission = _visibleMissions[index];
                  return SizedBox(
                    width: MediaQuery.sizeOf(context).width * 0.82,
                    child: _MissionCard(
                      mission: mission,
                      onTap: () => _openMissionSheet(mission),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _MissionCard extends StatelessWidget {
  const _MissionCard({required this.mission, required this.onTap});

  final Mission mission;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final done = mission.isDone;

    return Material(
      color: Colors.transparent,
      clipBehavior: Clip.antiAlias,
      borderRadius: BorderRadius.circular(24),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Ink(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            color: done
                ? const Color(0xFF10B981).withValues(alpha: 0.08)
                : mission.featured
                ? const Color(0xFFD946EF).withValues(alpha: 0.08)
                : const Color(0xFF090B19).withValues(alpha: 0.85),
            border: Border.all(
              color: done
                  ? const Color(0xFF34D399).withValues(alpha: 0.35)
                  : mission.featured
                  ? const Color(0xFFF0ABFC).withValues(alpha: 0.35)
                  : const Color(0xFF8B5CF6).withValues(alpha: 0.1),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      color: done
                          ? const Color(0xFF34D399).withValues(alpha: 0.15)
                          : Colors.white.withValues(alpha: 0.05),
                      border: Border.all(
                        color: done
                            ? const Color(0xFF34D399).withValues(alpha: 0.3)
                            : Colors.white.withValues(alpha: 0.1),
                      ),
                    ),
                    child: Icon(
                      _missionIcon(mission.icon),
                      color: done
                          ? const Color(0xFF6EE7B7)
                          : const Color(0xFFF0ABFC),
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: done
                          ? const Color(0xFF34D399).withValues(alpha: 0.15)
                          : Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      done ? tr('home.completed') : tr('home.pending'),
                      style: TextStyle(
                        color: done
                            ? const Color(0xFF6EE7B7)
                            : const Color(0xFFCBD5E1),
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.6,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Text(
                mission.title.toUpperCase(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: Text(
                  mission.description,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.55),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    height: 1.35,
                  ),
                ),
              ),
              Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tr('home.progress'),
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.45),
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        mission.progressLabel,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Text(
                    mission.rewardLabel,
                    style: const TextStyle(
                      color: Color(0xFFF0ABFC),
                      fontSize: 22,
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
              const SizedBox(height: 14),
              if (done)
                Text(
                  tr('home.completed'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xFF6EE7B7),
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                    letterSpacing: 0.6,
                  ),
                )
              else
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: OutlinedButton(
                    onPressed: onTap,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      tr('home.doMission'),
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 12,
                      ),
                    ),
                  ),
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

    final url = widget.mission.actionUrl;
    if (url != null && url.isNotEmpty) {
      final uri = Uri.tryParse(url);
      if (uri != null) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }

      if (widget.mission.type == 'follow_social') {
        setState(() {
          _working = true;
          _message = tr('home.verifyingMission');
        });

        await Future<void>.delayed(const Duration(seconds: 3));

        try {
          await MissionsApi(widget.authService.client).completeMission(
            widget.mission.id,
          );
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

      return;
    }

    setState(() {
      _message = tr('home.missionAutoValidate');
    });
  }

  @override
  Widget build(BuildContext context) {
    final mission = widget.mission;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
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
