import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { LifecycleNotifyService } from '../modules/admin/lifecycle-notify.service';

const TICK_MS = 60_000;

@Injectable()
export class LifecycleNotifyWorker implements OnModuleDestroy {
  private readonly logger = new Logger(LifecycleNotifyWorker.name);
  private interval?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly lifecycle: LifecycleNotifyService) {}

  async start() {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      this.tick().catch((error) => this.logger.error(error));
    }, TICK_MS);

    await this.tick();
    this.logger.log('Lifecycle notify worker started');
  }

  async tick() {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      await this.lifecycle.runClosingReminders();
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
