import { Controller, Get } from '@nestjs/common';
import { AppDownloadConfigService } from './app-download-config.service';

@Controller('app-download')
export class AppDownloadController {
  constructor(private readonly appDownloadConfig: AppDownloadConfigService) {}

  @Get()
  getAppDownload() {
    return this.appDownloadConfig.getConfigPayload();
  }
}
