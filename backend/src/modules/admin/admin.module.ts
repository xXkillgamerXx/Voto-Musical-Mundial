import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RewardsModule } from '../rewards/rewards.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminOverviewController } from './admin-overview.controller';
import { AdminOverviewService } from './admin-overview.service';
import { AdminPushController } from './admin-push.controller';
import { AdminPushService } from './admin-push.service';
import { AdminController } from './admin.controller';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { NotificationCampaignsController } from './notification-campaigns.controller';
import { NotificationCampaignsService } from './notification-campaigns.service';
import { VoteBotCampaignService } from './vote-bot-campaign.service';

@Module({
  imports: [AuthModule, PrismaModule, RewardsModule, SettingsModule],
  controllers: [
    AdminController,
    ModerationController,
    AdminPushController,
    AdminOverviewController,
    NotificationCampaignsController,
  ],
  providers: [
    ModerationService,
    AdminPushService,
    AdminOverviewService,
    VoteBotCampaignService,
    NotificationCampaignsService,
  ],
  exports: [VoteBotCampaignService, NotificationCampaignsService],
})
export class AdminModule {}
