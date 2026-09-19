import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/localized_content.dart';

int planRank(String sku) {
  switch (sku.trim().toUpperCase()) {
    case 'MEGA':
      return 3;
    case 'SUPER':
      return 2;
    case 'FAN':
      return 1;
    default:
      return 0;
  }
}

bool canBuyPlan(String activeSku, String nextSku) {
  if (activeSku.trim().isEmpty) return true;
  final next = planRank(nextSku);
  if (next == 0) return true;
  return next > planRank(activeSku);
}

String localizedMap(dynamic value) {
  if (value is String) return value.trim();
  if (value is Map) {
    final code = AppLocale.instance.code;
    final preferred = '${value[code] ?? ''}'.trim();
    if (preferred.isNotEmpty) return preferred;
    return localizedContent(
      '${value['es'] ?? ''}'.trim(),
      '${value['en'] ?? ''}'.trim(),
    );
  }
  return '';
}

List<String> localizedList(dynamic value) {
  if (value is List) {
    return value
        .map((item) => '$item'.trim())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }
  if (value is Map) {
    final code = AppLocale.instance.code;
    final list = value[code] ?? value['es'] ?? value['en'];
    if (list is List) {
      return list
          .map((item) => '$item'.trim())
          .where((item) => item.isNotEmpty)
          .toList(growable: false);
    }
  }
  return const [];
}

class CheckoutCountry {
  const CheckoutCountry({
    required this.code,
    required this.name,
    required this.dial,
    required this.maxDigits,
    required this.groups,
    required this.example,
  });

  final String code;
  final String name;
  final String dial;
  final int maxDigits;
  final List<int> groups;
  final String example;

  @override
  bool operator ==(Object other) =>
      other is CheckoutCountry && other.code == code;

  @override
  int get hashCode => code.hashCode;
}

const checkoutCountries = [
  CheckoutCountry(
    code: 'CO',
    name: 'Colombia',
    dial: '+57',
    maxDigits: 10,
    groups: [3, 3, 4],
    example: '300 000-0000',
  ),
  CheckoutCountry(
    code: 'DO',
    name: 'República Dominicana',
    dial: '+1',
    maxDigits: 10,
    groups: [3, 3, 4],
    example: '(809) 000-0000',
  ),
  CheckoutCountry(
    code: 'MX',
    name: 'México',
    dial: '+52',
    maxDigits: 10,
    groups: [2, 4, 4],
    example: '55 0000-0000',
  ),
  CheckoutCountry(
    code: 'US',
    name: 'Estados Unidos',
    dial: '+1',
    maxDigits: 10,
    groups: [3, 3, 4],
    example: '(555) 000-0000',
  ),
  CheckoutCountry(
    code: 'ES',
    name: 'España',
    dial: '+34',
    maxDigits: 9,
    groups: [3, 3, 3],
    example: '600 000 000',
  ),
  CheckoutCountry(
    code: 'KR',
    name: 'Corea del Sur',
    dial: '+82',
    maxDigits: 10,
    groups: [2, 4, 4],
    example: '10 1234-5678',
  ),
  CheckoutCountry(
    code: 'AR',
    name: 'Argentina',
    dial: '+54',
    maxDigits: 10,
    groups: [2, 4, 4],
    example: '11 0000-0000',
  ),
];

String formatNationalPhone(String digits, CheckoutCountry country) {
  if (digits.isEmpty) return '';
  if (country.code == 'US' || country.code == 'DO') {
    final a = digits.substring(0, digits.length.clamp(0, 3));
    final b = digits.length > 3
        ? digits.substring(3, digits.length.clamp(3, 6))
        : '';
    final c = digits.length > 6
        ? digits.substring(6, digits.length.clamp(6, 10))
        : '';
    if (digits.length <= 3) return '($a';
    if (digits.length <= 6) return '($a) $b';
    return '($a) $b-$c';
  }
  final parts = <String>[];
  var index = 0;
  for (final size in country.groups) {
    if (index >= digits.length) break;
    final end = (index + size).clamp(0, digits.length);
    parts.add(digits.substring(index, end));
    index = end;
  }
  if (parts.length <= 1) return parts.isEmpty ? '' : parts.first;
  if (country.code == 'ES') return parts.join(' ');
  final last = parts.removeLast();
  return '${parts.join(' ')}-$last';
}

String nationalPhoneDigits(String raw, CheckoutCountry country) {
  var digits = raw.replaceAll(RegExp(r'\D'), '');
  final dialDigits = country.dial.replaceAll(RegExp(r'\D'), '');
  if (dialDigits.isNotEmpty &&
      digits.startsWith(dialDigits) &&
      digits.length > dialDigits.length) {
    digits = digits.substring(dialDigits.length);
  }
  if (digits.length > country.maxDigits) {
    digits = digits.substring(0, country.maxDigits);
  }
  return digits;
}

int phoneFormatMaxLength(CheckoutCountry country) {
  final formatted = formatNationalPhone('0' * country.maxDigits, country);
  return formatted.length < 14 ? 14 : formatted.length;
}

class FanCheckoutArtist {
  const FanCheckoutArtist({
    required this.id,
    required this.name,
    this.image = '',
    this.slug = '',
  });

  final String id;
  final String name;
  final String image;
  final String slug;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    if (image.isNotEmpty) 'image': image,
    if (slug.isNotEmpty) 'slug': slug,
  };

  factory FanCheckoutArtist.fromJson(Map<String, dynamic> json) {
    return FanCheckoutArtist(
      id: '${json['id'] ?? ''}',
      name: '${json['name'] ?? ''}'.trim(),
      image: '${json['image'] ?? json['photo'] ?? json['photoUrl'] ?? ''}'.trim(),
      slug: '${json['slug'] ?? ''}'.trim(),
    );
  }
}

class FanPlan {
  const FanPlan({
    required this.sku,
    required this.name,
    required this.mark,
    required this.accent,
    required this.multiplier,
    required this.maxArtists,
    required this.welcomePts,
    required this.usdM,
    required this.usdY,
    required this.usdYTotal,
    required this.copM,
    required this.copY,
    required this.copYTotal,
    required this.featured,
    required this.mega,
    required this.tagline,
    required this.desc,
    required this.descYear,
    required this.benefits,
  });

  final String sku;
  final String name;
  final String mark;
  final String accent;
  final int multiplier;
  final int maxArtists;
  final int welcomePts;
  final double usdM;
  final double usdY;
  final double usdYTotal;
  final double copM;
  final double copY;
  final double copYTotal;
  final bool featured;
  final bool mega;
  final dynamic tagline;
  final dynamic desc;
  final dynamic descYear;
  final dynamic benefits;

  String get taglineText => localizedMap(tagline);
  String get descText => localizedMap(desc);
  String get descYearText => localizedMap(descYear);
  List<String> get benefitsList => localizedList(benefits);

  factory FanPlan.fromJson(Map<String, dynamic> json) {
    return FanPlan(
      sku: '${json['sku'] ?? ''}'.toUpperCase(),
      name: '${json['name'] ?? json['sku'] ?? 'FAN'}',
      mark: '${json['mark'] ?? '★'}',
      accent: '${json['accent'] ?? 'fan'}',
      multiplier: _asInt(json['multiplier'], 1),
      maxArtists: _asInt(json['maxArtists'], 1),
      welcomePts: _asInt(json['welcomePts']),
      usdM: _asDouble(json['usdM']),
      usdY: _asDouble(json['usdY']),
      usdYTotal: _asDouble(json['usdYTotal']),
      copM: _asDouble(json['copM']),
      copY: _asDouble(json['copY']),
      copYTotal: _asDouble(json['copYTotal']),
      featured: json['featured'] == true,
      mega: json['mega'] == true || '${json['sku'] ?? ''}'.toUpperCase() == 'MEGA',
      tagline: json['tagline'],
      desc: json['desc'],
      descYear: json['descYear'],
      benefits: json['benefits'],
    );
  }
}

class FanPack {
  const FanPack({
    required this.sku,
    required this.pts,
    required this.usd,
    required this.cop,
    required this.note,
  });

  final String sku;
  final int pts;
  final double usd;
  final double cop;
  final dynamic note;

  String get noteText => localizedMap(note);

  factory FanPack.fromJson(Map<String, dynamic> json) {
    return FanPack(
      sku: '${json['sku'] ?? ''}'.toUpperCase(),
      pts: _asInt(json['pts']),
      usd: _asDouble(json['usd']),
      cop: _asDouble(json['cop']),
      note: json['note'],
    );
  }
}

class FanCatalog {
  const FanCatalog({
    required this.visibility,
    required this.headline,
    required this.subhead,
    required this.plans,
    required this.packs,
  });

  final String visibility;
  final dynamic headline;
  final dynamic subhead;
  final List<FanPlan> plans;
  final List<FanPack> packs;

  String get headlineText => localizedMap(headline);
  String get subheadText => localizedMap(subhead);

  bool get isHidden => visibility == 'hidden';

  factory FanCatalog.fromJson(Map<String, dynamic> json) {
    final plans = json['plans'];
    final packs = json['packs'];
    return FanCatalog(
      visibility: '${json['visibility'] ?? 'public'}',
      headline: json['headline'],
      subhead: json['subhead'],
      plans: plans is List
          ? plans
                .whereType<Map<String, dynamic>>()
                .map(FanPlan.fromJson)
                .toList(growable: false)
          : const [],
      packs: packs is List
          ? packs
                .whereType<Map<String, dynamic>>()
                .map(FanPack.fromJson)
                .toList(growable: false)
          : const [],
    );
  }
}

class FanMembership {
  const FanMembership({
    required this.id,
    required this.invoiceId,
    required this.sku,
    required this.name,
    required this.type,
    required this.featured,
    required this.mega,
    required this.multiplier,
    required this.maxArtists,
    required this.yearly,
    required this.currency,
    required this.method,
    required this.country,
    required this.countryName,
    required this.phone,
    required this.artists,
    required this.status,
    required this.daysLeft,
    required this.expired,
    required this.base,
    required this.tax,
    required this.total,
    this.startedAt,
    this.expiresAt,
    this.cancelledAt,
  });

  final String id;
  final String invoiceId;
  final String sku;
  final String name;
  final String type;
  final bool featured;
  final bool mega;
  final int multiplier;
  final int maxArtists;
  final bool yearly;
  final String currency;
  final String method;
  final String country;
  final String countryName;
  final String phone;
  final List<FanCheckoutArtist> artists;
  final String status;
  final int daysLeft;
  final bool expired;
  final double base;
  final double tax;
  final double total;
  final DateTime? startedAt;
  final DateTime? expiresAt;
  final DateTime? cancelledAt;

  bool get isPlan => type != 'pack' && planRank(sku) > 0;
  bool get isActive => !expired && status != 'cancelled' && cancelledAt == null;

  factory FanMembership.fromJson(Map<String, dynamic> json) {
    final artists = json['artists'];
    return FanMembership(
      id: '${json['id'] ?? ''}',
      invoiceId: '${json['invoiceId'] ?? ''}',
      sku: '${json['sku'] ?? ''}'.toUpperCase(),
      name: '${json['name'] ?? json['sku'] ?? ''}',
      type: '${json['type'] ?? 'plan'}',
      featured: json['featured'] == true,
      mega: json['mega'] == true || '${json['sku'] ?? ''}'.toUpperCase() == 'MEGA',
      multiplier: _asInt(json['multiplier'], 1),
      maxArtists: _asInt(json['maxArtists']),
      yearly: json['yearly'] == true,
      currency: '${json['currency'] ?? 'USD'}',
      method: '${json['method'] ?? ''}',
      country: '${json['country'] ?? ''}',
      countryName: '${json['countryName'] ?? ''}',
      phone: '${json['phone'] ?? ''}',
      artists: artists is List
          ? artists
                .whereType<Map<String, dynamic>>()
                .map(FanCheckoutArtist.fromJson)
                .toList(growable: false)
          : const [],
      status: '${json['status'] ?? ''}',
      daysLeft: _asInt(json['daysLeft']),
      expired: json['expired'] == true,
      base: _asDouble(json['base']),
      tax: _asDouble(json['tax']),
      total: _asDouble(json['total']),
      startedAt: _asDate(json['startedAt']),
      expiresAt: _asDate(json['expiresAt']),
      cancelledAt: _asDate(json['cancelledAt']),
    );
  }
}

class FanMePayload {
  const FanMePayload({
    required this.membership,
    required this.purchases,
    required this.adsFree,
    required this.packDiscount,
  });

  final FanMembership? membership;
  final List<FanMembership> purchases;
  final bool adsFree;
  final double packDiscount;

  factory FanMePayload.fromJson(Map<String, dynamic> json) {
    final membership = json['membership'];
    final purchases = json['purchases'];
    return FanMePayload(
      membership: membership is Map<String, dynamic>
          ? FanMembership.fromJson(membership)
          : null,
      purchases: purchases is List
          ? purchases
                .whereType<Map<String, dynamic>>()
                .map(FanMembership.fromJson)
                .toList(growable: false)
          : const [],
      adsFree: json['adsFree'] == true,
      packDiscount: _asDouble(json['packDiscount']),
    );
  }
}

class PaypalOrder {
  const PaypalOrder({
    required this.orderId,
    required this.approveUrl,
    required this.mode,
  });

  final String orderId;
  final String approveUrl;
  final String mode;

  factory PaypalOrder.fromJson(Map<String, dynamic> json) {
    return PaypalOrder(
      orderId: '${json['orderId'] ?? ''}',
      approveUrl: '${json['approveUrl'] ?? ''}',
      mode: '${json['mode'] ?? 'sandbox'}',
    );
  }
}

class ArtistSupporter {
  const ArtistSupporter({
    required this.id,
    required this.userId,
    required this.name,
    required this.photo,
    required this.sku,
    required this.tier,
    required this.points,
    this.pinnedUntil,
  });

  final String id;
  final String userId;
  final String name;
  final String photo;
  final String sku;
  final String tier;
  final int points;
  final DateTime? pinnedUntil;

  factory ArtistSupporter.fromJson(Map<String, dynamic> json) {
    return ArtistSupporter(
      id: '${json['id'] ?? ''}',
      userId: '${json['userId'] ?? ''}',
      name: '${json['name'] ?? 'Fan'}'.trim().isEmpty
          ? 'Fan'
          : '${json['name'] ?? 'Fan'}'.trim(),
      photo: '${json['photo'] ?? ''}'.trim(),
      sku: '${json['sku'] ?? ''}'.toUpperCase(),
      tier: '${json['tier'] ?? json['sku'] ?? ''}',
      points: _asInt(json['points']),
      pinnedUntil: _asDate(json['pinnedUntil']),
    );
  }
}

class PrivacyPolicy {
  const PrivacyPolicy({
    required this.title,
    required this.intro,
    required this.bodyHtml,
    this.updatedAt,
  });

  final String title;
  final String intro;
  final String bodyHtml;
  final DateTime? updatedAt;

  factory PrivacyPolicy.fromJson(Map<String, dynamic> json) {
    return PrivacyPolicy(
      title: '${json['title'] ?? ''}'.trim(),
      intro: '${json['intro'] ?? ''}'.trim(),
      bodyHtml: '${json['bodyHtml'] ?? json['body'] ?? ''}',
      updatedAt: _asDate(json['updatedAt']),
    );
  }
}

int _asInt(Object? value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse('$value') ?? fallback;
}

double _asDouble(Object? value, [double fallback = 0]) {
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse('$value') ?? fallback;
}

DateTime? _asDate(Object? value) {
  if (value is DateTime) return value;
  if (value is String && value.isNotEmpty) return DateTime.tryParse(value);
  return null;
}

String _groupThousands(String digits, String separator) {
  final negative = digits.startsWith('-');
  final raw = negative ? digits.substring(1) : digits;
  final buffer = StringBuffer();
  for (var i = 0; i < raw.length; i++) {
    final fromEnd = raw.length - i;
    if (i > 0 && fromEnd % 3 == 0) buffer.write(separator);
    buffer.write(raw[i]);
  }
  return '${negative ? '-' : ''}$buffer';
}

String formatStoreCount(int value) {
  final separator = AppLocale.instance.code == 'en' ? ',' : '.';
  return _groupThousands('$value', separator);
}

String formatStoreMoney(double amount, String currency) {
  if (currency.toUpperCase() == 'COP') {
    return '\$${_groupThousands('${amount.round()}', '.')}';
  }
  final fixed = amount.toStringAsFixed(2);
  final parts = fixed.split('.');
  return '\$${_groupThousands(parts[0], ',')}.${parts[1]}';
}

double storeItemPrice({
  required bool isPack,
  required bool yearly,
  required String currency,
  FanPlan? plan,
  FanPack? pack,
}) {
  final cop = currency.toUpperCase() == 'COP';
  if (isPack && pack != null) {
    return cop ? pack.cop : pack.usd;
  }
  if (plan == null) return 0;
  if (yearly) {
    return cop ? plan.copYTotal : plan.usdYTotal;
  }
  return cop ? plan.copM : plan.usdM;
}

double storeDisplayPrice({
  required bool isPack,
  required bool yearly,
  required String currency,
  FanPlan? plan,
  FanPack? pack,
}) {
  final cop = currency.toUpperCase() == 'COP';
  if (isPack && pack != null) {
    return cop ? pack.cop : pack.usd;
  }
  if (plan == null) return 0;
  if (yearly) {
    return cop ? plan.copY : plan.usdY;
  }
  return cop ? plan.copM : plan.usdM;
}
