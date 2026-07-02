import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DailyRewardsConfigService } from './daily-rewards-config.service';
import { RewardsService } from './rewards.service';

@Controller('rewards')
export class RewardsController {
  constructor(
    private readonly rewards: RewardsService,
    private readonly dailyRewardsConfig: DailyRewardsConfigService,
  ) {}

  @Get('daily-schedule')
  dailySchedule() {
    return this.dailyRewardsConfig.getSchedulePayload();
  }

  @Post('daily-claim')
  @UseGuards(JwtAuthGuard)
  claimDaily(@CurrentUser() user: { id: bigint }) {
    return this.rewards.claimDaily(user.id);
  }
}
