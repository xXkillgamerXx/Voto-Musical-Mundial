import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateNewsCommentDto } from './dto/upsert-news-post.dto';
import { ListNewsDto } from './dto/list-news.dto';
import { NewsService } from './news.service';

@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}

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

  @Get('posts')
  list(@Query() query: ListNewsDto, @Query('locale') locale?: string) {
    return this.news.listPublic({ ...query, locale });
  }

  @Get('legacy-root/:slug')
  async legacyRoot(@Param('slug') slug: string, @Res() res: Response) {
    const dest = await this.news.legacySpanishRedirect(slug);
    if (!dest) return res.status(404).end();
    return res.redirect(301, dest);
  }

  @Get('posts/:slug/comments')
  comments(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.news.listComments(slug, locale);
  }

  @Post('posts/:slug/comments')
  @UseGuards(JwtAuthGuard)
  createComment(
    @Param('slug') slug: string,
    @Body() body: CreateNewsCommentDto,
    @CurrentUser() user: { id: bigint },
    @Query('locale') locale?: string,
  ) {
    return this.news.createComment(slug, locale, user, body.text);
  }

  @Get('posts/:slug')
  findOne(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.news.findBySlug(slug, locale);
  }
}
