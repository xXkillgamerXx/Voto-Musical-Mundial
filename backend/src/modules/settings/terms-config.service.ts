import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  DEFAULT_TERMS_SETTINGS,
  normalizeTermsSettings,
  TERMS_REDIS_KEY,
  TermsSettings,
} from './terms.config';

@Injectable()
export class TermsConfigService {
  constructor(private readonly redis: RedisService) {}

  async getSettings(): Promise<TermsSettings> {
    try {
      const raw = await this.redis.client.get(TERMS_REDIS_KEY);
      if (raw) {
        return normalizeTermsSettings(JSON.parse(raw));
      }
    } catch {
      // Fall back to defaults when Redis is unavailable or payload is invalid.
    }

    return { ...DEFAULT_TERMS_SETTINGS };
  }

  async updateSettings(body: Partial<TermsSettings>) {
    if (!body?.es && !body?.en) {
      throw new BadRequestException('Debes enviar el contenido en español y/o inglés.');
    }

    const current = await this.getSettings();
    const next = normalizeTermsSettings({
      es: body.es || current.es,
      en: body.en || current.en,
      updatedAt: new Date().toISOString(),
    });

    if (!next.es.bodyHtml.trim() || !next.en.bodyHtml.trim()) {
      throw new BadRequestException('El cuerpo de los términos no puede quedar vacío.');
    }

    await this.redis.client.set(TERMS_REDIS_KEY, JSON.stringify(next));
    return next;
  }
}
