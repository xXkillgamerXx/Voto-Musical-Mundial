import '../../../core/api/api_client.dart';

class ReportsApi {
  ReportsApi(this._client);

  final ApiClient _client;

  Future<String> create({
    required String targetType,
    required String targetId,
    required String reason,
    String details = '',
    String? reportedUserId,
    String? pollId,
  }) async {
    final payload = await _client.request(
      '/reports',
      method: 'POST',
      token: _client.accessToken,
      body: {
        'targetType': targetType,
        'targetId': targetId,
        'reason': reason,
        if (details.trim().isNotEmpty) 'details': details.trim(),
        if (reportedUserId != null && reportedUserId.isNotEmpty)
          'reportedUserId': reportedUserId,
        if (pollId != null && pollId.isNotEmpty) 'pollId': pollId,
      },
    );
    if (payload is Map<String, dynamic>) {
      final message = '${payload['message'] ?? ''}'.trim();
      if (message.isNotEmpty) return message;
    }
    return '';
  }
}
