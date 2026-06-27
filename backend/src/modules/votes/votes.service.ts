import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PollStatus, RoundType } from '@prisma/client';
import { Request } from 'express';
import { getClientIp, hashIp } from '../../common/request';
import { AuthService } from '../auth/auth.service';
import { VoteIdentity } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CastVoteDto } from './dto/cast-vote.dto';
import { VoteStatusDto } from './dto/vote-status.dto';

const DEFAULT_COOLDOWN_MINUTES = 60;
const MAX_BATCH_VOTES = 1000;

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
    const amount = Math.min(MAX_BATCH_VOTES, Math.max(1, Math.floor(Number(dto.amount || 1))));
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

    await this.enforceRateLimit(identity, ipHash);
    if (identity.type === 'anonymous') {
      await this.enforceAnonymousCooldown(identity, ipHash, context.poll.id, context.round?.id || null, voteScope, context.config);
    } else {
      await this.spendUserPoints(identity, amount, Number(dto.pointsPerVote ?? 1));
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
      pointsSpent: identity.type === 'user' ? String(amount * Number(dto.pointsPerVote ?? 1)) : '0',
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

    return {
      ok: true,
      pollId: context.poll.id.toString(),
      roundId: context.round?.id?.toString() || null,
      contestantId: context.contestant.id.toString(),
      artistId: context.contestant.artistId.toString(),
      amount,
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

  private resolveVoteScope(roundType?: RoundType | null, matchGroup = 0) {
    if (roundType !== RoundType.versus) {
      return null;
    }

    return `match_${matchGroup || 1}`;
  }

  private async enforceRateLimit(identity: VoteIdentity, ipHash: string) {
    const key = `rl:vote:${identity.type}:${identity.id}:${Math.floor(Date.now() / 60000)}`;
    const ipKey = `rl:vote:ip:${ipHash}:${Math.floor(Date.now() / 60000)}`;
    const result = await this.redis.client.multi().incr(key).expire(key, 60).incr(ipKey).expire(ipKey, 60).exec();
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

    await this.redis.client.multi(...keys.map((key) => ['set', key, '1', 'EX', ttlSeconds] as any)).exec();
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
