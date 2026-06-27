import { Controller, Get, Param, Query } from '@nestjs/common';
import { PollsService } from './polls.service';

@Controller('polls')
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Get()
  findAll(@Query('limit') limit?: string) {
    return this.polls.findAll(Number(limit || 100));
  }

  @Get('live')
  live(@Query('limit') limit?: string) {
    return this.polls.live(Number(limit || 12));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.polls.findOne(id);
  }

  @Get(':id/results')
  results(@Param('id') id: string, @Query('roundId') roundId?: string) {
    return this.polls.getResults(id, roundId);
  }
}
