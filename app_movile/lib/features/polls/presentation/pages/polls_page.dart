import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

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

class _PollsPageState extends State<PollsPage>
    with SingleTickerProviderStateMixin {
  late final PollsApi _pollsApi;
  late final TabController _tabController;
  late Future<_PollsData> _pollsFuture;

  @override
  void initState() {
    super.initState();
    _pollsApi = PollsApi(widget.authService.client);
    _tabController = TabController(length: 2, vsync: this);
    _pollsFuture = _loadPolls();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
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
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PollDetailPage(
          authService: widget.authService,
          pollId: poll.id,
          initialPoll: poll,
        ),
      ),
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
              const Text(
                'VOTACIONES',
                style: TextStyle(
                  color: Color(0xFFF0ABFC),
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2.4,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Todas las encuestas',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Explora votaciones abiertas y consulta resultados de las cerradas.',
                style: TextStyle(
                  color: Color(0xFFB9B2D8),
                  fontWeight: FontWeight.w600,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 14),
              Container(
                height: 46,
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.08),
                  ),
                ),
                child: TabBar(
                  controller: _tabController,
                  indicatorSize: TabBarIndicatorSize.tab,
                  dividerColor: Colors.transparent,
                  indicator: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF8B5CF6), Color(0xFFFF21C8)],
                    ),
                  ),
                  labelColor: Colors.white,
                  unselectedLabelColor: const Color(0xFFB9B2D8),
                  labelStyle: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                  ),
                  unselectedLabelStyle: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                  ),
                  tabs: const [
                    Tab(text: 'Abiertas'),
                    Tab(text: 'Cerradas'),
                  ],
                ),
              ),
            ],
          ),
        ),
        const BannerAdWidget(
          padding: EdgeInsets.fromLTRB(18, 8, 18, 4),
        ),
        const SizedBox(height: 4),
        Expanded(
          child: FutureBuilder<_PollsData>(
            future: _pollsFuture,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [
                    SizedBox(height: 80),
                    _PollsStateMessage(
                      icon: Icons.error_outline_rounded,
                      title: 'No se pudieron cargar las votaciones.',
                      subtitle: 'Desliza hacia abajo para reintentar.',
                    ),
                  ],
                );
              }

              if (!snapshot.hasData) {
                return const Center(
                  child: CircularProgressIndicator(color: Color(0xFFFF21C8)),
                );
              }

              final data = snapshot.data!;

              return TabBarView(
                controller: _tabController,
                children: [
                  _PollsTabList(
                    polls: data.openPolls,
                    emptyTitle: 'Sin votaciones abiertas',
                    emptySubtitle:
                        'Cuando haya encuestas en vivo o en proceso, aparecerán aquí.',
                    onRefresh: _refresh,
                    onOpenPoll: _openPoll,
                    isOpenTab: true,
                  ),
                  _PollsTabList(
                    polls: data.closedPolls,
                    emptyTitle: 'Sin votaciones cerradas',
                    emptySubtitle:
                        'Cuando finalice una votación, sus resultados quedarán aquí.',
                    onRefresh: _refresh,
                    onOpenPoll: _openPoll,
                    isOpenTab: false,
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _PollsTabList extends StatelessWidget {
  const _PollsTabList({
    required this.polls,
    required this.emptyTitle,
    required this.emptySubtitle,
    required this.onRefresh,
    required this.onOpenPoll,
    required this.isOpenTab,
  });

  final List<Poll> polls;
  final String emptyTitle;
  final String emptySubtitle;
  final Future<void> Function() onRefresh;
  final ValueChanged<Poll> onOpenPoll;
  final bool isOpenTab;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: const Color(0xFFFF21C8),
      backgroundColor: const Color(0xFF120A2B),
      onRefresh: onRefresh,
      child: polls.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(18, 24, 18, 100),
              children: [
                _PollsStateMessage(
                  icon: isOpenTab
                      ? Icons.how_to_vote_outlined
                      : Icons.inventory_2_outlined,
                  title: emptyTitle,
                  subtitle: emptySubtitle,
                ),
              ],
            )
          : ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 100),
              itemCount: polls.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                return _PollCard(
                  poll: polls[index],
                  isOpenTab: isOpenTab,
                  onTap: () => onOpenPoll(polls[index]),
                );
              },
            ),
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
                            '${_formatVotes(poll.totalVotes)} votos',
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
                      poll.title.isEmpty ? 'Votación' : poll.title,
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
    if (poll.status == 'selecting_winners') return 'Ver proceso';
    if (poll.status == 'closed') return 'Ver resultados';
    return 'Votar ahora';
  }

  String _dateLabel(Poll poll) {
    final date = poll.activeEndAt ?? poll.endAt;
    if (date == null) {
      return poll.status == 'closed' ? 'Finalizada' : 'En vivo';
    }

    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final formatted = '$day/$month/${date.year}';
    return poll.status == 'closed' ? 'Terminó $formatted' : 'Termina $formatted';
  }

  _StatusMeta _statusMeta(String status) {
    switch (status) {
      case 'live':
        return const _StatusMeta(
          label: 'EN VIVO',
          foreground: Color(0xFFD1FAE5),
          background: Color(0x2634D399),
          border: Color(0x4034D399),
        );
      case 'selecting_winners':
        return const _StatusMeta(
          label: 'EN PROCESO',
          foreground: Color(0xFFFEF3C7),
          background: Color(0x26FBBF24),
          border: Color(0x40FBBF24),
        );
      default:
        return const _StatusMeta(
          label: 'CERRADA',
          foreground: Color(0xFFE2E8F0),
          background: Color(0x14FFFFFF),
          border: Color(0x33FFFFFF),
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
