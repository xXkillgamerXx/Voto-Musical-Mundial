import 'package:shared_preferences/shared_preferences.dart';

class GiftNotificationStorage {
  static const _key = 'vmm_seen_gift_notifications';

  static Future<Set<String>> readSeenIds() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_key) ?? const [];
    return raw.map((item) => item.trim()).where((item) => item.isNotEmpty).toSet();
  }

  static Future<void> rememberSeen(String notificationId) async {
    if (notificationId.isEmpty) {
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    final seen = await readSeenIds();
    seen.add(notificationId);
    final next = seen.toList(growable: false);
    await prefs.setStringList(
      _key,
      next.length > 40 ? next.sublist(next.length - 40) : next,
    );
  }
}
