import { Module } from '@nestjs/common';
import { MissionProgressModule } from '../missions/mission-progress.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [MissionProgressModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
