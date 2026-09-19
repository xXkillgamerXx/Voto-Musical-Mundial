import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/fan/fan_perks.dart';
import '../../../../core/i18n/i18n_registry.dart';
import '../../../../core/i18n/tr.dart';
import '../../../auth/data/auth_service.dart';
import '../../../fan/data/fan_api.dart';
import '../../../fan/data/fan_models.dart';
import '../../../fan/presentation/pages/fan_checkout_page.dart';
import '../../../fan/presentation/pages/fan_store_page.dart';

class HomeFanPlansSection extends StatefulWidget {
  const HomeFanPlansSection({required this.authService, super.key});

  final AuthService authService;

  @override
  State<HomeFanPlansSection> createState() => _HomeFanPlansSectionState();
}

class _HomeFanPlansSectionState extends State<HomeFanPlansSection> {
  FanCatalog? _catalog;
  var _ready = false;

  @override
  void initState() {
    super.initState();
    FanPerks.instance.addListener(_onPerks);
    unawaited(_load());
  }

  @override
  void dispose() {
    FanPerks.instance.removeListener(_onPerks);
    super.dispose();
  }

  void _onPerks() {
    if (mounted) setState(() {});
  }

  Future<void> _load() async {
    try {
      final catalog = await FanApi(widget.authService.client).getCatalog();
      if (!mounted) return;
      setState(() {
        _catalog = catalog;
        _ready = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _ready = true);
    }
  }

  Future<void> _openStore() async {
    await Navigator.of(context, rootNavigator: true).push<void>(
      MaterialPageRoute(
        builder: (_) => FanStorePage(authService: widget.authService),
      ),
    );
  }

  Future<void> _openCheckout({FanPlan? plan, FanPack? pack}) async {
    final purchased = await Navigator.of(context, rootNavigator: true).push<bool>(
      MaterialPageRoute(
        builder: (_) => FanCheckoutPage(
          authService: widget.authService,
          plan: plan,
          pack: pack,
        ),
      ),
    );
    if (purchased == true && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(tr('fan.thanks'))));
    }
  }

  @override
  Widget build(BuildContext context) {
    initI18n();
    final catalog = _catalog;
    if (!_ready || catalog == null || catalog.isHidden || catalog.plans.isEmpty) {
      return const SizedBox.shrink();
    }

    final perks = FanPerks.instance;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr('home.buyEyebrow'),
            style: const TextStyle(
              color: Color(0xFFC4B5FD),
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.8,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Text(
                  tr('home.buyPlansTitle'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    height: 1.0,
                  ),
                ),
              ),
              TextButton(
                onPressed: _openStore,
                child: Text(
                  tr('fan.seePlans').toUpperCase(),
                  style: const TextStyle(
                    color: Color(0xFFF0ABFC),
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (var i = 0; i < catalog.plans.length; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            _HomePlanRow(
              plan: catalog.plans[i],
              canBuy: canBuyPlan(perks.sku, catalog.plans[i].sku),
              onTap: () => _openCheckout(plan: catalog.plans[i]),
            ),
          ],
          if (catalog.packs.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              tr('fan.packs').toUpperCase(),
              style: const TextStyle(
                color: Color(0xFFFBBF24),
                fontSize: 11,
                fontWeight: FontWeight.w900,
                letterSpacing: 2.2,
              ),
            ),
            const SizedBox(height: 10),
            for (var i = 0; i < catalog.packs.length; i++) ...[
              if (i > 0) const SizedBox(height: 8),
              _HomePackRow(
                pack: catalog.packs[i],
                popular: i == 1,
                onTap: () => _openCheckout(pack: catalog.packs[i]),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _HomePlanRow extends StatelessWidget {
  const _HomePlanRow({
    required this.plan,
    required this.canBuy,
    required this.onTap,
  });

  final FanPlan plan;
  final bool canBuy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final look = _lookFor(plan);
    final price = formatStoreMoney(plan.usdM, 'USD');
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: canBuy ? onTap : null,
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            color: look.glow.withValues(alpha: 0.18),
            border: Border.all(color: look.border),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  color: Colors.black.withValues(alpha: 0.28),
                  border: Border.all(color: look.border),
                ),
                child: Icon(look.icon, color: look.tone),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          plan.name.toUpperCase(),
                          style: TextStyle(
                            color: look.tone,
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.6,
                          ),
                        ),
                        if (plan.featured) ...[
                          const SizedBox(width: 8),
                          Text(
                            tr('fan.mostPopular').toUpperCase(),
                            style: const TextStyle(
                              color: Color(0xFFF0ABFC),
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$price${tr('fan.perMonth')} · ×${plan.multiplier}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: canBuy
                    ? Colors.white.withValues(alpha: 0.7)
                    : Colors.white.withValues(alpha: 0.25),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomePackRow extends StatelessWidget {
  const _HomePackRow({
    required this.pack,
    required this.popular,
    required this.onTap,
  });

  final FanPack pack;
  final bool popular;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            color: popular
                ? const Color(0x1AD946EF)
                : Colors.black.withValues(alpha: 0.25),
            border: Border.all(
              color: popular
                  ? const Color(0x66F0ABFC)
                  : Colors.white.withValues(alpha: 0.10),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      trp('fan.pts', {'n': formatStoreCount(pack.pts)}),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      popular
                          ? tr('fan.mostPopular').toUpperCase()
                          : tr('fan.packsEyebrow').toUpperCase(),
                      style: TextStyle(
                        color: popular
                            ? const Color(0xFFF0ABFC)
                            : Colors.white.withValues(alpha: 0.45),
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                formatStoreMoney(pack.usd, 'USD'),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlanLook {
  const _PlanLook({
    required this.icon,
    required this.tone,
    required this.border,
    required this.glow,
  });

  final IconData icon;
  final Color tone;
  final Color border;
  final Color glow;

  static const mega = _PlanLook(
    icon: Icons.workspace_premium_rounded,
    tone: Color(0xFFFDE68A),
    border: Color(0x4DFCD34D),
    glow: Color(0x33FBBF24),
  );

  static const superPlan = _PlanLook(
    icon: Icons.bolt_rounded,
    tone: Color(0xFFF0ABFC),
    border: Color(0x59F0ABFC),
    glow: Color(0x40D946EF),
  );

  static const fan = _PlanLook(
    icon: Icons.star_rounded,
    tone: Color(0xFFDDD6FE),
    border: Color(0x40C4B5FD),
    glow: Color(0x338B5CF6),
  );
}

_PlanLook _lookFor(FanPlan plan) {
  if (plan.mega) return _PlanLook.mega;
  if (plan.featured) return _PlanLook.superPlan;
  return _PlanLook.fan;
}
