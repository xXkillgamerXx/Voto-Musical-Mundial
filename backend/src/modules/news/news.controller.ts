import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { MailService } from '../mail/mail.service';
import { CreateNewsCommentDto } from './dto/upsert-news-post.dto';
import { ListNewsDto } from './dto/list-news.dto';
import { NewsService } from './news.service';

@Controller('news')
export class NewsController {
  constructor(
    private readonly news: NewsService,
    private readonly mail: MailService,
  ) {}

  @Get('home')
  home(@Query('locale') locale?: string) {
    return this.news.home(locale);
  }

  @Get('categories')
  categories(@Query('locale') locale?: string) {
    return this.news.categories(locale);
  }

  @Get('popular')
  popular(
    @Query('locale') locale?: string,
    @Query('exclude') exclude?: string,
    @Query('limit') limit?: string,
  ) {
    return this.news.popular(locale, exclude, Number(limit || 5));
  }

  @Get('tags/:slug')
  tag(@Param('slug') slug: string, @Query() query: ListNewsDto, @Query('locale') locale?: string) {
    return this.news.findTag(slug, locale, query.page, query.limit);
  }

  @Get('posts')
  list(@Query() query: ListNewsDto, @Query('locale') locale?: string) {
    return this.news.listPublic({ ...query, locale });
  }

  @Get('authors/:slug')
  author(
    @Param('slug') slug: string,
    @Query() query: ListNewsDto,
    @Query('locale') locale?: string,
  ) {
    return this.news.findAuthor(slug, locale, query.page, query.limit);
  }

  @Get('legacy-root/:slug')
  async legacyRoot(@Param('slug') slug: string, @Res() res: Response) {
    const dest = await this.news.legacySpanishRedirect(slug);
    if (!dest) return res.status(404).end();
    return res.redirect(301, dest);
  }

  @Get('posts/:slug/comments')
  @UseGuards(OptionalJwtAuthGuard)
  comments(
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
    @CurrentUser() user?: { id: bigint } | null,
  ) {
    return this.news.listComments(slug, locale, user || null);
  }

  @Post('posts/:slug/comments')
  @UseGuards(JwtAuthGuard)
  createComment(
    @Param('slug') slug: string,
    @Body() body: CreateNewsCommentDto,
    @CurrentUser() user: { id: bigint },
    @Query('locale') locale?: string,
  ) {
    return this.news.createComment(slug, locale, user, body.text || '', body.parentId, body.gif);
  }

  @Post('posts/:slug/comments/:id/vote')
  @UseGuards(JwtAuthGuard)
  voteComment(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: { value?: number },
    @CurrentUser() user: { id: bigint },
    @Query('locale') locale?: string,
  ) {
    return this.news.voteComment(slug, id, locale, user, Number(body?.value || 0));
  }

  @Post('posts/:slug/comments/:id/react')
  @UseGuards(JwtAuthGuard)
  reactComment(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: { reaction?: string },
    @CurrentUser() user: { id: bigint },
    @Query('locale') locale?: string,
  ) {
    return this.news.reactComment(slug, id, locale, user, String(body?.reaction || ''));
  }

  @Get('comment-report-options')
  listCommentReportOptions(@Query('locale') locale?: string) {
    return this.news.listCommentReportOptions(locale);
  }

  @Post('posts/:slug/comments/:id/report')
  @UseGuards(JwtAuthGuard)
  reportComment(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: { reason?: string; details?: string },
    @CurrentUser() user: { id: bigint },
    @Query('locale') locale?: string,
  ) {
    return this.news.reportComment(slug, id, locale, user, body || {});
  }

  @Get('posts/:slug')
  findOne(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.news.findBySlug(slug, locale);
  }

  @Get('pages')
  listPages(@Query('locale') locale?: string) {
    return this.news.listSitePages(locale);
  }

  @Get('pages/:slug')
  getPage(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.news.getSitePage(slug, locale);
  }

  @Post('contact')
  async contact(
    @Body()
    body: { name?: string; email?: string; subject?: string; message?: string },
  ) {
    try {
      return await this.mail.sendContactForm({
        name: String(body?.name || ''),
        email: String(body?.email || ''),
        subject: String(body?.subject || ''),
        message: String(body?.message || ''),
      });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'No se pudo enviar el mensaje.');
    }
  }
}
