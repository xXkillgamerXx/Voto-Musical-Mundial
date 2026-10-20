import { Controller, Get, Param, Query } from '@nestjs/common';
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

  @Get('posts/:slug')
  findOne(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.news.findBySlug(slug, locale);
  }
}
