import { Module } from '@nestjs/common';
import { VoteBotCampaignWorker } from './vote-bot-campaign.worker';
import { VoteSyncWorker } from './vote-sync.worker';

@Module({
  providers: [VoteSyncWorker, VoteBotCampaignWorker],
  exports: [VoteSyncWorker, VoteBotCampaignWorker],
})
export class WorkersModule {}
