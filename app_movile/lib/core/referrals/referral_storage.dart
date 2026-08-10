import 'package:shared_preferences/shared_preferences.dart';

/// Guarda el código de invitación (`?ref=`) que llega por deep link hasta que el
/// usuario termina de registrarse, que puede ser varios minutos después.
class ReferralStorage {
  static const _codeKey = 'vmm_pending_referral_code';
  static const _capturedAtKey = 'vmm_pending_referral_at';
  static const _maxAge = Duration(days: 30);

  static final RegExp _validCode = RegExp(r'^[a-z0-9_.-]{3,40}$');

  static String? normalize(String? raw) {
    final code = (raw ?? '').trim().toLowerCase();
    return _validCode.hasMatch(code) ? code : null;
  }

  /// Extrae `ref` (o alias) de un deep link y lo guarda si es válido.
  static Future<String?> captureFromUri(Uri uri) async {
    final params = uri.queryParameters;
    final code = normalize(params['ref'] ?? params['referral'] ?? params['referralCode']);

    if (code == null) {
      return null;
    }

    await save(code);
    return code;
  }

  static Future<void> save(String code) async {
    final normalized = normalize(code);
    if (normalized == null) {
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_codeKey, normalized);
    await prefs.setInt(_capturedAtKey, DateTime.now().millisecondsSinceEpoch);
  }

  static Future<String?> read() async {
    final prefs = await SharedPreferences.getInstance();
    final code = normalize(prefs.getString(_codeKey));

    if (code == null) {
      return null;
    }

    final capturedAt = prefs.getInt(_capturedAtKey) ?? 0;
    final age = DateTime.now().millisecondsSinceEpoch - capturedAt;

    if (capturedAt <= 0 || age > _maxAge.inMilliseconds) {
      await clear();
      return null;
    }

    return code;
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_codeKey);
    await prefs.remove(_capturedAtKey);
  }
}
