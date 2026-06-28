import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ArtistsService } from './artists.service';

@Controller('artists')
export class ArtistsController {
  constructor(private readonly artists: ArtistsService) {}

  @Get()
  findAll(@Query('limit') limit?: string) {
    return this.artists.findAll(Number(limit || 250));
  }

  @Get('ranking/popularity')
  popularity(@Query('limit') limit?: string) {
    return this.artists.popularityRanking(Number(limit || 100));
  }

  @Get(':id/follow')
  @UseGuards(JwtAuthGuard)
  followStatus(@Param('id') id: string, @CurrentUser() user: { id: bigint }) {
    return this.artists.followStatus(id, user.id);
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  follow(@Param('id') id: string, @CurrentUser() user: { id: bigint }) {
    return this.artists.follow(id, user.id);
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  unfollow(@Param('id') id: string, @CurrentUser() user: { id: bigint }) {
    return this.artists.unfollow(id, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.artists.findOne(id);
  }
}
