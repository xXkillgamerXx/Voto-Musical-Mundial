import '../../../core/api/api_client.dart';
import 'artist.dart';

class ArtistsApi {
  ArtistsApi(this._client);

  final ApiClient _client;

  static const _rankingTtl = Duration(minutes: 5);
  static const _artistTtl = Duration(minutes: 10);

  Future<List<Artist>> getPopularityRanking({
    int limit = 50,
    bool forceRefresh = false,
  }) async {
    final payload = await _client.cachedRequest(
      '/artists/ranking/popularity?limit=$limit',
      ttl: _rankingTtl,
      forceRefresh: forceRefresh,
    );

    return _mapArtists(payload);
  }

  Future<Artist> getArtist(String id, {bool forceRefresh = false}) async {
    final payload = await _client.cachedRequest(
      '/artists/${Uri.encodeComponent(id)}',
      ttl: _artistTtl,
      forceRefresh: forceRefresh,
    );
    return Artist.fromJson(payload as Map<String, dynamic>);
  }

  Future<ArtistFollowStatus> getFollowStatus(String id) async {
    final payload = await _client.request(
      '/artists/${Uri.encodeComponent(id)}/follow',
      token: _client.accessToken,
    );

    return ArtistFollowStatus.fromJson(payload as Map<String, dynamic>);
  }

  Future<ArtistFollowStatus> follow(String id) async {
    final payload = await _client.request(
      '/artists/${Uri.encodeComponent(id)}/follow',
      method: 'POST',
      body: const {},
      token: _client.accessToken,
    );

    return ArtistFollowStatus.fromJson(payload as Map<String, dynamic>);
  }

  Future<ArtistFollowStatus> unfollow(String id) async {
    final payload = await _client.request(
      '/artists/${Uri.encodeComponent(id)}/follow',
      method: 'DELETE',
      token: _client.accessToken,
    );

    return ArtistFollowStatus.fromJson(payload as Map<String, dynamic>);
  }

  List<Artist> _mapArtists(dynamic payload) {
    if (payload is! List) {
      return const [];
    }

    return payload
        .whereType<Map<String, dynamic>>()
        .map(Artist.fromJson)
        .toList(growable: false);
  }
}

class ArtistFollowStatus {
  const ArtistFollowStatus({
    required this.artistId,
    required this.following,
    required this.followersCount,
  });

  final String artistId;
  final bool following;
  final int followersCount;

  factory ArtistFollowStatus.fromJson(Map<String, dynamic> json) {
    return ArtistFollowStatus(
      artistId: '${json['artistId'] ?? ''}',
      following: json['following'] == true,
      followersCount: _toInt(json['followersCount']),
    );
  }
}

int _toInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse('$value') ?? 0;
}
