import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { FanService } from '../modules/fan/fan.service';

const TICK_MS = 60 * 60 * 1000;

@Injectable()
export class FanBonusWorker implements OnModuleDestroy {
  private readonly logger = new Logger(FanBonusWorker.name);
  private interval?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly fan: FanService) {}

  async start() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      this.tick().catch((error) => this.logger.error(error));
    }, TICK_MS);
    await this.tick();
    this.logger.log('Fan bonus worker started');
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.fan.grantDueBonuses();
    } finally {
      this.running = false;
    }
  }

  async onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}
