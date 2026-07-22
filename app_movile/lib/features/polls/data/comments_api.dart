import '../../../core/api/api_client.dart';
import 'poll_comment.dart';

class CommentsApi {
  CommentsApi(this._client);

  final ApiClient _client;

  Future<List<PollComment>> list(String pollId, {int limit = 100}) async {
    final payload = await _client.request(
      '/polls/${Uri.encodeComponent(pollId)}/comments?limit=$limit',
    );

    if (payload is! List) {
      return const [];
    }

    return payload
        .whereType<Map>()
        .map((row) => PollComment.fromJson(Map<String, dynamic>.from(row)))
        .where((c) => c.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<PollComment> create(
    String pollId, {
    String text = '',
    Map<String, String>? gif,
  }) async {
    final payload = await _client.request(
      '/polls/${Uri.encodeComponent(pollId)}/comments',
      method: 'POST',
      token: _client.accessToken,
      body: {
        'text': text,
        if (gif != null) 'gif': gif,
      },
    );

    return PollComment.fromJson(payload as Map<String, dynamic>);
  }

  Future<void> remove(String pollId, String commentId) async {
    await _client.request(
      '/polls/${Uri.encodeComponent(pollId)}/comments/${Uri.encodeComponent(commentId)}',
      method: 'DELETE',
      token: _client.accessToken,
    );
  }
}
