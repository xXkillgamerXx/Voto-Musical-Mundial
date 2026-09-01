import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportsService } from './reports.service';

@Controller('admin/content-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.superadmin, UserRole.owner)
export class ContentReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.reports.listForAdmin(status, Number(limit || 20), Number(page || 1));
  }

  @Post(':id/thank-reporter')
  thankReporter(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.reports.thankReporter(id, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.reports.updateStatus(id, body);
  }
}
