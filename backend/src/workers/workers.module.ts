import { Module } from '@nestjs/common';
import { AdminModule } from '../modules/admin/admin.module';
import { FanModule } from '../modules/fan/fan.module';
import { NewsModule } from '../modules/news/news.module';
import { CommentBotCampaignWorker } from './comment-bot-campaign.worker';
import { FanBonusWorker } from './fan-bonus.worker';
import { LifecycleNotifyWorker } from './lifecycle-notify.worker';
import { NewsSitemapWorker } from './news-sitemap.worker';
import { NotificationCampaignWorker } from './notification-campaign.worker';
import { VoteBotCampaignWorker } from './vote-bot-campaign.worker';
import { VoteSyncWorker } from './vote-sync.worker';

@Module({
  imports: [AdminModule, FanModule, NewsModule],
  providers: [
    VoteSyncWorker,
    VoteBotCampaignWorker,
    CommentBotCampaignWorker,
    NotificationCampaignWorker,
    LifecycleNotifyWorker,
    FanBonusWorker,
    NewsSitemapWorker,
  ],
  exports: [
    VoteSyncWorker,
    VoteBotCampaignWorker,
    CommentBotCampaignWorker,
    NotificationCampaignWorker,
    LifecycleNotifyWorker,
    FanBonusWorker,
    NewsSitemapWorker,
  ],
})
export class WorkersModule {}
