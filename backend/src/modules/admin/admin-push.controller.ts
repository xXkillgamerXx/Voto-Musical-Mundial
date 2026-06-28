import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminPushService } from './admin-push.service';

@Controller('admin/push')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.superadmin, UserRole.owner)
export class AdminPushController {
  constructor(private readonly push: AdminPushService) {}

  @Get('users')
  users(@Query('search') search?: string, @Query('limit') limit?: string) {
    return this.push.users(search, limit);
  }

  @Get('tokens')
  tokens(@Query('userId') userId?: string) {
    return this.push.tokens(userId);
  }

  @Post('send')
  send(@Body() body: any) {
    return this.push.send(body);
  }

  @Post('artists/:artistId/followers')
  sendArtistFollowers(@Param('artistId') artistId: string, @Body() body: any) {
    return this.push.sendArtistFollowers(artistId, body);
  }
}
