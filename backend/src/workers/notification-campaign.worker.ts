import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { NotificationCampaignsService } from '../modules/admin/notification-campaigns.service';

const TICK_MS = 60_000;

@Injectable()
export class NotificationCampaignWorker implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationCampaignWorker.name);
  private interval?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly campaigns: NotificationCampaignsService) {}

  async start() {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      this.tick().catch((error) => this.logger.error(error));
    }, TICK_MS);

    await this.tick();
    this.logger.log('Notification campaign worker started');
  }

  async tick() {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      await this.campaigns.runDue();
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
