import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

export const CANONICAL_NEWS_ORIGIN = 'https://www.musicmundial.com';

const first = (value?: string | null) =>
  String(value || '')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');

const hostOf = (value: string) =>
  value
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase();

const isLocalHost = (value: string) => /localhost|127\.0\.0\.1/i.test(value);

const isIpHost = (value: string) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostOf(value));

const canonicalize = (value: string) => {
  const raw = first(value);
  if (!raw) return '';
  const host = hostOf(raw);
  if (!host || isLocalHost(host) || isIpHost(host)) return '';
  if (host === 'musicmundial.com' || host === 'www.musicmundial.com') {
    return CANONICAL_NEWS_ORIGIN;
  }
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${host}`;
};

export const newsPublicOrigin = (config: ConfigService, req?: Request) => {
  const fromEnv = canonicalize(
    config.get<string>('PUBLIC_NEWS_ORIGIN') || config.get<string>('APP_PUBLIC_ORIGIN') || '',
  );
  if (fromEnv) return fromEnv;

  const fromApp = canonicalize(config.get<string>('APP_ORIGIN') || '');
  if (fromApp) return fromApp;

  if (req) {
    const host = String(req.headers.host || '').trim();
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https')
      .split(',')[0]
      .trim();
    const fromReq = canonicalize(`${proto}://${host}`);
    if (fromReq) return fromReq;
  }

  return CANONICAL_NEWS_ORIGIN;
};
