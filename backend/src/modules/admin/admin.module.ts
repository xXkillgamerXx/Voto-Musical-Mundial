import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RewardsModule } from '../rewards/rewards.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminPushController } from './admin-push.controller';
import { AdminPushService } from './admin-push.service';
import { AdminController } from './admin.controller';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { VoteBotCampaignService } from './vote-bot-campaign.service';

@Module({
  imports: [AuthModule, PrismaModule, RewardsModule, SettingsModule],
  controllers: [AdminController, ModerationController, AdminPushController],
  providers: [ModerationService, AdminPushService, VoteBotCampaignService],
  exports: [VoteBotCampaignService],
})
export class AdminModule {}
