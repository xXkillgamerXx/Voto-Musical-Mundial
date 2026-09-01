import { Module } from '@nestjs/common';
import { AdminModule } from '../modules/admin/admin.module';
import { FanModule } from '../modules/fan/fan.module';
import { CommentBotCampaignWorker } from './comment-bot-campaign.worker';
import { FanBonusWorker } from './fan-bonus.worker';
import { LifecycleNotifyWorker } from './lifecycle-notify.worker';
import { NotificationCampaignWorker } from './notification-campaign.worker';
import { VoteBotCampaignWorker } from './vote-bot-campaign.worker';
import { VoteSyncWorker } from './vote-sync.worker';

@Module({
  imports: [AdminModule, FanModule],
  providers: [
    VoteSyncWorker,
    VoteBotCampaignWorker,
    CommentBotCampaignWorker,
    NotificationCampaignWorker,
    LifecycleNotifyWorker,
    FanBonusWorker,
  ],
  exports: [
    VoteSyncWorker,
    VoteBotCampaignWorker,
    CommentBotCampaignWorker,
    NotificationCampaignWorker,
    LifecycleNotifyWorker,
    FanBonusWorker,
  ],
})
export class WorkersModule {}
