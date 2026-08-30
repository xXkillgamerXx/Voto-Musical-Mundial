import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Controlador global de idioma de la app.
///
/// Maneja una *preferencia* que puede ser:
/// - `'system'`: sigue el idioma del dispositivo (por defecto).
/// - `'es'` / `'en'`: idioma fijo elegido por el usuario.
///
/// Persiste la preferencia en `SharedPreferences` y notifica a los oyentes
/// (la app se reconstruye) al cambiar.
class AppLocale extends ChangeNotifier {
  AppLocale._();

  static final AppLocale instance = AppLocale._();

  /// Idiomas soportados por la app.
  static const List<String> supported = ['es', 'en'];

  /// Valores válidos para la preferencia guardada.
  static const List<String> preferences = ['system', 'es', 'en'];

  static const String _prefsKey = 'vmm_locale_preference';

  String _preference = 'system';

  /// Preferencia elegida: `'system'`, `'es'` o `'en'`.
  String get preference => _preference;

  bool get isSystem => _preference == 'system';

  /// Idioma efectivo resuelto (siempre uno de [supported]).
  String get code {
    if (supported.contains(_preference)) return _preference;
    return _deviceCode;
  }

  Locale get locale => Locale(code);

  bool get isEnglish => code == 'en';

  String get _deviceCode {
    final device = PlatformDispatcher.instance.locale.languageCode
        .toLowerCase();
    return supported.contains(device) ? device : 'en';
  }

  /// Carga la preferencia guardada (o `'system'` si no hay).
  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_prefsKey);
      if (saved != null && preferences.contains(saved)) {
        _preference = saved;
      }
    } catch (_) {
      // Ignora errores de storage y usa 'system'.
    }
  }

  Future<void> setPreference(String preference) async {
    if (!preferences.contains(preference) || preference == _preference) return;
    _preference = preference;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, preference);
    } catch (_) {
      // Persistencia best-effort.
    }
  }

  /// Fija un idioma concreto (`'es'` o `'en'`).
  Future<void> setCode(String code) => setPreference(code);

  /// Alterna entre español e inglés (según el idioma efectivo actual).
  Future<void> toggle() => setPreference(code == 'es' ? 'en' : 'es');
}
