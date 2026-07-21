import 'app_locale.dart';

/// Catálogo global de traducciones.
///
/// Cada clave mapea a un mapa por idioma, p.ej.:
/// `'common.vote': {'es': 'Votar', 'en': 'Vote'}`.
///
/// Los módulos registran sus cadenas con [registerStrings] (ver
/// `i18n_registry.dart`). La resolución usa el idioma actual de
/// [AppLocale].
final Map<String, Map<String, String>> _catalog = <String, Map<String, String>>{};

void registerStrings(Map<String, Map<String, String>> entries) {
  _catalog.addAll(entries);
}

/// Traduce [key] al idioma actual. Si no existe, devuelve el español
/// como respaldo y, en último caso, la propia clave.
String tr(String key) {
  final entry = _catalog[key];
  if (entry == null) return key;
  return entry[AppLocale.instance.code] ?? entry['es'] ?? key;
}

/// Igual que [tr] pero reemplaza parámetros del tipo `{nombre}`.
String trp(String key, Map<String, Object?> params) {
  var value = tr(key);
  params.forEach((k, v) {
    value = value.replaceAll('{$k}', '$v');
  });
  return value;
}

extension TrString on String {
  /// Azúcar sintáctico: `'common.vote'.tr()`.
  String tr() => trToString(this);
}

String trToString(String key) => tr(key);
