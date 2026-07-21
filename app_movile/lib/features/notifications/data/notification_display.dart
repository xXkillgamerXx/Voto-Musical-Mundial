import 'package:flutter/material.dart';

import '../../../core/i18n/tr.dart';
import 'app_notification.dart';

const _hiddenNotificationTypes = {'daily_reward_claimed'};

String notificationTitle(AppNotification notification) {
  final payload = notification.payload;

  final explicit = payload['title'];
  if (explicit != null && '$explicit'.trim().isNotEmpty) {
    return '$explicit'.trim();
  }

  switch (notification.type) {
    case 'admin_points_gift':
      return tr('misc.giftTitle');
    case 'mission_completed':
      final missionTitle = payload['missionTitle'];
      if (missionTitle != null && '$missionTitle'.trim().isNotEmpty) {
        return trp('misc.missionCompletedWithTitle', {'title': missionTitle});
      }
      return tr('misc.missionCompleted');
    case 'artist_push':
      final artistName = payload['artistName'];
      if (artistName != null && '$artistName'.trim().isNotEmpty) {
        return trp('misc.artistNews', {'name': artistName});
      }
      return tr('misc.artistNewsGeneric');
    case 'admin_push':
      return tr('misc.teamNotice');
    default:
      return '';
  }
}

String notificationBody(AppNotification notification) {
  final payload = notification.payload;
  final explicit = payload['message'] ?? payload['body'] ?? payload['description'];
  if (explicit != null && '$explicit'.trim().isNotEmpty) {
    return '$explicit'.trim();
  }

  switch (notification.type) {
    case 'admin_points_gift':
      final amount = _toInt(payload['amount'] ?? payload['rewardPoints']);
      return amount > 0
          ? trp('misc.giftReceivedPoints', {'count': _formatPoints(amount)})
          : tr('misc.giftReceivedGeneric');
    case 'mission_completed':
      final amount = _toInt(payload['rewardPoints']);
      return amount > 0
          ? trp('misc.earnedPoints', {'count': _formatPoints(amount)})
          : tr('misc.missionCompletedPrize');
    case 'artist_push':
      final artistName = payload['artistName'];
      if (artistName != null && '$artistName'.trim().isNotEmpty) {
        return trp('misc.artistNewsBody', {'name': artistName});
      }
      return '';
    case 'admin_push':
      return '';
    default:
      return '';
  }
}

bool shouldDisplayNotification(AppNotification notification) {
  if (notification.id.isEmpty) {
    return false;
  }

  if (_hiddenNotificationTypes.contains(notification.type)) {
    return false;
  }

  final title = notificationTitle(notification);
  final body = notificationBody(notification);
  return title.isNotEmpty && body.isNotEmpty;
}

IconData notificationIcon(AppNotification notification) {
  switch (notification.type) {
    case 'admin_points_gift':
      return Icons.card_giftcard_rounded;
    case 'mission_completed':
      return Icons.bolt_rounded;
    case 'artist_push':
      return Icons.star_rounded;
    case 'admin_push':
      return Icons.notifications_rounded;
    default:
      return Icons.info_outline_rounded;
  }
}

Color notificationIconColor(AppNotification notification) {
  switch (notification.type) {
    case 'admin_points_gift':
      return const Color(0xFFFDE68A);
    case 'mission_completed':
      return const Color(0xFF6EE7B7);
    case 'artist_push':
      return const Color(0xFFF0ABFC);
    case 'admin_push':
      return const Color(0xFF67E8F9);
    default:
      return const Color(0xFFC4B5FD);
  }
}

bool isGiftNotification(AppNotification notification) {
  return notification.type == 'admin_points_gift' ||
      notification.type == 'mission_completed';
}

int giftAmount(AppNotification notification) {
  return _toInt(
    notification.payload['amount'] ?? notification.payload['rewardPoints'],
  );
}

String giftSender(AppNotification notification) {
  if (notification.type == 'mission_completed') {
    return tr('misc.missionSystem');
  }

  final sender = notification.payload['senderName'] ??
      notification.payload['adminName'];
  if (sender != null && '$sender'.trim().isNotEmpty) {
    return '$sender'.trim();
  }

  return tr('misc.vmmTeam');
}

int _toInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse('$value') ?? 0;
}

String _formatPoints(int value) {
  return value.toString().replaceAllMapped(
    RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
    (match) => '${match[1]}.',
  );
}
