import 'package:flutter/material.dart';

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
      return 'Tienes un regalo';
    case 'mission_completed':
      final missionTitle = payload['missionTitle'];
      if (missionTitle != null && '$missionTitle'.trim().isNotEmpty) {
        return 'Misión completada: $missionTitle';
      }
      return 'Misión completada';
    case 'artist_push':
      final artistName = payload['artistName'];
      if (artistName != null && '$artistName'.trim().isNotEmpty) {
        return 'Novedades de $artistName';
      }
      return 'Novedades de artista';
    case 'admin_push':
      return 'Aviso del equipo';
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
          ? 'Recibiste ${_formatPoints(amount)} puntos de regalo.'
          : 'Recibiste puntos de regalo.';
    case 'mission_completed':
      final amount = _toInt(payload['rewardPoints']);
      return amount > 0
          ? 'Ganaste ${_formatPoints(amount)} puntos.'
          : 'Completaste una misión y recibiste tu premio.';
    case 'artist_push':
      final artistName = payload['artistName'];
      if (artistName != null && '$artistName'.trim().isNotEmpty) {
        return 'Hay novedades sobre $artistName.';
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
    return 'Sistema de misiones';
  }

  final sender = notification.payload['senderName'] ??
      notification.payload['adminName'];
  if (sender != null && '$sender'.trim().isNotEmpty) {
    return '$sender'.trim();
  }

  return 'Equipo Voto Música Mundial';
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
