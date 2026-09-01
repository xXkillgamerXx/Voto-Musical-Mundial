import { Controller, Get } from '@nestjs/common';
import { FanStoreConfigService } from './fan-store-config.service';

@Controller('fan-store')
export class FanStoreController {
  constructor(private readonly fanStoreConfig: FanStoreConfigService) {}

  @Get()
  getFanStore() {
    return this.fanStoreConfig.getPublicPayload();
  }
}
