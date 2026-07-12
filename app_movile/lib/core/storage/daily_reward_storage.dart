import 'package:shared_preferences/shared_preferences.dart';

class DailyRewardStorage {
  static const _key = 'vmm_daily_reward_state';

  static Future<bool> wasDismissedToday() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) {
      return false;
    }

    try {
      final parts = raw.split('|');
      if (parts.length < 2) {
        return false;
      }

      return parts[0] == _todayKey() && parts[1] == '1';
    } catch (_) {
      return false;
    }
  }

  static Future<void> markDismissedToday() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, '${_todayKey()}|1');
  }

  static String _todayKey() {
    final now = DateTime.now();
    final month = now.month.toString().padLeft(2, '0');
    final day = now.day.toString().padLeft(2, '0');
    return '${now.year}-$month-$day';
  }
}
