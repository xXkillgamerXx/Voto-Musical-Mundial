import { Module } from '@nestjs/common';
import { VoteSyncWorker } from './vote-sync.worker';

@Module({
  providers: [VoteSyncWorker],
  exports: [VoteSyncWorker],
})
export class WorkersModule {}
