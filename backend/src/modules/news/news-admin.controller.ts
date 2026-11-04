import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
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
    @Query('author') author?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.news.adminList({
      page: Number(page || 1),
      limit: Number(limit || 20),
      q,
      status,
      locale,
      author,
      from,
      to,
    });
  }

  @Get('authors')
  authors(@Query('locale') locale?: string, @Query('q') q?: string) {
    return this.news.adminAuthors(locale, q);
  }

  @Patch('authors/:id')
  updateAuthor(
    @Param('id') id: string,
    @Body()
    body: {
      locale?: string;
      name?: string;
      bio?: string;
      website?: string;
      photoUrl?: string;
      linkedUserId?: string | null;
    },
  ) {
    return this.news.adminUpdateAuthor(id, body);
  }

  @Get('tags')
  tags(@Query('locale') locale?: string, @Query('q') q?: string) {
    return this.news.adminTags(locale, q);
  }

  @Get('tags/:id')
  tag(@Param('id') id: string, @Query('locale') locale?: string) {
    return this.news.adminTag(id, locale);
  }

  @Patch('tags/:id')
  updateTag(
    @Param('id') id: string,
    @Body()
    body: {
      locale?: string;
      name?: string;
      description?: string;
      about?: string;
      logoUrl?: string;
      coverUrl?: string;
      verified?: boolean;
      followers?: number;
      related?: string[];
      supporters?: Array<{ name?: string; tier?: string; points?: number }>;
    },
  ) {
    return this.news.updateTag(id, body);
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

  @Get('comment-reports')
  listCommentReports(@Query('locale') locale?: string, @Query('status') status?: string) {
    return this.news.adminListCommentReports(locale, status);
  }

  @Patch('comment-reports/:id')
  updateCommentReport(
    @Param('id') id: string,
    @Query('locale') locale?: string,
    @Body() body?: { status?: string; deleteComment?: boolean },
  ) {
    return this.news.adminUpdateCommentReport(id, locale, body || {});
  }

  @Get('comment-report-options')
  getCommentReportOptions(@Query('locale') locale?: string) {
    return this.news.adminGetCommentReportOptions(locale);
  }

  @Put('comment-report-options')
  saveCommentReportOptions(
    @Query('locale') locale?: string,
    @Body() body?: { items?: Array<{ key?: string; labelEs?: string; labelEn?: string; enabled?: boolean; sort?: number }> },
  ) {
    return this.news.adminSaveCommentReportOptions(locale, body?.items || []);
  }

  @Post('posts/:id/restore')
  restore(@Param('id') id: string, @Query('locale') locale?: string) {
    return this.news.restore(id, locale);
  }

  @Delete('posts/:id')
  remove(@Param('id') id: string, @Query('locale') locale?: string) {
    return this.news.remove(id, locale);
  }

  @Get('pages')
  listPages(@Query('locale') locale?: string) {
    return this.news.listSitePages(locale);
  }

  @Get('pages/:key')
  getPage(@Param('key') key: string, @Query('locale') locale?: string) {
    return this.news.adminGetSitePage(key, locale);
  }

  @Patch('pages/:key')
  updatePage(
    @Param('key') key: string,
    @Body() body: { locale?: string; title?: string; content?: string; status?: string },
  ) {
    return this.news.updateSitePage(key, body);
  }
}
