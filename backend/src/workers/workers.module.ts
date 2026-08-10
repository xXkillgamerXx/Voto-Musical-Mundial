import { Module } from '@nestjs/common';
import { AdminModule } from '../modules/admin/admin.module';
import { NotificationCampaignWorker } from './notification-campaign.worker';
import { VoteBotCampaignWorker } from './vote-bot-campaign.worker';
import { VoteSyncWorker } from './vote-sync.worker';

@Module({
  imports: [AdminModule],
  providers: [VoteSyncWorker, VoteBotCampaignWorker, NotificationCampaignWorker],
  exports: [VoteSyncWorker, VoteBotCampaignWorker, NotificationCampaignWorker],
})
export class WorkersModule {}
