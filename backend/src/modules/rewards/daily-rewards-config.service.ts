import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  buildDailyRewardSchedulePayload,
  DAILY_REWARDS_REDIS_KEY,
  DailyRewardDay,
  DEFAULT_DAILY_REWARD_SCHEDULE,
  normalizeDailyRewardSchedule,
} from './daily-rewards.config';

@Injectable()
export class DailyRewardsConfigService {
  constructor(private readonly redis: RedisService) {}

  async getSchedule() {
    try {
      const raw = await this.redis.client.get(DAILY_REWARDS_REDIS_KEY);
      if (raw) {
        return normalizeDailyRewardSchedule(JSON.parse(raw));
      }
    } catch {
      // Fall back to defaults when Redis is unavailable or payload is invalid.
    }

    return [...DEFAULT_DAILY_REWARD_SCHEDULE];
  }

  async getSchedulePayload() {
    return buildDailyRewardSchedulePayload(await this.getSchedule());
  }

  async updateSchedule(days: DailyRewardDay[]) {
    if (!Array.isArray(days) || days.length !== 7) {
      throw new BadRequestException('Debes configurar exactamente 7 dias de recompensa.');
    }

    const normalized = normalizeDailyRewardSchedule(days);
    const invalidDay = normalized.find((entry) => entry.points <= 0);

    if (invalidDay) {
      throw new BadRequestException('Cada dia debe otorgar al menos 1 punto.');
    }

    await this.redis.client.set(DAILY_REWARDS_REDIS_KEY, JSON.stringify(normalized));
    return buildDailyRewardSchedulePayload(normalized);
  }
}
