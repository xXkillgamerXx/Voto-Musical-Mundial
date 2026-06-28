import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PollStatus, RoundType } from '@prisma/client';
import { Request } from 'express';
import { BLOCKED_IPS_KEY, BLOCKED_USERS_KEY } from '../../common/moderation-keys';
import { getClientIp, hashIp } from '../../common/request';
import { AuthService } from '../auth/auth.service';
import { VoteIdentity } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CastVoteDto } from './dto/cast-vote.dto';
import { VoteStatusDto } from './dto/vote-status.dto';

const DEFAULT_COOLDOWN_MINUTES = 60;
// Server-side hard cap on how many votes a single registered request may add.
// Anonymous requests are always forced to 1 (see castVote).
const MAX_BATCH_VOTES = 100;
const DEFAULT_POINTS_PER_VOTE = 1;

@Injectable()
export class VotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  async castVote(dto: CastVoteDto, request: Request) {
    const identity = await this.auth.resolveVoteIdentity(request.headers.authorization);
    const requestedAmount = Math.max(1, Math.floor(Number(dto.amount || 1)));
    // Anonymous votes are always single; only registered users may batch (capped server-side).
    const amount =
      identity.type === 'anonymous' ? 1 : Math.min(MAX_BATCH_VOTES, requestedAmount);
    const context = await this.loadContext(dto);
    const now = new Date();

    if (context.poll.status !== PollStatus.live) {
      throw new BadRequestException('La votacion no esta abierta.');
    }

    const endsAt = context.round?.endsAt || context.poll.endsAt || context.poll.activeEndAt;
    if (endsAt && endsAt.getTime() <= now.getTime()) {
      throw new BadRequestException('La votacion ya termino.');
    }

    const voteScope = this.resolveVoteScope(context.round?.type, context.contestant.matchGroup);
    const ipHash = hashIp(getClientIp(request), this.config.get<string>('IP_HASH_SALT') || 'votomusicamundial');
    // Vote cost is resolved exclusively from server-side poll/round config; the client value is ignored.
    const costPerVote = this.resolveVoteCost(context.poll.config, context.round?.config);

    await this.enforceNotBlocked(ipHash, identity.userId || null);
    await this.enforceRateLimit(identity, ipHash, amount);
    if (identity.type === 'anonymous') {
      await this.enforceAnonymousCooldown(identity, ipHash, context.poll.id, context.round?.id || null, voteScope, context.config);
    } else {
      await this.spendUserPoints(identity, amount, costPerVote);
    }

    const roundKey = context.round?.id?.toString() || '_root';
    const counterKey = `votes:poll:${context.poll.id.toString()}:round:${roundKey}`;
    const rankingKey = `ranking:poll:${context.poll.id.toString()}:round:${roundKey}`;
    const channel = `poll:${context.poll.id.toString()}:votes`;

    const streamPayload = {
      pollId: context.poll.id.toString(),
      roundId: context.round?.id?.toString() || '',
      contestantId: context.contestant.id.toString(),
      artistId: context.contestant.artistId.toString(),
      userId: identity.userId?.toString() || '',
      anonymousId: identity.type === 'anonymous' ? identity.id : '',
      ipHash,
      voteScope: voteScope || '',
      amount: amount.toString(),
      pointsSpent: identity.type === 'user' ? String(amount * costPerVote) : '0',
      isAnonymous: identity.type === 'anonymous' ? '1' : '0',
      createdAt: now.toISOString(),
    };

    await this.redis.client
      .multi()
      .hincrby(counterKey, context.contestant.id.toString(), amount)
      .zincrby(rankingKey, amount, context.contestant.id.toString())
      .xadd('votes:stream', 'MAXLEN', '~', '1000000', '*', ...Object.entries(streamPayload).flat())
      .publish(
        channel,
        JSON.stringify({
          type: 'vote_delta',
          pollId: context.poll.id.toString(),
          roundId: context.round?.id?.toString() || null,
          contestantId: context.contestant.id.toString(),
          artistId: context.contestant.artistId.toString(),
          amount,
        }),
      )
      .exec();

    let user: { points: number; spentPoints: number } | null = null;
    if (identity.type === 'user' && identity.userId) {
      const fresh = await this.prisma.user.findUnique({
        where: { id: identity.userId },
        select: { points: true, spentPoints: true },
      });
      if (fresh) {
        user = { points: Number(fresh.points), spentPoints: Number(fresh.spentPoints) };
      }
    }

    return {
      ok: true,
      pollId: context.poll.id.toString(),
      roundId: context.round?.id?.toString() || null,
      contestantId: context.contestant.id.toString(),
      artistId: context.contestant.artistId.toString(),
      amount,
      user,
      status: identity.type === 'anonymous'
        ? this.statusPayload(context.config.cooldownMinutes, Date.now() + context.config.cooldownMs)
        : null,
    };
  }

  async status(dto: VoteStatusDto, request: Request) {
    const identity = await this.auth.resolveVoteIdentity(request.headers.authorization);
    const context = await this.loadPollOnly(dto.pollId, dto.roundId);
    const config = this.anonymousConfig(context.poll.config, context.round?.config);

    if (identity.type !== 'anonymous') {
      return this.statusPayload(config.cooldownMinutes, 0);
    }

    const ipHash = hashIp(getClientIp(request), this.config.get<string>('IP_HASH_SALT') || 'votomusicamundial');
    const keys = this.cooldownKeys(identity.id, ipHash, context.poll.id, context.round?.id || null, dto.voteScope || null, config.blockByIp);
    const ttls = await Promise.all(keys.map((key) => this.redis.client.pttl(key)));
    const remainingMs = Math.max(0, ...ttls);

    return this.statusPayload(config.cooldownMinutes, remainingMs ? Date.now() + remainingMs : 0);
  }

  private async loadContext(dto: CastVoteDto) {
    const context = await this.loadPollOnly(dto.pollId, dto.roundId);
    const contestantOr: any[] = [];
    if (dto.contestantId) {
      contestantOr.push({ id: BigInt(Number(dto.contestantId) || 0) }, { firebaseId: dto.contestantId });
    }
    if (dto.artistId) {
      contestantOr.push(
        { artist: { firebaseId: dto.artistId } },
        { artist: { slug: dto.artistId } },
        { artistId: BigInt(Number(dto.artistId) || 0) },
      );
    }

    if (!contestantOr.length) {
      throw new BadRequestException('Falta el participante del voto.');
    }

    const contestant = await this.prisma.contestant.findFirst({
      where: {
        pollId: context.poll.id,
        roundId: context.round?.id || null,
        OR: contestantOr,
      },
      include: { artist: true },
    });

    if (!contestant) {
      throw new NotFoundException('El participante no pertenece a esta votacion.');
    }

    return {
      ...context,
      contestant,
    };
  }

  private async loadPollOnly(pollId: string, roundId?: string) {
    const poll = await this.prisma.poll.findFirst({
      where: { OR: [{ id: BigInt(Number(pollId) || 0) }, { slug: pollId }, { firebaseId: pollId }] },
    });

    if (!poll) {
      throw new NotFoundException('La votacion no existe.');
    }

    const round = roundId
      ? await this.prisma.round.findFirst({
          where: {
            pollId: poll.id,
            OR: [{ id: BigInt(Number(roundId) || 0) }, { firebaseId: roundId }],
          },
        })
      : null;

    if (roundId && !round) {
      throw new NotFoundException('La ronda no existe.');
    }

    return {
      poll,
      round,
      config: this.anonymousConfig(poll.config, round?.config),
    };
  }

  private anonymousConfig(pollConfig: unknown, roundConfig: unknown) {
    const merged = {
      ...(typeof pollConfig === 'object' && pollConfig ? (pollConfig as Record<string, any>).anonymousVoting || {} : {}),
      ...(typeof roundConfig === 'object' && roundConfig ? (roundConfig as Record<string, any>).anonymousVoting || {} : {}),
    };
    const cooldownMinutes = Math.min(
      24 * 60,
      Math.max(
        1,
        Math.floor(Number(merged.cooldownMinutes || this.config.get('DEFAULT_ANONYMOUS_COOLDOWN_MINUTES') || DEFAULT_COOLDOWN_MINUTES)),
      ),
    );

    return {
      enabled: merged.enabled !== false,
      blockByIp: merged.blockByIp !== false,
      cooldownMinutes,
      cooldownMs: cooldownMinutes * 60 * 1000,
    };
  }

  private resolveVoteCost(pollConfig: unknown, roundConfig: unknown) {
    const pollVoting =
      typeof pollConfig === 'object' && pollConfig ? (pollConfig as Record<string, any>).voting || {} : {};
    const roundVoting =
      typeof roundConfig === 'object' && roundConfig ? (roundConfig as Record<string, any>).voting || {} : {};
    const merged = { ...pollVoting, ...roundVoting };
    const fallback = Number(this.config.get('DEFAULT_POINTS_PER_VOTE') || DEFAULT_POINTS_PER_VOTE);
    const raw = merged.costPerVote === undefined ? fallback : Number(merged.costPerVote);
    const cost = Number.isFinite(raw) ? Math.floor(raw) : fallback;
    // Clamp to a sane range; defaults to 1 so the points economy can never be bypassed by accident.
    return Math.min(1000, Math.max(0, cost));
  }

  private resolveVoteScope(roundType?: RoundType | null, matchGroup = 0) {
    if (roundType !== RoundType.versus) {
      return null;
    }

    return `match_${matchGroup || 1}`;
  }

  private async enforceNotBlocked(ipHash: string, userId: bigint | null) {
    const checks: Promise<number>[] = [this.redis.client.hexists(BLOCKED_IPS_KEY, ipHash)];
    if (userId) {
      checks.push(this.redis.client.hexists(BLOCKED_USERS_KEY, userId.toString()));
    }

    const [ipBlocked, userBlocked] = await Promise.all(checks);
    if (ipBlocked || userBlocked) {
      throw new ForbiddenException('Tu acceso a las votaciones esta bloqueado.');
    }
  }

  private async enforceRateLimit(identity: VoteIdentity, ipHash: string, amount: number) {
    const window = Math.floor(Date.now() / 60000);
    const key = `rl:vote:${identity.type}:${identity.id}:${window}`;
    const ipKey = `rl:vote:ip:${ipHash}:${window}`;
    // Count by number of votes (not requests) so batching cannot bypass the limit.
    const result = await this.redis.client
      .multi()
      .incrby(key, amount)
      .expire(key, 60)
      .incrby(ipKey, amount)
      .expire(ipKey, 60)
      .exec();
    const userVotes = Number(result?.[0]?.[1] || 0);
    const ipVotes = Number(result?.[2]?.[1] || 0);

    if (userVotes > 120 || ipVotes > 600) {
      throw new HttpException('Demasiados votos en poco tiempo.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async enforceAnonymousCooldown(
    identity: VoteIdentity,
    ipHash: string,
    pollId: bigint,
    roundId: bigint | null,
    voteScope: string | null,
    config: { enabled: boolean; blockByIp: boolean; cooldownMs: number },
  ) {
    if (!config.enabled) {
      throw new BadRequestException('El voto anonimo no esta activo.');
    }

    const keys = this.cooldownKeys(identity.id, ipHash, pollId, roundId, voteScope, config.blockByIp);
    const ttlSeconds = Math.ceil(config.cooldownMs / 1000);
    const existingTtls = await Promise.all(keys.map((key) => this.redis.client.pttl(key)));
    const remainingMs = Math.max(0, ...existingTtls);

    if (remainingMs > 0) {
      throw new HttpException(
        {
          message: 'Debes esperar para votar otra vez.',
          nextVoteAt: new Date(Date.now() + remainingMs).toISOString(),
          remainingMs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const pipeline = this.redis.client.multi();
    keys.forEach((key) => {
      pipeline.set(key, '1', 'EX', ttlSeconds);
    });
    await pipeline.exec();
  }

  private cooldownKeys(
    uid: string,
    ipHash: string,
    pollId: bigint,
    roundId: bigint | null,
    voteScope: string | null,
    blockByIp: boolean,
  ) {
    const scope = voteScope || (roundId ? `round_${roundId.toString()}` : '_root');
    const base = `cooldown:poll:${pollId.toString()}:scope:${scope}`;
    const keys = [`${base}:uid:${uid}`];
    if (blockByIp) keys.push(`${base}:ip:${ipHash}`);
    return keys;
  }

  private async spendUserPoints(identity: VoteIdentity, amount: number, pointsPerVote: number) {
    const pointsToSpend = amount * pointsPerVote;
    if (!identity.userId || pointsToSpend <= 0) return;

    const updated = await this.prisma.user.updateMany({
      where: {
        id: identity.userId,
        points: { gte: pointsToSpend },
      },
      data: {
        points: { decrement: pointsToSpend },
        spentPoints: { increment: pointsToSpend },
      },
    });

    if (!updated.count) {
      throw new BadRequestException('No tienes puntos suficientes.');
    }
  }

  private statusPayload(cooldownMinutes: number, nextVoteAtMs: number) {
    return {
      enabled: true,
      blockByIp: true,
      cooldownMinutes,
      nextVoteAt: nextVoteAtMs ? new Date(nextVoteAtMs).toISOString() : null,
      remainingMs: Math.max(0, nextVoteAtMs - Date.now()),
    };
  }
}
