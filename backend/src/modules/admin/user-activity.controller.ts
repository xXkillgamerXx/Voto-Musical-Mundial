import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserActivityService } from './user-activity.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.superadmin, UserRole.owner)
export class UserActivityController {
  constructor(private readonly activity: UserActivityService) {}

  @Get(':id/profile')
  async profile(@Param('id') id: string) {
    return this.activity.getProfile(id);
  }

  @Get(':id/activity')
  async timeline(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.activity.getActivity(id, Number(limit) || undefined);
  }

  @Get(':id/activity-days')
  async days(@Param('id') id: string, @Query('days') days?: string) {
    return this.activity.getActivityDays(id, Number(days) || undefined);
  }
}
