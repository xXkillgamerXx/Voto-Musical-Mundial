import { Controller, Get, Param, Query } from '@nestjs/common';
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.artists.findOne(id);
  }
}
