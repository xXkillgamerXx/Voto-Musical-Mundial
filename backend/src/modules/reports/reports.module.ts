import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentReportsController } from './content-reports.controller';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController, ContentReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
