import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  APP_DOWNLOAD_REDIS_KEY,
  AppDownloadConfig,
  assertAppDownloadUrl,
  buildAppDownloadPayload,
  DEFAULT_APP_DOWNLOAD,
  normalizeAppDownloadConfig,
} from './app-download.config';

@Injectable()
export class AppDownloadConfigService {
  constructor(private readonly redis: RedisService) {}

  async getConfig(): Promise<AppDownloadConfig> {
    try {
      const raw = await this.redis.client.get(APP_DOWNLOAD_REDIS_KEY);
      if (raw) {
        return normalizeAppDownloadConfig(JSON.parse(raw));
      }
    } catch {
      // Fall back to defaults when Redis is unavailable or payload is invalid.
    }

    return { ...DEFAULT_APP_DOWNLOAD };
  }

  async getConfigPayload() {
    return buildAppDownloadPayload(await this.getConfig());
  }

  async updateConfig(input: Partial<AppDownloadConfig>) {
    const normalized = normalizeAppDownloadConfig({
      ...(await this.getConfig()),
      ...input,
    });

    try {
      assertAppDownloadUrl(normalized.playStoreUrl);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'La URL de Google Play no es valida.',
      );
    }

    await this.redis.client.set(APP_DOWNLOAD_REDIS_KEY, JSON.stringify(normalized));
    return buildAppDownloadPayload(normalized);
  }
}
