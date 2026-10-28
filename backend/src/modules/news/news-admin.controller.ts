import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UpsertNewsCategoryDto, UpsertNewsPostDto } from './dto/upsert-news-post.dto';
import { NewsService } from './news.service';

@Controller('admin/news')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.superadmin, UserRole.owner)
export class NewsAdminController {
  constructor(private readonly news: NewsService) {}

  @Get('overview')
  overview(@Query('days') days?: string) {
    return this.news.adminOverview(Number(days || 30));
  }

  @Get('posts')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('locale') locale?: string,
  ) {
    return this.news.adminList({
      page: Number(page || 1),
      limit: Number(limit || 20),
      q,
      status,
      locale,
    });
  }

  @Get('authors')
  authors(@Query('locale') locale?: string) {
    return this.news.adminAuthors(locale);
  }

  @Get('tags')
  tags(@Query('locale') locale?: string, @Query('q') q?: string) {
    return this.news.adminTags(locale, q);
  }

  @Get('categories')
  categories(@Query('locale') locale?: string) {
    return this.news.categories(locale);
  }

  @Post('categories')
  createCategory(@Body() body: UpsertNewsCategoryDto) {
    return this.news.createCategory(body);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: UpsertNewsCategoryDto) {
    return this.news.updateCategory(id, body);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.news.removeCategory(id);
  }

  @Get('posts/:id/comments')
  postComments(@Param('id') id: string, @Query('locale') locale?: string) {
    return this.news.adminListComments(id, locale);
  }

  @Get('posts/:id')
  getOne(@Param('id') id: string, @Query('locale') locale?: string) {
    return this.news.adminGet(id, locale);
  }

  @Post('posts')
  create(
    @Body() body: UpsertNewsPostDto,
    @CurrentUser() user: { id: bigint; role?: string },
  ) {
    return this.news.create(body, user);
  }

  @Patch('posts/:id')
  update(
    @Param('id') id: string,
    @Body() body: UpsertNewsPostDto,
    @CurrentUser() user: { id: bigint; role?: string },
  ) {
    return this.news.update(id, body, user);
  }

  @Delete('comments/:id')
  removeComment(@Param('id') id: string, @Query('locale') locale?: string) {
    return this.news.removeComment(id, locale);
  }

  @Delete('posts/:id')
  remove(@Param('id') id: string, @Query('locale') locale?: string) {
    return this.news.remove(id, locale);
  }
}
