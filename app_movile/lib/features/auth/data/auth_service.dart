import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_config.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_models.dart';
import '../../../core/auth/auth_session.dart';
import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/tr.dart';

class AuthService {
  AuthService(this._session) : _client = ApiClient(_session);

  final AuthSession _session;
  final ApiClient _client;
  bool _isGoogleInitialized = false;

  AuthSession get session => _session;
  ApiClient get client => _client;

  static String friendlyError(Object error) {
    if (error is ApiException) {
      return error.message;
    }

    return tr('data.actionFailed');
  }

  Future<ApiAuth> login({
    required String identifier,
    required String password,
  }) async {
    final payload = await _client.request(
      '/auth/login',
      method: 'POST',
      body: {
        'identifier': identifier.trim().toLowerCase(),
        'password': password,
      },
      retryOnUnauthorized: false,
    );

    final auth = ApiAuth.fromJson(payload as Map<String, dynamic>);
    await _session.setAuth(auth);
    return auth;
  }

  Future<ApiAuth> register({
    required String email,
    required String password,
    required String username,
    required String displayName,
    String? referralCode,
    Map<String, dynamic>? metadata,
  }) async {
    final payload = await _client.request(
      '/auth/register',
      method: 'POST',
      body: {
        'email': email.trim().toLowerCase(),
        'password': password,
        'username': username.trim().toLowerCase(),
        'displayName': displayName.trim(),
        'locale': AppLocale.instance.code == 'es' ? 'es' : 'en',
        if (referralCode != null && referralCode.trim().isNotEmpty)
          'referralCode': referralCode.trim().toLowerCase(),
        if (metadata != null) 'metadata': {
          ...metadata,
          'locale': AppLocale.instance.code == 'es' ? 'es' : 'en',
        },
      },
      retryOnUnauthorized: false,
    );

    final auth = ApiAuth.fromJson(payload as Map<String, dynamic>);
    await _session.setAuth(auth);
    return auth;
  }

  Future<void> requestPasswordReset({required String email}) async {
    await _client.request(
      '/auth/forgot-password',
      method: 'POST',
      body: {
        'email': email.trim().toLowerCase(),
        'locale': AppLocale.instance.code == 'es' ? 'es' : 'en',
      },
      retryOnUnauthorized: false,
    );
  }

  Future<ApiAuth> signInWithGoogle({String? referralCode}) async {
    final googleSignIn = GoogleSignIn.instance;

    if (!_isGoogleInitialized) {
      await googleSignIn.initialize(
        // En iOS el clientId es obligatorio; en Android se toma de google-services.json.
        clientId: (!kIsWeb && Platform.isIOS)
            ? ApiConfig.googleIosClientId
            : null,
        serverClientId: ApiConfig.googleServerClientId,
      );
      _isGoogleInitialized = true;
    }

    try {
      final googleUser = await googleSignIn.authenticate();
      final googleAuth = googleUser.authentication;
      final idToken = googleAuth.idToken;

      if (idToken == null || idToken.isEmpty) {
        throw ApiException(tr('data.googleTokenFailed'));
      }

      final payload = await _client.request(
        '/auth/google',
        method: 'POST',
        body: {
          'credential': idToken,
          'locale': AppLocale.instance.code == 'es' ? 'es' : 'en',
          if (referralCode != null && referralCode.trim().isNotEmpty)
            'referralCode': referralCode.trim().toLowerCase(),
        },
        retryOnUnauthorized: false,
      );

      final auth = ApiAuth.fromJson(payload as Map<String, dynamic>);
      await _session.setAuth(auth);
      return auth;
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled) {
        throw ApiException(tr('auth.cancel'));
      }
      throw ApiException(
        error.description?.trim().isNotEmpty == true
            ? error.description!
            : tr('data.googleTokenFailed'),
      );
    }
  }

  Future<ApiAuth> signInWithApple({String? referralCode}) async {
    if (kIsWeb || !Platform.isIOS) {
      throw ApiException(tr('auth.appleNotAvailable'));
    }

    final available = await SignInWithApple.isAvailable();
    if (!available) {
      throw ApiException(tr('auth.appleNotAvailable'));
    }

    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );

      final idToken = credential.identityToken;
      if (idToken == null || idToken.isEmpty) {
        throw ApiException(tr('auth.appleTokenFailed'));
      }

      final fullName = [
        credential.givenName,
        credential.familyName,
      ].whereType<String>().map((part) => part.trim()).where((part) => part.isNotEmpty).join(' ');

      final payload = await _client.request(
        '/auth/apple',
        method: 'POST',
        body: {
          'credential': idToken,
          'locale': AppLocale.instance.code == 'es' ? 'es' : 'en',
          if (fullName.isNotEmpty) 'fullName': fullName,
          if (referralCode != null && referralCode.trim().isNotEmpty)
            'referralCode': referralCode.trim().toLowerCase(),
        },
        retryOnUnauthorized: false,
      );

      final auth = ApiAuth.fromJson(payload as Map<String, dynamic>);
      await _session.setAuth(auth);
      return auth;
    } on SignInWithAppleAuthorizationException catch (error) {
      if (error.code == AuthorizationErrorCode.canceled) {
        throw ApiException(tr('auth.cancel'));
      }
      throw ApiException(
        error.message.trim().isNotEmpty
            ? error.message
            : tr('auth.appleTokenFailed'),
      );
    }
  }

  Future<ApiUser?> getMe() async {
    final token = _session.auth?.accessToken;
    if (token == null || token.isEmpty) {
      return null;
    }

    try {
      final payload = await _client.request('/users/me', token: token);
      final userJson = payload is Map<String, dynamic>
          ? (payload['user'] as Map<String, dynamic>? ?? payload)
          : <String, dynamic>{};
      final user = ApiUser.fromJson(userJson);
      await _session.updateUser(user);
      return user;
    } on ApiException catch (error) {
      if (error.statusCode == 401) {
        return null;
      }
      rethrow;
    }
  }

  Future<void> signOut() async {
    try {
      final googleSignIn = GoogleSignIn.instance;
      if (_isGoogleInitialized) {
        await googleSignIn.signOut();
      }
    } catch (_) {
      // Ignore Google sign-out errors.
    }

    await _session.signOut();
  }
}
