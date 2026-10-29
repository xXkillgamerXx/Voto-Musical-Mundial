import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Throttle } from '../../common/throttle.decorator';
import { RedisThrottleGuard } from '../../common/throttle.guard';
import { getClientIp } from '../../common/request';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateForumPostDto } from './dto/create-post.dto';
import { CreateForumTopicDto } from './dto/create-topic.dto';
import { ListForumTopicsDto } from './dto/list-topics.dto';
import { ForumService } from './forum.service';

const localeOf = (value?: string): 'es' | 'en' => (value === 'es' ? 'es' : 'en');

@Controller('forum')
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Get('home')
  home(@Query('locale') locale?: string) {
    return this.forum.home(localeOf(locale));
  }

  @Get('search')
  search(
    @Query('q') q?: string,
    @Query('locale') locale?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.forum.search(localeOf(locale), q || '', page, limit);
  }

  @Get('categories/:slug')
  category(@Param('slug') slug: string, @Query() query: ListForumTopicsDto, @Query('locale') locale?: string) {
    return this.forum.category(slug, localeOf(locale), query);
  }

  @Get('topics/:id')
  topic(
    @Param('id') id: string,
    @Query() query: ListForumTopicsDto,
    @Query('locale') locale?: string,
    @Req() request?: Request,
  ) {
    return this.forum.topic(id, localeOf(locale), query, undefined, request ? getClientIp(request) : undefined);
  }

  @Post('topics')
  @UseGuards(RedisThrottleGuard, JwtAuthGuard)
  @Throttle({ name: 'forum-topic', limit: 8, windowSec: 600 })
  createTopic(
    @CurrentUser() user: { id: bigint },
    @Body() body: CreateForumTopicDto,
    @Query('locale') locale?: string,
  ) {
    return this.forum.createTopic(user.id, body, localeOf(locale));
  }

  @Post('topics/:id/posts')
  @UseGuards(RedisThrottleGuard, JwtAuthGuard)
  @Throttle({ name: 'forum-reply', limit: 20, windowSec: 600 })
  createPost(
    @Param('id') id: string,
    @CurrentUser() user: { id: bigint },
    @Body() body: CreateForumPostDto,
  ) {
    return this.forum.createPost(user.id, id, body);
  }

  @Patch('categories/:slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.superadmin, UserRole.owner)
  setCategory(
    @Param('slug') slug: string,
    @Body() body: { isActive?: boolean },
    @CurrentUser() user: { role: UserRole },
  ) {
    return this.forum.setCategoryActive(slug, body?.isActive !== false, user.role);
  }
}
