import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { NotificationCampaignsService } from './notification-campaigns.service';

@Controller('admin/notification-campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.superadmin, UserRole.owner)
export class NotificationCampaignsController {
  constructor(private readonly campaigns: NotificationCampaignsService) {}

  @Get()
  list() {
    return this.campaigns.list();
  }

  @Post()
  create(@Body() body: any) {
    return this.campaigns.create(body, body?.createdBy ? String(body.createdBy) : undefined);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.campaigns.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }

  @Post(':id/send-now')
  sendNow(@Param('id') id: string) {
    return this.campaigns.sendNow(id);
  }
}
