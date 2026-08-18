import '../../../core/api/api_client.dart';
import 'mission.dart';

class MissionsApi {
  MissionsApi(this._client);

  final ApiClient _client;

  static const _publicTtl = Duration(minutes: 10);
  static const _authTtl = Duration(minutes: 2);

  Future<List<Mission>> getMissions({bool forceRefresh = false}) async {
    try {
      final token = _client.accessToken;
      // Sin `lang`: la respuesta trae los dos idiomas y `Mission` elige al
      // pintar, así el caché sirve para cualquier idioma.
      final path = token != null && token.isNotEmpty
          ? '/missions/me'
          : '/missions';
      final payload = await _client.cachedRequest(
        path,
        ttl: token != null && token.isNotEmpty ? _authTtl : _publicTtl,
        token: token,
        forceRefresh: forceRefresh,
      );
      return _mapMissions(payload);
    } catch (_) {
      return const [];
    }
  }

  Future<Map<String, dynamic>?> completeMission(String missionId) async {
    final token = _client.accessToken;
    if (token == null || token.isEmpty) {
      return null;
    }

    final payload = await _client.request(
      '/missions/${Uri.encodeComponent(missionId)}/complete',
      method: 'POST',
      token: token,
    );

    if (payload is Map<String, dynamic>) {
      return payload;
    }

    return null;
  }

  List<Mission> _mapMissions(dynamic payload) {
    if (payload is! List) {
      return const [];
    }

    return payload
        .whereType<Map<String, dynamic>>()
        .map(Mission.fromJson)
        .where((mission) => mission.title.isNotEmpty)
        .toList(growable: false);
  }
}
