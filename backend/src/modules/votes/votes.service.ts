import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PollStatus, RoundType, UserRole } from '@prisma/client';
import { Request } from 'express';
import { BLOCKED_IPS_KEY, BLOCKED_USERS_KEY } from '../../common/moderation-keys';
import { pollLookupWhere } from '../../common/poll-lookup';
import { getClientIp, hashIp } from '../../common/request';
import { serialize } from '../../common/serialize';
import { AuthService } from '../auth/auth.service';
import { VoteIdentity } from '../auth/auth.types';
import { MissionProgressService } from '../missions/mission-progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ShareVoteBoostConfigService } from '../rewards/share-vote-boost-config.service';
import { CastVoteDto } from './dto/cast-vote.dto';
import { VoteStatusDto } from './dto/vote-status.dto';
import { TurnstileService } from './turnstile.service';

const DEFAULT_COOLDOWN_MINUTES = 60;
// Server-side hard cap on how many votes a single registered request may add.
// Must stay aligned with CastVoteDto @Max(amount) and the frontend vote queue chunk size.
const MAX_BATCH_VOTES = 100000;
const DEFAULT_POINTS_PER_VOTE = 1;
const DEFAULT_USER_VOTES_PER_MINUTE_LIMIT = 20000;
const DEFAULT_IP_VOTES_PER_MINUTE_LIMIT = 30000;
const STAFF_ROLES = new Set<UserRole>([UserRole.admin, UserRole.superadmin, UserRole.owner]);
const SHARE_BOOST_PLATFORMS = new Set([
  'facebook',
  'whatsapp',
  'telegram',
  'twitter',
  'startly',
  'more',
]);

@Injectable()
export class VotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly turnstile: TurnstileService,
    private readonly shareVoteBoostConfig: ShareVoteBoostConfigService,
    private readonly missionProgress: MissionProgressService,
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
    const clientIp = getClientIp(request);
    const ipHash = hashIp(clientIp, this.config.get<string>('IP_HASH_SALT') || 'votomusicamundial');
    // Vote cost is resolved exclusively from server-side poll/round config; the client value is ignored.
    const costPerVote = this.resolveVoteCost(context.poll.config, context.round?.config);

    await this.enforceNotBlocked(ipHash, identity.userId || null);
    await this.enforceRateLimit(identity, ipHash, amount);

    let usedFreeVote = false;
    if (identity.type === 'anonymous') {
      // Bot protection: anonymous voters must pass a Cloudflare Turnstile challenge (when enabled).
      await this.turnstile.verify(dto.turnstileToken, clientIp);
      await this.enforceAnonymousCooldown(
        identity,
        ipHash,
        context.poll.id,
        context.round?.id || null,
        voteScope,
        context.config,
      );
      usedFreeVote = true;
    } else {
      const spent = await this.trySpendUserPoints(identity, amount, costPerVote);
      if (!spent) {
        // Sin puntos: 1 voto gratis con el cooldown del admin (voto anónimo).
        if (amount !== 1 || !context.config.enabled) {
          throw new BadRequestException('No tienes puntos suficientes para votar.');
        }
        await this.enforceAnonymousCooldown(
          identity,
          ipHash,
          context.poll.id,
          context.round?.id || null,
          voteScope,
          context.config,
        );
        usedFreeVote = true;
      }
    }

    const shareBoost = await this.getActiveShareBoost(identity);
    const countedAmount = Math.min(
      MAX_BATCH_VOTES * Math.max(1, shareBoost?.multiplier || 1),
      amount * Math.max(1, shareBoost?.multiplier || 1),
    );

    const roundKey = context.round?.id?.toString() || '_root';
    const counterKey = `votes:poll:${context.poll.id.toString()}:round:${roundKey}`;
    const rankingKey = `ranking:poll:${context.poll.id.toString()}:round:${roundKey}`;
    const channel = `poll:${context.poll.id.toString()}:votes`;
    const voteUser = identity.type === 'user' && identity.userId
      ? await this.prisma.user.findUnique({
        where: { id: identity.userId },
        select: {
          username: true,
          displayName: true,
          photoUrl: true,
          points: true,
          spentPoints: true,
          role: true,
        },
      })
      : null;
    const userDisplayName = voteUser?.displayName || voteUser?.username || '';
    const userPhotoUrl = voteUser?.photoUrl || '';
    const isStaffVote = Boolean(voteUser?.role && STAFF_ROLES.has(voteUser.role));

    const artistName = context.contestant.artist?.name || '';
    const pollTitle = context.poll.title || '';
    const pollConfig = (context.poll.config || {}) as Record<string, unknown>;
    const pollYear = Number(pollConfig.year || new Date(context.poll.createdAt).getFullYear());

    const streamPayload = {
      pollId: context.poll.id.toString(),
      roundId: context.round?.id?.toString() || '',
      contestantId: context.contestant.id.toString(),
      artistId: context.contestant.artistId.toString(),
      userId: identity.userId?.toString() || '',
      username: voteUser?.username || '',
      userDisplayName,
      userPhotoUrl,
      anonymousId: identity.type === 'anonymous' ? identity.id : '',
      ipHash,
      voteScope: voteScope || '',
      amount: countedAmount.toString(),
      pointsSpent: usedFreeVote ? '0' : String(amount * costPerVote),
      isAnonymous: identity.type === 'anonymous' ? '1' : '0',
      shareBoost: shareBoost ? '1' : '0',
      createdAt: now.toISOString(),
    };

    await this.redis.client
      .multi()
      .hincrby(counterKey, context.contestant.id.toString(), countedAmount)
      .zincrby(rankingKey, countedAmount, context.contestant.id.toString())
      .xadd('votes:stream', 'MAXLEN', '~', '1000000', '*', ...Object.entries(streamPayload).flat())
      .publish(
        channel,
        JSON.stringify({
          type: 'vote_delta',
          pollId: context.poll.id.toString(),
          pollTitle,
          pollSlug: context.poll.slug || '',
          pollYear,
          roundId: context.round?.id?.toString() || null,
          contestantId: context.contestant.id.toString(),
          artistId: context.contestant.artistId.toString(),
          artistName,
          userId: identity.userId?.toString() || '',
          username: voteUser?.username || null,
          userDisplayName: userDisplayName || null,
          userPhotoUrl: userPhotoUrl || null,
          amount: countedAmount,
          isAnonymous: identity.type === 'anonymous',
          staffVote: isStaffVote,
          shareBoost: Boolean(shareBoost),
          createdAt: now.toISOString(),
        }),
      )
      .exec();

    if (identity.type === 'user' && identity.userId) {
      void this.missionProgress.trackVote(identity.userId, countedAmount).catch(() => {});
    }

    let user: { points: number; spentPoints: number } | null = null;
    if (voteUser) {
      user = { points: Number(voteUser.points), spentPoints: Number(voteUser.spentPoints) };
    }

    return {
      ok: true,
      pollId: context.poll.id.toString(),
      roundId: context.round?.id?.toString() || null,
      contestantId: context.contestant.id.toString(),
      artistId: context.contestant.artistId.toString(),
      amount: countedAmount,
      spentAmount: amount,
      multiplier: shareBoost?.multiplier || 1,
      shareBoostActive: Boolean(shareBoost),
      shareBoostEndsAt: shareBoost?.endsAt || null,
      user,
      freeVote: usedFreeVote,
      status: usedFreeVote
        ? this.statusPayload(context.config.cooldownMinutes, Date.now() + context.config.cooldownMs)
        : null,
    };
  }

  async getShareBoost(request: Request) {
    const identity = await this.auth.resolveVoteIdentity(request.headers.authorization);
    const config = await this.shareVoteBoostConfig.getConfig();
    const active = await this.getActiveShareBoost(identity);
    const claimedToday = config.oncePerDay ? await this.hasClaimedShareBoostToday(identity) : false;

    return {
      enabled: config.enabled,
      multiplier: config.multiplier,
      durationMinutes: config.durationMinutes,
      oncePerDay: config.oncePerDay,
      claimedToday,
      canClaim: Boolean(config.enabled && !active && (!config.oncePerDay || !claimedToday)),
      active: active
        ? {
            multiplier: active.multiplier,
            endsAt: active.endsAt,
            remainingMs: Math.max(0, active.endsAt - Date.now()),
          }
        : null,
    };
  }

  async claimShareBoost(request: Request, platform?: string) {
    const identity = await this.auth.resolveVoteIdentity(request.headers.authorization);
    const config = await this.shareVoteBoostConfig.getConfig();

    if (!config.enabled) {
      throw new BadRequestException('El boost por compartir esta desactivado.');
    }

    const normalizedPlatform = String(platform || 'more').toLowerCase();
    if (!SHARE_BOOST_PLATFORMS.has(normalizedPlatform)) {
      throw new BadRequestException('Red social no valida.');
    }

    const active = await this.getActiveShareBoost(identity);
    if (active) {
      // Already running: do not restart the timer on every share click.
      const claimedToday = config.oncePerDay
        ? await this.hasClaimedShareBoostToday(identity)
        : false;
      return {
        ok: true,
        enabled: true,
        multiplier: config.multiplier,
        durationMinutes: config.durationMinutes,
        oncePerDay: config.oncePerDay,
        claimedToday,
        canClaim: false,
        platform: normalizedPlatform,
        alreadyActive: true,
        active: {
          multiplier: active.multiplier,
          endsAt: active.endsAt,
          remainingMs: Math.max(0, active.endsAt - Date.now()),
        },
      };
    }

    if (config.oncePerDay && (await this.hasClaimedShareBoostToday(identity))) {
      throw new BadRequestException('Ya activaste el boost por compartir hoy. Vuelve manana.');
    }

    const ttlSeconds = Math.max(60, config.durationMinutes * 60);
    const endsAt = Date.now() + ttlSeconds * 1000;
    const key = this.shareBoostKey(identity);
    const payload = JSON.stringify({
      multiplier: config.multiplier,
      platform: normalizedPlatform,
      claimedAt: new Date().toISOString(),
    });

    const pipeline = this.redis.client.multi();
    pipeline.set(key, payload, 'EX', ttlSeconds);
    if (config.oncePerDay) {
      const dayKey = this.shareBoostDayKey(identity);
      // Keep the daily lock until next UTC midnight (+ small buffer).
      pipeline.set(dayKey, '1', 'EX', this.secondsUntilNextUtcMidnight());
    }
    await pipeline.exec();

    if (identity.type === 'user' && identity.userId) {
      void this.missionProgress.trackShareClaim(identity.userId, normalizedPlatform).catch(() => {});
    }

    return {
      ok: true,
      enabled: true,
      multiplier: config.multiplier,
      durationMinutes: config.durationMinutes,
      oncePerDay: config.oncePerDay,
      claimedToday: true,
      canClaim: false,
      platform: normalizedPlatform,
      alreadyActive: false,
      active: {
        multiplier: config.multiplier,
        endsAt,
        remainingMs: ttlSeconds * 1000,
      },
    };
  }

  async status(dto: VoteStatusDto, request: Request) {
    const identity = await this.auth.resolveVoteIdentity(request.headers.authorization);
    const context = await this.loadPollOnly(dto.pollId, dto.roundId);
    const config = this.anonymousConfig(context.poll.config, context.round?.config);
    const ipHash = hashIp(getClientIp(request), this.config.get<string>('IP_HASH_SALT') || 'votomusicamundial');
    const keys = this.cooldownKeys(
      identity.id,
      ipHash,
      context.poll.id,
      context.round?.id || null,
      dto.voteScope || null,
      config.blockByIp,
    );
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
      where: pollLookupWhere(pollId),
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

  private shareBoostKey(identity: VoteIdentity) {
    return `share_vote_boost:${identity.type}:${identity.id}`;
  }

  private shareBoostDayKey(identity: VoteIdentity) {
    const day = new Date().toISOString().slice(0, 10);
    return `share_vote_boost_day:${identity.type}:${identity.id}:${day}`;
  }

  private secondsUntilNextUtcMidnight() {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return Math.max(60, Math.ceil((next.getTime() - now.getTime()) / 1000));
  }

  private async hasClaimedShareBoostToday(identity: VoteIdentity) {
    try {
      return Boolean(await this.redis.client.exists(this.shareBoostDayKey(identity)));
    } catch {
      return false;
    }
  }

  private async getActiveShareBoost(identity: VoteIdentity) {
    const key = this.shareBoostKey(identity);
    try {
      const [raw, ttlSeconds] = await Promise.all([
        this.redis.client.get(key),
        this.redis.client.ttl(key),
      ]);
      if (!raw || ttlSeconds <= 0) {
        return null;
      }

      const parsed = JSON.parse(raw) as { multiplier?: number };
      const multiplier = Math.max(2, Math.floor(Number(parsed.multiplier || 2)));
      return {
        multiplier,
        endsAt: Date.now() + ttlSeconds * 1000,
      };
    } catch {
      return null;
    }
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
    // Registered users: limit requests/minute so bulk voting can send many votes per call.
    // Anonymous/IP paths still count votes to prevent abuse.
    const userIncrement = identity.type === 'user' ? 1 : amount;
    const result = await this.redis.client
      .multi()
      .incrby(key, userIncrement)
      .expire(key, 60)
      .incrby(ipKey, amount)
      .expire(ipKey, 60)
      .exec();
    const userVotes = Number(result?.[0]?.[1] || 0);
    const ipVotes = Number(result?.[2]?.[1] || 0);

    const userLimit = Math.max(
      120,
      Number(this.config.get('VOTE_RATE_LIMIT_USER_PER_MINUTE') || DEFAULT_USER_VOTES_PER_MINUTE_LIMIT),
    );
    const ipLimit = Math.max(
      600,
      Number(this.config.get('VOTE_RATE_LIMIT_IP_PER_MINUTE') || DEFAULT_IP_VOTES_PER_MINUTE_LIMIT),
    );

    if (userVotes > userLimit || ipVotes > ipLimit) {
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

  private async trySpendUserPoints(
    identity: VoteIdentity,
    amount: number,
    pointsPerVote: number,
  ): Promise<boolean> {
    const pointsToSpend = amount * pointsPerVote;
    if (!identity.userId || pointsToSpend <= 0) return true;

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

    return updated.count > 0;
  }

  private async spendUserPoints(identity: VoteIdentity, amount: number, pointsPerVote: number) {
    const spent = await this.trySpendUserPoints(identity, amount, pointsPerVote);
    if (!spent) {
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

  async recentRegisteredActivity(limitValue?: string, hoursValue?: string) {
    const limit = Math.min(Math.max(Number(limitValue || 24), 1), 50);
    const hours = Math.min(Math.max(Number(hoursValue || 24), 1), 720);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [registeredRows] = await Promise.all([
      this.prisma.voteLedger.findMany({
        where: {
          isAnonymous: false,
          userId: { not: null },
          createdAt: { gte: since },
          poll: {
            status: PollStatus.live,
          },
          user: {
            role: { notIn: [UserRole.admin, UserRole.superadmin, UserRole.owner] },
          },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              photoUrl: true,
            },
          },
          contestant: {
            include: {
              artist: {
                select: {
                  id: true,
                  name: true,
                  photoUrl: true,
                },
              },
            },
          },
          poll: {
            select: {
              id: true,
              title: true,
              slug: true,
              config: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const shape = (row: any) => {
      const pollConfig = (row.poll?.config || {}) as Record<string, unknown>;

      return {
        id: row.id.toString(),
        createdAt: row.createdAt,
        amount: Math.min(Number(row.amount || 0), 5),
        pollId: row.pollId.toString(),
        pollTitle: row.poll?.title || '',
        pollSlug: row.poll?.slug || '',
        pollYear: Number(pollConfig.year || new Date(row.poll?.createdAt || Date.now()).getFullYear()),
        artistId: row.contestant?.artistId?.toString() || '',
        artistName: row.contestant?.artist?.name || '',
        artistPhotoUrl: row.contestant?.artist?.photoUrl || '',
        userId: row.userId?.toString() || '',
        username: row.user?.username || '',
        userDisplayName: row.user?.displayName || row.user?.username || '',
        userPhotoUrl: row.user?.photoUrl || '',
      };
    };

    const merged = registeredRows
      .map((row) => shape(row))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return serialize(merged);
  }
}
