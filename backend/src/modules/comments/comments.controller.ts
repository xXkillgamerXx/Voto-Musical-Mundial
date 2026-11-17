import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CommentsService } from './comments.service';

@Controller('polls/:pollId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Param('pollId') pollId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sort') sort?: string,
    @CurrentUser() user?: { id: bigint } | null,
  ) {
    return this.comments.list(
      pollId,
      Number(limit || 20),
      Number(offset || 0),
      sort || 'latest',
      user?.id || null,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Param('pollId') pollId: string,
    @CurrentUser() user: { id: bigint },
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    return this.comments.create(pollId, user.id, body, request);
  }

  @Post(':id/reactions')
  @UseGuards(JwtAuthGuard)
  react(
    @Param('pollId') pollId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: bigint },
    @Body() body: { reaction?: string },
  ) {
    return this.comments.react(pollId, user.id, id, String(body?.reaction || ''));
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
