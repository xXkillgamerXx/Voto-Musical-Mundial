import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type NewsApiKeyAuth = {
  source: 'env' | 'db';
  id?: string;
  name?: string;
  special: boolean;
};

export const hashNewsApiKey = (raw: string) => createHash('sha256').update(String(raw || '').trim()).digest('hex');

/**
 * Protects Music Mundial integration endpoints.
 * Accepts `X-API-Key` or `Authorization: Bearer <key>`.
 * Validates DB keys (admin panel) and optional env fallback NEWS_CRM_API_KEY.
 */
@Injectable()
export class NewsApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      newsApiKey?: NewsApiKeyAuth;
    }>();
    const headers = request.headers || {};
    const rawKey = headers['x-api-key'];
    const headerKey = String(Array.isArray(rawKey) ? rawKey[0] : rawKey || '').trim();
    const authorization = String(headers.authorization || headers.Authorization || '');
    const bearer = authorization.toLowerCase().startsWith('bearer ')
      ? authorization.slice('bearer '.length).trim()
      : '';
    const provided = headerKey || bearer;
    if (!provided) {
      throw new UnauthorizedException('API key required.');
    }

    const envKeys = String(process.env.NEWS_CRM_API_KEY || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (envKeys.includes(provided)) {
      request.newsApiKey = { source: 'env', name: 'env', special: true };
      return true;
    }

    const keyHash = hashNewsApiKey(provided);
    const row = await this.prisma.newsIntegrationApiKey.findUnique({ where: { keyHash } });
    if (!row || !row.active) {
      throw new UnauthorizedException('Invalid API key.');
    }
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('API key expired.');
    }

    request.newsApiKey = {
      source: 'db',
      id: row.id,
      name: row.name,
      special: Boolean(row.special),
    };

    // Fire-and-forget last used stamp
    void this.prisma.newsIntegrationApiKey
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return true;
  }
}
