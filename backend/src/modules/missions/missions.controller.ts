import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MissionsService } from './missions.service';

@Controller('missions')
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  @Get()
  findAll() {
    return this.missions.findAll();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findForMe(@CurrentUser() user: { id: bigint }) {
    return this.missions.findForUser(user.id);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  complete(@Param('id') id: string, @CurrentUser() user: { id: bigint }) {
    return this.missions.complete(id, user.id);
  }
}
