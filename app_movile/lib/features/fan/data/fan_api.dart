import '../../../core/api/api_client.dart';
import '../../../core/fan/fan_perks.dart';
import '../../../core/i18n/app_locale.dart';
import 'fan_models.dart';

class FanApi {
  FanApi(this._client);

  final ApiClient _client;

  Future<FanCatalog> getCatalog() async {
    final payload = await _client.request('/fan-store');
    if (payload is Map<String, dynamic>) {
      return FanCatalog.fromJson(payload);
    }
    return const FanCatalog(
      visibility: 'hidden',
      headline: '',
      subhead: '',
      plans: [],
      packs: [],
    );
  }

  Future<FanMePayload> getMe({bool applyPerks = true}) async {
    final payload = await _client.request(
      '/fan-store/me',
      token: _client.accessToken,
    );
    final me = FanMePayload.fromJson(
      payload is Map<String, dynamic> ? payload : const {},
    );
    if (applyPerks) {
      FanPerks.instance.apply(me);
    }
    return me;
  }

  Future<PaypalOrder> createPaypalOrder({
    required String sku,
    required bool yearly,
    required String currency,
    required String country,
    required String countryName,
    String phone = '',
    List<FanCheckoutArtist> artists = const [],
  }) async {
    final payload = await _client.request(
      '/fan-store/paypal/order',
      method: 'POST',
      token: _client.accessToken,
      body: {
        'sku': sku,
        'yearly': yearly,
        'currency': currency,
        'country': country,
        'countryName': countryName,
        if (phone.trim().isNotEmpty) 'phone': phone.trim(),
        'method': 'paypal',
        if (artists.isNotEmpty)
          'artists': artists.map((artist) => artist.toJson()).toList(),
      },
    );
    return PaypalOrder.fromJson(
      payload is Map<String, dynamic> ? payload : const {},
    );
  }

  Future<FanMembership> capturePaypalOrder(String orderId) async {
    final payload = await _client.request(
      '/fan-store/paypal/capture',
      method: 'POST',
      token: _client.accessToken,
      body: {'orderId': orderId},
    );
    await getMe();
    return FanMembership.fromJson(
      payload is Map<String, dynamic> ? payload : const {},
    );
  }

  Future<FanMembership> cancelPurchase(String id) async {
    final payload = await _client.request(
      '/fan-store/purchases/${Uri.encodeComponent(id)}/cancel',
      method: 'POST',
      token: _client.accessToken,
    );
    await getMe();
    return FanMembership.fromJson(
      payload is Map<String, dynamic> ? payload : const {},
    );
  }

  Future<List<ArtistSupporter>> listSupporters(String artistId) async {
    final payload = await _client.request(
      '/artists/${Uri.encodeComponent(artistId)}/supporters',
    );
    if (payload is! List) return const [];
    return payload
        .whereType<Map<String, dynamic>>()
        .map(ArtistSupporter.fromJson)
        .toList(growable: false);
  }

  Future<PrivacyPolicy> getPrivacy() async {
    final lang = AppLocale.instance.code == 'es' ? 'es' : 'en';
    final payload = await _client.request('/privacy?lang=$lang');
    return PrivacyPolicy.fromJson(
      payload is Map<String, dynamic> ? payload : const {},
    );
  }
}
