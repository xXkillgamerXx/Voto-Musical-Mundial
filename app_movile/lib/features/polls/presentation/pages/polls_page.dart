import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';
import '../../../../core/ads/banner_ad_widget.dart';
import '../../../artists/presentation/widgets/artist_avatar.dart';
import '../../../auth/data/auth_service.dart';
import '../../../home/data/poll.dart';
import '../../../home/data/polls_api.dart';
import 'poll_detail_page.dart';

class _PollsData {
  const _PollsData({required this.openPolls, required this.closedPolls});

  final List<Poll> openPolls;
  final List<Poll> closedPolls;
}

class PollsPage extends StatefulWidget {
  const PollsPage({required this.authService, super.key});

  final AuthService authService;

  @override
  State<PollsPage> createState() => _PollsPageState();
}

class _PollsPageState extends State<PollsPage> {
  late final PollsApi _pollsApi;
  late Future<_PollsData> _pollsFuture;

  @override
  void initState() {
    super.initState();
    _pollsApi = PollsApi(widget.authService.client);
    _pollsFuture = _loadPolls();
  }

  Future<_PollsData> _loadPolls({bool forceRefresh = false}) async {
    final liveFuture = _pollsApi.getLivePolls(
      limit: 50,
      forceRefresh: forceRefresh,
    );
    final allFuture = _pollsApi.getPolls(
      limit: 100,
      forceRefresh: forceRefresh,
    );

    final livePolls = await liveFuture;
    final allPolls = await allFuture;

    final openById = <String, Poll>{};
    for (final poll in livePolls) {
      if (poll.id.isEmpty) continue;
      openById[poll.id] = poll;
    }
    for (final poll in allPolls) {
      if (poll.id.isEmpty) continue;
      if (poll.status == 'live' || poll.status == 'selecting_winners') {
        openById.putIfAbsent(poll.id, () => poll);
      }
    }

    final closedPolls = allPolls
        .where((poll) => poll.status == 'closed')
        .toList(growable: false);

    return _PollsData(
      openPolls: openById.values.toList(growable: false),
      closedPolls: closedPolls,
    );
  }

  Future<void> _refresh() async {
    setState(() {
      _pollsFuture = _loadPolls(forceRefresh: true);
    });
    await _pollsFuture;
  }

  void _openPoll(Poll poll) {
    PollDetailPage.open(
      context,
      authService: widget.authService,
      pollId: poll.id,
      initialPoll: poll,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                tr('catalog.pollsEyebrow'),
                style: const TextStyle(
                  color: Color(0xFFF0ABFC),
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2.4,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                tr('catalog.pollsTitle'),
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
              ),
              const SizedBox(height: 6),
              Text(
                tr('catalog.pollsSubtitle'),
                style: const TextStyle(
                  color: Color(0xFFB9B2D8),
                  fontWeight: FontWeight.w600,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
        const BannerAdWidget(
          padding: EdgeInsets.fromLTRB(18, 8, 18, 4),
        ),
        Expanded(
          child: FutureBuilder<_PollsData>(
            future: _pollsFuture,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return RefreshIndicator(
                  color: const Color(0xFFFF21C8),
                  backgroundColor: const Color(0xFF120A2B),
                  onRefresh: _refresh,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      const SizedBox(height: 80),
                      _PollsStateMessage(
                        icon: Icons.error_outline_rounded,
                        title: tr('catalog.pollsLoadError'),
                        subtitle: tr('catalog.pollsRetryHint'),
                      ),
                    ],
                  ),
                );
              }

              if (!snapshot.hasData) {
                return const Center(
                  child: CircularProgressIndicator(color: Color(0xFFFF21C8)),
                );
              }

              final data = snapshot.data!;
              return RefreshIndicator(
                color: const Color(0xFFFF21C8),
                backgroundColor: const Color(0xFF120A2B),
                onRefresh: _refresh,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics(),
                  ),
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 100),
                  children: [
                    _PollsSectionHeader(
                      title: tr('catalog.pollsTabOpen'),
                      count: data.openPolls.length,
                    ),
                    const SizedBox(height: 12),
                    if (data.openPolls.isEmpty)
                      _PollsStateMessage(
                        icon: Icons.how_to_vote_outlined,
                        title: tr('catalog.pollsEmptyOpenTitle'),
                        subtitle: tr('catalog.pollsEmptyOpenSubtitle'),
                      )
                    else
                      ..._pollCards(data.openPolls, isOpen: true),
                    const SizedBox(height: 28),
                    _PollsSectionHeader(
                      title: tr('catalog.pollsTabClosed'),
                      count: data.closedPolls.length,
                    ),
                    const SizedBox(height: 12),
                    if (data.closedPolls.isEmpty)
                      _PollsStateMessage(
                        icon: Icons.inventory_2_outlined,
                        title: tr('catalog.pollsEmptyClosedTitle'),
                        subtitle: tr('catalog.pollsEmptyClosedSubtitle'),
                      )
                    else
                      ..._pollCards(data.closedPolls, isOpen: false),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  List<Widget> _pollCards(List<Poll> polls, {required bool isOpen}) {
    final children = <Widget>[];
    for (var i = 0; i < polls.length; i++) {
      if (i > 0) children.add(const SizedBox(height: 12));
      children.add(
        _PollCard(
          poll: polls[i],
          isOpenTab: isOpen,
          onTap: () => _openPoll(polls[i]),
        ),
      );
    }
    return children;
  }
}

class _PollsSectionHeader extends StatelessWidget {
  const _PollsSectionHeader({
    required this.title,
    required this.count,
  });

  final String title;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          title.toUpperCase(),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(width: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xFFD946EF).withValues(alpha: 0.18),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: const Color(0xFFD946EF).withValues(alpha: 0.35),
            ),
          ),
          child: Text(
            '$count',
            style: const TextStyle(
              color: Color(0xFFF0ABFC),
              fontSize: 11,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ],
    );
  }
}

class _PollCard extends StatelessWidget {
  const _PollCard({
    required this.poll,
    required this.isOpenTab,
    required this.onTap,
  });

  final Poll poll;
  final bool isOpenTab;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bannerUrl = resolveArtistMediaUrl(poll.banner);
    final description = _stripHtml(poll.description);
    final status = _statusMeta(poll.status);

    return Material(
      color: const Color(0xFF090B19).withValues(alpha: 0.9),
      borderRadius: BorderRadius.circular(24),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: isOpenTab ? 168 : 132,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (bannerUrl.isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: bannerUrl,
                        fit: BoxFit.cover,
                        errorWidget: (_, _, _) => const _BannerFallback(),
                      )
                    else
                      const _BannerFallback(),
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.black.withValues(alpha: 0.05),
                            const Color(0xFF080A17),
                          ],
                        ),
                      ),
                    ),
                    Positioned(
                      left: 14,
                      top: 14,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: status.background,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: status.border),
                        ),
                        child: Text(
                          status.label,
                          style: TextStyle(
                            color: status.foreground,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                    ),
                    if (poll.totalVotes > 0)
                      Positioned(
                        right: 14,
                        top: 14,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.45),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.15),
                            ),
                          ),
                          child: Text(
                            trp('catalog.votesCount', {
                              'count': _formatVotes(poll.totalVotes),
                            }),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      poll.title.isEmpty
                          ? tr('catalog.pollFallbackTitle')
                          : poll.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if (description.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          height: 1.4,
                        ),
                      ),
                    ],
                    if (poll.categoryName.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        poll.categoryName.toUpperCase(),
                        style: const TextStyle(
                          color: Color(0xFF64748B),
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.1,
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            _dateLabel(poll),
                            style: const TextStyle(
                              color: Color(0xFF64748B),
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            gradient: isOpenTab && poll.status == 'live'
                                ? const LinearGradient(
                                    colors: [
                                      Color(0xFF8B5CF6),
                                      Color(0xFFFF21C8),
                                    ],
                                  )
                                : null,
                            color: isOpenTab && poll.status == 'live'
                                ? null
                                : const Color(0xFFD946EF).withValues(
                                    alpha: 0.12,
                                  ),
                            border: isOpenTab && poll.status == 'live'
                                ? null
                                : Border.all(
                                    color: const Color(
                                      0xFFF0ABFC,
                                    ).withValues(alpha: 0.25),
                                  ),
                          ),
                          child: Text(
                            _actionLabel(poll),
                            style: TextStyle(
                              color: isOpenTab && poll.status == 'live'
                                  ? Colors.white
                                  : const Color(0xFFF5D0FE),
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _actionLabel(Poll poll) {
    if (poll.status == 'selecting_winners') {
      return tr('catalog.pollActionViewProcess');
    }
    if (poll.status == 'closed') return tr('catalog.pollActionViewResults');
    return tr('catalog.pollActionVoteNow');
  }

  String _dateLabel(Poll poll) {
    final date = poll.activeEndAt ?? poll.endAt;
    if (poll.hideCountdown || date == null) {
      return poll.status == 'closed'
          ? tr('catalog.pollFinished')
          : tr('catalog.pollLive');
    }

    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final formatted = '$day/$month/${date.year}';
    return poll.status == 'closed'
        ? trp('catalog.pollEndedOn', {'date': formatted})
        : trp('catalog.pollEndsOn', {'date': formatted});
  }

  _StatusMeta _statusMeta(String status) {
    switch (status) {
      case 'live':
        return _StatusMeta(
          label: tr('catalog.statusLive'),
          foreground: const Color(0xFFD1FAE5),
          background: const Color(0x2634D399),
          border: const Color(0x4034D399),
        );
      case 'selecting_winners':
        return _StatusMeta(
          label: tr('catalog.statusInProcess'),
          foreground: const Color(0xFFFEF3C7),
          background: const Color(0x26FBBF24),
          border: const Color(0x40FBBF24),
        );
      default:
        return _StatusMeta(
          label: tr('catalog.statusClosed'),
          foreground: const Color(0xFFE2E8F0),
          background: const Color(0x14FFFFFF),
          border: const Color(0x33FFFFFF),
        );
    }
  }
}

class _StatusMeta {
  const _StatusMeta({
    required this.label,
    required this.foreground,
    required this.background,
    required this.border,
  });

  final String label;
  final Color foreground;
  final Color background;
  final Color border;
}

class _BannerFallback extends StatelessWidget {
  const _BannerFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2E1065), Color(0xFF701A75), Color(0xFF0F172A)],
        ),
      ),
    );
  }
}

class _PollsStateMessage extends StatelessWidget {
  const _PollsStateMessage({
    required this.icon,
    required this.title,
    this.subtitle,
  });

  final IconData icon;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 40),
      child: Column(
        children: [
          Icon(icon, size: 48, color: const Color(0xFFF0ABFC)),
          const SizedBox(height: 14),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 8),
            Text(
              subtitle!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFF94A3B8),
                fontWeight: FontWeight.w600,
                height: 1.45,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

String _stripHtml(String value) {
  return value
      .replaceAll(RegExp(r'<[^>]*>'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

String _formatVotes(int value) {
  if (value >= 1000000) {
    return '${(value / 1000000).toStringAsFixed(1)}M';
  }
  if (value >= 1000) {
    return '${(value / 1000).toStringAsFixed(1)}K';
  }
  return '$value';
}
