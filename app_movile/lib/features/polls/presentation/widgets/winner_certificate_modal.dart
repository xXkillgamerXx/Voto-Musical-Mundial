import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:gal/gal.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/i18n/app_locale.dart';
import '../../../../core/i18n/tr.dart';

String formatWinnerCertificateYear(DateTime? value, {int? pollYear}) {
  if (pollYear != null && pollYear >= 2000) {
    return '$pollYear';
  }
  final date = value ?? DateTime.now();
  return '${date.year}';
}

Future<void> showWinnerCertificateModal(
  BuildContext context, {
  required String name,
  String group = '',
  String category = '',
  required String year,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => WinnerCertificateModal(
      name: name,
      group: group,
      category: category,
      year: year,
    ),
  );
}

class WinnerCertificateModal extends StatefulWidget {
  const WinnerCertificateModal({
    super.key,
    required this.name,
    this.group = '',
    this.category = '',
    required this.year,
  });

  final String name;
  final String group;
  final String category;
  final String year;

  @override
  State<WinnerCertificateModal> createState() => _WinnerCertificateModalState();
}

class _WinnerCertificateModalState extends State<WinnerCertificateModal> {
  final GlobalKey _boundaryKey = GlobalKey();
  bool _busy = false;

  String get _shareText {
    final group = widget.group.trim().isEmpty ? '' : ' (${widget.group.trim()})';
    final category =
        widget.category.trim().isEmpty ? '' : ' · ${widget.category.trim()}';
    final year = widget.year.trim().isEmpty ? '' : ' ${widget.year.trim()}';
    return '${widget.name}$group$category$year';
  }

  String get _filename {
    final slug = [widget.name, widget.group, widget.category, widget.year]
        .map((part) => part
            .trim()
            .toLowerCase()
            .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
            .replaceAll(RegExp(r'^-+|-+$'), ''))
        .where((part) => part.isNotEmpty)
        .join('-');
    return 'music-mundial-${slug.isEmpty ? 'certificate' : slug}.png';
  }

  Future<Uint8List> _capturePng() async {
    await Future<void>.delayed(const Duration(milliseconds: 16));
    final boundary =
        _boundaryKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
    if (boundary == null) {
      throw StateError('certificate_boundary_missing');
    }
    final image = await boundary.toImage(pixelRatio: 3);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    if (bytes == null) {
      throw StateError('certificate_encode_failed');
    }
    return bytes.buffer.asUint8List();
  }

  Future<File> _writeTempPng(Uint8List bytes) async {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$_filename');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  Future<void> _runBusy(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _download() async {
    try {
      await _runBusy(() async {
        final bytes = await _capturePng();
        final hasAccess = await Gal.hasAccess(toAlbum: true);
        if (!hasAccess) {
          final granted = await Gal.requestAccess(toAlbum: true);
          if (!granted) {
            throw StateError('gallery_permission_denied');
          }
        }
        await Gal.putImageBytes(bytes, name: _filename.replaceAll('.png', ''));
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('pollDetail.certificateSaved'))),
        );
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('pollDetail.certificateDownloadError'))),
      );
    }
  }

  Future<void> _share() async {
    try {
      await _runBusy(() async {
        final bytes = await _capturePng();
        final file = await _writeTempPng(bytes);
        await SharePlus.instance.share(
          ShareParams(
            files: [XFile(file.path, mimeType: 'image/png', name: _filename)],
            text: _shareText,
            title: widget.name,
          ),
        );
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('pollDetail.certificateShareError'))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.92,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFF050213),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: const Color(0xFFD946EF).withValues(alpha: 0.25)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 8, 10),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tr('pollDetail.certificateEyebrow'),
                        style: const TextStyle(
                          color: Color(0xFFF5D0FE),
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 2.4,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        tr('pollDetail.certificateTitle'),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(Icons.close_rounded, color: Colors.white),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0x22FFFFFF)),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: RepaintBoundary(
                    key: _boundaryKey,
                    child: WinnerCertificateView(
                      name: widget.name,
                      group: widget.group,
                      category: widget.category,
                      year: widget.year,
                    ),
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 12 + bottom),
            child: Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _busy ? null : _download,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      backgroundColor: const Color(0xFFA855F7),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    icon: const Icon(Icons.download_rounded),
                    label: Text(
                      tr('pollDetail.certificateDownload'),
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : _share,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      foregroundColor: Colors.white,
                      side: BorderSide(
                        color: Colors.white.withValues(alpha: 0.18),
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    icon: const Icon(Icons.ios_share_rounded),
                    label: Text(
                      tr('pollDetail.certificateShare'),
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class WinnerCertificateView extends StatelessWidget {
  const WinnerCertificateView({
    super.key,
    required this.name,
    this.group = '',
    this.category = '',
    required this.year,
  });

  final String name;
  final String group;
  final String category;
  final String year;

  bool get _isEn => AppLocale.instance.code == 'en';

  @override
  Widget build(BuildContext context) {
    final displayName = name.trim().toUpperCase();
    final displayGroup = group.trim().toUpperCase();
    final displayCategory = category.trim().toUpperCase();
    final yearText = year.trim().isEmpty
        ? '${DateTime.now().year}'
        : year.trim();
    final title = _isEn ? 'CERTIFICATE' : 'CERTIFICADO';
    final certifies =
        _isEn ? 'MUSIC MUNDIAL CERTIFIES THAT' : 'MUSIC MUNDIAL CERTIFICA QUE';
    final awarded = _isEn
        ? 'HAS BEEN OFFICIALLY AWARDED'
        : 'HA SIDO OFICIALMENTE PREMIADO/A';
    final desc = _isEn
        ? 'In recognition of outstanding talent, dedication and impact in the music industry.'
        : 'En reconocimiento a su talento excepcional, dedicación e impacto en la industria musical.';
    final voted =
        _isEn ? 'Voted by fans worldwide.' : 'Votado por fans de todo el mundo.';

    return AspectRatio(
      aspectRatio: 3 / 3.85,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: Color(0xFF070314),
            border: Border.fromBorderSide(
              BorderSide(color: Color(0xFF4C1D95)),
            ),
            image: DecorationImage(
              image: AssetImage('assets/branding/certificate-bg.jpg'),
              fit: BoxFit.cover,
            ),
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment(0, -1.05),
                    radius: 0.9,
                    colors: [Color(0x517C3AED), Color(0x00000000)],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(22, 18, 22, 16),
                child: Column(
                  children: [
                    Image.asset(
                      'assets/branding/certificate-crown.png',
                      width: 96,
                      fit: BoxFit.contain,
                      filterQuality: FilterQuality.high,
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'MUSIC MUNDIAL',
                      style: TextStyle(
                        color: Color(0xFFF5F3FF),
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 3.2,
                      ),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'VOTING',
                      style: TextStyle(
                        color: Color(0xFFC084FC),
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 3.8,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.star_rounded,
                            color: Color(0xFFE9D5FF), size: 18),
                        const SizedBox(width: 8),
                        Text(
                          title,
                          style: const TextStyle(
                            color: Color(0xFFF8F7FF),
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 2.8,
                            fontFamily: 'serif',
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Icon(Icons.star_rounded,
                            color: Color(0xFFE9D5FF), size: 18),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '✦',
                      style: TextStyle(color: Color(0xFFC084FC), fontSize: 10),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      certifies,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFFD8B4FE),
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.6,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _GradientText(
                      displayName,
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                      letterSpacingEm: 0.01,
                      height: 1.05,
                      colors: const [
                        Color(0xFFFFFFFF),
                        Color(0xFFF3E8FF),
                        Color(0xFFC084FC),
                      ],
                      stops: const [0.08, 0.4, 1],
                    ),
                    if (displayGroup.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        displayGroup,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Color(0xFFEDE9FE),
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 5,
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    Text(
                      awarded,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFFA1A1AA),
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 2,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.symmetric(horizontal: 8),
                      padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: const Color(0x61E9D5FF),
                        ),
                        gradient: const LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Color(0x0DFFFFFF), Color(0x2E581C87)],
                        ),
                      ),
                      child: Column(
                        children: [
                          Text(
                            displayCategory.isEmpty
                                ? tr('pollDetail.certificateTitle').toUpperCase()
                                : displayCategory,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.2,
                              fontFamily: 'serif',
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '✦  $yearText  ✦',
                            style: const TextStyle(
                              color: Color(0xFFE9D5FF),
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 2.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      desc,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFFC4C4D0),
                        fontSize: 11,
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      voted,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFFA1A1AA),
                        fontSize: 10,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                    const Spacer(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          '◆ vote.musicmundial.com',
                          style: TextStyle(
                            color: Color(0xFFA1A1AA),
                            fontSize: 9,
                          ),
                        ),
                        const Text(
                          '✦',
                          style: TextStyle(
                            color: Color(0xFFC084FC),
                            fontSize: 9,
                          ),
                        ),
                        Text(
                          '#MusicMundialAwards$yearText',
                          style: const TextStyle(
                            color: Color(0xFFC084FC),
                            fontSize: 9,
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
}

class _GradientText extends StatelessWidget {
  const _GradientText(
    this.text, {
    required this.fontSize,
    required this.fontWeight,
    required this.colors,
    this.stops,
    this.letterSpacingEm = 0,
    this.height = 1,
  });

  final String text;
  final double fontSize;
  final FontWeight fontWeight;
  final List<Color> colors;
  final List<double>? stops;
  final double letterSpacingEm;
  final double height;

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      blendMode: BlendMode.srcIn,
      shaderCallback: (bounds) => LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: colors,
        stops: stops,
      ).createShader(bounds),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: Colors.white,
          fontSize: fontSize,
          fontWeight: fontWeight,
          letterSpacing: fontSize * letterSpacingEm,
          height: height,
          fontFamily: 'serif',
        ),
      ),
    );
  }
}
