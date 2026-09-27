import 'package:flutter/material.dart';

/// Hueco del menú flotante inferior para que el aviso no quede detrás.
const kAppSnackNavGap = 86.0;

SnackBar appSnackBar(
  BuildContext context,
  String message, {
  bool error = false,
}) {
  final bottom =
      MediaQuery.viewPaddingOf(context).bottom + kAppSnackNavGap;
  return SnackBar(
    behavior: SnackBarBehavior.floating,
    elevation: 10,
    margin: EdgeInsets.fromLTRB(16, 8, 16, bottom),
    duration: const Duration(seconds: 4),
    backgroundColor:
        error ? const Color(0xFF4C0519) : const Color(0xFF17102E),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: BorderSide(
        color: error
            ? const Color(0xFFFCA5A5).withValues(alpha: 0.4)
            : const Color(0xFFC084FC).withValues(alpha: 0.4),
      ),
    ),
    content: Text(
      message,
      style: const TextStyle(
        color: Colors.white,
        fontWeight: FontWeight.w700,
        fontSize: 14,
        height: 1.35,
      ),
    ),
  );
}

void showAppSnackBar(
  BuildContext context,
  String message, {
  bool error = false,
}) {
  if (!context.mounted) return;
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(appSnackBar(context, message, error: error));
}
