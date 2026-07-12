import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class _CacheEntry {
  _CacheEntry({required this.data, required this.storedAt});

  final dynamic data;
  final DateTime storedAt;

  bool isFresh(Duration ttl) => DateTime.now().difference(storedAt) < ttl;
}

class ResponseCache {
  ResponseCache._();

  static ResponseCache? _instance;

  static ResponseCache get instance {
    final cache = _instance;
    if (cache == null) {
      throw StateError('ResponseCache.init() must be called before use.');
    }
    return cache;
  }

  static ResponseCache? get instanceOrNull => _instance;

  static Future<ResponseCache> init() async {
    if (_instance != null) {
      return _instance!;
    }

    final cache = ResponseCache._();
    cache._prefs = await SharedPreferences.getInstance();
    _instance = cache;
    return cache;
  }

  static const _diskPrefix = 'vmm_cache_';

  final Map<String, _CacheEntry> _memory = {};
  SharedPreferences? _prefs;

  dynamic readFresh(String key, Duration ttl) {
    final memoryEntry = _memory[key];
    if (memoryEntry != null && memoryEntry.isFresh(ttl)) {
      return memoryEntry.data;
    }

    final diskEntry = _readDiskEntry(key);
    if (diskEntry != null && diskEntry.isFresh(ttl)) {
      _memory[key] = diskEntry;
      return diskEntry.data;
    }

    return null;
  }

  dynamic readAny(String key) {
    final memoryEntry = _memory[key];
    if (memoryEntry != null) {
      return memoryEntry.data;
    }

    final diskEntry = _readDiskEntry(key);
    if (diskEntry != null) {
      _memory[key] = diskEntry;
      return diskEntry.data;
    }

    return null;
  }

  Future<void> write(String key, dynamic data) async {
    final entry = _CacheEntry(data: data, storedAt: DateTime.now());
    _memory[key] = entry;

    final prefs = _prefs;
    if (prefs == null) {
      return;
    }

    await prefs.setString(
      '$_diskPrefix$key',
      jsonEncode({
        'storedAt': entry.storedAt.toIso8601String(),
        'data': data,
      }),
    );
  }

  Future<void> invalidate(String key) async {
    _memory.remove(key);
    await _prefs?.remove('$_diskPrefix$key');
  }

  _CacheEntry? _readDiskEntry(String key) {
    final raw = _prefs?.getString('$_diskPrefix$key');
    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      final payload = jsonDecode(raw);
      if (payload is! Map<String, dynamic>) {
        return null;
      }

      final storedAt = DateTime.tryParse('${payload['storedAt'] ?? ''}');
      if (storedAt == null) {
        return null;
      }

      return _CacheEntry(data: payload['data'], storedAt: storedAt);
    } catch (_) {
      return null;
    }
  }
}
