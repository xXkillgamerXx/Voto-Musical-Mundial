import { Module } from '@nestjs/common';
import { DailyRewardsConfigService } from './daily-rewards-config.service';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { ShareVoteBoostConfigService } from './share-vote-boost-config.service';

@Module({
  controllers: [RewardsController],
  providers: [RewardsService, DailyRewardsConfigService, ShareVoteBoostConfigService],
  exports: [DailyRewardsConfigService, ShareVoteBoostConfigService],
})
export class RewardsModule {}
