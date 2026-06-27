import { Module } from '@nestjs/common';
import { ArtistsModule } from '../artists/artists.module';
import { PollsModule } from '../polls/polls.module';
import { RankingsController } from './rankings.controller';

@Module({
  imports: [ArtistsModule, PollsModule],
  controllers: [RankingsController],
})
export class RankingsModule {}
