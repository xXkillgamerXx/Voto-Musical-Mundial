import { BadRequestException, Injectable } from '@nestjs/common';
import { BLOCKED_IPS_KEY, BLOCKED_USERS_KEY } from '../../common/moderation-keys';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type BlockMeta = {
  reason: string;
  at: string;
  by: string | null;
  label?: string | null;
};

type IpActivityRow = {
  ipHash: string;
  voteRows: number;
  totalVotes: number;
  distinctAnon: number;
  distinctUsers: number;
  lastVoteAt: Date | null;
  firstVoteAt: Date | null;
};

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private clampHours(value?: string | number) {
    const hours = Math.floor(Number(value || 24));
    if (!Number.isFinite(hours) || hours <= 0) return 24;
    return Math.min(hours, 24 * 30);
  }

  private clampLimit(value?: string | number, fallback = 50, max = 200) {
    const limit = Math.floor(Number(value || fallback));
    if (!Number.isFinite(limit) || limit <= 0) return fallback;
    return Math.min(limit, max);
  }

  private riskLevel(row: { totalVotes: number; distinctAnon: number; distinctUsers: number }) {
    const identities = row.distinctAnon + row.distinctUsers;
    if (row.distinctAnon >= 8 || row.totalVotes >= 250 || identities >= 12) return 'high';
    if (row.distinctAnon >= 4 || row.totalVotes >= 80 || identities >= 6) return 'medium';
    return 'low';
  }

  private async blockedIpSet() {
    const all = await this.redis.client.hgetall(BLOCKED_IPS_KEY);
    return all || {};
  }

  private async blockedUserSet() {
    const all = await this.redis.client.hgetall(BLOCKED_USERS_KEY);
    return all || {};
  }

  private parseMeta(raw?: string): BlockMeta | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as BlockMeta;
    } catch {
      return { reason: raw, at: '', by: null };
    }
  }

  async overview(hoursValue?: string) {
    const hours = this.clampHours(hoursValue);
    const since = new Date(Date.now() - hours * 3600 * 1000);

    const [windowAgg, distinctRows, blockedIps, blockedUsers, totalLedger] = await Promise.all([
      this.prisma.voteLedger.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ distinctIps: number; distinctAnon: number; distinctUsers: number }>>`
        SELECT
          COUNT(DISTINCT ip_hash)::int AS "distinctIps",
          COUNT(DISTINCT anonymous_id)::int AS "distinctAnon",
          COUNT(DISTINCT user_id)::int AS "distinctUsers"
        FROM vote_ledger
        WHERE created_at >= ${since}
      `,
      this.redis.client.hlen(BLOCKED_IPS_KEY),
      this.redis.client.hlen(BLOCKED_USERS_KEY),
      this.prisma.voteLedger.count(),
    ]);

    const distinct = distinctRows?.[0] || { distinctIps: 0, distinctAnon: 0, distinctUsers: 0 };

    return {
      windowHours: hours,
      votesInWindow: Number(windowAgg._sum.amount || 0),
      voteRowsInWindow: Number(windowAgg._count._all || 0),
      distinctIps: Number(distinct.distinctIps || 0),
      distinctAnon: Number(distinct.distinctAnon || 0),
      distinctUsers: Number(distinct.distinctUsers || 0),
      totalVoteRows: Number(totalLedger || 0),
      blockedIps: Number(blockedIps || 0),
      blockedUsers: Number(blockedUsers || 0),
    };
  }

  async ipActivity(hoursValue?: string, limitValue?: string) {
    const hours = this.clampHours(hoursValue);
    const limit = this.clampLimit(limitValue, 50, 200);
    const since = new Date(Date.now() - hours * 3600 * 1000);

    const rows = await this.prisma.$queryRaw<IpActivityRow[]>`
      SELECT
        ip_hash AS "ipHash",
        COUNT(*)::int AS "voteRows",
        COALESCE(SUM(amount), 0)::int AS "totalVotes",
        COUNT(DISTINCT anonymous_id)::int AS "distinctAnon",
        COUNT(DISTINCT user_id)::int AS "distinctUsers",
        MAX(created_at) AS "lastVoteAt",
        MIN(created_at) AS "firstVoteAt"
      FROM vote_ledger
      WHERE created_at >= ${since} AND ip_hash IS NOT NULL
      GROUP BY ip_hash
      ORDER BY "totalVotes" DESC
      LIMIT ${limit}
    `;

    const blocked = await this.blockedIpSet();

    return {
      windowHours: hours,
      items: rows.map((row) => ({
        ipHash: row.ipHash,
        ipShort: row.ipHash ? `${row.ipHash.slice(0, 12)}…` : '',
        voteRows: Number(row.voteRows || 0),
        totalVotes: Number(row.totalVotes || 0),
        distinctAnon: Number(row.distinctAnon || 0),
        distinctUsers: Number(row.distinctUsers || 0),
        lastVoteAt: row.lastVoteAt,
        firstVoteAt: row.firstVoteAt,
        risk: this.riskLevel({
          totalVotes: Number(row.totalVotes || 0),
          distinctAnon: Number(row.distinctAnon || 0),
          distinctUsers: Number(row.distinctUsers || 0),
        }),
        blocked: Boolean(blocked[row.ipHash]),
      })),
    };
  }

  async recentVotes(limitValue?: string) {
    const limit = this.clampLimit(limitValue, 100, 300);

    const rows = await this.prisma.voteLedger.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        contestant: { select: { id: true, artist: { select: { name: true } } } },
        poll: { select: { id: true, title: true } },
      },
    });

    const blockedIps = await this.blockedIpSet();
    const blockedUsers = await this.blockedUserSet();

    return rows.map((row) => ({
      id: row.id.toString(),
      createdAt: row.createdAt,
      amount: Number(row.amount || 0),
      isAnonymous: row.isAnonymous,
      ipHash: row.ipHash,
      ipShort: row.ipHash ? `${row.ipHash.slice(0, 12)}…` : '',
      ipBlocked: row.ipHash ? Boolean(blockedIps[row.ipHash]) : false,
      anonymousId: row.anonymousId,
      userId: row.userId ? row.userId.toString() : null,
      userBlocked: row.userId ? Boolean(blockedUsers[row.userId.toString()]) : false,
      userName: row.user?.displayName || row.user?.username || null,
      artistName: row.contestant?.artist?.name || null,
      pollTitle: row.poll?.title || null,
    }));
  }

  async blocks() {
    const [ipsRaw, usersRaw] = await Promise.all([this.blockedIpSet(), this.blockedUserSet()]);

    const ips = Object.entries(ipsRaw).map(([ipHash, raw]) => {
      const meta = this.parseMeta(raw);
      return {
        ipHash,
        ipShort: `${ipHash.slice(0, 12)}…`,
        reason: meta?.reason || '',
        at: meta?.at || '',
        by: meta?.by || null,
      };
    });

    const userIds = Object.keys(usersRaw);
    const userRows = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds.map((id) => BigInt(id)) } },
          select: { id: true, username: true, displayName: true, email: true },
        })
      : [];
    const userMap = new Map(userRows.map((user) => [user.id.toString(), user]));

    const users = userIds.map((userId) => {
      const meta = this.parseMeta(usersRaw[userId]);
      const profile = userMap.get(userId);
      return {
        userId,
        name: profile?.displayName || profile?.username || profile?.email || `#${userId}`,
        reason: meta?.reason || '',
        at: meta?.at || '',
        by: meta?.by || null,
      };
    });

    return { ips, users };
  }

  async blockIp(ipHash: string, reason: string, by: string | null) {
    const value = String(ipHash || '').trim();
    if (!value) {
      throw new BadRequestException('Falta el identificador de IP.');
    }

    const meta: BlockMeta = {
      reason: String(reason || '').trim() || 'Bloqueo manual',
      at: new Date().toISOString(),
      by,
    };
    await this.redis.client.hset(BLOCKED_IPS_KEY, value, JSON.stringify(meta));
    return { ok: true, ipHash: value };
  }

  async unblockIp(ipHash: string) {
    const value = String(ipHash || '').trim();
    if (!value) {
      throw new BadRequestException('Falta el identificador de IP.');
    }

    await this.redis.client.hdel(BLOCKED_IPS_KEY, value);
    return { ok: true, ipHash: value };
  }

  async blockUser(userId: string, reason: string, by: string | null) {
    const value = String(userId || '').trim();
    if (!value) {
      throw new BadRequestException('Falta el usuario.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: BigInt(value) }, select: { id: true } });
    if (!user) {
      throw new BadRequestException('El usuario no existe.');
    }

    const meta: BlockMeta = {
      reason: String(reason || '').trim() || 'Bloqueo manual',
      at: new Date().toISOString(),
      by,
    };
    await this.redis.client.hset(BLOCKED_USERS_KEY, value, JSON.stringify(meta));
    return { ok: true, userId: value };
  }

  async unblockUser(userId: string) {
    const value = String(userId || '').trim();
    if (!value) {
      throw new BadRequestException('Falta el usuario.');
    }

    await this.redis.client.hdel(BLOCKED_USERS_KEY, value);
    return { ok: true, userId: value };
  }
}
