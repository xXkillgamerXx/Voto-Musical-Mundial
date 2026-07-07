import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'auth_models.dart';

class AuthStorage {
  AuthStorage._();

  static const _storageKey = 'vmm_api_auth';

  static Future<ApiAuth?> read() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);

    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      return ApiAuth.fromJson(json);
    } catch (_) {
      return null;
    }
  }

  static Future<void> write(ApiAuth? auth) async {
    final prefs = await SharedPreferences.getInstance();

    if (auth == null) {
      await prefs.remove(_storageKey);
      return;
    }

    await prefs.setString(_storageKey, jsonEncode(auth.toJson()));
  }
}
