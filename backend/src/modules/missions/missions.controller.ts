import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MissionsService } from './missions.service';

const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@Controller('missions')
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  @Get()
  findAll(@Query('lang') lang?: string) {
    return this.missions.findAll(lang);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findForMe(@CurrentUser() user: { id: bigint }, @Query('lang') lang?: string) {
    return this.missions.findForUser(user.id, lang);
  }

  @Post('visit')
  async validateVisitPost(@Body() body: { token?: string; pageUrl?: string; url?: string }) {
    return this.missions.validateVisit(
      String(body?.token || ''),
      String(body?.pageUrl || body?.url || ''),
    );
  }

  @Get('visit')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async validateVisitGet(
    @Query('t') token: string,
    @Query('u') pageUrl: string,
    @Res() response: Response,
  ) {
    try {
      await this.missions.validateVisit(String(token || ''), String(pageUrl || ''));
    } catch {
      // Best-effort pixel: never break the host page.
    }

    response.setHeader('Content-Type', 'image/gif');
    response.setHeader('Access-Control-Allow-Origin', '*');
    return response.send(PIXEL_GIF);
  }

  @Post('visit-progress')
  @UseGuards(JwtAuthGuard)
  reportAuthenticatedVisit(
    @CurrentUser() user: { id: bigint },
    @Body() body: { pageUrl?: string; url?: string },
  ) {
    return this.missions.reportAuthenticatedVisit(
      user.id,
      String(body?.pageUrl || body?.url || ''),
    );
  }

  @Post('poll-view')
  @UseGuards(JwtAuthGuard)
  trackPollView(@CurrentUser() user: { id: bigint }) {
    return this.missions.trackPollView(user.id);
  }

  @Post('referral-share')
  @UseGuards(JwtAuthGuard)
  trackReferralShare(@CurrentUser() user: { id: bigint }) {
    return this.missions.trackReferralShare(user.id);
  }

  @Post('share-action')
  @UseGuards(JwtAuthGuard)
  trackShareAction(
    @CurrentUser() user: { id: bigint },
    @Body() body: { platform?: string },
  ) {
    return this.missions.trackShareAction(user.id, body?.platform);
  }

  @Post(':id/visit-token')
  @UseGuards(JwtAuthGuard)
  createVisitToken(@Param('id') id: string, @CurrentUser() user: { id: bigint }) {
    return this.missions.createVisitToken(id, user.id);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  complete(@Param('id') id: string, @CurrentUser() user: { id: bigint }) {
    return this.missions.complete(id, user.id);
  }
}
