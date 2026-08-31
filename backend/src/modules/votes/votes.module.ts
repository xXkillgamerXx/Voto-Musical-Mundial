import { Module, forwardRef } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { MissionProgressModule } from '../missions/mission-progress.module';
import { RewardsModule } from '../rewards/rewards.module';
import { TurnstileService } from './turnstile.service';
import { VotesController } from './votes.controller';
import { VotesService } from './votes.service';

@Module({
  imports: [AuthModule, RewardsModule, MissionProgressModule, forwardRef(() => AdminModule)],
  controllers: [VotesController],
  providers: [VotesService, TurnstileService],
  exports: [VotesService],
})
export class VotesModule {}
