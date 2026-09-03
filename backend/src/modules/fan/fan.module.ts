import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { FanMembershipController } from './fan.controller';
import { FanService } from './fan.service';
import { PaypalService } from './paypal.service';
import { RedisThrottleGuard } from '../../common/throttle.guard';

@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [FanMembershipController],
  providers: [FanService, PaypalService, RedisThrottleGuard],
  exports: [FanService],
})
export class FanModule {}
