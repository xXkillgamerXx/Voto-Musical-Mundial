import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ModerationService } from './moderation.service';
import { UserActivityService } from './user-activity.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.superadmin, UserRole.owner)
export class UserActivityController {
  constructor(
    private readonly activity: UserActivityService,
    private readonly moderation: ModerationService,
  ) {}

  @Get(':id/profile')
  async profile(@Param('id') id: string) {
    const [profile, block] = await Promise.all([
      this.activity.getProfile(id),
      this.moderation.getActiveUserBlock(id),
    ]);

    return {
      ...profile,
      accountStatus: block?.blocked ? 'blocked' : 'active',
      accountBlock: block,
    };
  }

  @Get(':id/alerts')
  async alerts(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.moderation.listAlertsForUser(id, limit);
  }

  @Get(':id/comments')
  async comments(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.activity.getComments(id, Number(limit) || undefined, Number(page) || undefined);
  }

  @Delete(':id/comments/:commentId')
  async deleteComment(@Param('id') id: string, @Param('commentId') commentId: string) {
    return this.activity.deleteUserComment(id, commentId);
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
