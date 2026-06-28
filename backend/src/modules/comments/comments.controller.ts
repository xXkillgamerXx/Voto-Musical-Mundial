import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommentsService } from './comments.service';

@Controller('polls/:pollId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@Param('pollId') pollId: string, @Query('limit') limit?: string) {
    return this.comments.list(pollId, Number(limit || 100));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Param('pollId') pollId: string,
    @CurrentUser() user: { id: bigint },
    @Body() body: unknown,
  ) {
    return this.comments.create(pollId, user.id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('pollId') pollId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: bigint; role: UserRole },
  ) {
    return this.comments.remove(pollId, user.id, user.role, id);
  }
}
