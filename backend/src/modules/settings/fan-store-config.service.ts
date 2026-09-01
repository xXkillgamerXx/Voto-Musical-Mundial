import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  buildFanStorePayload,
  DEFAULT_FAN_STORE,
  FAN_STORE_REDIS_KEY,
  FanStoreConfig,
  normalizeFanStoreConfig,
} from './fan-store.config';

@Injectable()
export class FanStoreConfigService {
  constructor(private readonly redis: RedisService) {}

  async getConfig(): Promise<FanStoreConfig> {
    try {
      const raw = await this.redis.client.get(FAN_STORE_REDIS_KEY);
      if (raw) {
        return normalizeFanStoreConfig(JSON.parse(raw));
      }
    } catch {
      // Fall back to defaults when Redis is unavailable or payload is invalid.
    }

    return normalizeFanStoreConfig(DEFAULT_FAN_STORE);
  }

  async getPublicPayload() {
    return buildFanStorePayload(await this.getConfig(), { publicOnly: true });
  }

  async getAdminPayload() {
    return buildFanStorePayload(await this.getConfig());
  }

  async updateConfig(input: unknown) {
    const normalized = normalizeFanStoreConfig({
      ...(await this.getConfig()),
      ...(input && typeof input === 'object' ? input : {}),
    });
    await this.redis.client.set(FAN_STORE_REDIS_KEY, JSON.stringify(normalized));
    return buildFanStorePayload(normalized);
  }
}
