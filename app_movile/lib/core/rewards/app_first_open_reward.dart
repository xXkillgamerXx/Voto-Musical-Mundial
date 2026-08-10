import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/auth/data/auth_service.dart';
import '../../features/notifications/data/app_notification.dart';
import '../../features/notifications/presentation/widgets/gift_notification_modal.dart';
import '../../features/rewards/data/rewards_api.dart';
import '../i18n/tr.dart';

const _appFirstOpenClaimedKey = 'vmm_app_first_open_reward_claimed';

/// Reclama el bonus de primera apertura de la app (1 vez por cuenta).
Future<void> maybeClaimAppFirstOpenReward({
  required BuildContext context,
  required AuthService authService,
}) async {
  final prefs = await SharedPreferences.getInstance();
  if (prefs.getBool(_appFirstOpenClaimedKey) == true) {
    return;
  }

  try {
    final api = RewardsApi(authService.client);
    final claim = await api.claimAppFirstOpenReward();

    if (claim.alreadyClaimed || claim.pointsAwarded <= 0) {
      await prefs.setBool(_appFirstOpenClaimedKey, true);
      return;
    }

    final user = authService.session.user;
    if (user != null) {
      await authService.session.updateUser(
        user.copyWith(points: claim.userPoints),
      );
    }

    await prefs.setBool(_appFirstOpenClaimedKey, true);

    if (!context.mounted) return;

    final notification = AppNotification(
      id: 'app-first-open-${DateTime.now().millisecondsSinceEpoch}',
      type: 'admin_points_gift',
      payload: {
        'amount': claim.pointsAwarded,
        'pointsBefore': claim.pointsBefore,
        'pointsAfter': claim.pointsAfter,
        'senderName': tr('appFirstOpen.giftSender'),
        'message': trp('appFirstOpen.giftMessage', {
          'points': '${claim.pointsAwarded}',
        }),
      },
      createdAt: DateTime.now(),
    );

    await showGeneralDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'app-first-open-gift',
      barrierColor: Colors.transparent,
      pageBuilder: (dialogContext, animation, secondaryAnimation) {
        return GiftNotificationModal(
          notification: notification,
          authService: authService,
          onClose: () => Navigator.of(dialogContext).pop(),
        );
      },
    );
  } catch (_) {
    // Silencioso: si el bonus está apagado o falla la red, no bloquear la app.
  }
}
