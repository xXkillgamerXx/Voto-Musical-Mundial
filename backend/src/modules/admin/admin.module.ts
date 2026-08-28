import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RewardsModule } from '../rewards/rewards.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminMailController } from './admin-mail.controller';
import { AdminMailService } from './admin-mail.service';
import { AdminOverviewController } from './admin-overview.controller';
import { AdminOverviewService } from './admin-overview.service';
import { AdminPushController } from './admin-push.controller';
import { AdminPushService } from './admin-push.service';
import { AdminController } from './admin.controller';
import { CommentBotCampaignController } from './comment-bot-campaign.controller';
import { CommentBotCampaignService } from './comment-bot-campaign.service';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { NotificationCampaignsController } from './notification-campaigns.controller';
import { NotificationCampaignsService } from './notification-campaigns.service';
import { UserActivityController } from './user-activity.controller';
import { UserActivityService } from './user-activity.service';
import { VoteBotCampaignService } from './vote-bot-campaign.service';

@Module({
  imports: [AuthModule, PrismaModule, RewardsModule, SettingsModule],
  controllers: [
    AdminController,
    ModerationController,
    AdminPushController,
    AdminMailController,
    AdminOverviewController,
    NotificationCampaignsController,
    CommentBotCampaignController,
    UserActivityController,
  ],
  providers: [
    UserActivityService,
    ModerationService,
    AdminPushService,
    AdminMailService,
    AdminOverviewService,
    VoteBotCampaignService,
    CommentBotCampaignService,
    NotificationCampaignsService,
  ],
  exports: [VoteBotCampaignService, CommentBotCampaignService, NotificationCampaignsService],
})
export class AdminModule {}
