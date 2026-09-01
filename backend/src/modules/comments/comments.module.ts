import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { FanModule } from '../fan/fan.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [ConfigModule, AuthModule, FanModule, forwardRef(() => AdminModule)],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
