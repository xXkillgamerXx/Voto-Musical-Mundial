import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ChartsService } from './charts.service';

@Controller('charts')
export class ChartsController {
  constructor(private readonly charts: ChartsService) {}

  @Get('data')
  getSiteData() {
    return this.charts.getSiteData();
  }

  @Get('spotify/countries')
  getCountries() {
    return this.charts.getCountriesMeta();
  }

  @Get('spotify/:code')
  getCountry(@Param('code') code: string) {
    const raw = String(code || '').replace(/-daily$/i, '');
    return this.charts.getCountryDaily(raw);
  }

  @Post('ingest')
  ingest(
    @Headers('x-charts-ingest-secret') secret: string,
    @Body()
    body: {
      packs?: Array<Record<string, unknown>>;
      data?: Record<string, unknown>;
      countries?: Array<Record<string, unknown>>;
      secret?: string;
    },
  ) {
    this.charts.assertIngestSecret(secret || body?.secret);
    return this.charts.ingestBundle(body as any);
  }
}
