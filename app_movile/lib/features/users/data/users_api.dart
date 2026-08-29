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

  /// Sube una imagen (avatar o banner) y devuelve la URL absoluta.
  Future<String> uploadImage(String filePath) async {
    final payload = await _client.uploadFile(
      '/users/me/uploads',
      filePath: filePath,
      field: 'file',
      token: _client.accessToken,
    );

    final url = '${payload['url'] ?? payload['path'] ?? ''}'.trim();
    return url;
  }

  /// Actualiza el perfil del usuario actual. Solo envía los campos no nulos.
  Future<UserProfile> updateProfile({
    String? displayName,
    String? username,
    String? photoUrl,
    String? banner,
    String? bio,
    String? country,
    bool? emailCampaigns,
  }) async {
    final body = <String, dynamic>{};
    if (displayName != null) {
      body['displayName'] = displayName;
      body['name'] = displayName;
    }
    if (username != null) body['username'] = username;
    if (photoUrl != null) body['photoURL'] = photoUrl;
    if (banner != null) body['banner'] = banner;
    if (bio != null) body['bio'] = bio;
    if (country != null) body['country'] = country;
    if (emailCampaigns != null) body['emailCampaigns'] = emailCampaigns;

    final payload = await _client.request(
      '/users/me',
      method: 'PATCH',
      body: body,
      token: _client.accessToken,
    );

    final userJson = payload is Map<String, dynamic>
        ? (payload['user'] as Map<String, dynamic>? ?? payload)
        : <String, dynamic>{};

    return UserProfile.fromJson(userJson);
  }
}
