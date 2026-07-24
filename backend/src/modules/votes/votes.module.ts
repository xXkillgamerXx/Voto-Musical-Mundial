import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RewardsModule } from '../rewards/rewards.module';
import { TurnstileService } from './turnstile.service';
import { VotesController } from './votes.controller';
import { VotesService } from './votes.service';

@Module({
  imports: [AuthModule, RewardsModule],
  controllers: [VotesController],
  providers: [VotesService, TurnstileService],
  exports: [VotesService],
})
export class VotesModule {}
