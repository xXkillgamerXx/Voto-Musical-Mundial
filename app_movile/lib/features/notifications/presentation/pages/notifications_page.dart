import 'package:flutter/material.dart';

import '../../../../core/i18n/app_locale.dart';
import '../../../../core/i18n/tr.dart';
import '../../../../core/widgets/points_chip.dart';
import '../../../../core/widgets/skeleton_box.dart';
import '../../application/notification_controller.dart';
import '../../application/notification_deep_link.dart';
import '../../data/app_notification.dart';
import '../../data/notification_display.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({
    required this.controller,
    this.onSelectSection,
    super.key,
  });

  final NotificationController controller;
  final void Function(String section)? onSelectSection;

  static Future<void> open(
    BuildContext context, {
    required NotificationController controller,
    void Function(String section)? onSelectSection,
  }) {
    return Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => NotificationsScreen(
          controller: controller,
          onSelectSection: onSelectSection,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF050213), Color(0xFF09061B), Color(0xFF120A2B)],
        ),
      ),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          surfaceTintColor: Colors.transparent,
          foregroundColor: Colors.white,
          title: Text(
            tr('misc.notificationsTitle'),
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          actions: [
            AppBarPointsAction(session: controller.authService.session),
          ],
        ),
        body: NotificationsPage(
          controller: controller,
          onSelectSection: onSelectSection,
        ),
      ),
    );
  }
}

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({
    required this.controller,
    this.onSelectSection,
    super.key,
  });

  final NotificationController controller;
  final void Function(String section)? onSelectSection;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.controller.refresh();
    });
  }

  Future<void> _openNotification(AppNotification notification) async {
    await widget.controller.markRead(notification);
    if (!mounted) return;

    final url = '${notification.payload['url'] ?? ''}'.trim();
    final path = url.contains('://')
        ? (Uri.tryParse(url)?.path ?? url)
        : url;
    final type = notification.type;
    final isTabDestination = path == '/votaciones' ||
        path == '/artistas' ||
        path == '/misiones' ||
        path == '/' ||
        path.isEmpty ||
        (type == 'admin_push' && (path.isEmpty || path == '/'));

    final shouldCloseInbox = isTabDestination &&
        type != 'admin_points_gift' &&
        type != 'artist_push' &&
        Navigator.of(context).canPop();

    // IMPORTANTE: navegar ANTES de hacer pop. Si se cierra la bandeja primero,
    // este State se destruye (mounted=false) y nunca llega a cambiar de pestaña.
    await NotificationDeepLink.openFromNotification(
      context,
      authService: widget.controller.authService,
      notification: notification,
      controller: widget.controller,
      onSelectSection: widget.onSelectSection,
      fromInbox: true,
    );

    if (shouldCloseInbox && mounted && Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    }
  }

  String _formatDate(DateTime? value) {
    if (value == null) {
      return '';
    }

    const months = [
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ];

    final local = value.toLocal();
    final month = months[local.month - 1];
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '${local.day} $month ${local.year}, $hour:$minute';
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([widget.controller, AppLocale.instance]),
      builder: (context, _) {
        final controller = widget.controller;
        final items = controller.visibleNotifications;

        return ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF090B19).withValues(alpha: 0.9),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tr('misc.notificationCenter'),
                    style: const TextStyle(
                      color: Color(0xFFF0ABFC),
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.8,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    tr('misc.yourActivity'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    controller.unreadCount > 0
                        ? trp('misc.unreadCount', {'count': controller.unreadCount})
                        : tr('misc.allCaughtUp'),
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.58),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (controller.unreadCount > 0) ...[
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: controller.markAllRead,
                      child: Text(tr('misc.markAllRead')),
                    ),
                  ],
                  if (!controller.pushEnabled) ...[
                    const SizedBox(height: 14),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF22D3EE).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color: const Color(0xFF67E8F9).withValues(alpha: 0.2),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tr('misc.enablePushTitle'),
                            style: const TextStyle(
                              color: Color(0xFF67E8F9),
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            tr('misc.enablePushBody'),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.62),
                              fontWeight: FontWeight.w600,
                              fontSize: 12,
                              height: 1.35,
                            ),
                          ),
                          const SizedBox(height: 10),
                          FilledButton(
                            onPressed: controller.enablePush,
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFF22D3EE),
                              foregroundColor: const Color(0xFF020617),
                            ),
                            child: Text(
                              tr('misc.enablePushButton'),
                              style: const TextStyle(fontWeight: FontWeight.w900),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            if ((controller.loading || !controller.hasFetched) &&
                items.isEmpty)
              const _NotificationsSkeletonList()
            else if (controller.errorMessage != null && items.isEmpty)
              _EmptyState(message: controller.errorMessage!)
            else if (items.isEmpty)
              _EmptyState(message: tr('misc.noNotifications'))
            else
              ...items.map(
                (notification) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _NotificationTile(
                    notification: notification,
                    dateLabel: _formatDate(notification.createdAt),
                    onTap: () => _openNotification(notification),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.notification,
    required this.dateLabel,
    required this.onTap,
  });

  final AppNotification notification;
  final String dateLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: notification.isUnread
                ? Colors.white.withValues(alpha: 0.06)
                : const Color(0xFF090B19).withValues(alpha: 0.75),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  notificationIcon(notification),
                  color: notificationIconColor(notification),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notificationTitle(notification),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      notificationBody(notification),
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.58),
                        fontWeight: FontWeight.w600,
                        height: 1.35,
                        fontSize: 13,
                      ),
                    ),
                    if (dateLabel.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        dateLabel.toUpperCase(),
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.35),
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (notification.isUnread)
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 6),
                  decoration: const BoxDecoration(
                    color: Color(0xFFEC4899),
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Color(0xFFCBD5E1),
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _NotificationsSkeletonList extends StatelessWidget {
  const _NotificationsSkeletonList();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(5, (index) {
        return Padding(
          padding: EdgeInsets.only(bottom: index == 4 ? 0 : 12),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF090B19).withValues(alpha: 0.75),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(
                  height: 44,
                  width: 44,
                  borderRadius: BorderRadius.all(Radius.circular(14)),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SkeletonBox(height: 15, width: 160),
                      SizedBox(height: 8),
                      SkeletonBox(height: 12, width: double.infinity),
                      SizedBox(height: 6),
                      SkeletonBox(height: 12, width: 200),
                      SizedBox(height: 10),
                      SkeletonBox(height: 10, width: 110),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }
}
