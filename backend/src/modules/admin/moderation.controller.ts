import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { serialize } from '../../common/serialize';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ModerationService } from './moderation.service';

@Controller('admin/moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.superadmin, UserRole.owner)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  private actorFrom(request: Request) {
    const user = (request as any).user;
    return user?.displayName || user?.username || user?.email || (user?.id ? `#${user.id}` : null);
  }

  @Get('overview')
  overview(@Query('hours') hours?: string) {
    return this.moderation.overview(hours);
  }

  @Get('ip-activity')
  ipActivity(@Query('hours') hours?: string, @Query('limit') limit?: string) {
    return this.moderation.ipActivity(hours, limit);
  }

  @Get('recent-votes')
  async recentVotes(@Query('limit') limit?: string) {
    return serialize(await this.moderation.recentVotes(limit));
  }

  @Get('blocks')
  async blocks() {
    return serialize(await this.moderation.blocks());
  }

  @Post('block-ip')
  blockIp(@Body() body: any, @Req() request: Request) {
    return this.moderation.blockIp(body?.ipHash, body?.reason, this.actorFrom(request));
  }

  @Delete('block-ip/:ipHash')
  unblockIp(@Param('ipHash') ipHash: string) {
    return this.moderation.unblockIp(ipHash);
  }

  @Post('block-user')
  blockUser(@Body() body: any, @Req() request: Request) {
    return this.moderation.blockUser(body?.userId, body?.reason, this.actorFrom(request));
  }

  @Delete('block-user/:userId')
  unblockUser(@Param('userId') userId: string) {
    return this.moderation.unblockUser(userId);
  }
}
