import 'strings/auth_strings.dart';
import 'strings/catalog_strings.dart';
import 'strings/common_strings.dart';
import 'strings/data_strings.dart';
import 'strings/home_strings.dart';
import 'strings/misc_strings.dart';
import 'strings/poll_detail_strings.dart';
import 'strings/settings_strings.dart';
import 'tr.dart';

/// Registra todos los catálogos de traducción de la app.
///
/// Llamar una sola vez al arrancar (en `main`), antes de construir la UI.
void initI18n() {
  registerStrings(commonStrings);
  registerStrings(dataStrings);
  registerStrings(authStrings);
  registerStrings(homeStrings);
  registerStrings(pollDetailStrings);
  registerStrings(catalogStrings);
  registerStrings(miscStrings);
  registerStrings(settingsStrings);
}
