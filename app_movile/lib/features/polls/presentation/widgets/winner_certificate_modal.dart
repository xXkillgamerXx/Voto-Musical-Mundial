import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:gal/gal.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/i18n/app_locale.dart';
import '../../../../core/i18n/tr.dart';

String formatWinnerCertificateDate(DateTime? value) {
  final date = value ?? DateTime.now();
  final locale = AppLocale.instance.code == 'en' ? 'en' : 'es';
  final month = DateFormat('MMMM', locale).format(date);
  final year = DateFormat('yyyy', locale).format(date);
  return '$month $year';
}

Future<void> showWinnerCertificateModal(
  BuildContext context, {
  required String name,
  String group = '',
  required String date,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => WinnerCertificateModal(
      name: name,
      group: group,
      date: date,
    ),
  );
}

class WinnerCertificateModal extends StatefulWidget {
  const WinnerCertificateModal({
    super.key,
    required this.name,
    this.group = '',
    required this.date,
  });

  final String name;
  final String group;
  final String date;

  @override
  State<WinnerCertificateModal> createState() => _WinnerCertificateModalState();
}

class _WinnerCertificateModalState extends State<WinnerCertificateModal> {
  final GlobalKey _boundaryKey = GlobalKey();
  bool _busy = false;

  String get _shareText {
    final group = widget.group.trim().isEmpty ? '' : ' (${widget.group.trim()})';
    final date = widget.date.trim().isEmpty ? '' : ' · ${widget.date.trim()}';
    return '${widget.name}$group$date';
  }

  String get _filename {
    final slug = [widget.name, widget.group, widget.date]
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
                      date: widget.date,
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
    required this.date,
  });

  final String name;
  final String group;
  final String date;

  @override
  Widget build(BuildContext context) {
    final displayName = name.trim().toUpperCase();
    final displayGroup = group.trim().toUpperCase();
    final displayDate = date.trim().toUpperCase();

    return AspectRatio(
      aspectRatio: 819 / 1024,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final w = constraints.maxWidth;
            final h = constraints.maxHeight;
            // Mismos % y clamp que public/certificate.html (cqw = % del certificado)
            final nameSize = (w * 0.092).clamp(21.6, 48.0);
            final groupSize = (w * 0.045).clamp(13.6, 23.2);
            final dateSize = (w * 0.028).clamp(10.4, 14.72);

            return Stack(
              fit: StackFit.expand,
              children: [
                Image.asset(
                  'assets/branding/certificate-bg.png',
                  fit: BoxFit.fill,
                  filterQuality: FilterQuality.high,
                ),
                if (displayName.isNotEmpty)
                  Positioned(
                    top: h * 0.335,
                    left: w * 0.11,
                    width: w * 0.78,
                    child: _GradientText(
                      displayName,
                      fontSize: nameSize,
                      fontWeight: FontWeight.w900,
                      letterSpacingEm: 0.04,
                      height: 0.95,
                      colors: const [
                        Color(0xFFFFFFFF),
                        Color(0xFFB789F4),
                        Color(0xFF9889FB),
                      ],
                      stops: const [0, 0.52, 1],
                    ),
                  ),
                if (displayGroup.isNotEmpty)
                  Positioned(
                    top: h * 0.412,
                    left: w * 0.11,
                    width: w * 0.78,
                    child: _GradientText(
                      displayGroup,
                      fontSize: groupSize,
                      fontWeight: FontWeight.w800,
                      letterSpacingEm: 0.18,
                      height: 1,
                      colors: const [
                        Color(0xFFA45DE0),
                        Color(0xFF7953CA),
                      ],
                    ),
                  ),
                if (displayDate.isNotEmpty)
                  Positioned(
                    top: h * 0.81,
                    left: w * 0.74 - (w * 0.28) / 2,
                    width: w * 0.28,
                    child: Text(
                      displayDate,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: dateSize,
                        fontWeight: FontWeight.w500,
                        letterSpacing: dateSize * 0.1,
                        height: 1,
                      ),
                    ),
                  ),
              ],
            );
          },
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
        ),
      ),
    );
  }
}
