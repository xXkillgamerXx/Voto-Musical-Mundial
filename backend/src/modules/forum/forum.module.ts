import { Module } from '@nestjs/common';
import { RedisThrottleGuard } from '../../common/throttle.guard';
import { AuthModule } from '../auth/auth.module';
import { FanModule } from '../fan/fan.module';
import { ForumAdminController } from './forum-admin.controller';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';

@Module({
  imports: [AuthModule, FanModule],
  controllers: [ForumController, ForumAdminController],
  providers: [ForumService, RedisThrottleGuard],
  exports: [ForumService],
})
export class ForumModule {}
