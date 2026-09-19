import 'package:flutter/material.dart';

Color fanSkuColor(String sku) {
  switch (sku.trim().toUpperCase()) {
    case 'MEGA':
      return const Color(0xFFFBBF24);
    case 'SUPER':
      return const Color(0xFFE879F9);
    case 'FAN':
      return const Color(0xFFA78BFA);
    default:
      return const Color(0xFFC084FC);
  }
}

String fanSkuMark(String sku) {
  switch (sku.trim().toUpperCase()) {
    case 'MEGA':
      return '♛';
    case 'SUPER':
      return '⚡';
    case 'FAN':
      return '★';
    default:
      return '';
  }
}

class FanBadge extends StatelessWidget {
  const FanBadge({
    required this.sku,
    this.compact = false,
    super.key,
  });

  final String sku;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final key = sku.trim().toUpperCase();
    if (key.isEmpty) return const SizedBox.shrink();
    final color = fanSkuColor(key);
    final mark = fanSkuMark(key);
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 6 : 8,
        vertical: compact ? 2 : 3,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.55)),
      ),
      child: Text(
        mark.isEmpty ? key : '$mark $key',
        style: TextStyle(
          color: color,
          fontSize: compact ? 9 : 10,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}
