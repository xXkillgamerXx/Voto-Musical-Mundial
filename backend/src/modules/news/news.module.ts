import { Module } from '@nestjs/common';
import { NewsAdminController } from './news-admin.controller';
import { NewsController } from './news.controller';
import { NewsShareController } from './news-share.controller';
import { NewsSitemapController } from './news-sitemap.controller';
import { NewsFeedController } from './news-feed.controller';
import { NewsMysqlService } from './news-mysql';
import { NewsService } from './news.service';
import { NewsSitemapService } from './news-sitemap.service';

@Module({
  controllers: [NewsController, NewsShareController, NewsSitemapController, NewsFeedController, NewsAdminController],
  providers: [NewsMysqlService, NewsService, NewsSitemapService],
  exports: [NewsService, NewsSitemapService],
})
export class NewsModule {}
