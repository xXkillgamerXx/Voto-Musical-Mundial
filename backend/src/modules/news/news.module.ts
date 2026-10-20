import { Module } from '@nestjs/common';
import { NewsAdminController } from './news-admin.controller';
import { NewsController } from './news.controller';
import { NewsMysqlService } from './news-mysql';
import { NewsService } from './news.service';

@Module({
  controllers: [NewsController, NewsAdminController],
  providers: [NewsMysqlService, NewsService],
  exports: [NewsService],
})
export class NewsModule {}
