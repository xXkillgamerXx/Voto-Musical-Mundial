import 'package:flutter/foundation.dart';

import '../../features/fan/data/fan_models.dart';

/// Perks del plan fan activo (sin anuncios, descuento de packs, badge).
class FanPerks extends ChangeNotifier {
  FanPerks._();

  static final FanPerks instance = FanPerks._();

  FanMembership? membership;
  List<FanMembership> purchases = const [];
  bool adsFree = false;
  bool adminAdsFree = false;
  double packDiscount = 0;

  bool get hideAds => adsFree || adminAdsFree;

  String get sku {
    final plan = membership;
    if (plan == null || plan.expired) return '';
    return plan.sku;
  }

  bool get hasPlan => sku.isNotEmpty;

  int get rank => planRank(sku);

  int get daysLeft => membership?.daysLeft ?? 0;

  void setAdminAdsFree(bool value) {
    if (adminAdsFree == value) return;
    adminAdsFree = value;
    notifyListeners();
  }

  void apply(FanMePayload payload) {
    membership = payload.membership;
    purchases = payload.purchases;
    // SUPER/MEGA (y featured/mega) sin anuncios. El API también marca
    // adsFree para admin — eso NO debe ocultar AdMob en la app.
    final plan = membership;
    final sku = (plan != null && !plan.expired) ? plan.sku : '';
    adsFree = sku == 'SUPER' ||
        sku == 'MEGA' ||
        plan?.featured == true ||
        plan?.mega == true;
    packDiscount = payload.packDiscount;
    notifyListeners();
  }

  void clear() {
    membership = null;
    purchases = const [];
    adsFree = false;
    adminAdsFree = false;
    packDiscount = 0;
    notifyListeners();
  }
}
