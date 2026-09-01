import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BLOCKED_IPS_KEY,
  BLOCKED_USERS_KEY,
  MOD_ALERT_DEDUPE_PREFIX,
  MOD_ALERTS_DATA_KEY,
  MOD_ALERTS_TIMELINE_KEY,
} from '../../common/moderation-keys';
import {
  buildCommentAlertReason,
  buildSpawnSignupReason,
  type CommentDictionaryScan,
  SPAWN_SIGNUP_ALERT_THRESHOLD,
} from '../../common/moderation-dictionary';
import {
  isUserBlockExpired,
  parseUserBlockMeta,
  toUserBlockStatus,
  USER_BLOCKED_ERROR,
  UserBlockMeta,
  UserBlockStatus,
} from '../../common/user-block';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export type ModerationAlertType =
  | 'comment_promo'
  | 'comment_diversion'
  | 'comment_external_link'
  | 'spawn_signup';

export type ModerationAlertRecord = {
  id: string;
  type: ModerationAlertType;
  status: 'open' | 'dismissed';
  at: string;
  reason: string;
  signals: string[];
  sample?: string | null;
  userId?: string | null;
  userName?: string | null;
  ipHash?: string | null;
  ipShort?: string | null;
  pollId?: string | null;
  commentId?: string | null;
};

type BlockMeta = UserBlockMeta;

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

  private clampBlockDurationHours(value?: string | number | null) {
    if (value === null || value === undefined || value === '') return null;
    const hours = Math.floor(Number(value));
    if (!Number.isFinite(hours) || hours <= 0) return null;
    return Math.min(hours, 24 * 365);
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
    return parseUserBlockMeta(raw);
  }

  private formatExpiryNotice(expiresAt: string | null) {
    if (!expiresAt) return 'Tu cuenta está suspendida de forma permanente.';
    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) return 'Tu cuenta está suspendida temporalmente.';
    return `Tu cuenta está suspendida hasta ${date.toLocaleString('es-ES')}.`;
  }

  async getActiveUserBlock(userId: string): Promise<UserBlockStatus | null> {
    const value = String(userId || '').trim();
    if (!value) return null;

    const raw = await this.redis.client.hget(BLOCKED_USERS_KEY, value);
    if (!raw) return null;

    const meta = this.parseMeta(raw);
    if (!meta || isUserBlockExpired(meta)) {
      await this.redis.client.hdel(BLOCKED_USERS_KEY, value);
      return null;
    }

    return toUserBlockStatus(meta);
  }

  async getActiveUserBlocks(userIds: string[]): Promise<Record<string, UserBlockStatus>> {
    const uniqueIds = [...new Set(userIds.map((id) => String(id || '').trim()).filter(Boolean))];
    if (!uniqueIds.length) return {};

    const pipeline = this.redis.client.pipeline();
    for (const id of uniqueIds) {
      pipeline.hget(BLOCKED_USERS_KEY, id);
    }
    const results = await pipeline.exec();
    const active: Record<string, UserBlockStatus> = {};
    const expiredIds: string[] = [];

    uniqueIds.forEach((id, index) => {
      const raw = String(results?.[index]?.[1] || '');
      if (!raw) return;
      const meta = this.parseMeta(raw);
      if (!meta || isUserBlockExpired(meta)) {
        expiredIds.push(id);
        return;
      }
      const status = toUserBlockStatus(meta);
      if (status) active[id] = status;
    });

    if (expiredIds.length) {
      await this.redis.client.hdel(BLOCKED_USERS_KEY, ...expiredIds);
    }

    return active;
  }

  async getActiveBlockedUserIds(): Promise<string[]> {
    const all = await this.blockedUserSet();
    const active: string[] = [];
    const expired: string[] = [];

    for (const [id, raw] of Object.entries(all)) {
      const meta = this.parseMeta(raw);
      if (!meta || isUserBlockExpired(meta)) {
        expired.push(id);
      } else {
        active.push(id);
      }
    }

    if (expired.length) {
      await this.redis.client.hdel(BLOCKED_USERS_KEY, ...expired);
    }

    return active;
  }

  async isUserBlocked(userId: string | bigint | null | undefined) {
    if (!userId) return false;
    const block = await this.getActiveUserBlock(String(userId));
    return Boolean(block?.blocked);
  }

  assertUserNotBlocked(userId: string | bigint | null | undefined, scope = 'esta acción') {
    void scope;
    return this.getActiveUserBlock(String(userId || '')).then((block) => {
      if (!block?.blocked) return;
      throw new ForbiddenException({
        error: USER_BLOCKED_ERROR,
        message: 'Tu cuenta está suspendida.',
        reason: block.reason,
        expiresAt: block.expiresAt,
        permanent: block.permanent,
      });
    });
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
      openAlerts: await this.openAlertsCount(),
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
    const ipHashes = rows.map((row) => String(row.ipHash || '').trim()).filter(Boolean);

    const [voteUserRows, relatedBySignupIp] = await Promise.all([
      ipHashes.length
        ? this.prisma.voteLedger.findMany({
            where: {
              ipHash: { in: ipHashes },
              userId: { not: null },
              createdAt: { gte: since },
            },
            select: {
              ipHash: true,
              userId: true,
              amount: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  email: true,
                  photoUrl: true,
                  createdAt: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      this.accountsForSignupIps(ipHashes),
    ]);

    const accountsByIp = new Map<string, Array<ReturnType<ModerationService['formatRelatedAccount']> & { votes: number }>>();

    const addAccount = (
      ipHash: string,
      account: ReturnType<ModerationService['formatRelatedAccount']>,
      votes = 0,
    ) => {
      const list = accountsByIp.get(ipHash) || [];
      const existing = list.find((item) => item.id === account.id);
      if (existing) {
        existing.votes += votes;
        return;
      }
      list.push({ ...account, votes });
      accountsByIp.set(ipHash, list);
    };

    for (const row of voteUserRows) {
      const hash = String(row.ipHash || '').trim();
      if (!hash || !row.user) continue;
      addAccount(hash, this.formatRelatedAccount(row.user), Number(row.amount || 0));
    }

    for (const [hash, accounts] of relatedBySignupIp.entries()) {
      for (const account of accounts) {
        addAccount(hash, account, 0);
      }
    }

    return {
      windowHours: hours,
      items: rows.map((row) => {
        const accounts = (accountsByIp.get(row.ipHash) || []).sort((a, b) => b.votes - a.votes);
        return {
          ipHash: row.ipHash,
          ipShort: row.ipHash ? `${row.ipHash.slice(0, 12)}…` : '',
          voteRows: Number(row.voteRows || 0),
          totalVotes: Number(row.totalVotes || 0),
          distinctAnon: Number(row.distinctAnon || 0),
          distinctUsers: Number(row.distinctUsers || 0),
          accounts,
          accountCount: accounts.length,
          lastVoteAt: row.lastVoteAt,
          firstVoteAt: row.firstVoteAt,
          risk: this.riskLevel({
            totalVotes: Number(row.totalVotes || 0),
            distinctAnon: Number(row.distinctAnon || 0),
            distinctUsers: Number(row.distinctUsers || 0),
          }),
          blocked: Boolean(blocked[row.ipHash]),
        };
      }),
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

    const users = userIds
      .map((userId) => {
        const meta = this.parseMeta(usersRaw[userId]);
        if (!meta || isUserBlockExpired(meta)) return null;
        const profile = userMap.get(userId);
        return {
          userId,
          name: profile?.displayName || profile?.username || profile?.email || `#${userId}`,
          reason: meta?.reason || '',
          at: meta?.at || '',
          by: meta?.by || null,
          expiresAt: meta?.expiresAt || null,
          permanent: !meta?.expiresAt,
        };
      })
      .filter(Boolean);

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

  async blockUser(
    userId: string,
    reason: string,
    by: string | null,
    durationHours?: string | number | null,
  ) {
    const value = String(userId || '').trim();
    if (!value) {
      throw new BadRequestException('Falta el usuario.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(value) },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new BadRequestException('El usuario no existe.');
    }
    if (user.role === 'owner') {
      throw new BadRequestException('No se puede bloquear la cuenta owner.');
    }

    const hours = this.clampBlockDurationHours(durationHours);
    const expiresAt = hours ? new Date(Date.now() + hours * 3600 * 1000).toISOString() : null;
    const reasonText = String(reason || '').trim() || 'Bloqueo manual';

    const meta: BlockMeta = {
      reason: reasonText,
      at: new Date().toISOString(),
      by,
      expiresAt,
    };
    await this.redis.client.hset(BLOCKED_USERS_KEY, value, JSON.stringify(meta));

    const notice = this.formatExpiryNotice(expiresAt);
    await this.prisma.notification.create({
      data: {
        userId: user.id,
        type: 'account_suspended',
        payload: {
          reason: reasonText,
          expiresAt,
          permanent: !expiresAt,
          title: 'Cuenta suspendida',
          message: `${notice} Motivo: ${reasonText}`,
        },
      },
    });

    return {
      ok: true,
      userId: value,
      expiresAt,
      permanent: !expiresAt,
    };
  }

  async unblockUser(userId: string) {
    const value = String(userId || '').trim();
    if (!value) {
      throw new BadRequestException('Falta el usuario.');
    }

    await this.redis.client.hdel(BLOCKED_USERS_KEY, value);
    return { ok: true, userId: value };
  }

  private alertDedupeKey(type: string, userId: string | null, fingerprint: string) {
    return `${MOD_ALERT_DEDUPE_PREFIX}${type}:${userId || 'none'}:${fingerprint}`;
  }

  private mapCommentAlertType(scan: CommentDictionaryScan): ModerationAlertType {
    if (scan.primaryType === 'external_link') return 'comment_external_link';
    if (scan.primaryType === 'diversion') return 'comment_diversion';
    return 'comment_promo';
  }

  async createAlert(input: {
    type: ModerationAlertType;
    reason: string;
    signals?: string[];
    sample?: string | null;
    userId?: string | bigint | null;
    userName?: string | null;
    ipHash?: string | null;
    pollId?: string | bigint | null;
    commentId?: string | bigint | null;
    dedupeFingerprint?: string;
    dedupeTtlSeconds?: number;
  }) {
    const userId = input.userId ? String(input.userId) : null;
    const fingerprint =
      input.dedupeFingerprint ||
      `${input.type}:${(input.signals || []).slice(0, 3).join('|')}:${String(input.sample || '').slice(0, 80)}`;
    const dedupeKey = this.alertDedupeKey(input.type, userId, fingerprint);
    const dedupeTtl = Math.max(300, Math.floor(Number(input.dedupeTtlSeconds || 1800)));

    const dedupeOk = await this.redis.client.set(dedupeKey, '1', 'EX', dedupeTtl, 'NX');
    if (dedupeOk !== 'OK') {
      return null;
    }

    const id = randomUUID();
    const ipHash = input.ipHash ? String(input.ipHash) : null;
    const record: ModerationAlertRecord = {
      id,
      type: input.type,
      status: 'open',
      at: new Date().toISOString(),
      reason: String(input.reason || '').trim() || 'Actividad sospechosa',
      signals: Array.isArray(input.signals) ? input.signals.filter(Boolean) : [],
      sample: input.sample ? String(input.sample).slice(0, 400) : null,
      userId,
      userName: input.userName || null,
      ipHash,
      ipShort: ipHash ? `${ipHash.slice(0, 12)}…` : null,
      pollId: input.pollId ? String(input.pollId) : null,
      commentId: input.commentId ? String(input.commentId) : null,
    };

    const score = Date.now();
    await this.redis.client
      .multi()
      .zadd(MOD_ALERTS_TIMELINE_KEY, score, id)
      .hset(MOD_ALERTS_DATA_KEY, id, JSON.stringify(record))
      .exec();

    // Mantener solo las últimas 500 alertas
    const overflow = await this.redis.client.zcard(MOD_ALERTS_TIMELINE_KEY);
    if (overflow > 500) {
      const staleIds = await this.redis.client.zrange(MOD_ALERTS_TIMELINE_KEY, 0, overflow - 501);
      if (staleIds.length) {
        await this.redis.client
          .multi()
          .zrem(MOD_ALERTS_TIMELINE_KEY, ...staleIds)
          .hdel(MOD_ALERTS_DATA_KEY, ...staleIds)
          .exec();
      }
    }

    return record;
  }

  async createCommentSuspicionAlert(input: {
    text: string;
    scan: CommentDictionaryScan;
    userId: bigint;
    userName: string;
    pollId: bigint;
    commentId: bigint;
    ipHash?: string | null;
  }) {
    if (!input.scan.suspicious) return null;

    const alertType = this.mapCommentAlertType(input.scan);
    // Enlaces externos ya se bloquean al publicar; alerta solo promo/desvío
    if (alertType === 'comment_external_link') return null;

    return this.createAlert({
      type: alertType,
      reason: buildCommentAlertReason(input.scan),
      signals: input.scan.matches.map((match) => `${match.category}:${match.label}`),
      sample: input.text,
      userId: input.userId,
      userName: input.userName,
      pollId: input.pollId,
      commentId: input.commentId,
      ipHash: input.ipHash || null,
      dedupeFingerprint: `${alertType}:${input.userId.toString()}:${input.scan.primaryType}`,
    });
  }

  async createSpawnSignupAlert(input: {
    ipHash: string;
    accountCount: number;
    userId: bigint;
    userName?: string | null;
  }) {
    if (!input.ipHash || input.accountCount < SPAWN_SIGNUP_ALERT_THRESHOLD) {
      return null;
    }

    return this.createAlert({
      type: 'spawn_signup',
      reason: buildSpawnSignupReason(`${input.ipHash.slice(0, 12)}…`, input.accountCount),
      signals: [`spawn:ip_accounts:${input.accountCount}`],
      userId: input.userId,
      userName: input.userName || null,
      ipHash: input.ipHash,
      dedupeFingerprint: `spawn:${input.ipHash}:${input.accountCount}`,
      dedupeTtlSeconds: 3600,
    });
  }

  private formatRelatedAccount(user: {
    id: bigint;
    username: string | null;
    displayName: string | null;
    email: string | null;
    photoUrl: string | null;
    createdAt: Date;
  }) {
    return {
      id: user.id.toString(),
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      photoUrl: user.photoUrl,
      createdAt: user.createdAt.toISOString(),
      name: user.displayName || user.username || user.email || `#${user.id.toString()}`,
    };
  }

  private async accountsForSignupIps(ipHashes: string[]) {
    const unique = [...new Set(ipHashes.map((hash) => String(hash || '').trim()).filter(Boolean))];
    const byIp = new Map<string, Array<ReturnType<ModerationService['formatRelatedAccount']>>>();
    if (!unique.length) return byIp;

    const relatedUsers = await this.prisma.user.findMany({
      where: {
        OR: unique.map((hash) => ({
          metadata: { path: ['signupIpHash'], equals: hash },
        })),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        photoUrl: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    for (const user of relatedUsers) {
      const meta =
        user.metadata && typeof user.metadata === 'object' && !Array.isArray(user.metadata)
          ? (user.metadata as Record<string, unknown>)
          : {};
      const hash = String(meta.signupIpHash || '').trim();
      if (!hash) continue;
      const list = byIp.get(hash) || [];
      list.push(this.formatRelatedAccount(user));
      byIp.set(hash, list);
    }

    return byIp;
  }

  async listAlertsPaginated(options?: {
    limitValue?: string;
    pageValue?: string;
    status?: string;
    type?: string;
  }) {
    const limit = this.clampLimit(options?.limitValue, 20, 100);
    const page = Math.max(Number(options?.pageValue) || 1, 1);
    const skip = (page - 1) * limit;
    const statusFilter = String(options?.status || '').trim().toLowerCase();
    const typeFilter = String(options?.type || '').trim().toLowerCase();

    const ids = await this.redis.client.zrevrange(MOD_ALERTS_TIMELINE_KEY, 0, 999);
    if (!ids.length) {
      return { items: [], total: 0, page, pageSize: limit, totalPages: 1 };
    }

    const rows = await this.redis.client.hmget(MOD_ALERTS_DATA_KEY, ...ids);
    const alerts: ModerationAlertRecord[] = [];

    ids.forEach((id, index) => {
      const raw = rows[index];
      if (!raw) return;
      try {
        alerts.push(JSON.parse(raw) as ModerationAlertRecord);
      } catch {
        // ignore corrupt row
      }
    });

    const filtered = alerts.filter((alert) => {
      if (statusFilter === 'open' && alert.status !== 'open') return false;
      if (statusFilter === 'dismissed' && alert.status !== 'dismissed') return false;
      if (typeFilter && alert.type !== typeFilter) return false;
      return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const pageItems = filtered.slice(skip, skip + limit);

    const userIds = [...new Set(pageItems.map((a) => a.userId).filter(Boolean))] as string[];
    const pollIds = [...new Set(pageItems.map((a) => a.pollId).filter(Boolean))] as string[];
    const ipHashes = [...new Set(pageItems.map((a) => a.ipHash).filter(Boolean))] as string[];

    const [users, polls, relatedByIp, blockedIps] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds.map((id) => BigInt(id)) } },
            select: {
              id: true,
              username: true,
              displayName: true,
              email: true,
              photoUrl: true,
              createdAt: true,
            },
          })
        : Promise.resolve([] as Array<{
            id: bigint;
            username: string | null;
            displayName: string | null;
            email: string | null;
            photoUrl: string | null;
            createdAt: Date;
          }>),
      pollIds.length
        ? this.prisma.poll.findMany({
            where: { id: { in: pollIds.map((id) => BigInt(id)) } },
            select: { id: true, title: true },
          })
        : Promise.resolve([] as Array<{ id: bigint; title: string }>),
      this.accountsForSignupIps(ipHashes),
      this.blockedIpSet(),
    ]);
    const userMap = new Map(users.map((u) => [u.id.toString(), u]));
    const pollMap = new Map(polls.map((p) => [p.id.toString(), p]));

    const items = pageItems.map((alert) => {
      const profile = alert.userId ? userMap.get(alert.userId) : null;
      const poll = alert.pollId ? pollMap.get(alert.pollId) : null;
      const relatedAccounts = alert.ipHash ? relatedByIp.get(alert.ipHash) || [] : [];
      return {
        ...alert,
        userName:
          alert.userName ||
          profile?.displayName ||
          profile?.username ||
          profile?.email ||
          (alert.userId ? `#${alert.userId}` : null),
        userEmail: profile?.email || null,
        userUsername: profile?.username || null,
        userPhotoUrl: profile?.photoUrl || null,
        userCreatedAt: profile?.createdAt?.toISOString() || null,
        pollTitle: poll?.title || null,
        relatedAccounts,
        relatedAccountCount: relatedAccounts.length,
        ipBlocked: alert.ipHash ? Boolean(blockedIps[alert.ipHash]) : false,
      };
    });

    return { items, total, page, pageSize: limit, totalPages };
  }

  async listAlertsForUser(userId: string, limitValue?: string) {
    const value = String(userId || '').trim();
    if (!value) return [];

    const limit = this.clampLimit(limitValue, 80, 200);
    const ids = await this.redis.client.zrevrange(MOD_ALERTS_TIMELINE_KEY, 0, 499);
    if (!ids.length) return [];

    const rows = await this.redis.client.hmget(MOD_ALERTS_DATA_KEY, ...ids);
    const alerts: ModerationAlertRecord[] = [];

    ids.forEach((id, index) => {
      const raw = rows[index];
      if (!raw) return;
      try {
        const record = JSON.parse(raw) as ModerationAlertRecord;
        if (record.userId === value) {
          alerts.push(record);
        }
      } catch {
        // ignore corrupt row
      }
    });

    return alerts.slice(0, limit);
  }

  async listAlerts(limitValue?: string) {
    const limit = this.clampLimit(limitValue, 80, 200);
    const ids = await this.redis.client.zrevrange(MOD_ALERTS_TIMELINE_KEY, 0, limit - 1);
    if (!ids.length) return [];

    const rows = await this.redis.client.hmget(MOD_ALERTS_DATA_KEY, ...ids);
    const alerts: ModerationAlertRecord[] = [];

    ids.forEach((id, index) => {
      const raw = rows[index];
      if (!raw) return;
      try {
        alerts.push(JSON.parse(raw) as ModerationAlertRecord);
      } catch {
        // ignore corrupt row
      }
    });

    const userIds = [...new Set(alerts.map((a) => a.userId).filter(Boolean))] as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds.map((id) => BigInt(id)) } },
          select: { id: true, username: true, displayName: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    return alerts.map((alert) => {
      const profile = alert.userId ? userMap.get(alert.userId) : null;
      return {
        ...alert,
        userName:
          alert.userName ||
          profile?.displayName ||
          profile?.username ||
          profile?.email ||
          (alert.userId ? `#${alert.userId}` : null),
      };
    });
  }

  async dismissAlert(alertId: string) {
    const id = String(alertId || '').trim();
    if (!id) throw new BadRequestException('Falta la alerta.');

    const raw = await this.redis.client.hget(MOD_ALERTS_DATA_KEY, id);
    if (!raw) throw new BadRequestException('La alerta no existe.');

    let record: ModerationAlertRecord;
    try {
      record = JSON.parse(raw) as ModerationAlertRecord;
    } catch {
      throw new BadRequestException('La alerta está corrupta.');
    }

    record.status = 'dismissed';
    await this.redis.client.hset(MOD_ALERTS_DATA_KEY, id, JSON.stringify(record));
    return { ok: true, id };
  }

  async openAlertsCount() {
    const ids = await this.redis.client.zrevrange(MOD_ALERTS_TIMELINE_KEY, 0, 199);
    if (!ids.length) return 0;
    const rows = await this.redis.client.hmget(MOD_ALERTS_DATA_KEY, ...ids);
    return rows.filter((raw) => {
      if (!raw) return false;
      try {
        return (JSON.parse(raw) as ModerationAlertRecord).status === 'open';
      } catch {
        return false;
      }
    }).length;
  }

  async blockedUsersCount() {
    return Number(await this.redis.client.hlen(BLOCKED_USERS_KEY));
  }
}
