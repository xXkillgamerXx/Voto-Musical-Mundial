import 'package:flutter/material.dart';

import '../../application/notification_controller.dart';

class ForegroundPushBannerToast extends StatelessWidget {
  const ForegroundPushBannerToast({
    super.key,
    required this.banner,
    required this.onOpen,
    required this.onDismiss,
  });

  final ForegroundPushBanner banner;
  final VoidCallback onOpen;
  final VoidCallback onDismiss;

  static const _cyan = Color(0xFF22D3EE);

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;

    return Positioned(
      top: top + 12,
      left: 16,
      right: 16,
      child: Material(
        color: Colors.transparent,
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: const Color(0xF20B0D1A),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: _cyan.withValues(alpha: 0.28)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.45),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: InkWell(
                borderRadius: BorderRadius.circular(22),
                onTap: onOpen,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 8, 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: _cyan.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: _cyan.withValues(alpha: 0.28),
                          ),
                        ),
                        child: const Icon(
                          Icons.notifications_active_rounded,
                          color: _cyan,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'NOTIFICACIÓN',
                              style: TextStyle(
                                color: _cyan.withValues(alpha: 0.9),
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.6,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              banner.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w900,
                                height: 1.25,
                              ),
                            ),
                            if (banner.body.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                banner.body,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.72),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  height: 1.35,
                                ),
                              ),
                            ],
                            const SizedBox(height: 8),
                            Text(
                              'Ver detalle →',
                              style: TextStyle(
                                color: _cyan.withValues(alpha: 0.95),
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: onDismiss,
                        visualDensity: VisualDensity.compact,
                        icon: Icon(
                          Icons.close_rounded,
                          color: Colors.white.withValues(alpha: 0.55),
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
