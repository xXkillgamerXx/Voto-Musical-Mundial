import { Module, forwardRef } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { MissionProgressModule } from '../missions/mission-progress.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FanModule } from '../fan/fan.module';

@Module({
  imports: [MissionProgressModule, FanModule, forwardRef(() => AdminModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
