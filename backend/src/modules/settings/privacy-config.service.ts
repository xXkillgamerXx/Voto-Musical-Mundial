import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  DEFAULT_PRIVACY_SETTINGS,
  normalizePrivacySettings,
  PRIVACY_REDIS_KEY,
  PrivacySettings,
} from './privacy.config';

@Injectable()
export class PrivacyConfigService {
  constructor(private readonly redis: RedisService) {}

  async getSettings(): Promise<PrivacySettings> {
    try {
      const raw = await this.redis.client.get(PRIVACY_REDIS_KEY);
      if (raw) {
        return normalizePrivacySettings(JSON.parse(raw));
      }
    } catch {
      // Fall back to defaults when Redis is unavailable or payload is invalid.
    }

    return { ...DEFAULT_PRIVACY_SETTINGS };
  }

  async updateSettings(body: Partial<PrivacySettings>) {
    if (!body?.es && !body?.en) {
      throw new BadRequestException('Debes enviar el contenido en español y/o inglés.');
    }

    const current = await this.getSettings();
    const next = normalizePrivacySettings({
      es: body.es || current.es,
      en: body.en || current.en,
      updatedAt: new Date().toISOString(),
    });

    if (!next.es.bodyHtml.trim() || !next.en.bodyHtml.trim()) {
      throw new BadRequestException('El cuerpo de la política de privacidad no puede quedar vacío.');
    }

    await this.redis.client.set(PRIVACY_REDIS_KEY, JSON.stringify(next));
    return next;
  }
}
