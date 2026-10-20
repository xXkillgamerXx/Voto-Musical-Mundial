import { ConfigService } from '@nestjs/config';

const INSECURE_VALUES = new Set([
  '',
  'change-me-access-secret',
  'change-me-refresh-secret',
  'change-me-anonymous-secret',
  'change-me-ip-hash-salt',
  'votomusicamundial',
  'CAMBIA_ESTO',
  'CAMBIA_ESTA_CLAVE_FUERTE',
]);

const REQUIRED_SECRETS = [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ANONYMOUS_SECRET',
  'IP_HASH_SALT',
];

export const LOCAL_WEB_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
];

export const resolveCorsOrigins = (config: ConfigService) => {
  const origin = config.get<string>('APP_ORIGIN') || 'http://localhost:5174';
  const missionVisitOrigins =
    config.get<string>('MISSION_VISIT_ORIGINS') ||
    'https://www.musicmundial.com,https://musicmundial.com,http://www.musicmundial.com,http://musicmundial.com';

  return [
    ...new Set(
      [
        ...origin.split(','),
        ...missionVisitOrigins.split(','),
        ...LOCAL_WEB_ORIGINS,
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
};

/**
 * Fail-fast in production if any security-critical secret is missing or still set to a
 * well-known placeholder. Prevents shipping forgeable tokens / predictable IP hashing.
 */
export const assertSecurityConfig = (config: ConfigService) => {
  const isProduction = String(config.get('NODE_ENV') || '').toLowerCase() === 'production';
  if (!isProduction) {
    return;
  }

  const insecure = REQUIRED_SECRETS.filter((key) => INSECURE_VALUES.has(String(config.get(key) || '')));
  if (insecure.length) {
    throw new Error(
      `Configuracion de seguridad invalida en produccion. Define valores fuertes y unicos para: ${insecure.join(', ')}.`,
    );
  }
};
