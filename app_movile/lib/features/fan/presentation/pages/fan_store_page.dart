import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/fan/fan_perks.dart';
import '../../../../core/i18n/i18n_registry.dart';
import '../../../../core/i18n/tr.dart';
import '../../../auth/data/auth_service.dart';
import '../../data/fan_api.dart';
import '../../data/fan_models.dart';
import '../widgets/fan_badge.dart';
import 'fan_checkout_page.dart';

class FanStorePage extends StatefulWidget {
  const FanStorePage({
    required this.authService,
    this.preselectedArtistId,
    super.key,
  });

  final AuthService authService;
  final String? preselectedArtistId;

  @override
  State<FanStorePage> createState() => _FanStorePageState();
}

class _FanStorePageState extends State<FanStorePage> {
  late final FanApi _api;
  FanCatalog? _catalog;
  String? _error;
  var _loading = true;
  var _yearly = false;
  var _currency = 'USD';

  @override
  void initState() {
    super.initState();
    _api = FanApi(widget.authService.client);
    FanPerks.instance.addListener(_onPerks);
    unawaited(_load());
  }

  void _onPerks() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    FanPerks.instance.removeListener(_onPerks);
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final catalog = await _api.getCatalog();
      await _api.getMe();
      if (!mounted) return;
      setState(() {
        _catalog = catalog;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException ? error.message : tr('common.error');
        _loading = false;
      });
    }
  }

  Future<void> _openCheckout({FanPlan? plan, FanPack? pack}) async {
    final purchased = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => FanCheckoutPage(
          authService: widget.authService,
          plan: plan,
          pack: pack,
          preselectedArtistId: widget.preselectedArtistId,
          initialYearly: pack == null && _yearly,
          initialCurrency: _currency,
        ),
      ),
    );
    if (purchased == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('fan.thanks'))),
      );
    }
  }

  String _lockedLabel(int daysLeft) {
    if (daysLeft <= 0) return tr('fan.lockedCtaSoon');
    if (daysLeft == 1) return tr('fan.lockedCtaOne');
    return trp('fan.lockedCta', {'n': '$daysLeft'});
  }

  @override
  Widget build(BuildContext context) {
    initI18n();
    final catalog = _catalog;
    final perks = FanPerks.instance;
    return Scaffold(
      backgroundColor: const Color(0xFF05010E),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: Text(tr('fan.storeTitle')),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFFFF21C8)),
            )
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white70),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: _load,
                      child: Text(tr('common.retry')),
                    ),
                  ],
                ),
              ),
            )
          : catalog == null || catalog.isHidden
          ? Center(
              child: Text(
                tr('fan.hidden'),
                style: const TextStyle(color: Colors.white70),
              ),
            )
          : RefreshIndicator(
              color: const Color(0xFFFF21C8),
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 36),
                children: [
                  _StoreHero(
                    headline: catalog.headlineText.isEmpty
                        ? tr('fan.storeTitle')
                        : catalog.headlineText,
                    subhead: catalog.subheadText,
                    yearly: _yearly,
                    currency: _currency,
                    membership: perks.membership,
                    onYearly: (value) => setState(() => _yearly = value),
                    onCurrency: (value) => setState(() => _currency = value),
                  ),
                  const SizedBox(height: 22),
                  for (final plan in catalog.plans)
                    _PlanCard(
                      plan: plan,
                      yearly: _yearly,
                      currency: _currency,
                      activeSku: perks.sku,
                      lockedLabel: _lockedLabel(perks.daysLeft),
                      onBuy: () => _openCheckout(plan: plan),
                    ),
                  const SizedBox(height: 10),
                  _PacksSection(
                    packs: catalog.packs,
                    currency: _currency,
                    discount: perks.packDiscount,
                    onBuy: (pack) => _openCheckout(pack: pack),
                  ),
                  const SizedBox(height: 16),
                  const _TrustGrid(),
                ],
              ),
            ),
    );
  }
}

class _StoreHero extends StatelessWidget {
  const _StoreHero({
    required this.headline,
    required this.subhead,
    required this.yearly,
    required this.currency,
    required this.onYearly,
    required this.onCurrency,
    this.membership,
  });

  final String headline;
  final String subhead;
  final bool yearly;
  final String currency;
  final ValueChanged<bool> onYearly;
  final ValueChanged<String> onCurrency;
  final FanMembership? membership;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF060713),
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: const Color(0x26F0ABFC)),
        ),
        child: Stack(
          children: [
            Positioned(
              right: -70,
              top: -70,
              child: Container(
                width: 180,
                height: 180,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFE879F9).withValues(alpha: 0.18),
                ),
              ),
            ),
            Positioned(
              left: 20,
              bottom: -80,
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF22D3EE).withValues(alpha: 0.10),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
              child: Column(
                children: [
                  Text(
                    headline.toUpperCase(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      height: 0.98,
                      letterSpacing: -0.6,
                    ),
                  ),
                  if (subhead.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(
                      subhead,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFFCBD5E1),
                        height: 1.45,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Text(
                    tr('fan.supportPeriod'),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.42),
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      height: 1.45,
                    ),
                  ),
                  if (membership != null && !membership!.expired) ...[
                    const SizedBox(height: 14),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: fanSkuColor(membership!.sku).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: fanSkuColor(membership!.sku).withValues(alpha: 0.4),
                        ),
                      ),
                      child: Row(
                        children: [
                          FanBadge(sku: membership!.sku),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              '${tr('fan.currentPlan')} · ${membership!.daysLeft}d',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _PillToggle(
                        left: tr('fan.monthly'),
                        right: tr('fan.yearly'),
                        rightHint: tr('fan.saveYear'),
                        rightSelected: yearly,
                        onLeft: () => onYearly(false),
                        onRight: () => onYearly(true),
                      ),
                      _PillToggle(
                        left: 'USD',
                        right: 'COP',
                        rightSelected: currency == 'COP',
                        onLeft: () => onCurrency('USD'),
                        onRight: () => onCurrency('COP'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PillToggle extends StatelessWidget {
  const _PillToggle({
    required this.left,
    required this.right,
    required this.rightSelected,
    required this.onLeft,
    required this.onRight,
    this.rightHint,
  });

  final String left;
  final String right;
  final String? rightHint;
  final bool rightSelected;
  final VoidCallback onLeft;
  final VoidCallback onRight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ToggleChip(
            label: left,
            selected: !rightSelected,
            onTap: onLeft,
          ),
          _ToggleChip(
            label: right,
            hint: rightHint,
            selected: rightSelected,
            onTap: onRight,
          ),
        ],
      ),
    );
  }
}

class _ToggleChip extends StatelessWidget {
  const _ToggleChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.hint,
  });

  final String label;
  final String? hint;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          gradient: selected
              ? const LinearGradient(
                  colors: [Color(0xFF8B5CF6), Color(0xFFEC4899)],
                )
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label.toUpperCase(),
              style: TextStyle(
                color: selected ? Colors.white : const Color(0xFFCBD5E1),
                fontSize: 11,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.4,
              ),
            ),
            if (hint != null) ...[
              const SizedBox(width: 4),
              Text(
                hint!,
                style: TextStyle(
                  color: selected
                      ? const Color(0xFFBBF7D0)
                      : const Color(0xFF6EE7B7),
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ],
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
    required this.cta,
  });

  final IconData icon;
  final Color tone;
  final Color border;
  final Color glow;
  final List<Color> cta;

  static _PlanLook of(FanPlan plan) {
    if (plan.mega) {
      return const _PlanLook(
        icon: Icons.workspace_premium_rounded,
        tone: Color(0xFFFDE68A),
        border: Color(0x4DFCD34D),
        glow: Color(0x33FBBF24),
        cta: [Color(0xFFFBBF24), Color(0xFFF97316)],
      );
    }
    if (plan.featured) {
      return const _PlanLook(
        icon: Icons.bolt_rounded,
        tone: Color(0xFFF0ABFC),
        border: Color(0x59F0ABFC),
        glow: Color(0x40D946EF),
        cta: [Color(0xFF8B5CF6), Color(0xFFD946EF), Color(0xFFEC4899)],
      );
    }
    return const _PlanLook(
      icon: Icons.star_rounded,
      tone: Color(0xFFDDD6FE),
      border: Color(0x40C4B5FD),
      glow: Color(0x338B5CF6),
      cta: [Color(0xFF8B5CF6), Color(0xFFD946EF)],
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.yearly,
    required this.currency,
    required this.activeSku,
    required this.lockedLabel,
    required this.onBuy,
  });

  final FanPlan plan;
  final bool yearly;
  final String currency;
  final String activeSku;
  final String lockedLabel;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    final canBuy = canBuyPlan(activeSku, plan.sku);
    final look = _PlanLook.of(plan);
    final cop = currency == 'COP';
    final display = yearly
        ? (cop ? plan.copY : plan.usdY)
        : (cop ? plan.copM : plan.usdM);
    final yearTotal = cop ? plan.copYTotal : plan.usdYTotal;
    final highlights = plan.benefitsList
        .where(
          (line) => !RegExp(
            'bienvenida|welcome bonus',
            caseSensitive: false,
          ).hasMatch(line),
        )
        .toList(growable: false);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: const Color(0xE60A0D20),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: look.border),
        boxShadow: [
          BoxShadow(
            color: look.glow,
            blurRadius: 28,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Positioned(
            right: -36,
            top: -36,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(colors: look.cta),
              ),
            ),
          ),
          Positioned(
            right: -36,
            top: -36,
            child: Container(
              width: 120,
              height: 120,
              color: const Color(0xCC0A0D20),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(18, plan.featured ? 28 : 18, 18, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.07),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.10),
                    ),
                  ),
                  child: Icon(look.icon, color: look.tone, size: 26),
                ),
                const SizedBox(height: 16),
                Text(
                  plan.name.toUpperCase(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.4,
                  ),
                ),
                if (plan.taglineText.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    plan.taglineText,
                    style: TextStyle(
                      color: look.tone,
                      fontWeight: FontWeight.w800,
                      height: 1.35,
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Flexible(
                      child: Text(
                        formatStoreMoney(display, currency),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 34,
                          fontWeight: FontWeight.w900,
                          height: 1,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        '/ ${tr('fan.monthly').toLowerCase()}',
                        style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                if (yearly) ...[
                  const SizedBox(height: 6),
                  Text(
                    trp('fan.billedYear', {
                      'total': formatStoreMoney(yearTotal, currency),
                    }),
                    style: const TextStyle(
                      color: Color(0xFF6EE7B7),
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _StatBox(
                        label: tr('fan.eachVote'),
                        value: '×${plan.multiplier}',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _StatBox(
                        label: tr('fan.welcome'),
                        value: '${plan.welcomePts} pts',
                        valueColor: plan.featured
                            ? const Color(0xFFF0ABFC)
                            : Colors.white,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                for (final benefit in highlights)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.check_circle_rounded,
                          size: 16,
                          color: Color(0xFFF0ABFC),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            benefit,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              height: 1.35,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 8),
                _GradientCta(
                  colors: look.cta,
                  enabled: canBuy,
                  label: canBuy
                      ? (activeSku.isEmpty
                            ? trp('fan.choosePlan', {'name': plan.name})
                            : trp('fan.upgradeTo', {'name': plan.name}))
                      : lockedLabel,
                  onTap: onBuy,
                ),
                if (!canBuy) ...[
                  const SizedBox(height: 10),
                  Text(
                    tr('fan.lockedBody'),
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.45),
                      fontSize: 12,
                      height: 1.4,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (plan.featured)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 6,
                  ),
                  decoration: const BoxDecoration(
                    borderRadius: BorderRadius.vertical(
                      bottom: Radius.circular(16),
                    ),
                    gradient: LinearGradient(
                      colors: [Color(0xFFD946EF), Color(0xFFEC4899)],
                    ),
                  ),
                  child: Text(
                    tr('fan.mostPopular').toUpperCase(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.4,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  const _StatBox({
    required this.label,
    required this.value,
    this.valueColor = Colors.white,
  });

  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: Color(0xFF94A3B8),
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              color: valueColor,
              fontSize: 22,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _GradientCta extends StatelessWidget {
  const _GradientCta({
    required this.colors,
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  final List<Color> colors;
  final String label;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(16),
          child: Ink(
            height: 52,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: LinearGradient(colors: colors),
              boxShadow: enabled
                  ? [
                      BoxShadow(
                        color: colors.last.withValues(alpha: 0.28),
                        blurRadius: 16,
                        offset: const Offset(0, 8),
                      ),
                    ]
                  : null,
            ),
            child: Center(
              child: Text(
                label.toUpperCase(),
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: colors.first == const Color(0xFFFBBF24)
                      ? const Color(0xFF1A1200)
                      : Colors.white,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.6,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PacksSection extends StatelessWidget {
  const _PacksSection({
    required this.packs,
    required this.currency,
    required this.discount,
    required this.onBuy,
  });

  final List<FanPack> packs;
  final String currency;
  final double discount;
  final ValueChanged<FanPack> onBuy;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
      decoration: BoxDecoration(
        color: const Color(0xD9080B1C),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr('fan.packsEyebrow').toUpperCase(),
            style: const TextStyle(
              color: Color(0xFFFDE68A),
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.2,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            tr('fan.packsTitle').toUpperCase(),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            tr('fan.packsBody'),
            style: const TextStyle(
              color: Color(0xFF94A3B8),
              height: 1.45,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          for (final pack in packs)
            _PackCard(
              pack: pack,
              currency: currency,
              discount: discount,
              onBuy: () => onBuy(pack),
            ),
        ],
      ),
    );
  }
}

class _PackCard extends StatelessWidget {
  const _PackCard({
    required this.pack,
    required this.currency,
    required this.discount,
    required this.onBuy,
  });

  final FanPack pack;
  final String currency;
  final double discount;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    final raw = currency == 'COP' ? pack.cop : pack.usd;
    final price = raw * (1 - discount);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.22),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
            ),
            child: const Icon(Icons.bolt_rounded, color: Color(0xFFFDE68A)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  trp('fan.pts', {'n': formatStoreCount(pack.pts)}),
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 18,
                  ),
                ),
                if (pack.noteText.isNotEmpty)
                  Text(
                    pack.noteText,
                    style: const TextStyle(
                      color: Color(0xFF94A3B8),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                if (discount > 0)
                  Text(
                    trp('fan.packDiscount', {
                      'n': '${(discount * 100).round()}',
                    }),
                    style: const TextStyle(
                      color: Color(0xFF67E8F9),
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                formatStoreMoney(price, currency),
                style: const TextStyle(
                  color: Color(0xFFFEF3C7),
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: onBuy,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.10),
                    ),
                  ),
                  child: Text(
                    tr('fan.buy').toUpperCase(),
                    style: const TextStyle(
                      color: Color(0xFFE2E8F0),
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TrustGrid extends StatelessWidget {
  const _TrustGrid();

  @override
  Widget build(BuildContext context) {
    const items = [
      (Icons.verified_user_rounded, 'fan.trustSecureTitle', 'fan.trustSecureBody'),
      (Icons.replay_rounded, 'fan.trustCancelTitle', 'fan.trustCancelBody'),
      (Icons.diamond_rounded, 'fan.trustFairTitle', 'fan.trustFairBody'),
      (Icons.favorite_rounded, 'fan.trustVoiceTitle', 'fan.trustVoiceBody'),
    ];
    return Column(
      children: [
        for (final item in items)
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(item.$1, color: const Color(0xFFDDD6FE), size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tr(item.$2).toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.4,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        tr(item.$3),
                        style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 12,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
