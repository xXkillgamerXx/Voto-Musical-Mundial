import { Module } from '@nestjs/common';
import { DailyRewardsConfigService } from './daily-rewards-config.service';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  controllers: [RewardsController],
  providers: [RewardsService, DailyRewardsConfigService],
  exports: [DailyRewardsConfigService],
})
export class RewardsModule {}
