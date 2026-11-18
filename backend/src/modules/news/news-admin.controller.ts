import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UpsertNewsCategoryDto, UpsertNewsPostDto } from './dto/upsert-news-post.dto';
import { NewsService } from './news.service';

type NewsActor = { id: bigint; role?: string };

const FULL_ADMIN = [UserRole.admin, UserRole.superadmin, UserRole.owner] as const;
const NEWS_STAFF = [...FULL_ADMIN, UserRole.author] as const;

@Controller('admin/news')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...NEWS_STAFF)
export class NewsAdminController {
  constructor(private readonly news: NewsService) {}

  private assertFullAdmin(user?: { role?: string }) {
    const role = String(user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'superadmin' && role !== 'owner') {
      throw new ForbiddenException('Solo administradores pueden usar esta sección.');
    }
  }

  @Get('overview')
  overview(@Query('days') days?: string, @CurrentUser() user?: NewsActor) {
    this.assertFullAdmin(user);
    return this.news.adminOverview(Number(days || 30));
  }

  @Get('posts')
  list(
    @CurrentUser() user: NewsActor,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('locale') locale?: string,
    @Query('author') author?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.news.adminList(
      {
        page: Number(page || 1),
        limit: Number(limit || 20),
        q,
        status,
        locale,
        author,
        from,
        to,
      },
      user,
    );
  }

  @Get('authors')
  authors(
    @CurrentUser() user: NewsActor,
    @Query('locale') locale?: string,
    @Query('q') q?: string,
  ) {
    return this.news.adminAuthors(locale, q, user);
  }

  @Patch('authors/:id')
  updateAuthor(
    @CurrentUser() user: NewsActor,
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
    this.assertFullAdmin(user);
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
    @CurrentUser() user: NewsActor,
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
    this.assertFullAdmin(user);
    return this.news.updateTag(id, body);
  }

  @Get('categories')
  categories(@Query('locale') locale?: string) {
    return this.news.categories(locale);
  }

  @Post('categories')
  createCategory(@CurrentUser() user: NewsActor, @Body() body: UpsertNewsCategoryDto) {
    this.assertFullAdmin(user);
    return this.news.createCategory(body);
  }

  @Patch('categories/:id')
  updateCategory(
    @CurrentUser() user: NewsActor,
    @Param('id') id: string,
    @Body() body: UpsertNewsCategoryDto,
  ) {
    this.assertFullAdmin(user);
    return this.news.updateCategory(id, body);
  }

  @Delete('categories/:id')
  removeCategory(@CurrentUser() user: NewsActor, @Param('id') id: string) {
    this.assertFullAdmin(user);
    return this.news.removeCategory(id);
  }

  @Get('posts/:id/comments')
  postComments(
    @CurrentUser() user: NewsActor,
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ) {
    this.assertFullAdmin(user);
    return this.news.adminListComments(id, locale);
  }

  @Get('posts/:id')
  getOne(
    @CurrentUser() user: NewsActor,
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ) {
    return this.news.adminGet(id, locale, user);
  }

  @Post('posts')
  create(@Body() body: UpsertNewsPostDto, @CurrentUser() user: NewsActor) {
    return this.news.create(body, user);
  }

  @Patch('posts/:id')
  update(
    @Param('id') id: string,
    @Body() body: UpsertNewsPostDto,
    @CurrentUser() user: NewsActor,
  ) {
    return this.news.update(id, body, user);
  }

  @Delete('comments/:id')
  removeComment(
    @CurrentUser() user: NewsActor,
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ) {
    this.assertFullAdmin(user);
    return this.news.removeComment(id, locale);
  }

  @Get('comment-reports')
  listCommentReports(
    @CurrentUser() user: NewsActor,
    @Query('locale') locale?: string,
    @Query('status') status?: string,
  ) {
    this.assertFullAdmin(user);
    return this.news.adminListCommentReports(locale, status);
  }

  @Patch('comment-reports/:id')
  updateCommentReport(
    @CurrentUser() user: NewsActor,
    @Param('id') id: string,
    @Query('locale') locale?: string,
    @Body() body?: { status?: string; deleteComment?: boolean },
  ) {
    this.assertFullAdmin(user);
    return this.news.adminUpdateCommentReport(id, locale, body || {});
  }

  @Get('comment-report-options')
  getCommentReportOptions(@CurrentUser() user: NewsActor, @Query('locale') locale?: string) {
    this.assertFullAdmin(user);
    return this.news.adminGetCommentReportOptions(locale);
  }

  @Put('comment-report-options')
  saveCommentReportOptions(
    @CurrentUser() user: NewsActor,
    @Query('locale') locale?: string,
    @Body() body?: { items?: Array<{ key?: string; labelEs?: string; labelEn?: string; enabled?: boolean; sort?: number }> },
  ) {
    this.assertFullAdmin(user);
    return this.news.adminSaveCommentReportOptions(locale, body?.items || []);
  }

  @Post('posts/:id/restore')
  restore(
    @CurrentUser() user: NewsActor,
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ) {
    return this.news.restore(id, locale, user);
  }

  @Delete('posts/:id')
  remove(
    @CurrentUser() user: NewsActor,
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ) {
    return this.news.remove(id, locale, user);
  }

  @Get('pages')
  listPages(@CurrentUser() user: NewsActor, @Query('locale') locale?: string) {
    this.assertFullAdmin(user);
    return this.news.listSitePages(locale);
  }

  @Get('pages/:key')
  getPage(
    @CurrentUser() user: NewsActor,
    @Param('key') key: string,
    @Query('locale') locale?: string,
  ) {
    this.assertFullAdmin(user);
    return this.news.adminGetSitePage(key, locale);
  }

  @Patch('pages/:key')
  updatePage(
    @CurrentUser() user: NewsActor,
    @Param('key') key: string,
    @Body() body: { locale?: string; title?: string; content?: string; status?: string },
  ) {
    this.assertFullAdmin(user);
    return this.news.updateSitePage(key, body);
  }

  @Get('api-keys')
  listApiKeys(@CurrentUser() user: NewsActor) {
    this.assertFullAdmin(user);
    return this.news.listIntegrationApiKeys();
  }

  @Post('api-keys')
  createApiKey(
    @CurrentUser() user: NewsActor,
    @Body() body: { name?: string; special?: boolean; expiresAt?: string | null },
  ) {
    this.assertFullAdmin(user);
    return this.news.createIntegrationApiKey({
      name: body?.name,
      special: body?.special,
      expiresAt: body?.expiresAt,
      createdBy: user?.id ?? null,
    });
  }

  @Patch('api-keys/:id')
  updateApiKey(
    @CurrentUser() user: NewsActor,
    @Param('id') id: string,
    @Body() body: { name?: string; active?: boolean; special?: boolean; expiresAt?: string | null },
  ) {
    this.assertFullAdmin(user);
    return this.news.updateIntegrationApiKey(id, body || {});
  }

  @Delete('api-keys/:id')
  deleteApiKey(@CurrentUser() user: NewsActor, @Param('id') id: string) {
    this.assertFullAdmin(user);
    return this.news.deleteIntegrationApiKey(id);
  }
}
