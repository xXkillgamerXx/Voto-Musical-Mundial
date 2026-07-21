import 'package:flutter/material.dart';

import '../../../../core/i18n/tr.dart';
import '../../application/notification_controller.dart';
import '../pages/notifications_page.dart';

class NotificationsBell extends StatelessWidget {
  const NotificationsBell({
    required this.controller,
    super.key,
  });

  final NotificationController controller;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final unread = controller.unreadCount;

        return IconButton(
          tooltip: tr('misc.notificationsTitle'),
          onPressed: () {
            NotificationsScreen.open(
              context,
              controller: controller,
            );
          },
          icon: Stack(
            clipBehavior: Clip.none,
            children: [
              const Icon(Icons.notifications_rounded),
              if (unread > 0)
                Positioned(
                  right: -2,
                  top: -2,
                  child: Container(
                    constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEC4899),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: const Color(0xFF050213), width: 2),
                    ),
                    child: Center(
                      child: Text(
                        unread > 9 ? '9+' : '$unread',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
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
