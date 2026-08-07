import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../features/notifications/data/app_notification.dart';

class NotificationsCache {
  static const _keyPrefix = 'vmm_notifications_cache_';

  static String _key(String userId) => '$_keyPrefix$userId';

  static Future<List<AppNotification>> read(String userId) async {
    if (userId.isEmpty) return const [];
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key(userId));
    if (raw == null || raw.isEmpty) return const [];

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      return decoded
          .whereType<Map>()
          .map((item) => AppNotification.fromJson(
                Map<String, dynamic>.from(item),
              ))
          .where((item) => item.id.isNotEmpty)
          .toList(growable: false);
    } catch (_) {
      return const [];
    }
  }

  static Future<void> write(
    String userId,
    List<AppNotification> items,
  ) async {
    if (userId.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final payload = items.take(40).map((item) => item.toJson()).toList();
    await prefs.setString(_key(userId), jsonEncode(payload));
  }

  static Future<void> clear(String userId) async {
    if (userId.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key(userId));
  }
}
