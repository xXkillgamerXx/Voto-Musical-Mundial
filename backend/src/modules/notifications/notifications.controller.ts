import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
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
}
