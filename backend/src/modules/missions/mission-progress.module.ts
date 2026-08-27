import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MissionProgressService } from './mission-progress.service';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [MissionProgressService],
  exports: [MissionProgressService],
})
export class MissionProgressModule {}
