import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../data/artist.dart';
import '../widgets/artist_avatar.dart';

class ArtistProfilePage extends StatefulWidget {
  const ArtistProfilePage({required this.artist, super.key});

  final Artist artist;

  @override
  State<ArtistProfilePage> createState() => _ArtistProfilePageState();
}

class _ArtistProfilePageState extends State<ArtistProfilePage> {
  late int _followersCount;
  bool _isTogglingFollow = false;
  String _errorMessage = '';

  User? get _user => FirebaseAuth.instance.currentUser;

  @override
  void initState() {
    super.initState();
    _followersCount = widget.artist.followersCount;
  }

  @override
  Widget build(BuildContext context) {
    final accumulatedVotes =
        (widget.artist.popularityScore - _followersCount * 10).clamp(
          0,
          1 << 31,
        );
    final popularity = _followersCount * 10 + accumulatedVotes;

    return Scaffold(
      extendBodyBehindAppBar: true,
      backgroundColor: const Color(0xFF09061B),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: Colors.white,
        leading: IconButton(
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
        ),
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF050213), Color(0xFF09061B), Color(0xFF120A2B)],
          ),
        ),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: const EdgeInsets.only(bottom: 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _ProfileHero(
                  artist: widget.artist,
                  isTogglingFollow: _isTogglingFollow,
                  onFollowTap: _toggleFollow,
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_errorMessage.isNotEmpty) ...[
                        _ProfileMessage(message: _errorMessage),
                        const SizedBox(height: 14),
                      ],
                      Text(
                        widget.artist.bio.isEmpty
                            ? 'Perfil público con popularidad, fans y actividad en votaciones.'
                            : widget.artist.bio,
                        style: const TextStyle(
                          color: Color(0xFFD8D3F7),
                          height: 1.45,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 14),
                      _StatsGrid(
                        stats: [
                          _ProfileStatData(
                            label: 'Seguidores',
                            value: _formatProfileCount(_followersCount),
                          ),
                          _ProfileStatData(
                            label: 'Votos acumulados',
                            value: _formatProfileCount(accumulatedVotes),
                          ),
                          const _ProfileStatData(
                            label: 'Apoyo promedio',
                            value: '0.00%',
                          ),
                          _ProfileStatData(
                            label: 'Popularidad',
                            value: _formatProfileCount(popularity),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      _InfoPanel(artist: widget.artist),
                      const SizedBox(height: 14),
                      _AchievementsPanel(artist: widget.artist),
                      const SizedBox(height: 16),
                      _ActivityPanel(
                        artist: widget.artist,
                        accumulatedVotes: accumulatedVotes,
                        popularity: popularity,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _toggleFollow() async {
    final user = _user;

    if (user == null || _isTogglingFollow) {
      return;
    }

    setState(() {
      _errorMessage = '';
      _isTogglingFollow = true;
    });

    final artistFollowRef = FirebaseFirestore.instance
        .collection('artists')
        .doc(widget.artist.id)
        .collection('followers')
        .doc(user.uid);
    final artistRef = FirebaseFirestore.instance
        .collection('artists')
        .doc(widget.artist.id);
    final userFollowRef = FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .collection('followingArtists')
        .doc(widget.artist.id);

    try {
      final followSnap = await artistFollowRef.get();

      if (followSnap.exists) {
        final shouldUnfollow = await _confirmUnfollow();

        if (shouldUnfollow != true) {
          return;
        }

        final batch = FirebaseFirestore.instance.batch()
          ..delete(artistFollowRef)
          ..delete(userFollowRef)
          ..update(artistRef, {
            'followersCount': FieldValue.increment(-1),
            'popularityScore': FieldValue.increment(-10),
          });

        await batch.commit();
        setState(() {
          _followersCount = _followersCount > 0 ? _followersCount - 1 : 0;
        });
      } else {
        final followData = {
          'artistId': widget.artist.id,
          'artistSlug': widget.artist.slug.isEmpty
              ? widget.artist.id
              : widget.artist.slug,
          'userId': user.uid,
          'artistName': widget.artist.name,
          'artistImage': widget.artist.image,
          'createdAt': FieldValue.serverTimestamp(),
        };

        final batch = FirebaseFirestore.instance.batch()
          ..set(artistFollowRef, followData)
          ..set(userFollowRef, followData)
          ..update(artistRef, {
            'followersCount': FieldValue.increment(1),
            'popularityScore': FieldValue.increment(10),
          });

        await batch.commit();
        setState(() => _followersCount += 1);
      }
    } catch (_) {
      if (mounted) {
        setState(() => _errorMessage = 'No se pudo actualizar el seguimiento.');
      }
    } finally {
      if (mounted) {
        setState(() => _isTogglingFollow = false);
      }
    }
  }

  Future<bool?> _confirmUnfollow() {
    return showDialog<bool>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.72),
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF100A24),
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text(
          'Dejar de seguir',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900),
        ),
        content: Text(
          '¿Quieres dejar de seguir a ${widget.artist.name}?',
          style: const TextStyle(
            color: Color(0xFFD8D3F7),
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFFF21C8),
              foregroundColor: Colors.white,
            ),
            child: const Text('Dejar de seguir'),
          ),
        ],
      ),
    );
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({
    required this.artist,
    required this.isTogglingFollow,
    required this.onFollowTap,
  });

  final Artist artist;
  final bool isTogglingFollow;
  final VoidCallback onFollowTap;

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final followDoc = user == null
        ? null
        : FirebaseFirestore.instance
              .collection('artists')
              .doc(artist.id)
              .collection('followers')
              .doc(user.uid)
              .snapshots();

    return Container(
      margin: const EdgeInsets.fromLTRB(10, 0, 10, 0),
      height: 248,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(28)),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          DecoratedBox(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF1E1B4B), Color(0xFF701A75)],
              ),
            ),
            child: artist.banner.isEmpty
                ? const SizedBox.shrink()
                : Image.network(
                    artist.banner,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) =>
                        const SizedBox.shrink(),
                  ),
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0x33080416),
                  Color(0xBB080416),
                  Color(0xFF080416),
                ],
              ),
            ),
          ),
          Positioned(
            left: 16,
            right: 16,
            bottom: 16,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    ArtistAvatar(artist: artist, size: 72, radius: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'PERFIL DE ARTISTA',
                            style: TextStyle(
                              color: Color(0xFF67E8F9),
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 2,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            artist.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 26,
                              fontWeight: FontWeight.w900,
                              height: 1,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            artist.group.isEmpty ? 'Sin grupo' : artist.group,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFFFBBF24),
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                followDoc == null
                    ? _FollowButton(
                        label: 'Inicia sesión para seguir',
                        isLoading: false,
                        isFollowing: false,
                        onTap: null,
                      )
                    : StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
                        stream: followDoc,
                        builder: (context, snapshot) {
                          final isFollowing = snapshot.data?.exists ?? false;

                          return _FollowButton(
                            label: isFollowing ? 'Siguiendo' : 'Seguir artista',
                            isLoading: isTogglingFollow,
                            isFollowing: isFollowing,
                            onTap: onFollowTap,
                          );
                        },
                      ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FollowButton extends StatelessWidget {
  const _FollowButton({
    required this.label,
    required this.isLoading,
    required this.isFollowing,
    required this.onTap,
  });

  final String label;
  final bool isLoading;
  final bool isFollowing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 50,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: isFollowing
              ? null
              : const LinearGradient(
                  colors: [Color(0xFF7C3AED), Color(0xFFFF21C8)],
                ),
          color: isFollowing ? Colors.white.withValues(alpha: 0.10) : null,
          borderRadius: BorderRadius.circular(16),
          border: isFollowing
              ? Border.all(color: Colors.white.withValues(alpha: 0.14))
              : null,
        ),
        child: FilledButton.icon(
          onPressed: isLoading ? null : onTap,
          icon: isLoading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Icon(
                  isFollowing ? Icons.check_rounded : Icons.favorite_rounded,
                ),
          label: Text(label),
          style: FilledButton.styleFrom(
            backgroundColor: Colors.transparent,
            foregroundColor: Colors.white,
            shadowColor: Colors.transparent,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            textStyle: const TextStyle(fontWeight: FontWeight.w900),
          ),
        ),
      ),
    );
  }
}

class _ProfileStatData {
  const _ProfileStatData({required this.label, required this.value});

  final String label;
  final String value;
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats});

  final List<_ProfileStatData> stats;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: stats.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.95,
      ),
      itemBuilder: (context, index) {
        final stat = stats[index];

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.20),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                stat.label.toUpperCase(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFF8E86B9),
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                stat.value,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _InfoPanel extends StatelessWidget {
  const _InfoPanel({required this.artist});

  final Artist artist;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'DATOS',
            style: TextStyle(
              color: Color(0xFFF0ABFC),
              fontSize: 12,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.2,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _InfoChip(label: 'Rol', value: artist.role.ifEmpty('Artista')),
              _InfoChip(
                label: 'País',
                value: artist.country.ifEmpty('No definido'),
              ),
              _InfoChip(
                label: 'Grupo',
                value: artist.group.ifEmpty('Sin grupo'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Text(
        '$label: $value',
        style: const TextStyle(
          color: Color(0xFFD8D3F7),
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _AchievementsPanel extends StatelessWidget {
  const _AchievementsPanel({required this.artist});

  final Artist artist;

  @override
  Widget build(BuildContext context) {
    final achievements = <String>[
      if (artist.role.isNotEmpty) artist.role,
      if (artist.group.isNotEmpty) artist.group,
      if (artist.country.isNotEmpty) artist.country,
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF59E0B).withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: const Color(0xFFFBBF24).withValues(alpha: 0.14),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'LOGROS',
            style: TextStyle(
              color: Color(0xFFFBBF24),
              fontSize: 12,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.2,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children:
                (achievements.isEmpty ? ['Sin logros todavía'] : achievements)
                    .take(3)
                    .map(
                      (item) => Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(
                            0xFFFBBF24,
                          ).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(99),
                          border: Border.all(
                            color: const Color(
                              0xFFFBBF24,
                            ).withValues(alpha: 0.18),
                          ),
                        ),
                        child: Text(
                          item.toUpperCase(),
                          style: const TextStyle(
                            color: Color(0xFFFFF7CC),
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    )
                    .toList(),
          ),
        ],
      ),
    );
  }
}

class _ActivityPanel extends StatelessWidget {
  const _ActivityPanel({
    required this.artist,
    required this.accumulatedVotes,
    required this.popularity,
  });

  final Artist artist;
  final int accumulatedVotes;
  final int popularity;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ActivityCard(
          status: 'LIVE',
          title: artist.group.isEmpty ? 'Actividad del artista' : artist.group,
          percent: popularity <= 0 ? 0 : (accumulatedVotes / popularity) * 100,
          votes: accumulatedVotes,
        ),
      ],
    );
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({
    required this.status,
    required this.title,
    required this.percent,
    required this.votes,
  });

  final String status;
  final String title;
  final double percent;
  final int votes;

  @override
  Widget build(BuildContext context) {
    final safePercent = percent.clamp(0, 100);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF090B19).withValues(alpha: 0.90),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            status,
            style: const TextStyle(
              color: Color(0xFFFF4FD8),
              fontSize: 10,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Apoyo actual',
                style: TextStyle(
                  color: Color(0xFFB9B2D8),
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                '${safePercent.toStringAsFixed(2)}%',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: safePercent / 100,
              minHeight: 6,
              backgroundColor: Colors.white.withValues(alpha: 0.10),
              valueColor: const AlwaysStoppedAnimation(Color(0xFFFF4FD8)),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${_formatProfileCount(votes)} votos',
            style: const TextStyle(
              color: Color(0xFF8E86B9),
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileMessage extends StatelessWidget {
  const _ProfileMessage({required this.message});

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

String _formatProfileCount(int value) {
  if (value >= 1000000) {
    return '${(value / 1000000).toStringAsFixed(1)}M';
  }

  if (value >= 1000) {
    return '${(value / 1000).toStringAsFixed(1)}K';
  }

  return value.toString();
}

extension on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}
