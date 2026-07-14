import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { PrivacyConfigService } from './privacy-config.service';
import { PrivacyController } from './privacy.controller';
import { TermsConfigService } from './terms-config.service';
import { TermsController } from './terms.controller';

@Module({
  imports: [RedisModule],
  controllers: [TermsController, PrivacyController],
  providers: [TermsConfigService, PrivacyConfigService],
  exports: [TermsConfigService, PrivacyConfigService],
})
export class SettingsModule {}
