import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/widgets/points_chip.dart';
import '../../../auth/data/auth_service.dart';
import '../../data/artist.dart';
import '../../data/artists_api.dart';
import '../widgets/artist_avatar.dart';

class ArtistProfilePage extends StatefulWidget {
  const ArtistProfilePage({
    required this.artist,
    required this.authService,
    super.key,
  });

  final Artist artist;
  final AuthService authService;

  @override
  State<ArtistProfilePage> createState() => _ArtistProfilePageState();
}

class _ArtistProfilePageState extends State<ArtistProfilePage> {
  late int _followersCount;
  bool _isFollowing = false;
  bool _isTogglingFollow = false;
  bool _isLoadingFollowStatus = true;
  String _errorMessage = '';
  late final ArtistsApi _artistsApi;

  bool get _isSignedIn => widget.authService.session.isSignedIn;

  @override
  void initState() {
    super.initState();
    _followersCount = widget.artist.followersCount;
    _artistsApi = ArtistsApi(widget.authService.client);
    _loadFollowStatus();
  }

  Future<void> _loadFollowStatus() async {
    if (!_isSignedIn) {
      setState(() => _isLoadingFollowStatus = false);
      return;
    }

    try {
      final status = await _artistsApi.getFollowStatus(widget.artist.id);
      if (!mounted) return;
      setState(() {
        _isFollowing = status.following;
        _followersCount = status.followersCount;
        _isLoadingFollowStatus = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoadingFollowStatus = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accumulatedVotes = widget.artist.totalVotes > 0
        ? widget.artist.totalVotes
        : (widget.artist.popularityScore - _followersCount * 10).clamp(
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
        actions: [
          AppBarPointsAction(session: widget.authService.session),
        ],
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
            padding: const EdgeInsets.only(bottom: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_errorMessage.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: _ProfileMessage(message: _errorMessage),
                  ),
                ],
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF090B19).withValues(alpha: 0.9),
                    border: Border(
                      bottom: BorderSide(
                        color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
                      ),
                    ),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _ProfileHero(
                        artist: widget.artist,
                        isSignedIn: _isSignedIn,
                        isFollowing: _isFollowing,
                        isLoadingFollowStatus: _isLoadingFollowStatus,
                        isTogglingFollow: _isTogglingFollow,
                        onFollowTap: _toggleFollow,
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              widget.artist.bio.isEmpty
                                  ? 'Perfil público con popularidad, fans y actividad en votaciones.'
                                  : widget.artist.bio,
                              style: const TextStyle(
                                color: Color(0xFFCBD5E1),
                                height: 1.6,
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 12),
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
                            const SizedBox(height: 16),
                            _InfoPanel(artist: widget.artist),
                            const SizedBox(height: 12),
                            _AchievementsPanel(artist: widget.artist),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                ColoredBox(
                  color: const Color(0xFF090B19).withValues(alpha: 0.9),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
                    child: _EmptyVotesPanel(artistName: widget.artist.name),
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
    if (!_isSignedIn || _isTogglingFollow) {
      return;
    }

    setState(() {
      _errorMessage = '';
      _isTogglingFollow = true;
    });

    try {
      if (_isFollowing) {
        final shouldUnfollow = await _confirmUnfollow();

        if (shouldUnfollow != true) {
          return;
        }

        final result = await _artistsApi.unfollow(widget.artist.id);
        setState(() {
          _isFollowing = result.following;
          _followersCount = result.followersCount;
        });
      } else {
        final result = await _artistsApi.follow(widget.artist.id);
        setState(() {
          _isFollowing = result.following;
          _followersCount = result.followersCount;
        });
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
    required this.isSignedIn,
    required this.isFollowing,
    required this.isLoadingFollowStatus,
    required this.isTogglingFollow,
    required this.onFollowTap,
  });

  final Artist artist;
  final bool isSignedIn;
  final bool isFollowing;
  final bool isLoadingFollowStatus;
  final bool isTogglingFollow;
  final VoidCallback onFollowTap;

  @override
  Widget build(BuildContext context) {
    final bannerUrl = resolveArtistBanner(artist);

    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 520;

        return SizedBox(
          height: wide ? 288 : 332,
          child: Stack(
            fit: StackFit.expand,
            children: [
              DecoratedBox(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFF172554),
                      Color(0xFF4C1D95),
                      Color(0xFF701A75),
                    ],
                  ),
                ),
                child: CachedNetworkImage(
                  imageUrl: bannerUrl,
                  fit: BoxFit.cover,
                  color: Colors.white.withValues(alpha: 0.55),
                  colorBlendMode: BlendMode.modulate,
                  errorWidget: (context, error, stackTrace) =>
                      const SizedBox.shrink(),
                ),
              ),
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      const Color(0xFF090B19),
                      const Color(0xFF090B19).withValues(alpha: 0.3),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: _HeroIdentity(
                    artist: artist,
                    wide: wide,
                    isSignedIn: isSignedIn,
                    isFollowing: isFollowing,
                    isLoadingFollowStatus: isLoadingFollowStatus,
                    isTogglingFollow: isTogglingFollow,
                    onFollowTap: onFollowTap,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _HeroIdentity extends StatelessWidget {
  const _HeroIdentity({
    required this.artist,
    required this.wide,
    required this.isSignedIn,
    required this.isFollowing,
    required this.isLoadingFollowStatus,
    required this.isTogglingFollow,
    required this.onFollowTap,
  });

  final Artist artist;
  final bool wide;
  final bool isSignedIn;
  final bool isFollowing;
  final bool isLoadingFollowStatus;
  final bool isTogglingFollow;
  final VoidCallback onFollowTap;

  @override
  Widget build(BuildContext context) {
    final avatarSize = wide ? 112.0 : 96.0;
    final groupLabel = artist.group.isEmpty ? 'Sin grupo' : artist.group;

    final textColumn = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'PERFIL DE ARTISTA',
          style: TextStyle(
            color: Color(0xFF67E8F9),
            fontSize: 11,
            fontWeight: FontWeight.w900,
            letterSpacing: 2.8,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          artist.name,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: Colors.white,
            fontSize: wide ? 34 : 28,
            fontWeight: FontWeight.w900,
            height: 1,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          groupLabel.toUpperCase(),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Color(0xFFFCD34D),
            fontSize: 13,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(height: 10),
      ],
    );

    final followButton = !isSignedIn
        ? _FollowButton(
            label: 'Inicia sesión para seguir',
            isLoading: false,
            isFollowing: false,
            onTap: null,
            compact: wide,
          )
        : _FollowButton(
            label: isFollowing ? 'SIGUIENDO' : 'SEGUIR',
            isLoading: isTogglingFollow || isLoadingFollowStatus,
            isFollowing: isFollowing,
            onTap: onFollowTap,
            compact: wide,
          );

    if (wide) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          ArtistAvatar(
            artist: artist,
            size: avatarSize,
            radius: 28,
          ),
          const SizedBox(width: 14),
          Expanded(child: textColumn),
          const SizedBox(width: 12),
          followButton,
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            ArtistAvatar(
              artist: artist,
              size: avatarSize,
              radius: 28,
            ),
            const SizedBox(width: 14),
            Expanded(child: textColumn),
          ],
        ),
        const SizedBox(height: 14),
        followButton,
      ],
    );
  }
}

class _FollowButton extends StatelessWidget {
  const _FollowButton({
    required this.label,
    required this.isLoading,
    required this.isFollowing,
    required this.onTap,
    this.compact = false,
  });

  final String label;
  final bool isLoading;
  final bool isFollowing;
  final VoidCallback? onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final button = DecoratedBox(
      decoration: BoxDecoration(
        gradient: isFollowing
            ? null
            : const LinearGradient(
                colors: [Color(0xFFEC4899), Color(0xFFD946EF)],
              ),
        color: isFollowing ? Colors.black.withValues(alpha: 0.2) : null,
        borderRadius: BorderRadius.circular(99),
        border: isFollowing
            ? Border.all(color: const Color(0xFFF0ABFC).withValues(alpha: 0.45))
            : null,
        boxShadow: isFollowing
            ? null
            : [
                BoxShadow(
                  color: const Color(0xFFD946EF).withValues(alpha: 0.28),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
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
                size: 18,
              ),
        label: Text(
          label,
          style: TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: compact ? 12 : 13,
            letterSpacing: compact ? 1 : 1.1,
          ),
        ),
        style: FilledButton.styleFrom(
          backgroundColor: Colors.transparent,
          foregroundColor: Colors.white,
          shadowColor: Colors.transparent,
          padding: EdgeInsets.symmetric(
            horizontal: compact ? 22 : 18,
            vertical: compact ? 12 : 14,
          ),
          minimumSize: compact ? null : const Size(double.infinity, 48),
          alignment: Alignment.center,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(99),
          ),
        ),
      ),
    );

    if (compact) {
      return button;
    }

    return SizedBox(width: double.infinity, child: button);
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
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var row = 0; row < stats.length; row += 2) ...[
          if (row > 0) const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _StatCard(stat: stats[row])),
              const SizedBox(width: 10),
              Expanded(
                child: row + 1 < stats.length
                    ? _StatCard(stat: stats[row + 1])
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.stat});

  final _ProfileStatData stat;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            stat.label.toUpperCase(),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Color(0xFF64748B),
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.6,
              height: 1.15,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            stat.value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w900,
              height: 1,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoPanel extends StatelessWidget {
  const _InfoPanel({required this.artist});

  final Artist artist;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
        ),
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
                label: 'Fandom',
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
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF59E0B).withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(0xFFFBBF24).withValues(alpha: 0.15),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'LOGROS',
            style: TextStyle(
              color: Color(0xFFFCD34D),
              fontSize: 12,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.2,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(99),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
            ),
            child: const Text(
              'Sin logros todavía',
              style: TextStyle(
                color: Color(0xFF94A3B8),
                fontSize: 12,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyVotesPanel extends StatelessWidget {
  const _EmptyVotesPanel({required this.artistName});

  final String artistName;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFF090B19).withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(32),
        border: Border.all(
          color: const Color(0xFFF0ABFC).withValues(alpha: 0.15),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4A044E).withValues(alpha: 0.2),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(32),
        child: Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(-0.64, -1),
                    radius: 1,
                    colors: [
                      const Color(0xFFD946EF).withValues(alpha: 0.18),
                      Colors.transparent,
                    ],
                    stops: const [0, 0.34],
                  ),
                ),
              ),
            ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(0.76, -0.64),
                    radius: 1,
                    colors: [
                      const Color(0xFF22D3EE).withValues(alpha: 0.12),
                      Colors.transparent,
                    ],
                    stops: const [0, 0.3],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD946EF).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(32),
                    border: Border.all(
                      color: const Color(0xFFF0ABFC).withValues(alpha: 0.25),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF4A044E).withValues(alpha: 0.2),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.music_note_rounded,
                    color: Color(0xFFF5D0FE),
                    size: 30,
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'SIN RONDAS REGISTRADAS',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFFF0ABFC),
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2.8,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Aún no hay votos de $artistName',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    height: 1.15,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Este artista todavía no aparece con votos registrados en rondas cerradas o activas. Cuando participe en una votación, aquí verás su apoyo, porcentaje y resultados.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFFCBD5E1),
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    height: 1.55,
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFD946EF), Color(0xFF22D3EE)],
                      ),
                      borderRadius: BorderRadius.circular(99),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF4A044E).withValues(alpha: 0.3),
                          blurRadius: 18,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: TextButton(
                      onPressed: () {},
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                      child: const Text(
                        'VER VOTACIONES',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.1,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        ),
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
