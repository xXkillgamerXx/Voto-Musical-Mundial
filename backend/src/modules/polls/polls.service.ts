import { Injectable, NotFoundException } from '@nestjs/common';
import { PollStatus } from '@prisma/client';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const POLLS_CACHE_SECONDS = 90;

@Injectable()
export class PollsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(limit = 100) {
    const key = `cache:polls:${limit}`;
    const cached = await this.redis.client.get(key);
    if (cached) return JSON.parse(cached);

    const polls = await this.prisma.poll.findMany({
      take: Math.min(limit, 200),
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        rounds: { orderBy: { createdAt: 'asc' } },
      },
    });
    const payload = serialize(polls);

    await this.redis.client.set(key, JSON.stringify(payload), 'EX', POLLS_CACHE_SECONDS);
    return payload;
  }

  async live(limit = 12) {
    const polls = await this.prisma.poll.findMany({
      take: Math.min(limit, 50),
      where: { status: { in: [PollStatus.live, PollStatus.selecting_winners] } },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        rounds: { orderBy: { createdAt: 'asc' } },
      },
    });

    return serialize(polls);
  }

  async findOne(id: string) {
    const poll = await this.prisma.poll.findFirst({
      where: {
        OR: [{ id: BigInt(Number(id) || 0) }, { slug: id }, { firebaseId: id }],
      },
      include: {
        category: true,
        rounds: { orderBy: { createdAt: 'asc' } },
        contestants: {
          include: { artist: true },
          orderBy: [{ matchGroup: 'asc' }, { matchOrder: 'asc' }, { order: 'asc' }],
        },
      },
    });

    if (!poll) {
      throw new NotFoundException('La votacion no existe.');
    }

    return serialize(poll);
  }

  async getResults(pollId: string, roundId?: string) {
    const poll = await this.prisma.poll.findFirst({
      where: { OR: [{ id: BigInt(Number(pollId) || 0) }, { slug: pollId }, { firebaseId: pollId }] },
      select: { id: true },
    });
    if (!poll) throw new NotFoundException('La votacion no existe.');

    const resolvedRoundId = roundId ? BigInt(Number(roundId) || 0) : null;
    const rankingKey = `ranking:poll:${poll.id.toString()}:round:${resolvedRoundId?.toString() || '_root'}`;
    const redisRanking = await this.redis.client.zrevrange(rankingKey, 0, -1, 'WITHSCORES');
    const redisScores = new Map<string, number>();

    for (let index = 0; index < redisRanking.length; index += 2) {
      redisScores.set(redisRanking[index], Number(redisRanking[index + 1] || 0));
    }

    const contestants = await this.prisma.contestant.findMany({
      where: { pollId: poll.id, roundId: resolvedRoundId },
      include: { artist: true },
      orderBy: [{ matchGroup: 'asc' }, { matchOrder: 'asc' }, { order: 'asc' }],
    });

    const results = contestants
      .map((contestant) => {
        const redisVotes = redisScores.get(contestant.id.toString()) || 0;
        const votes = Number(contestant.votes) + redisVotes;
        const manualVotes = Number(contestant.manualVotes);
        return {
          id: contestant.id.toString(),
          contestantId: contestant.id.toString(),
          artistId: contestant.artistId.toString(),
          artist: serialize(contestant.artist),
          votes,
          manualVotes,
          totalVotes: votes + manualVotes,
          matchGroup: contestant.matchGroup,
          matchOrder: contestant.matchOrder,
          order: contestant.order,
        };
      })
      .sort((current, next) => next.totalVotes - current.totalVotes);

    const totalVotes = results.reduce((sum, result) => sum + result.totalVotes, 0);

    return {
      pollId: poll.id.toString(),
      roundId: resolvedRoundId?.toString() || null,
      totalVotes,
      leaderArtistId: results[0]?.artistId || null,
      leaderVotes: results[0]?.totalVotes || 0,
      results: results.map((result, index) => ({
        ...result,
        rank: index + 1,
        percent: totalVotes ? (result.totalVotes / totalVotes) * 100 : 0,
      })),
      updatedAt: new Date().toISOString(),
    };
  }
}
