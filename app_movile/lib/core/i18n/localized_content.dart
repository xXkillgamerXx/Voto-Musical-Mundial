import 'app_locale.dart';

/// Elige el texto del idioma activo de la app para contenido de la API
/// (títulos de votaciones y rondas, biografías, misiones...).
///
/// La API envía siempre ambos idiomas, así que la resolución se hace al
/// mostrar y no al parsear: cambiar el idioma en Ajustes reconstruye la app
/// y el texto cambia sin volver a pedir los datos.
///
/// Si falta la traducción del idioma activo se usa la del otro idioma antes
/// que dejar el texto vacío.
String localizedContent(String es, String en) {
  final preferred = AppLocale.instance.isEnglish ? en : es;
  if (preferred.isNotEmpty) return preferred;
  return AppLocale.instance.isEnglish ? es : en;
}
