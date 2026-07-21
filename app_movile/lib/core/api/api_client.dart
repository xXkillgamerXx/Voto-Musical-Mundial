import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../auth/auth_models.dart';
import '../auth/auth_session.dart';
import '../cache/response_cache.dart';
import '../i18n/tr.dart';
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

  /// Sube un archivo con `multipart/form-data`. Devuelve el JSON de
  /// respuesta (p.ej. `{ "url": "...", "path": "..." }`).
  Future<Map<String, dynamic>> uploadFile(
    String path, {
    required String filePath,
    String field = 'file',
    String? token,
    bool retryOnUnauthorized = true,
  }) async {
    Future<http.Response> send(String? authToken) async {
      final uri = Uri.parse('$baseUrl$path');
      final req = http.MultipartRequest('POST', uri);
      if (authToken != null && authToken.isNotEmpty) {
        req.headers['Authorization'] = 'Bearer $authToken';
      }
      req.files.add(
        await http.MultipartFile.fromPath(
          field,
          filePath,
          contentType: _mediaTypeFor(filePath),
        ),
      );
      final streamed = await req.send();
      return http.Response.fromStream(streamed);
    }

    http.Response response = await send(token);
    dynamic payload = _decodeBody(response);

    if (response.statusCode == 401 && retryOnUnauthorized) {
      final refreshed = await _refreshStoredAuth();
      if (refreshed?.accessToken.isNotEmpty == true) {
        response = await send(refreshed!.accessToken);
        payload = _decodeBody(response);
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = _errorMessage(payload);
      if (response.statusCode == 401) {
        await _session.signOut();
      }
      throw ApiException(
        message,
        statusCode: response.statusCode,
        payload: payload,
      );
    }

    return payload is Map<String, dynamic> ? payload : <String, dynamic>{};
  }

  MediaType? _mediaTypeFor(String filePath) {
    final lower = filePath.toLowerCase();
    if (lower.endsWith('.png')) return MediaType('image', 'png');
    if (lower.endsWith('.webp')) return MediaType('image', 'webp');
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      return MediaType('image', 'jpeg');
    }
    return null;
  }

  Future<dynamic> cachedRequest(
    String path, {
    Duration ttl = const Duration(minutes: 5),
    bool forceRefresh = false,
    String? token,
    bool retryOnUnauthorized = true,
  }) async {
    final cacheKey = _cacheKey(path, token);
    final cache = ResponseCache.instanceOrNull;

    if (!forceRefresh && cache != null) {
      final fresh = cache.readFresh(cacheKey, ttl);
      if (fresh != null) {
        return fresh;
      }

      final stale = cache.readAny(cacheKey);
      if (stale != null) {
        unawaited(
          _fetchAndCache(
            path,
            cacheKey: cacheKey,
            token: token,
            retryOnUnauthorized: retryOnUnauthorized,
          ),
        );
        return stale;
      }
    }

    return _fetchAndCache(
      path,
      cacheKey: cacheKey,
      token: token,
      retryOnUnauthorized: retryOnUnauthorized,
    );
  }

  Future<dynamic> _fetchAndCache(
    String path, {
    required String cacheKey,
    String? token,
    bool retryOnUnauthorized = true,
  }) async {
    final payload = await request(
      path,
      token: token,
      retryOnUnauthorized: retryOnUnauthorized,
    );

    await ResponseCache.instanceOrNull?.write(cacheKey, payload);
    return payload;
  }

  String _cacheKey(String path, String? token) {
    if (token == null || token.isEmpty) {
      return path;
    }

    return '$path::auth';
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

    return tr('data.requestFailed');
  }

  String? get accessToken => _session.auth?.accessToken;
}
