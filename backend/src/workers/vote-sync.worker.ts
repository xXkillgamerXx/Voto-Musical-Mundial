import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../modules/prisma/prisma.service';
import { RedisService } from '../modules/redis/redis.service';

type StreamVote = {
  pollId: string;
  roundId: string;
  contestantId: string;
  artistId: string;
  userId: string;
  anonymousId: string;
  ipHash: string;
  voteScope: string;
  amount: string;
  pointsSpent: string;
  isAnonymous: string;
  createdAt: string;
};

@Injectable()
export class VoteSyncWorker implements OnModuleDestroy {
  private readonly logger = new Logger(VoteSyncWorker.name);
  private queue?: Queue;
  private worker?: Worker;
  private interval?: NodeJS.Timeout;
  private readonly batchSize: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    this.batchSize = Number(config.get('VOTE_SYNC_BATCH_SIZE') || 1000);
  }

  async start() {
    const connection = new IORedis(this.config.get<string>('REDIS_URL') || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });

    await this.ensureConsumerGroup();
    this.queue = new Queue('vote-sync', { connection: connection as any });
    this.worker = new Worker('vote-sync', () => this.syncOnce(), { connection: connection as any, concurrency: 1 });

    this.interval = setInterval(() => {
      this.queue?.add('sync-votes', {}, { removeOnComplete: true, removeOnFail: 100 }).catch((error) => {
        this.logger.error(error);
      });
    }, 5000);

    await this.queue.add('sync-votes', {}, { removeOnComplete: true, removeOnFail: 100 });
    this.logger.log('Vote sync worker started');
  }

  async syncOnce() {
    const response = await this.redis.client.xreadgroup(
      'GROUP',
      'vote-sync',
      `worker-${process.pid}`,
      'COUNT',
      this.batchSize,
      'BLOCK',
      1000,
      'STREAMS',
      'votes:stream',
      '>',
    );

    const entries = response?.[0]?.[1] || [];
    if (!entries.length) {
      return { processed: 0 };
    }

    const messages = entries.map(([id, fields]) => ({
      id,
      vote: this.parseFields(fields as string[]),
    }));
    const deltas = new Map<string, number>();

    await this.prisma.$transaction(async (tx) => {
      await tx.voteLedger.createMany({
        data: messages.map(({ vote }) => ({
          pollId: BigInt(vote.pollId),
          roundId: vote.roundId ? BigInt(vote.roundId) : null,
          contestantId: BigInt(vote.contestantId),
          userId: vote.userId ? BigInt(vote.userId) : null,
          anonymousId: vote.anonymousId || null,
          ipHash: vote.ipHash || null,
          voteScope: vote.voteScope || null,
          amount: Number(vote.amount || 1),
          pointsSpent: Number(vote.pointsSpent || 0),
          isAnonymous: vote.isAnonymous === '1',
          createdAt: vote.createdAt ? new Date(vote.createdAt) : new Date(),
        })),
      });

      for (const { vote } of messages) {
        const key = `${vote.pollId}:${vote.roundId || '_root'}:${vote.contestantId}:${vote.artistId}`;
        deltas.set(key, (deltas.get(key) || 0) + Number(vote.amount || 1));
      }

      for (const [key, amount] of deltas) {
        const [pollId, _roundId, contestantId, artistId] = key.split(':');
        await tx.contestant.update({
          where: { id: BigInt(contestantId) },
          data: { votes: { increment: amount } },
        });
        await tx.artist.update({
          where: { id: BigInt(artistId) },
          data: {
            totalVotes: { increment: amount },
            popularityScore: { increment: amount },
          },
        });
        await tx.poll.update({
          where: { id: BigInt(pollId) },
          data: { totalVotes: { increment: amount } },
        });
      }
    });

    const pipeline = this.redis.client.multi();
    for (const [key, amount] of deltas) {
      const [pollId, roundId, contestantId] = key.split(':');
      const counterKey = `votes:poll:${pollId}:round:${roundId}`;
      const rankingKey = `ranking:poll:${pollId}:round:${roundId}`;
      pipeline.hincrby(counterKey, contestantId, -amount);
      pipeline.zincrby(rankingKey, -amount, contestantId);
    }
    pipeline.xack('votes:stream', 'vote-sync', ...messages.map((message) => message.id));
    await pipeline.exec();

    return { processed: messages.length };
  }

  async onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
    await Promise.all([this.worker?.close(), this.queue?.close()]);
  }

  private async ensureConsumerGroup() {
    try {
      await this.redis.client.xgroup('CREATE', 'votes:stream', 'vote-sync', '0', 'MKSTREAM');
    } catch (error) {
      if (!String((error as Error).message).includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  private parseFields(fields: string[]): StreamVote {
    const vote: Record<string, string> = {};
    for (let index = 0; index < fields.length; index += 2) {
      vote[fields[index]] = fields[index + 1];
    }
    return vote as StreamVote;
  }
}
