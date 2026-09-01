import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { AppDownloadConfigService } from './app-download-config.service';
import { AppDownloadController } from './app-download.controller';
import { FanStoreConfigService } from './fan-store-config.service';
import { FanStoreController } from './fan-store.controller';
import { PrivacyConfigService } from './privacy-config.service';
import { PrivacyController } from './privacy.controller';
import { TermsConfigService } from './terms-config.service';
import { TermsController } from './terms.controller';

@Module({
  imports: [RedisModule],
  controllers: [TermsController, PrivacyController, AppDownloadController, FanStoreController],
  providers: [TermsConfigService, PrivacyConfigService, AppDownloadConfigService, FanStoreConfigService],
  exports: [TermsConfigService, PrivacyConfigService, AppDownloadConfigService, FanStoreConfigService],
})
export class SettingsModule {}
