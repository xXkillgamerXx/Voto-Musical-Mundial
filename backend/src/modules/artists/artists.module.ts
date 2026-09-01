import { Module } from '@nestjs/common';
import { MissionProgressModule } from '../missions/mission-progress.module';
import { FanModule } from '../fan/fan.module';
import { ArtistsController } from './artists.controller';
import { ArtistsService } from './artists.service';

@Module({
  imports: [MissionProgressModule, FanModule],
  controllers: [ArtistsController],
  providers: [ArtistsService],
  exports: [ArtistsService],
})
export class ArtistsModule {}
