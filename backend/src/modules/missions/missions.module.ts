import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MissionProgressModule } from './mission-progress.module';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';

@Module({
  imports: [AuthModule, MissionProgressModule],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService, MissionProgressModule],
})
export class MissionsModule {}
