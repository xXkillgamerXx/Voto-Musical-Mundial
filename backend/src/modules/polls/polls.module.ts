import { Module } from '@nestjs/common';
import { PollsController } from './polls.controller';
import { PollsService } from './polls.service';
import { ShareController } from './share.controller';

@Module({
  controllers: [PollsController, ShareController],
  providers: [PollsService],
  exports: [PollsService],
})
export class PollsModule {}
