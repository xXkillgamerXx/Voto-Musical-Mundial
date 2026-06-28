import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findForUser(@CurrentUser() user: { id: bigint }, @Query('limit') limit?: string) {
    return this.notifications.findForUser(user.id, Number(limit || 30));
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: { id: bigint }, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('push-token')
  registerPushToken(
    @CurrentUser() user: { id: bigint },
    @Body() body: { token?: string; platform?: string; permission?: string },
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.notifications.registerPushToken(user.id, body, userAgent);
  }

  @Delete('push-token')
  unregisterPushToken(@CurrentUser() user: { id: bigint }, @Body() body: { token?: string }) {
    return this.notifications.unregisterPushToken(user.id, body?.token || '');
  }
}
