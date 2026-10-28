import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { NewsSitemapService } from '../modules/news/news-sitemap.service';

const TICK_MS = 30 * 60_000;

@Injectable()
export class NewsSitemapWorker implements OnModuleDestroy {
  private readonly logger = new Logger(NewsSitemapWorker.name);
  private interval?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly sitemaps: NewsSitemapService) {}

  async start() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      this.tick().catch((error) => this.logger.error(error));
    }, TICK_MS);
    await this.tick();
    this.logger.log('News sitemap worker started');
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.sitemaps.refreshAll();
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
