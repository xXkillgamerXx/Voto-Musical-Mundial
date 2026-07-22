import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/i18n/app_locale.dart';
import '../../../../core/i18n/i18n_registry.dart';
import '../../../../core/i18n/tr.dart';
import '../../../../core/widgets/points_chip.dart';
import '../../../auth/data/auth_service.dart';
import '../../data/comments_api.dart';
import '../../data/giphy_api.dart';
import '../../data/poll_comment.dart';

/// Pantalla aparte de comentarios (estilo normal, no chat).
class PollCommentsPage extends StatefulWidget {
  const PollCommentsPage({
    required this.pollId,
    required this.authService,
    this.pollTitle,
    super.key,
  });

  final String pollId;
  final AuthService authService;
  final String? pollTitle;

  static Future<void> open(
    BuildContext context, {
    required String pollId,
    required AuthService authService,
    String? pollTitle,
  }) {
    initI18n();
    const bg = Color(0xFF050213);
    return Navigator.of(context, rootNavigator: true).push<void>(
      PageRouteBuilder<void>(
        opaque: true,
        pageBuilder: (context, animation, secondaryAnimation) {
          return ColoredBox(
            color: bg,
            child: PollCommentsPage(
              pollId: pollId,
              authService: authService,
              pollTitle: pollTitle,
            ),
          );
        },
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(
            opacity: CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            ),
            child: child,
          );
        },
        transitionDuration: const Duration(milliseconds: 220),
      ),
    );
  }

  @override
  State<PollCommentsPage> createState() => _PollCommentsPageState();
}

class _PollCommentsPageState extends State<PollCommentsPage> {
  static const _minLength = 3;
  static const _maxLength = 500;
  static const _bg = Color(0xFF050213);

  late final CommentsApi _api;
  late final TextEditingController _controller;

  List<PollComment> _comments = const [];
  bool _loading = true;
  bool _publishing = false;
  String? _error;
  DateTime? _cooldownUntil;
  GiphyGif? _selectedGif;

  @override
  void initState() {
    super.initState();
    _api = CommentsApi(widget.authService.client);
    _controller = TextEditingController();
    _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final rows = await _api.list(widget.pollId);
      if (!mounted) return;
      setState(() {
        _comments = rows;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error is ApiException
            ? error.message
            : tr('pollDetail.commentsLoadError');
      });
    }
  }

  Future<void> _publish() async {
    final text = _controller.text.trim();
    final gif = _selectedGif;
    if (_publishing) return;
    if (text.length < _minLength && gif == null) return;

    final remaining = _cooldownRemaining;
    if (remaining > Duration.zero) {
      _showMessage(
        trp('pollDetail.commentsCooldown', {'time': _formatCooldown(remaining)}),
      );
      return;
    }

    setState(() => _publishing = true);

    try {
      final created = await _api.create(
        widget.pollId,
        text: text,
        gif: gif?.toCommentPayload(),
      );
      if (!mounted) return;
      setState(() {
        _comments = [created, ..._comments.where((c) => c.id != created.id)];
        _controller.clear();
        _selectedGif = null;
        _publishing = false;
        _cooldownUntil = DateTime.now().add(const Duration(minutes: 5));
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _publishing = false);
      if (error.statusCode == 429) {
        final ms = _remainingMs(error.payload);
        if (ms != null && ms > 0) {
          setState(() {
            _cooldownUntil = DateTime.now().add(Duration(milliseconds: ms));
          });
        }
      }
      _showMessage(error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _publishing = false);
      _showMessage(tr('pollDetail.commentsPublishError'));
    }
  }

  Future<void> _openGifPicker() async {
    if (!GiphyApi.isConfigured) {
      _showMessage(tr('pollDetail.commentsGifMissingKey'));
      return;
    }

    final selected = await showModalBottomSheet<GiphyGif>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const _GifPickerSheet(),
    );

    if (selected != null && mounted) {
      setState(() => _selectedGif = selected);
    }
  }

  Future<void> _delete(PollComment comment) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF120A2B),
          title: Text(
            tr('pollDetail.commentsDeleteTitle'),
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
          content: Text(
            tr('pollDetail.commentsDeleteBody'),
            style: TextStyle(color: Colors.white.withValues(alpha: 0.72)),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(tr('pollDetail.commentsCancel')),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(
                tr('pollDetail.commentsDelete'),
                style: const TextStyle(color: Color(0xFFFF4FD8)),
              ),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    try {
      await _api.remove(widget.pollId, comment.id);
      if (!mounted) return;
      setState(() {
        _comments = _comments.where((c) => c.id != comment.id).toList();
      });
    } on ApiException catch (error) {
      _showMessage(error.message);
    } catch (_) {
      _showMessage(tr('pollDetail.commentsDeleteError'));
    }
  }

  int? _remainingMs(dynamic payload) {
    if (payload is Map && payload['remainingMs'] != null) {
      return int.tryParse('${payload['remainingMs']}');
    }
    return null;
  }

  Duration get _cooldownRemaining {
    final until = _cooldownUntil;
    if (until == null) return Duration.zero;
    final left = until.difference(DateTime.now());
    return left.isNegative ? Duration.zero : left;
  }

  String _formatCooldown(Duration duration) {
    final total = duration.inSeconds;
    final minutes = total ~/ 60;
    final seconds = total % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  String _formatCommentDate(DateTime? date) {
    if (date == null) return '';
    final local = date.toLocal();
    final diff = DateTime.now().difference(local);
    if (diff.inMinutes < 1) return tr('pollDetail.commentsJustNow');
    if (diff.inMinutes < 60) {
      return trp('pollDetail.commentsMinutesAgo', {
        'count': '${diff.inMinutes}',
      });
    }
    if (diff.inHours < 24) {
      return trp('pollDetail.commentsHoursAgo', {'count': '${diff.inHours}'});
    }
    if (diff.inDays < 7) {
      return trp('pollDetail.commentsDaysAgo', {'count': '${diff.inDays}'});
    }

    // Día concreto, como en la web (ej. 21 jul / Jul 21).
    final locale = AppLocale.instance.code == 'en' ? 'en' : 'es';
    return DateFormat('d MMM', locale).format(local);
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  bool _canDelete(PollComment comment) {
    final user = widget.authService.session.user;
    if (user == null) return false;
    return comment.userId.isNotEmpty && comment.userId == user.id;
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.authService.session.user;
    final text = _controller.text.trim();
    final cooldown = _cooldownRemaining;
    final canPublish = user != null &&
        (text.length >= _minLength || _selectedGif != null) &&
        !_publishing &&
        cooldown <= Duration.zero;

    return Scaffold(
      backgroundColor: _bg,
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        backgroundColor: const Color(0xFF09061B),
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tr('pollDetail.commentsTitle'),
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
            ),
            if ((widget.pollTitle ?? '').trim().isNotEmpty)
              Text(
                widget.pollTitle!.trim(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.55),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),
        actions: [
          AppBarPointsAction(session: widget.authService.session),
          IconButton(
            tooltip: tr('pollDetail.retry'),
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF0B031B), Color(0xFF050213)],
          ),
        ),
        child: Column(
          children: [
            Expanded(
              child: RefreshIndicator(
                color: const Color(0xFFFF21C8),
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                tr('pollDetail.commentsEyebrow'),
                                style: const TextStyle(
                                  color: Color(0xFF67E8F9),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 2.2,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                tr('pollDetail.commentsTitle'),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD946EF).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: const Color(0xFFD946EF)
                                  .withValues(alpha: 0.28),
                            ),
                          ),
                          child: Text(
                            '${_comments.length}',
                            style: const TextStyle(
                              color: Color(0xFFF5D0FE),
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      trp('pollDetail.commentsCount', {
                        'count': '${_comments.length}',
                      }),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.4),
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.6,
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (_loading)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 40),
                        child: Center(
                          child: CircularProgressIndicator(
                            color: Color(0xFFFF21C8),
                          ),
                        ),
                      )
                    else if (_error != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        child: Column(
                          children: [
                            Text(
                              _error!,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.7),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            TextButton(
                              onPressed: _load,
                              child: Text(tr('pollDetail.retry')),
                            ),
                          ],
                        ),
                      )
                    else if (_comments.isEmpty)
                      _EmptyComments()
                    else
                      ..._comments.map(
                        (comment) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _CommentCard(
                            comment: comment,
                            timeLabel: _formatCommentDate(comment.createdAt),
                            canDelete: _canDelete(comment),
                            onDelete: () => _delete(comment),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            Material(
              color: const Color(0xFF09061B),
              elevation: 8,
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  12,
                  10,
                  12,
                  10 + MediaQuery.paddingOf(context).bottom,
                ),
                child: _ComposerCard(
                  controller: _controller,
                  userName: user?.name ?? 'Fan',
                  userPhotoUrl: user?.photoUrl ?? '',
                  enabled: user != null && !_publishing,
                  canPublish: canPublish,
                  publishing: _publishing,
                  maxLength: _maxLength,
                  selectedGif: _selectedGif,
                  statusText: user == null
                      ? tr('pollDetail.commentsLoginHint')
                      : cooldown > Duration.zero
                          ? trp('pollDetail.commentsCooldown', {
                              'time': _formatCooldown(cooldown),
                            })
                          : text.isNotEmpty &&
                                  text.length < _minLength &&
                                  _selectedGif == null
                              ? trp('pollDetail.commentsMinChars', {
                                  'count': '$_minLength',
                                })
                              : '${_maxLength - text.length}/$_maxLength',
                  onChanged: () => setState(() {}),
                  onClearGif: () => setState(() => _selectedGif = null),
                  onPickGif: user == null || _publishing ? null : _openGifPicker,
                  onPublish: canPublish ? _publish : null,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ComposerCard extends StatelessWidget {
  const _ComposerCard({
    required this.controller,
    required this.userName,
    required this.userPhotoUrl,
    required this.enabled,
    required this.canPublish,
    required this.publishing,
    required this.maxLength,
    required this.selectedGif,
    required this.statusText,
    required this.onChanged,
    required this.onClearGif,
    required this.onPickGif,
    required this.onPublish,
  });

  final TextEditingController controller;
  final String userName;
  final String userPhotoUrl;
  final bool enabled;
  final bool canPublish;
  final bool publishing;
  final int maxLength;
  final GiphyGif? selectedGif;
  final String statusText;
  final VoidCallback onChanged;
  final VoidCallback onClearGif;
  final VoidCallback? onPickGif;
  final VoidCallback? onPublish;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF090B19),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Avatar(name: userName, photoUrl: userPhotoUrl),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: controller,
                  enabled: enabled,
                  maxLength: maxLength,
                  maxLines: 3,
                  minLines: 2,
                  onChanged: (_) => onChanged(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                  decoration: InputDecoration(
                    counterText: '',
                    hintText: tr('pollDetail.commentsPlaceholder'),
                    hintStyle: TextStyle(
                      color: Colors.white.withValues(alpha: 0.35),
                      fontWeight: FontWeight.w600,
                    ),
                    filled: true,
                    fillColor: const Color(0xFF050817),
                    contentPadding: const EdgeInsets.all(12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide(
                        color: Colors.white.withValues(alpha: 0.12),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide(
                        color: Colors.white.withValues(alpha: 0.12),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: Color(0xFFD946EF)),
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (selectedGif != null) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: CachedNetworkImage(
                      imageUrl: selectedGif!.previewUrl.isNotEmpty
                          ? selectedGif!.previewUrl
                          : selectedGif!.url,
                      height: 120,
                      width: 180,
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) => Container(
                        height: 120,
                        width: 180,
                        color: Colors.white.withValues(alpha: 0.06),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: Material(
                      color: Colors.black.withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(999),
                      child: InkWell(
                        onTap: onClearGif,
                        borderRadius: BorderRadius.circular(999),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          child: Text(
                            '×',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 8,
                    bottom: 8,
                    child: Text(
                      tr('pollDetail.commentsGifByGiphy'),
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Text(
                  statusText,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontWeight: FontWeight.w600,
                    fontSize: 11,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _PillButton(
                label: 'GIF',
                onTap: onPickGif,
                filled: false,
                accent: const Color(0xFF67E8F9),
              ),
              const SizedBox(width: 8),
              _PillButton(
                label: publishing
                    ? tr('pollDetail.commentsPublishing')
                    : tr('pollDetail.commentsPublish'),
                onTap: onPublish,
                filled: true,
                enabled: canPublish,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PillButton extends StatelessWidget {
  const _PillButton({
    required this.label,
    required this.onTap,
    required this.filled,
    this.enabled = true,
    this.accent,
  });

  final String label;
  final VoidCallback? onTap;
  final bool filled;
  final bool enabled;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final active = onTap != null && enabled;
    final color = accent ?? Colors.white;

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        gradient: filled && active
            ? const LinearGradient(
                colors: [Color(0xFFEC4899), Color(0xFFD946EF)],
              )
            : null,
        color: filled
            ? (active ? null : Colors.white.withValues(alpha: 0.08))
            : color.withValues(alpha: active ? 0.12 : 0.06),
        border: filled
            ? null
            : Border.all(color: color.withValues(alpha: active ? 0.35 : 0.15)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: active ? onTap : null,
          borderRadius: BorderRadius.circular(999),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Text(
              label,
              style: TextStyle(
                color: filled
                    ? (active
                        ? Colors.white
                        : Colors.white.withValues(alpha: 0.4))
                    : color.withValues(alpha: active ? 1 : 0.4),
                fontWeight: FontWeight.w900,
                fontSize: 11,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _GifPickerSheet extends StatefulWidget {
  const _GifPickerSheet();

  @override
  State<_GifPickerSheet> createState() => _GifPickerSheetState();
}

class _GifPickerSheetState extends State<_GifPickerSheet> {
  final _searchController = TextEditingController();
  List<GiphyGif> _results = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _search();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _search([String? term]) async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final rows = await GiphyApi.search(term: term ?? _searchController.text);
      if (!mounted) return;
      setState(() {
        _results = rows;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = tr('pollDetail.commentsGifLoadError');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        height: MediaQuery.sizeOf(context).height * 0.78,
        decoration: const BoxDecoration(
          color: Color(0xFF070A18),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'GIPHY',
                          style: TextStyle(
                            color: Color(0xFF67E8F9),
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 2,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          tr('pollDetail.commentsGifSearchTitle'),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded, color: Colors.white),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                      textInputAction: TextInputAction.search,
                      onSubmitted: _search,
                      decoration: InputDecoration(
                        hintText: tr('pollDetail.commentsGifSearchHint'),
                        hintStyle: TextStyle(
                          color: Colors.white.withValues(alpha: 0.35),
                        ),
                        filled: true,
                        fillColor: const Color(0xFF050817),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(
                            color: Colors.white.withValues(alpha: 0.1),
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(
                            color: Colors.white.withValues(alpha: 0.1),
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(
                            color: Color(0xFF67E8F9),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _PillButton(
                    label: tr('pollDetail.commentsGifSearch'),
                    onTap: _loading ? null : () => _search(),
                    filled: false,
                    accent: const Color(0xFF67E8F9),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: Color(0xFF67E8F9),
                      ),
                    )
                  : _error != null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              _error!,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.7),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        )
                      : GridView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            mainAxisSpacing: 8,
                            crossAxisSpacing: 8,
                            childAspectRatio: 1.15,
                          ),
                          itemCount: _results.length,
                          itemBuilder: (context, index) {
                            final gif = _results[index];
                            return Material(
                              color: Colors.white.withValues(alpha: 0.05),
                              borderRadius: BorderRadius.circular(16),
                              clipBehavior: Clip.antiAlias,
                              child: InkWell(
                                onTap: () => Navigator.pop(context, gif),
                                child: CachedNetworkImage(
                                  imageUrl: gif.previewUrl.isNotEmpty
                                      ? gif.previewUrl
                                      : gif.url,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, _, _) => const SizedBox.shrink(),
                                ),
                              ),
                            );
                          },
                        ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                16,
                0,
                16,
                12 + MediaQuery.paddingOf(context).bottom,
              ),
              child: Text(
                tr('pollDetail.commentsGifByGiphy'),
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.4),
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CommentCard extends StatelessWidget {
  const _CommentCard({
    required this.comment,
    required this.timeLabel,
    required this.canDelete,
    required this.onDelete,
  });

  final PollComment comment;
  final String timeLabel;
  final bool canDelete;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Avatar(name: comment.displayName, photoUrl: comment.photoUrl),
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        comment.displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    if (timeLabel.isNotEmpty)
                      Container(
                        margin: const EdgeInsets.only(right: 4),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          timeLabel,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.55),
                            fontWeight: FontWeight.w700,
                            fontSize: 11,
                          ),
                        ),
                      ),
                    if (canDelete)
                      TextButton(
                        onPressed: onDelete,
                        style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFFFCA5A5),
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: Text(
                          tr('pollDetail.commentsDelete'),
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 11,
                          ),
                        ),
                      ),
                  ],
                ),
                if (comment.text.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    comment.text,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.88),
                      fontWeight: FontWeight.w600,
                      height: 1.4,
                      fontSize: 14,
                    ),
                  ),
                ],
                if (comment.gifUrl.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        CachedNetworkImage(
                          imageUrl: comment.gifUrl,
                          fit: BoxFit.cover,
                          height: 160,
                          width: double.infinity,
                          errorWidget: (_, _, _) => const SizedBox.shrink(),
                        ),
                        Container(
                          color: const Color(0xFF050817),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          child: Text(
                            tr('pollDetail.commentsGifByGiphy'),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.45),
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _EmptyComments extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
      decoration: BoxDecoration(
        color: const Color(0xFF0A0C1C).withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: const Color(0xFFD946EF).withValues(alpha: 0.18),
        ),
      ),
      child: Column(
        children: [
          Icon(
            Icons.chat_bubble_outline_rounded,
            size: 40,
            color: Colors.white.withValues(alpha: 0.4),
          ),
          const SizedBox(height: 12),
          Text(
            tr('pollDetail.commentsEmptyTitle'),
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: 17,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            tr('pollDetail.commentsEmptyBody'),
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.5),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, required this.photoUrl});

  final String name;
  final String photoUrl;

  @override
  Widget build(BuildContext context) {
    final initial = name.trim().isEmpty
        ? 'F'
        : name.trim().substring(0, 1).toUpperCase();

    return Container(
      width: 40,
      height: 40,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [Color(0xFFD946EF), Color(0xFF7C3AED)],
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: photoUrl.isEmpty
          ? Center(
              child: Text(
                initial,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
              ),
            )
          : CachedNetworkImage(
              imageUrl: photoUrl,
              fit: BoxFit.cover,
              errorWidget: (_, _, _) => Center(
                child: Text(
                  initial,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ),
    );
  }
}

/// Acceso a la pantalla de comentarios desde el detalle de votación.
class PollCommentsEntry extends StatefulWidget {
  const PollCommentsEntry({
    required this.pollId,
    required this.authService,
    this.pollTitle,
    super.key,
  });

  final String pollId;
  final AuthService authService;
  final String? pollTitle;

  @override
  State<PollCommentsEntry> createState() => _PollCommentsEntryState();
}

class _PollCommentsEntryState extends State<PollCommentsEntry> {
  int? _count;

  @override
  void initState() {
    super.initState();
    _loadCount();
  }

  @override
  void didUpdateWidget(covariant PollCommentsEntry oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pollId != widget.pollId) {
      _loadCount();
    }
  }

  Future<void> _loadCount() async {
    try {
      final rows = await CommentsApi(widget.authService.client).list(widget.pollId);
      if (!mounted) return;
      setState(() => _count = rows.length);
    } catch (_) {
      if (!mounted) return;
      setState(() => _count = null);
    }
  }

  Future<void> _open() async {
    await PollCommentsPage.open(
      context,
      pollId: widget.pollId,
      authService: widget.authService,
      pollTitle: widget.pollTitle,
    );
    if (mounted) {
      await _loadCount();
    }
  }

  @override
  Widget build(BuildContext context) {
    final countLabel = _count == null
        ? tr('pollDetail.commentsOpenHint')
        : trp('pollDetail.commentsCount', {'count': '$_count'});

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _open,
          borderRadius: BorderRadius.circular(20),
          child: Ink(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              color: Colors.white.withValues(alpha: 0.05),
              border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
            ),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: 0.08),
                  ),
                  child: const Icon(
                    Icons.chat_bubble_outline_rounded,
                    color: Color(0xFFF0ABFC),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tr('pollDetail.commentsTitle'),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        countLabel,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.55),
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                if (_count != null)
                  Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFD946EF).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: const Color(0xFFD946EF).withValues(alpha: 0.3),
                      ),
                    ),
                    child: Text(
                      '$_count',
                      style: const TextStyle(
                        color: Color(0xFFF5D0FE),
                        fontWeight: FontWeight.w900,
                        fontSize: 13,
                      ),
                    ),
                  ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: Colors.white.withValues(alpha: 0.55),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
