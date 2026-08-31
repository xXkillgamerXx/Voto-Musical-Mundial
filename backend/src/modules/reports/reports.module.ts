import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { ContentReportsController } from './content-reports.controller';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule, forwardRef(() => AdminModule)],
  controllers: [ReportsController, ContentReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
