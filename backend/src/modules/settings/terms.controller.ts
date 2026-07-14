import { Controller, Get, Query } from '@nestjs/common';
import { TermsConfigService } from './terms-config.service';

@Controller('terms')
export class TermsController {
  constructor(private readonly termsConfig: TermsConfigService) {}

  @Get()
  async getTerms(@Query('lang') lang?: string) {
    const settings = await this.termsConfig.getSettings();
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
