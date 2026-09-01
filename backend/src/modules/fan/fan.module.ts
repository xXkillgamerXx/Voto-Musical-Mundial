import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { FanMembershipController } from './fan.controller';
import { FanService } from './fan.service';

@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [FanMembershipController],
  providers: [FanService],
  exports: [FanService],
})
export class FanModule {}
