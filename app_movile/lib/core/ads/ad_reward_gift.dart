import 'package:flutter/material.dart';

import '../../features/auth/data/auth_service.dart';
import '../../features/notifications/data/app_notification.dart';
import '../../features/notifications/presentation/widgets/gift_notification_modal.dart';
import '../../features/rewards/data/rewards_api.dart';
import '../i18n/tr.dart';
import 'admob_config.dart';

/// Reclama puntos en el servidor y muestra el modal de regalo.
Future<AdRewardClaimResult?> claimAndShowAdRewardGift({
  required BuildContext context,
  required AuthService authService,
}) async {
  final api = RewardsApi(authService.client);
  final claim = await api.claimAdReward();

  final user = authService.session.user;
  if (user != null) {
    await authService.session.updateUser(
      user.copyWith(points: claim.userPoints),
    );
  }

  if (!context.mounted) return claim;

  await showAdRewardGift(
    context: context,
    authService: authService,
    points: claim.pointsAwarded,
    pointsBefore: claim.pointsBefore,
    pointsAfter: claim.pointsAfter,
  );

  return claim;
}

/// Muestra el modal de regalo al ganar puntos por ver un anuncio rewarded.
Future<void> showAdRewardGift({
  required BuildContext context,
  required AuthService authService,
  int? points,
  int? pointsBefore,
  int? pointsAfter,
}) async {
  if (!context.mounted) return;

  final bonus = points ?? AdMobConfig.rewardedVideoPoints;
  final user = authService.session.user;
  final before = pointsBefore ??
      (((user?.points ?? 0) - bonus) < 0 ? 0 : (user?.points ?? 0) - bonus);
  final after = pointsAfter ?? (user?.points ?? (before + bonus));

  final notification = AppNotification(
    id: 'ad-reward-${DateTime.now().millisecondsSinceEpoch}',
    type: 'admin_points_gift',
    payload: {
      'amount': bonus,
      'pointsBefore': before,
      'pointsAfter': after,
      'senderName': tr('pollDetail.watchAdGiftSender'),
      'message': trp('pollDetail.watchAdGiftMessage', {'points': '$bonus'}),
    },
    createdAt: DateTime.now(),
  );

  await showGeneralDialog<void>(
    context: context,
    barrierDismissible: false,
    barrierLabel: 'ad-reward-gift',
    barrierColor: Colors.transparent,
    pageBuilder: (dialogContext, animation, secondaryAnimation) {
      return GiftNotificationModal(
        notification: notification,
        authService: authService,
        onClose: () => Navigator.of(dialogContext).pop(),
      );
    },
  );
}
