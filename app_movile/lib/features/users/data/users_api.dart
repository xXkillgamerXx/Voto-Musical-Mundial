import '../../../core/api/api_client.dart';
import 'user_profile.dart';

class UsersApi {
  UsersApi(this._client);

  final ApiClient _client;

  Future<UserProfile> getPublicProfile(String username) async {
    final payload = await _client.request(
      '/users/${Uri.encodeComponent(username.trim().toLowerCase())}',
    );

    return UserProfile.fromJson(payload as Map<String, dynamic>);
  }

  Future<UserProfile> getMeProfile() async {
    final payload = await _client.request(
      '/users/me',
      token: _client.accessToken,
    );

    final userJson = payload is Map<String, dynamic>
        ? (payload['user'] as Map<String, dynamic>? ?? payload)
        : <String, dynamic>{};

    return UserProfile.fromJson(userJson);
  }
}
