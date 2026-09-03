class ApiConfig {
  ApiConfig._();

  /// API de producción (vote.musicmundial.com).
  static const productionApiUrl = 'https://vote.musicmundial.com/api';

  /// URL activa. Por defecto = producción.
  /// Solo para desarrollo local:
  /// `--dart-define=API_BASE_URL=http://localhost:4000/api`
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: productionApiUrl,
  );

  static String get uploadsOrigin =>
      baseUrl.replaceAll(RegExp(r'/api$'), '');

  static bool get isProduction =>
      baseUrl.contains('vote.musicmundial.com');

  /// Web / server OAuth client (aud del idToken que valida el backend).
  static const googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue:
        '927668152816-gko08hdb5upa01a3psav544t0gf9m1a4.apps.googleusercontent.com',
  );

  /// iOS OAuth client (GoogleService-Info.plist → CLIENT_ID).
  static const googleIosClientId = String.fromEnvironment(
    'GOOGLE_IOS_CLIENT_ID',
    defaultValue:
        '927668152816-qth0gukdhrja9lrd6ejcf88ttlo8154t.apps.googleusercontent.com',
  );

  /// Misma clave que `VITE_GIPHY_API_KEY` en la web (`.env`).
  /// Se puede sobreescribir con `--dart-define=GIPHY_API_KEY=...`
  static const giphyApiKey = String.fromEnvironment(
    'GIPHY_API_KEY',
    defaultValue: 'y6JAoCFwoiRlmmkcXapPcfHK0U2gzSpf',
  );

  /// Instagram oficial del certificado. Mismo valor que `VITE_INSTAGRAM_HANDLE`.
  /// https://www.instagram.com/musicmundial_awards/
  static const instagramHandle = String.fromEnvironment(
    'INSTAGRAM_HANDLE',
    defaultValue: 'musicmundial_awards',
  );

  static String get instagramTag {
    final raw = instagramHandle.trim().replaceFirst(RegExp(r'^[@#]+'), '');
    return '#${raw.isEmpty ? 'musicmundial_awards' : raw}';
  }
}