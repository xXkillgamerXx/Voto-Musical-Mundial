import 'dart:convert';

import 'package:http/http.dart' as http;

import '../auth/auth_models.dart';
import '../auth/auth_session.dart';
import 'api_config.dart';
import 'api_exception.dart';

class ApiClient {
  ApiClient(this._session);

  final AuthSession _session;
  Future<ApiAuth?>? _refreshFuture;

  String get baseUrl => ApiConfig.baseUrl;

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    String? token,
    bool retryOnUnauthorized = true,
  }) async {
    http.Response response = await _send(
      path,
      method: method,
      body: body,
      token: token,
    );
    dynamic payload = _decodeBody(response);

    if (response.statusCode == 401 &&
        retryOnUnauthorized &&
        !path.startsWith('/auth/')) {
      final refreshed = await _refreshStoredAuth();

      if (refreshed?.accessToken.isNotEmpty == true) {
        response = await _send(
          path,
          method: method,
          body: body,
          token: refreshed!.accessToken,
        );
        payload = _decodeBody(response);
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = _errorMessage(payload);
      if (response.statusCode == 401 && !path.startsWith('/auth/')) {
        await _session.signOut();
      }
      throw ApiException(message, statusCode: response.statusCode, payload: payload);
    }

    return payload;
  }

  Future<http.Response> _send(
    String path, {
    required String method,
    Map<String, dynamic>? body,
    String? token,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };

    switch (method.toUpperCase()) {
      case 'POST':
        return http.post(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        );
      case 'PATCH':
        return http.patch(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        );
      case 'PUT':
        return http.put(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        );
      case 'DELETE':
        return http.delete(uri, headers: headers);
      default:
        return http.get(uri, headers: headers);
    }
  }

  Future<ApiAuth?> _refreshStoredAuth() async {
    final current = _session.auth;
    if (current?.refreshToken.isEmpty != false) {
      return null;
    }

    _refreshFuture ??= _performRefresh(current!.refreshToken);
    try {
      return await _refreshFuture;
    } finally {
      _refreshFuture = null;
    }
  }

  Future<ApiAuth?> _performRefresh(String refreshToken) async {
    try {
      final payload = await request(
        '/auth/refresh',
        method: 'POST',
        body: {'refreshToken': refreshToken},
        retryOnUnauthorized: false,
      );
      final auth = ApiAuth.fromJson(payload as Map<String, dynamic>);
      await _session.setAuth(auth);
      return auth;
    } catch (_) {
      await _session.signOut();
      return null;
    }
  }

  dynamic _decodeBody(http.Response response) {
    if (response.body.isEmpty) {
      return null;
    }

    try {
      return jsonDecode(response.body);
    } catch (_) {
      return null;
    }
  }

  String _errorMessage(dynamic payload) {
    if (payload is Map<String, dynamic>) {
      final message = payload['message'];
      if (message is String && message.trim().isNotEmpty) {
        return message;
      }

      final nested = payload['error'];
      if (nested is Map<String, dynamic>) {
        final nestedMessage = nested['message'];
        if (nestedMessage is String && nestedMessage.trim().isNotEmpty) {
          return nestedMessage;
        }
      }

      if (message is List && message.isNotEmpty) {
        return message.map((item) => '$item').join('\n');
      }
    }

    return 'No se pudo completar la solicitud.';
  }

  String? get accessToken => _session.auth?.accessToken;
}
