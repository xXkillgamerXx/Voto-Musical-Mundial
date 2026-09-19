import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/fan/fan_perks.dart';
import '../../../../core/i18n/i18n_registry.dart';
import '../../../../core/i18n/tr.dart';
import '../../../artists/data/artist.dart';
import '../../../artists/data/artists_api.dart';
import '../../../auth/data/auth_service.dart';
import '../../data/fan_api.dart';
import '../../data/fan_models.dart';
import 'paypal_checkout_page.dart';

class FanCheckoutPage extends StatefulWidget {
  const FanCheckoutPage({
    required this.authService,
    this.plan,
    this.pack,
    this.preselectedArtistId,
    this.initialYearly = false,
    this.initialCurrency = 'USD',
    super.key,
  });

  final AuthService authService;
  final FanPlan? plan;
  final FanPack? pack;
  final String? preselectedArtistId;
  final bool initialYearly;
  final String initialCurrency;

  @override
  State<FanCheckoutPage> createState() => _FanCheckoutPageState();
}

class _FanCheckoutPageState extends State<FanCheckoutPage> {
  late final FanApi _fanApi;
  late final ArtistsApi _artistsApi;
  final _phoneController = TextEditingController();
  final _searchController = TextEditingController();

  var _yearly = false;
  CheckoutCountry _country = checkoutCountries.first;
  var _phoneDigits = '';
  List<Artist> _artists = const [];
  final List<FanCheckoutArtist> _selected = [];
  var _loadingArtists = true;
  var _paying = false;
  String? _error;

  bool get _isPack => widget.pack != null;
  FanPlan? get _plan => widget.plan;
  FanPack? get _pack => widget.pack;
  String get _sku => (_plan?.sku ?? _pack?.sku ?? '').toUpperCase();
  String get _currency => _country.code == 'CO' ? 'COP' : 'USD';
  int get _maxArtists => _isPack ? 0 : (_plan?.maxArtists ?? 1);

  @override
  void initState() {
    super.initState();
    _fanApi = FanApi(widget.authService.client);
    _artistsApi = ArtistsApi(widget.authService.client);
    _yearly = widget.initialYearly;
    if (widget.initialCurrency.toUpperCase() == 'COP') {
      _country = checkoutCountries.firstWhere(
        (item) => item.code == 'CO',
        orElse: () => checkoutCountries.first,
      );
    }
    if (!_isPack) {
      _loadArtists();
    } else {
      _loadingArtists = false;
    }
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadArtists() async {
    try {
      final artists = await _artistsApi.listAll(limit: 250);
      if (!mounted) return;
      final preselected = widget.preselectedArtistId?.trim() ?? '';
      setState(() {
        _artists = artists;
        _loadingArtists = false;
        if (preselected.isNotEmpty) {
          Artist? match;
          for (final artist in artists) {
            if (artist.id == preselected || artist.slug == preselected) {
              match = artist;
              break;
            }
          }
          if (match != null) {
            _selected
              ..clear()
              ..add(
                FanCheckoutArtist(
                  id: match.id,
                  name: match.name,
                  image: match.image,
                  slug: match.slug,
                ),
              );
          }
        }
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingArtists = false;
        _error = error is ApiException ? error.message : tr('common.error');
      });
    }
  }

  double get _base {
    var amount = storeItemPrice(
      isPack: _isPack,
      yearly: _yearly,
      currency: _currency,
      plan: _plan,
      pack: _pack,
    );
    if (_isPack && FanPerks.instance.packDiscount > 0) {
      amount = double.parse(
        (amount * (1 - FanPerks.instance.packDiscount)).toStringAsFixed(2),
      );
    }
    return amount;
  }

  double get _tax =>
      _country.code == 'CO' ? double.parse((_base * 0.19).toStringAsFixed(2)) : 0;
  double get _total => double.parse((_base + _tax).toStringAsFixed(2));

  void _setCountry(CheckoutCountry country) {
    if (country.code == _country.code) return;
    setState(() {
      _country = country;
      _phoneDigits = '';
      _phoneController.clear();
    });
  }

  void _onPhoneChanged(String raw) {
    final digits = nationalPhoneDigits(raw, _country);
    final formatted = formatNationalPhone(digits, _country);
    _phoneDigits = digits;
    if (_phoneController.text != formatted) {
      _phoneController.value = TextEditingValue(
        text: formatted,
        selection: TextSelection.collapsed(offset: formatted.length),
      );
    }
    setState(() {});
  }

  void _toggleArtist(Artist artist) {
    final existing = _selected.indexWhere((item) => item.id == artist.id);
    setState(() {
      if (existing >= 0) {
        _selected.removeAt(existing);
        return;
      }
      if (_selected.length >= _maxArtists) return;
      _selected.add(
        FanCheckoutArtist(
          id: artist.id,
          name: artist.name,
          image: artist.image,
          slug: artist.slug,
        ),
      );
    });
  }

  bool get _phoneReady => _phoneDigits.length == _country.maxDigits;

  Future<void> _pay() async {
    setState(() => _error = null);
    if (!_isPack && _selected.isEmpty) {
      setState(() => _error = tr('fan.needArtist'));
      return;
    }
    if (!_phoneReady) {
      setState(() => _error = tr('fan.needPhone'));
      return;
    }

    setState(() => _paying = true);
    try {
      final order = await _fanApi.createPaypalOrder(
        sku: _sku,
        yearly: _isPack ? false : _yearly,
        currency: _currency,
        country: _country.code,
        countryName: _country.name,
        phone: _phoneDigits.isEmpty
            ? ''
            : '${_country.dial}$_phoneDigits',
        artists: _selected,
      );
      if (order.approveUrl.isEmpty || order.orderId.isEmpty) {
        throw ApiException(tr('fan.paypalMissing'));
      }
      if (!mounted) return;
      final approved = await PaypalCheckoutPage.open(
        context,
        approveUrl: order.approveUrl,
      );
      if (!approved) {
        if (!mounted) return;
        setState(() {
          _paying = false;
          _error = tr('fan.paypalCancel');
        });
        return;
      }
      await _fanApi.capturePaypalOrder(order.orderId);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _paying = false;
        _error = error is ApiException ? error.message : tr('common.error');
      });
    }
  }

  List<Color> get _ctaColors {
    if (_sku == 'MEGA') return const [Color(0xFFFBBF24), Color(0xFFF97316)];
    if (_sku == 'SUPER') {
      return const [Color(0xFF8B5CF6), Color(0xFFD946EF), Color(0xFFEC4899)];
    }
    return const [Color(0xFF8B5CF6), Color(0xFFEC4899)];
  }

  Color get _tone {
    if (_isPack || _sku == 'MEGA') return const Color(0xFFFDE68A);
    if (_sku == 'SUPER') return const Color(0xFFF0ABFC);
    return const Color(0xFFDDD6FE);
  }

  IconData get _itemIcon {
    if (_isPack) return Icons.card_giftcard_rounded;
    if (_sku == 'MEGA') return Icons.workspace_premium_rounded;
    if (_sku == 'SUPER') return Icons.bolt_rounded;
    return Icons.star_rounded;
  }

  @override
  Widget build(BuildContext context) {
    initI18n();
    final query = _searchController.text.trim().toLowerCase();
    final filtered = query.isEmpty
        ? _artists
        : _artists
              .where(
                (artist) =>
                    artist.name.toLowerCase().contains(query) ||
                    artist.group.toLowerCase().contains(query),
              )
              .toList(growable: false);

    return Scaffold(
      backgroundColor: const Color(0xFF05010E),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: Text(tr('fan.checkoutTitle')),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.07),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
                ),
                child: Icon(_itemIcon, color: _tone, size: 26),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      (_isPack
                              ? trp('fan.pts', {
                                  'n': formatStoreCount(_pack?.pts ?? 0),
                                })
                              : (_plan?.name ?? _sku))
                          .toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.4,
                      ),
                    ),
                    if (!_isPack && (_plan?.taglineText ?? '').isNotEmpty)
                      Text(
                        _plan!.taglineText,
                        style: TextStyle(
                          color: _tone,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    if (_isPack && (_pack?.noteText ?? '').isNotEmpty)
                      Text(
                        _pack!.noteText,
                        style: TextStyle(
                          color: _tone,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (!_isPack && _plan != null) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _MiniStat(
                    label: tr('fan.eachVote'),
                    value: '×${_plan!.multiplier}',
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _MiniStat(
                    label: tr('fan.welcome'),
                    value: '+${formatStoreCount(_plan!.welcomePts)} pts',
                    valueColor: const Color(0xFFF0ABFC),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _PillToggle(
              left: tr('fan.monthly'),
              right: tr('fan.yearly'),
              rightHint: tr('fan.saveYear'),
              rightSelected: _yearly,
              onLeft: _paying ? () {} : () => setState(() => _yearly = false),
              onRight: _paying ? () {} : () => setState(() => _yearly = true),
            ),
          ],
          if (!_isPack) ...[
            const SizedBox(height: 22),
            Text(
              tr('fan.pickArtists').toUpperCase(),
              style: const TextStyle(
                color: Color(0xFF94A3B8),
                fontSize: 11,
                fontWeight: FontWeight.w900,
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              trp('fan.maxArtists', {'n': '$_maxArtists'}),
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.45),
                fontWeight: FontWeight.w600,
              ),
            ),
            if (_selected.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final artist in _selected)
                    InputChip(
                      onDeleted: _paying
                          ? null
                          : () => setState(
                              () => _selected.removeWhere(
                                (item) => item.id == artist.id,
                              ),
                            ),
                      avatar: artist.image.isEmpty
                          ? CircleAvatar(
                              child: Text(
                                artist.name.isEmpty ? '?' : artist.name[0],
                              ),
                            )
                          : CircleAvatar(
                              backgroundImage: CachedNetworkImageProvider(
                                artist.image,
                              ),
                            ),
                      label: Text(artist.name),
                      labelStyle: const TextStyle(
                        color: Color(0xFFF5D0FE),
                        fontWeight: FontWeight.w800,
                      ),
                      backgroundColor: const Color(0x26D946EF),
                      side: const BorderSide(color: Color(0x59F0ABFC)),
                      deleteIconColor: Colors.white54,
                    ),
                ],
              ),
            ],
            const SizedBox(height: 10),
            TextField(
              controller: _searchController,
              onChanged: (_) => setState(() {}),
              style: const TextStyle(color: Colors.white),
              decoration: _fieldDecoration(tr('fan.searchArtist')).copyWith(
                prefixIcon: const Icon(Icons.search, color: Colors.white54),
              ),
            ),
            const SizedBox(height: 10),
            if (_loadingArtists)
              const Padding(
                padding: EdgeInsets.all(20),
                child: Center(
                  child: CircularProgressIndicator(color: Color(0xFFFF21C8)),
                ),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final artist in filtered.take(12))
                    _ArtistPickTile(
                      artist: artist,
                      selected: _selected.any((item) => item.id == artist.id),
                      onTap: _paying ? null : () => _toggleArtist(artist),
                    ),
                ],
              ),
          ],
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: const Color(0xE60A0D20),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr('fan.payment').toUpperCase(),
                  style: const TextStyle(
                    color: Color(0xFFF0ABFC),
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2.2,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  '${tr('fan.phone').toUpperCase()} *',
                  style: const TextStyle(
                    color: Color(0xFF94A3B8),
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.30),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.10),
                    ),
                  ),
                  child: Row(
                    children: [
                      PopupMenuButton<CheckoutCountry>(
                        enabled: !_paying,
                        tooltip: tr('fan.country'),
                        color: const Color(0xFF160B35),
                        initialValue: _country,
                        onSelected: _setCountry,
                        itemBuilder: (context) => [
                          for (final country in checkoutCountries)
                            PopupMenuItem(
                              value: country,
                              child: Text(
                                '${country.dial}  ${country.name}',
                                style: const TextStyle(color: Colors.white),
                              ),
                            ),
                        ],
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(12, 14, 8, 14),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                _country.dial,
                                style: const TextStyle(
                                  color: Color(0xFFCBD5E1),
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(width: 2),
                              Icon(
                                Icons.keyboard_arrow_down_rounded,
                                size: 18,
                                color: Colors.white.withValues(alpha: 0.55),
                              ),
                            ],
                          ),
                        ),
                      ),
                      Container(
                        width: 1,
                        height: 46,
                        color: Colors.white.withValues(alpha: 0.10),
                      ),
                      Expanded(
                        child: TextField(
                          controller: _phoneController,
                          enabled: !_paying,
                          keyboardType: TextInputType.phone,
                          maxLength: phoneFormatMaxLength(_country),
                          onChanged: _onPhoneChanged,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            hintText: _country.example,
                            hintStyle: TextStyle(
                              color: Colors.white.withValues(alpha: 0.35),
                            ),
                            counterText: '',
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 14,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0x59F0ABFC)),
                    color: const Color(0x14D946EF),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.account_balance_wallet_rounded,
                          color: Color(0xFFF0ABFC)),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'PayPal',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.10),
                    ),
                  ),
                  child: Column(
                    children: [
                      _PriceRow(
                        label: tr('fan.subtotal'),
                        value: formatStoreMoney(_base, _currency),
                      ),
                      const SizedBox(height: 8),
                      _PriceRow(
                        label: _tax > 0 ? tr('fan.iva') : tr('fan.ivaNone'),
                        value: formatStoreMoney(_tax, _currency),
                        tint: _tax > 0,
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Divider(color: Color(0x1AFFFFFF), height: 1),
                      ),
                      _PriceRow(
                        label: tr('fan.total'),
                        value: formatStoreMoney(_total, _currency),
                        strong: true,
                      ),
                    ],
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: const TextStyle(
                      color: Color(0xFFFCA5A5),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: _paying ? null : _pay,
                    borderRadius: BorderRadius.circular(16),
                    child: Ink(
                      height: 52,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        gradient: LinearGradient(colors: _ctaColors),
                      ),
                      child: Center(
                        child: _paying
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(
                                tr('fan.payPaypal').toUpperCase(),
                                style: TextStyle(
                                  color: _sku == 'MEGA'
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
              ],
            ),
          ),
        ],
      ),
    );
  }
}

InputDecoration _fieldDecoration(String? hint) {
  return InputDecoration(
    hintText: hint,
    hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.35)),
    filled: true,
    fillColor: Colors.black.withValues(alpha: 0.30),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.10)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: Color(0x66F0ABFC)),
    ),
  );
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
        children: [
          Expanded(
            child: _ToggleChip(
              label: left,
              selected: !rightSelected,
              onTap: onLeft,
            ),
          ),
          Expanded(
            child: _ToggleChip(
              label: right,
              hint: rightHint,
              selected: rightSelected,
              onTap: onRight,
            ),
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
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          gradient: selected
              ? const LinearGradient(
                  colors: [Color(0xFF8B5CF6), Color(0xFFEC4899)],
                )
              : null,
        ),
        alignment: Alignment.center,
        child: Text(
          hint == null
              ? label.toUpperCase()
              : '${label.toUpperCase()} $hint',
          style: TextStyle(
            color: selected ? Colors.white : const Color(0xFFCBD5E1),
            fontSize: 11,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({
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
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _ArtistPickTile extends StatelessWidget {
  const _ArtistPickTile({
    required this.artist,
    required this.selected,
    this.onTap,
  });

  final Artist artist;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: (MediaQuery.sizeOf(context).width - 40) / 2,
      child: Material(
        color: selected ? const Color(0x26D946EF) : const Color(0x40000000),
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: selected
                    ? const Color(0x66F0ABFC)
                    : Colors.white.withValues(alpha: 0.10),
              ),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundColor: const Color(0xFF2A1848),
                  backgroundImage: artist.image.isNotEmpty
                      ? CachedNetworkImageProvider(artist.image)
                      : null,
                  child: artist.image.isEmpty
                      ? Text(artist.name.isEmpty ? 'A' : artist.name[0])
                      : null,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    artist.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.strong = false,
    this.tint = false,
  });

  final String label;
  final String value;
  final bool strong;
  final bool tint;

  @override
  Widget build(BuildContext context) {
    final color = strong
        ? Colors.white
        : tint
            ? const Color(0xFFF0ABFC)
            : const Color(0xFF94A3B8);
    return Row(
      children: [
        Expanded(
          child: Text(
            strong ? label.toUpperCase() : label,
            style: TextStyle(
              color: color,
              fontWeight: strong ? FontWeight.w900 : FontWeight.w600,
              letterSpacing: strong ? 0.6 : 0,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.w900,
            fontSize: strong ? 28 : 14,
          ),
        ),
      ],
    );
  }
}
