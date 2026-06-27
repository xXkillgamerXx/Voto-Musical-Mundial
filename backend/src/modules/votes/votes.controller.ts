import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CastVoteDto } from './dto/cast-vote.dto';
import { VoteStatusDto } from './dto/vote-status.dto';
import { VotesService } from './votes.service';

@Controller('votes')
export class VotesController {
  constructor(private readonly votes: VotesService) {}

  @Post()
  castVote(@Body() dto: CastVoteDto, @Req() request: Request) {
    return this.votes.castVote(dto, request);
  }

  @Post('status')
  status(@Body() dto: VoteStatusDto, @Req() request: Request) {
    return this.votes.status(dto, request);
  }
}
