import { Controller, Get, Query } from '@nestjs/common';
import { PrivacyConfigService } from './privacy-config.service';

@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacyConfig: PrivacyConfigService) {}

  @Get()
  async getPrivacy(@Query('lang') lang?: string) {
    const settings = await this.privacyConfig.getSettings();
    const locale = String(lang || 'es').trim().toLowerCase().startsWith('en') ? 'en' : 'es';
    return {
      lang: locale,
      ...settings[locale],
      updatedAt: settings.updatedAt,
      locales: {
        es: settings.es,
        en: settings.en,
      },
    };
  }
}
