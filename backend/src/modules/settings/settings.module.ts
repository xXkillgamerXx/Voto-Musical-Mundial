import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { AppDownloadConfigService } from './app-download-config.service';
import { AppDownloadController } from './app-download.controller';
import { PrivacyConfigService } from './privacy-config.service';
import { PrivacyController } from './privacy.controller';
import { TermsConfigService } from './terms-config.service';
import { TermsController } from './terms.controller';

@Module({
  imports: [RedisModule],
  controllers: [TermsController, PrivacyController, AppDownloadController],
  providers: [TermsConfigService, PrivacyConfigService, AppDownloadConfigService],
  exports: [TermsConfigService, PrivacyConfigService, AppDownloadConfigService],
})
export class SettingsModule {}
