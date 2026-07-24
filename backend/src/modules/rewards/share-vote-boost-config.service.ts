import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  buildShareVoteBoostPayload,
  DEFAULT_SHARE_VOTE_BOOST,
  normalizeShareVoteBoostConfig,
  SHARE_VOTE_BOOST_REDIS_KEY,
  ShareVoteBoostConfig,
} from './share-vote-boost.config';

@Injectable()
export class ShareVoteBoostConfigService {
  constructor(private readonly redis: RedisService) {}

  async getConfig(): Promise<ShareVoteBoostConfig> {
    try {
      const raw = await this.redis.client.get(SHARE_VOTE_BOOST_REDIS_KEY);
      if (raw) {
        return normalizeShareVoteBoostConfig(JSON.parse(raw));
      }
    } catch {
      // Fall back to defaults when Redis is unavailable or payload is invalid.
    }

    return { ...DEFAULT_SHARE_VOTE_BOOST };
  }

  async getConfigPayload() {
    return buildShareVoteBoostPayload(await this.getConfig());
  }

  async updateConfig(input: Partial<ShareVoteBoostConfig>) {
    const normalized = normalizeShareVoteBoostConfig({
      ...(await this.getConfig()),
      ...input,
    });

    if (normalized.durationMinutes < 1) {
      throw new BadRequestException('La duracion del boost debe ser de al menos 1 minuto.');
    }

    await this.redis.client.set(SHARE_VOTE_BOOST_REDIS_KEY, JSON.stringify(normalized));
    return buildShareVoteBoostPayload(normalized);
  }
}
