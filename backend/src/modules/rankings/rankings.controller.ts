import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { NoStoreInterceptor } from '../../common/no-store.interceptor';
import { ArtistsService } from '../artists/artists.service';
import { PollsService } from '../polls/polls.service';

@Controller('rankings')
@UseInterceptors(NoStoreInterceptor)
export class RankingsController {
  constructor(
    private readonly artists: ArtistsService,
    private readonly polls: PollsService,
  ) {}

  @Get('artists/popularity')
  artistsPopularity(@Query('limit') limit?: string) {
    return this.artists.popularityRanking(Number(limit || 100));
  }

  @Get('polls/:pollId')
  pollResults(@Param('pollId') pollId: string, @Query('roundId') roundId?: string) {
    return this.polls.getResults(pollId, roundId);
  }
}
