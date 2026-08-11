import { Module } from '@nestjs/common';
import { AdminModule } from '../modules/admin/admin.module';
import { CommentBotCampaignWorker } from './comment-bot-campaign.worker';
import { NotificationCampaignWorker } from './notification-campaign.worker';
import { VoteBotCampaignWorker } from './vote-bot-campaign.worker';
import { VoteSyncWorker } from './vote-sync.worker';

@Module({
  imports: [AdminModule],
  providers: [
    VoteSyncWorker,
    VoteBotCampaignWorker,
    CommentBotCampaignWorker,
    NotificationCampaignWorker,
  ],
  exports: [
    VoteSyncWorker,
    VoteBotCampaignWorker,
    CommentBotCampaignWorker,
    NotificationCampaignWorker,
  ],
})
export class WorkersModule {}
