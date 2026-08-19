import 'package:google_sign_in/google_sign_in.dart';

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
        if (referralCode != null && referralCode.trim().isNotEmpty)
          'referralCode': referralCode.trim().toLowerCase(),
        if (metadata != null) 'metadata': metadata,
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
        'locale': AppLocale.instance.code == 'en' ? 'en' : 'es',
      },
      retryOnUnauthorized: false,
    );
  }

  Future<ApiAuth> signInWithGoogle({String? referralCode}) async {
    final googleSignIn = GoogleSignIn.instance;

    if (!_isGoogleInitialized) {
      await googleSignIn.initialize(
        serverClientId: ApiConfig.googleServerClientId,
      );
      _isGoogleInitialized = true;
    }

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
        if (referralCode != null && referralCode.trim().isNotEmpty)
          'referralCode': referralCode.trim().toLowerCase(),
      },
      retryOnUnauthorized: false,
    );

    final auth = ApiAuth.fromJson(payload as Map<String, dynamic>);
    await _session.setAuth(auth);
    return auth;
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
