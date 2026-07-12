import '../../../core/api/api_client.dart';
import 'app_notification.dart';

class NotificationsApi {
  NotificationsApi(this._client);

  final ApiClient _client;

  Future<List<AppNotification>> getNotifications({int limit = 40}) async {
    final payload = await _client.request(
      '/notifications?limit=$limit',
      token: _client.accessToken,
    );

    if (payload is! List) {
      return const [];
    }

    return payload
        .whereType<Map<String, dynamic>>()
        .map(AppNotification.fromJson)
        .where((item) => item.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<void> markRead(String id) async {
    await _client.request(
      '/notifications/${Uri.encodeComponent(id)}/read',
      method: 'PATCH',
      token: _client.accessToken,
    );
  }

  Future<void> registerPushToken({
    required String token,
    required String platform,
    String permission = 'granted',
  }) async {
    await _client.request(
      '/notifications/push-token',
      method: 'POST',
      token: _client.accessToken,
      body: {
        'token': token,
        'platform': platform,
        'permission': permission,
      },
    );
  }

  Future<void> unregisterPushToken(String token) async {
    await _client.request(
      '/notifications/push-token',
      method: 'DELETE',
      token: _client.accessToken,
      body: {'token': token},
    );
  }
}
