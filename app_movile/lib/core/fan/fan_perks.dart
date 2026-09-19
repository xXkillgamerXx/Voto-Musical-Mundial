import 'package:flutter/foundation.dart';

import '../../features/fan/data/fan_models.dart';

/// Perks del plan fan activo (sin anuncios, descuento de packs, badge).
class FanPerks extends ChangeNotifier {
  FanPerks._();

  static final FanPerks instance = FanPerks._();

  FanMembership? membership;
  List<FanMembership> purchases = const [];
  bool adsFree = false;
  double packDiscount = 0;

  String get sku {
    final plan = membership;
    if (plan == null || plan.expired) return '';
    return plan.sku;
  }

  bool get hasPlan => sku.isNotEmpty;

  int get rank => planRank(sku);

  int get daysLeft => membership?.daysLeft ?? 0;

  void apply(FanMePayload payload) {
    membership = payload.membership;
    purchases = payload.purchases;
    adsFree = payload.adsFree;
    packDiscount = payload.packDiscount;
    notifyListeners();
  }

  void clear() {
    membership = null;
    purchases = const [];
    adsFree = false;
    packDiscount = 0;
    notifyListeners();
  }
}
