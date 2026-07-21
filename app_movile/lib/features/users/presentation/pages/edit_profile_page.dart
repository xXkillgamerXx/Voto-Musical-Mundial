import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/i18n/tr.dart';
import '../../../artists/presentation/widgets/artist_avatar.dart';
import '../../../auth/data/auth_service.dart';
import '../../data/user_profile.dart';
import '../../data/users_api.dart';

class EditProfilePage extends StatefulWidget {
  const EditProfilePage({
    required this.authService,
    this.initialProfile,
    super.key,
  });

  final AuthService authService;
  final UserProfile? initialProfile;

  @override
  State<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends State<EditProfilePage> {
  static final RegExp _usernameRegex = RegExp(r'^[a-zA-Z0-9_]{3,32}$');

  late final UsersApi _usersApi;
  final _picker = ImagePicker();

  final _nameController = TextEditingController();
  final _usernameController = TextEditingController();
  final _bioController = TextEditingController();

  UserProfile? _profile;
  String _photoUrl = '';
  String _bannerUrl = '';
  String _country = '';

  bool _loading = true;
  bool _saving = false;
  bool _uploadingAvatar = false;
  bool _uploadingBanner = false;

  @override
  void initState() {
    super.initState();
    _usersApi = UsersApi(widget.authService.client);
    final initial = widget.initialProfile;
    if (initial != null) {
      _applyProfile(initial);
      _loading = false;
    } else {
      _load();
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _usernameController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final profile = await _usersApi.getMeProfile();
      if (!mounted) return;
      setState(() {
        _applyProfile(profile);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  void _applyProfile(UserProfile profile) {
    _profile = profile;
    _nameController.text = profile.displayName;
    _usernameController.text = profile.username;
    _bioController.text = profile.bio;
    _photoUrl = profile.photoUrl;
    _bannerUrl = profile.bannerUrl;
    _country = profile.country;
  }

  Future<void> _pickImage({required bool isBanner}) async {
    if (_saving) return;
    try {
      final XFile? file = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: isBanner ? 1600 : 1024,
        imageQuality: 85,
      );
      if (file == null) return;

      setState(() {
        if (isBanner) {
          _uploadingBanner = true;
        } else {
          _uploadingAvatar = true;
        }
      });

      final url = await _usersApi.uploadImage(file.path);
      if (!mounted) return;
      if (url.isEmpty) {
        _showMessage(tr('editProfile.uploadError'));
      } else {
        setState(() {
          if (isBanner) {
            _bannerUrl = url;
          } else {
            _photoUrl = url;
          }
        });
      }
    } catch (_) {
      if (!mounted) return;
      _showMessage(tr('editProfile.uploadError'));
    } finally {
      if (mounted) {
        setState(() {
          _uploadingAvatar = false;
          _uploadingBanner = false;
        });
      }
    }
  }

  Future<void> _save() async {
    if (_saving) return;
    final name = _nameController.text.trim();
    final username = _usernameController.text.trim();

    if (name.isEmpty) {
      _showMessage(tr('editProfile.nameRequired'));
      return;
    }
    if (username.isNotEmpty && !_usernameRegex.hasMatch(username)) {
      _showMessage(tr('editProfile.usernameInvalid'));
      return;
    }

    setState(() => _saving = true);
    try {
      final updated = await _usersApi.updateProfile(
        displayName: name,
        username: username.isNotEmpty ? username : null,
        photoUrl: _photoUrl,
        banner: _bannerUrl,
        bio: _bioController.text.trim(),
        country: _country.isNotEmpty ? _country : null,
      );

      final current = widget.authService.session.user;
      if (current != null) {
        await widget.authService.session.updateUser(
          current.copyWith(
            displayName: updated.displayName,
            username: updated.username.isNotEmpty ? updated.username : null,
            photoUrl: updated.photoUrl,
          ),
        );
      }

      if (!mounted) return;
      _showMessage(tr('editProfile.saved'));
      Navigator.of(context).pop(updated);
    } catch (error) {
      if (!mounted) return;
      _showMessage(AuthService.friendlyError(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF05010E),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(tr('editProfile.title')),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              top: false,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                children: [
                  _buildHeader(),
                  const SizedBox(height: 64),
                  _FieldLabel(text: tr('editProfile.displayName')),
                  TextField(
                    controller: _nameController,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(
                      hintText: tr('editProfile.displayNameHint'),
                    ),
                  ),
                  const SizedBox(height: 18),
                  _FieldLabel(text: tr('editProfile.username')),
                  TextField(
                    controller: _usernameController,
                    autocorrect: false,
                    decoration: InputDecoration(
                      prefixText: '@',
                      hintText: tr('editProfile.usernameHint'),
                    ),
                  ),
                  const SizedBox(height: 18),
                  _FieldLabel(text: tr('editProfile.bio')),
                  TextField(
                    controller: _bioController,
                    maxLines: 4,
                    maxLength: 280,
                    decoration: InputDecoration(
                      hintText: tr('editProfile.bioHint'),
                      alignLabelWithHint: true,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _saving ? null : _save,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF8B5CF6),
                      foregroundColor: Colors.white,
                    ),
                    child: _saving
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : Text(tr('editProfile.save')),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildHeader() {
    final bannerUrl = resolveArtistMediaUrl(_bannerUrl);
    final photoUrl = resolveArtistMediaUrl(_photoUrl);

    return SizedBox(
      height: 150,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Banner
          Positioned.fill(
            child: GestureDetector(
              onTap: () => _pickImage(isBanner: true),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (bannerUrl.isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: bannerUrl,
                        fit: BoxFit.cover,
                        errorWidget: (_, _, _) => const _BannerPlaceholder(),
                      )
                    else
                      const _BannerPlaceholder(),
                    Container(color: Colors.black.withValues(alpha: 0.25)),
                    if (_uploadingBanner)
                      const Center(
                        child: CircularProgressIndicator(color: Colors.white),
                      ),
                    Positioned(
                      right: 10,
                      top: 10,
                      child: _EditBadge(label: tr('editProfile.changeBanner')),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Avatar
          Positioned(
            left: 16,
            bottom: -48,
            child: GestureDetector(
              onTap: () => _pickImage(isBanner: false),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0xFF05010E),
                        width: 4,
                      ),
                      gradient: const LinearGradient(
                        colors: [Color(0xFF7C3AED), Color(0xFFFF21C8)],
                      ),
                    ),
                    child: ClipOval(
                      child: photoUrl.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: photoUrl,
                              fit: BoxFit.cover,
                              errorWidget: (_, _, _) => _AvatarInitial(
                                name: _profile?.name ?? '',
                              ),
                            )
                          : _AvatarInitial(name: _profile?.name ?? ''),
                    ),
                  ),
                  if (_uploadingAvatar)
                    const Positioned.fill(
                      child: Center(
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      ),
                    ),
                  Positioned(
                    right: -2,
                    bottom: -2,
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Color(0xFF8B5CF6),
                      ),
                      child: const Icon(
                        Icons.camera_alt,
                        size: 16,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, left: 4),
      child: Text(
        text,
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.7),
          fontSize: 13,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

class _EditBadge extends StatelessWidget {
  const _EditBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.image_outlined, size: 14, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _BannerPlaceholder extends StatelessWidget {
  const _BannerPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2A1650), Color(0xFF4C1D95), Color(0xFF831843)],
        ),
      ),
    );
  }
}

class _AvatarInitial extends StatelessWidget {
  const _AvatarInitial({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final letter = name.trim().isEmpty ? 'F' : name.trim()[0].toUpperCase();
    return Center(
      child: Text(
        letter,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 34,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}
