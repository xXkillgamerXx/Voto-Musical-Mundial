class ApiConfig {
  ApiConfig._();

  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://vote.musicmundial.com/api',
  );

  static const googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue:
        '927668152816-gko08hdb5upa01a3psav544t0gf9m1a4.apps.googleusercontent.com',
  );
}
