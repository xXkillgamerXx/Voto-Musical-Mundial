import '../../../core/api/api_client.dart';
import 'poll.dart';

class PollsApi {
  PollsApi(this._client);

  final ApiClient _client;

  static const _pollListTtl = Duration(seconds: 45);
  static const _livePollsTtl = Duration(seconds: 30);
  static const _liveResultsTtl = Duration(seconds: 30);
  static const _closedResultsTtl = Duration(hours: 24);

  Future<List<Poll>> getPolls({
    int limit = 100,
    bool forceRefresh = false,
  }) async {
    final payload = await _client.cachedRequest(
      '/polls?limit=$limit',
      ttl: _pollListTtl,
      forceRefresh: forceRefresh,
    );
    return _mapPolls(payload);
  }

  Future<List<Poll>> getLivePolls({
    int limit = 12,
    bool forceRefresh = false,
  }) async {
    final payload = await _client.cachedRequest(
      '/polls/live?limit=$limit',
      ttl: _livePollsTtl,
      forceRefresh: forceRefresh,
    );
    return _mapPolls(payload);
  }

  Future<Poll> getPoll(String id, {bool forceRefresh = false}) async {
    final path = '/polls/${Uri.encodeComponent(id)}';
    final payload = await _client.cachedRequest(
      path,
      ttl: const Duration(seconds: 20),
      forceRefresh: forceRefresh,
    );
    return Poll.fromJson(payload as Map<String, dynamic>);
  }

  Future<PollResults> getPollResults(
    String pollId, {
    String? roundId,
    Duration? cacheTtl,
    bool forceRefresh = false,
  }) async {
    final query = roundId != null && roundId.isNotEmpty
        ? '?roundId=${Uri.encodeComponent(roundId)}'
        : '';
    final path = '/polls/${Uri.encodeComponent(pollId)}/results$query';
    final payload = await _client.cachedRequest(
      path,
      ttl: cacheTtl ?? _liveResultsTtl,
      forceRefresh: forceRefresh,
    );

    return PollResults.fromJson(payload as Map<String, dynamic>);
  }

  Duration resultsTtlForPoll(Poll poll) {
    if (poll.status == 'closed') {
      return _closedResultsTtl;
    }

    return _liveResultsTtl;
  }

  List<Poll> _mapPolls(dynamic payload) {
    if (payload is! List) {
      return const [];
    }

    return payload
        .whereType<Map<String, dynamic>>()
        .map(Poll.fromJson)
        .toList(growable: false);
  }
}
