import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { VoteSyncWorker } from './vote-sync.worker';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  const voteSyncWorker = app.get(VoteSyncWorker);

  await voteSyncWorker.start();

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void bootstrap();
