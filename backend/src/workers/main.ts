import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { NotificationCampaignWorker } from './notification-campaign.worker';
import { VoteBotCampaignWorker } from './vote-bot-campaign.worker';
import { VoteSyncWorker } from './vote-sync.worker';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  const voteSyncWorker = app.get(VoteSyncWorker);
  const voteBotCampaignWorker = app.get(VoteBotCampaignWorker);
  const notificationCampaignWorker = app.get(NotificationCampaignWorker);

  await voteSyncWorker.start();
  await voteBotCampaignWorker.start();
  await notificationCampaignWorker.start();

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void bootstrap();
