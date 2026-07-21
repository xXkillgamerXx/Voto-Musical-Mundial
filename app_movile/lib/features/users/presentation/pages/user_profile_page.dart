import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../artists/data/artist.dart';
import '../../../artists/data/artists_api.dart';
import '../../../artists/presentation/pages/artist_profile_page.dart';
import '../../../artists/presentation/widgets/artist_avatar.dart';
import '../../../auth/data/auth_service.dart';
import '../../../../core/i18n/tr.dart';
import '../../../../core/widgets/points_chip.dart';
import '../../data/user_profile.dart';
import '../../data/users_api.dart';

class UserProfilePage extends StatefulWidget {
  const UserProfilePage({
    required this.authService,
    this.username,
    super.key,
  });

  final AuthService authService;
  final String? username;

  @override
  State<UserProfilePage> createState() => _UserProfilePageState();
}

class _UserProfilePageState extends State<UserProfilePage> {
  late final UsersApi _usersApi;
  late final ArtistsApi _artistsApi;
  late Future<UserProfile> _profileFuture;

  bool get _isOwnProfileRequest {
    final username = widget.username?.trim().toLowerCase() ?? '';
    if (username.isEmpty) return true;
    final current = widget.authService.session.user?.username
            .trim()
            .toLowerCase() ??
        '';
    return current.isNotEmpty && current == username;
  }

  @override
  void initState() {
    super.initState();
    _usersApi = UsersApi(widget.authService.client);
    _artistsApi = ArtistsApi(widget.authService.client);
    _profileFuture = _loadProfile();
  }

  Future<UserProfile> _loadProfile() async {
    final username = widget.username?.trim().toLowerCase() ?? '';
    if (username.isNotEmpty && !_isOwnProfileRequest) {
      return _usersApi.getPublicProfile(username);
    }

    if (username.isNotEmpty) {
      return _usersApi.getPublicProfile(username);
    }

    return _usersApi.getMeProfile();
  }

  Future<void> _refresh() async {
    setState(() {
      _profileFuture = _loadProfile();
    });
    await _profileFuture;
  }

  Future<void> _openArtist(FollowedArtistSummary followed) async {
    final artistId = followed.artistSlug.isNotEmpty
        ? followed.artistSlug
        : followed.artistId;
    if (artistId.isEmpty) return;

    try {
      final artist = await _artistsApi.getArtist(artistId);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ArtistProfilePage(
            artist: artist,
            authService: widget.authService,
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      final fallback = Artist(
        id: followed.artistId,
        name: followed.artistName,
        group: followed.artistGroup,
        country: '',
        role: '',
        image: followed.artistImage,
        banner: followed.artistImage,
        bio: '',
        slug: followed.artistSlug,
        followersCount: 0,
        popularityScore: 0,
        totalVotes: 0,
      );
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ArtistProfilePage(
            artist: fallback,
            authService: widget.authService,
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF09061B),
      appBar: AppBar(
        backgroundColor: const Color(0xFF09061B),
        foregroundColor: Colors.white,
        title: Text(
          _isOwnProfileRequest ? tr('misc.myProfile') : tr('misc.profile'),
          style: const TextStyle(fontWeight: FontWeight.w900),
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
        child: RefreshIndicator(
          color: const Color(0xFFFF21C8),
          backgroundColor: const Color(0xFF120A2B),
          onRefresh: _refresh,
          child: FutureBuilder<UserProfile>(
            future: _profileFuture,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    const SizedBox(height: 120),
                    _ProfileStateMessage(
                      icon: Icons.person_off_rounded,
                      title: tr('misc.profileLoadError'),
                      subtitle: tr('misc.profileUnavailable'),
                    ),
                  ],
                );
              }

              if (!snapshot.hasData) {
                return const Center(
                  child: CircularProgressIndicator(color: Color(0xFFFF21C8)),
                );
              }

              final profile = snapshot.data!;
              final photoUrl = resolveArtistMediaUrl(profile.photoUrl);
              final bannerUrl = resolveArtistMediaUrl(profile.bannerUrl);
              final bio = profile.bio.trim().isEmpty
                  ? tr('misc.publicFanProfileBio')
                  : profile.bio;

              return ListView(
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                children: [
                  Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF090B19).withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(28),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.1),
                      ),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SizedBox(
                          height: 150,
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              if (bannerUrl.isNotEmpty)
                                CachedNetworkImage(
                                  imageUrl: bannerUrl,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) =>
                                      const _BannerFallback(),
                                )
                              else
                                const _BannerFallback(),
                              Container(
                                decoration: const BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [
                                      Colors.transparent,
                                      Color(0xCC090B19),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Transform.translate(
                                offset: const Offset(0, -36),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    _ProfileAvatar(
                                      photoUrl: photoUrl,
                                      initial: profile.initial,
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Padding(
                                        padding: const EdgeInsets.only(
                                          bottom: 8,
                                        ),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              profile.name,
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 22,
                                                fontWeight: FontWeight.w900,
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              profile.username.isEmpty
                                                  ? '@fan'
                                                  : '@${profile.username}',
                                              style: const TextStyle(
                                                color: Color(0xFFC4B5FD),
                                                fontSize: 13,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Transform.translate(
                                offset: const Offset(0, -20),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      bio,
                                      style: const TextStyle(
                                        color: Color(0xFFCBD5E1),
                                        height: 1.55,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    const SizedBox(height: 14),
                                    Container(
                                      width: double.infinity,
                                      padding: const EdgeInsets.all(14),
                                      decoration: BoxDecoration(
                                        color: Colors.black.withValues(
                                          alpha: 0.22,
                                        ),
                                        borderRadius: BorderRadius.circular(18),
                                        border: Border.all(
                                          color: Colors.white.withValues(
                                            alpha: 0.1,
                                          ),
                                        ),
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            tr('misc.followedArtistsLabel'),
                                            style: const TextStyle(
                                              color: Color(0xFF94A3B8),
                                              fontSize: 10,
                                              fontWeight: FontWeight.w900,
                                              letterSpacing: 1.4,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            '${profile.followedArtists.length}',
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 24,
                                              fontWeight: FontWeight.w900,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.04),
                      borderRadius: BorderRadius.circular(28),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.1),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          tr('misc.favoritesLabel'),
                          style: const TextStyle(
                            color: Color(0xFFF0ABFC),
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.6,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          tr('misc.followedArtistsTitle'),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 14),
                        if (profile.followedArtists.isEmpty)
                          const _EmptyFollowing()
                        else
                          ...profile.followedArtists.map(
                            (artist) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _FollowedArtistTile(
                                artist: artist,
                                onTap: () => _openArtist(artist),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
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

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({required this.photoUrl, required this.initial});

  final String photoUrl;
  final String initial;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 88,
      height: 88,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white.withValues(alpha: 0.25), width: 1.5),
        gradient: const LinearGradient(
          colors: [Color(0xFF8B5CF6), Color(0xFFFF21C8)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFF21C8).withValues(alpha: 0.28),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(1.5),
        child: CircleAvatar(
          backgroundColor: const Color(0xFF0B071C),
          backgroundImage: photoUrl.isEmpty
              ? null
              : CachedNetworkImageProvider(photoUrl),
          child: photoUrl.isEmpty
              ? Text(
                  initial,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                  ),
                )
              : null,
        ),
      ),
    );
  }
}

class _FollowedArtistTile extends StatelessWidget {
  const _FollowedArtistTile({required this.artist, required this.onTap});

  final FollowedArtistSummary artist;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final imageUrl = resolveArtistMediaUrl(artist.artistImage);
    final initial = artist.artistName.isEmpty
        ? 'A'
        : artist.artistName[0].toUpperCase();

    return Material(
      color: const Color(0xFF020617).withValues(alpha: 0.45),
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF8B5CF6), Color(0xFFFF21C8)],
                  ),
                ),
                clipBehavior: Clip.antiAlias,
                child: imageUrl.isEmpty
                    ? Center(
                        child: Text(
                          initial,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 18,
                          ),
                        ),
                      )
                    : CachedNetworkImage(
                        imageUrl: imageUrl,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Center(
                          child: Text(
                            initial,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 18,
                            ),
                          ),
                        ),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      artist.artistName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      artist.artistGroup.isEmpty
                          ? tr('misc.following')
                          : artist.artistGroup,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: Colors.white.withValues(alpha: 0.45),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyFollowing extends StatelessWidget {
  const _EmptyFollowing();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF020617).withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr('misc.noFavoritesLabel'),
            style: const TextStyle(
              color: Color(0xFF67E8F9),
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            tr('misc.fanNoArtists'),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            tr('misc.artistsWillAppear'),
            style: const TextStyle(
              color: Color(0xFF94A3B8),
              fontSize: 13,
              fontWeight: FontWeight.w600,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileStateMessage extends StatelessWidget {
  const _ProfileStateMessage({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
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
          const SizedBox(height: 8),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFF94A3B8),
              fontWeight: FontWeight.w600,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}
