import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/fan/fan_perks.dart';
import '../../../../core/i18n/tr.dart';
import '../../../auth/data/auth_service.dart';
import '../../data/fan_api.dart';
import '../../data/fan_models.dart';
import '../widgets/fan_badge.dart';
import 'fan_store_page.dart';

class MembershipPage extends StatefulWidget {
  const MembershipPage({required this.authService, super.key});

  final AuthService authService;

  @override
  State<MembershipPage> createState() => _MembershipPageState();
}

class _MembershipPageState extends State<MembershipPage> {
  late final FanApi _api;
  var _loading = true;
  var _cancelling = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _api = FanApi(widget.authService.client);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _api.getMe();
      if (!mounted) return;
      setState(() => _loading = false);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException ? error.message : tr('common.error');
        _loading = false;
      });
    }
  }

  Future<void> _cancel() async {
    final plan = FanPerks.instance.membership;
    if (plan == null || plan.id.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: const Color(0xFF120A2B),
          title: Text(
            tr('fan.cancelPlan'),
            style: const TextStyle(color: Colors.white),
          ),
          content: Text(
            tr('fan.cancelConfirm'),
            style: const TextStyle(color: Colors.white70),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text(tr('common.cancel')),
            ),
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(tr('fan.cancelYes')),
            ),
          ],
        );
      },
    );
    if (ok != true) return;
    setState(() => _cancelling = true);
    try {
      await _api.cancelPurchase(plan.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('fan.cancelled'))),
      );
      setState(() => _cancelling = false);
    } catch (error) {
      if (!mounted) return;
      setState(() => _cancelling = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error is ApiException ? error.message : tr('common.error')),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final perks = FanPerks.instance;
    return Scaffold(
      backgroundColor: const Color(0xFF05010E),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: Text(tr('fan.membership')),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFFFF21C8)),
            )
          : RefreshIndicator(
              color: const Color(0xFFFF21C8),
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                children: [
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        _error!,
                        style: const TextStyle(color: Color(0xFFFCA5A5)),
                      ),
                    ),
                  if (perks.hasPlan && perks.membership != null)
                    _PlanCard(
                      membership: perks.membership!,
                      cancelling: _cancelling,
                      onCancel: _cancel,
                    )
                  else
                    _EmptyPlan(
                      onSeePlans: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) =>
                                FanStorePage(authService: widget.authService),
                          ),
                        );
                      },
                    ),
                  const SizedBox(height: 24),
                  Text(
                    tr('fan.payments').toUpperCase(),
                    style: const TextStyle(
                      color: Color(0xFFC084FC),
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.4,
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (perks.purchases.isEmpty)
                    Text(
                      tr('fan.emptyHistory'),
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.5),
                      ),
                    )
                  else
                    for (final row in perks.purchases) _PurchaseTile(row: row),
                ],
              ),
            ),
    );
  }
}

class _EmptyPlan extends StatelessWidget {
  const _EmptyPlan({required this.onSeePlans});

  final VoidCallback onSeePlans;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr('fan.noPlan'),
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: onSeePlans,
            child: Text(tr('fan.seePlans')),
          ),
        ],
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.membership,
    required this.cancelling,
    required this.onCancel,
  });

  final FanMembership membership;
  final bool cancelling;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: fanSkuColor(membership.sku).withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              FanBadge(sku: membership.sku),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  membership.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 18,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            membership.daysLeft <= 1
                ? tr('fan.lockedCtaOne')
                : trp('fan.lockedCta', {'n': '${membership.daysLeft}'}),
            style: const TextStyle(color: Color(0xFFC4B5FD)),
          ),
          if (membership.artists.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              membership.artists.map((artist) => artist.name).join(', '),
              style: TextStyle(color: Colors.white.withValues(alpha: 0.7)),
            ),
          ],
          const SizedBox(height: 14),
          OutlinedButton(
            onPressed: cancelling ? null : onCancel,
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFFCA5A5),
            ),
            child: Text(tr('fan.cancelPlan')),
          ),
        ],
      ),
    );
  }
}

class _PurchaseTile extends StatelessWidget {
  const _PurchaseTile({required this.row});

  final FanMembership row;

  @override
  Widget build(BuildContext context) {
    final date = row.startedAt;
    final dateLabel = date == null
        ? ''
        : DateFormat.yMMMd().format(date.toLocal());
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  row.name.isEmpty ? row.sku : row.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text(
                formatStoreMoney(row.total, row.currency),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            [
              if (dateLabel.isNotEmpty) dateLabel,
              if (row.invoiceId.isNotEmpty) '${tr('fan.invoice')} ${row.invoiceId}',
              row.status,
            ].where((item) => item.trim().isNotEmpty).join(' · '),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.5),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
