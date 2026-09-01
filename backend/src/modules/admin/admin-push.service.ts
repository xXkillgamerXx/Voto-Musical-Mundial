import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type SendPushPayload = {
  title?: string;
  titleEn?: string;
  body?: string;
  bodyEn?: string;
  url?: string;
  userIds?: string[];
  tokens?: string[];
  sendToAll?: boolean;
};

type PushJobState = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  title: string;
  body: string;
  url: string;
  sendToAll: boolean;
  total: number;
  processed: number;
  sent: number;
  failed: number;
  percent: number;
  errors: Array<{ token: string; code: string; message: string }>;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

@Injectable()
export class AdminPushService {
  private readonly logger = new Logger(AdminPushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private firebaseReady = false;
  private static readonly PUSH_JOB_TTL_SECONDS = 60 * 60;

  private initFirebaseAdmin() {
    if (this.firebaseReady || getApps().length) {
      this.firebaseReady = true;
      return;
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const projectId = process.env.FIREBASE_PROJECT_ID || 'votos-3420a';

    if (serviceAccountJson) {
      initializeApp({
        credential: cert(JSON.parse(serviceAccountJson)),
        projectId,
      });
    } else if (serviceAccountPath) {
      initializeApp({
        credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))),
        projectId,
      });
    } else {
      initializeApp({
        credential: applicationDefault(),
        projectId,
      });
    }

    this.firebaseReady = true;
  }

  private cleanTokens(tokens: unknown[]) {
    return [...new Set(tokens.map((token) => String(token || '').trim()).filter(Boolean))];
  }

  private buildMulticastMessage(
    tokens: string[],
    payload: {
      title: string;
      body: string;
      url: string;
      type: string;
      extraData?: Record<string, string>;
    },
  ): MulticastMessage {
    return {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        title: payload.title,
        body: payload.body,
        url: payload.url,
        type: payload.type,
        ...(payload.extraData || {}),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'vmm_default',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      webpush: {
        fcmOptions: { link: payload.url },
        notification: {
          title: payload.title,
          body: payload.body,
          data: { url: payload.url },
        },
      },
    };
  }

  private logPushFailures(tokens: string[], response: Awaited<ReturnType<ReturnType<typeof getMessaging>['sendEachForMulticast']>>) {
    response.responses.forEach((item, index) => {
      if (item.success) {
        return;
      }

      const token = tokens[index] || '';
      this.logger.warn(
        `Push fallido (${token.slice(0, 18)}...): ${item.error?.code || 'unknown'} ${item.error?.message || ''}`,
      );
    });
  }

  /** FCM rechaza multicast de más de 500 tokens por request. */
  private static readonly FCM_BATCH = 500;

  private chunk<T>(items: T[], size: number) {
    const groups: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      groups.push(items.slice(index, index + size));
    }
    return groups;
  }

  /** Recorre toda la tabla por cursor para no toparse con el tope de 500 del broadcast anterior. */
  async collectAllTokens(platform = 'all') {
    const where = platform && platform !== 'all' ? { platform } : {};
    const rows: Array<{ token: string; userId: bigint }> = [];
    let cursor: bigint | undefined;

    for (;;) {
      const page = await this.prisma.pushToken.findMany({
        where,
        take: 1000,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: { id: true, token: true, userId: true },
      });

      if (!page.length) {
        break;
      }

      rows.push(...page.map((row) => ({ token: row.token, userId: row.userId })));
      cursor = page[page.length - 1].id;

      if (page.length < 1000) {
        break;
      }
    }

    return rows;
  }

  private isDeadTokenError(code?: string) {
    return (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/invalid-argument'
    );
  }

  private async pruneDeadTokens(tokens: string[]) {
    if (!tokens.length) {
      return;
    }

    try {
      const removed = await this.prisma.pushToken.deleteMany({ where: { token: { in: tokens } } });
      this.logger.log(`Tokens FCM inválidos eliminados: ${removed.count}`);
    } catch (error) {
      this.logger.warn(`No se pudieron limpiar tokens inválidos: ${(error as Error).message}`);
    }
  }

  async dispatch(
    tokens: string[],
    payload: { title: string; body: string; url: string; type: string; extraData?: Record<string, string> },
    onBatch?: (progress: { processed: number; sent: number; failed: number; total: number }) => void | Promise<void>,
  ) {
    this.initFirebaseAdmin();

    let sent = 0;
    let failed = 0;
    let processed = 0;
    const errors: Array<{ token: string; code: string; message: string }> = [];
    const deadTokens: string[] = [];

    for (const batch of this.chunk(tokens, AdminPushService.FCM_BATCH)) {
      const response = await getMessaging().sendEachForMulticast(
        this.buildMulticastMessage(batch, payload),
      );

      this.logPushFailures(batch, response);
      sent += response.successCount;
      failed += response.failureCount;
      processed += batch.length;

      response.responses.forEach((item, index) => {
        if (item.success) {
          return;
        }

        const token = batch[index];
        const code = item.error?.code || 'unknown';

        if (this.isDeadTokenError(code)) {
          deadTokens.push(token);
        }

        if (errors.length < 25) {
          errors.push({
            token: `${token.slice(0, 18)}...${token.slice(-8)}`,
            code,
            message: item.error?.message || 'No se pudo enviar.',
          });
        }
      });

      if (onBatch) {
        await onBatch({ processed, sent, failed, total: tokens.length });
      }
    }

    await this.pruneDeadTokens(deadTokens);

    return { sent, failed, total: tokens.length, errors };
  }

  private pushJobKey(jobId: string) {
    return `admin-push-job:${jobId}`;
  }

  private async savePushJob(job: PushJobState) {
    await this.redis.client.set(
      this.pushJobKey(job.id),
      JSON.stringify(job),
      'EX',
      AdminPushService.PUSH_JOB_TTL_SECONDS,
    );
  }

  async getJob(jobId: string) {
    const raw = await this.redis.client.get(this.pushJobKey(String(jobId || '').trim()));
    if (!raw) {
      throw new NotFoundException('No se encontro ese envio de push.');
    }
    return serialize(JSON.parse(raw) as PushJobState);
  }

  async createInAppNotifications(userIds: string[], type: string, payload: Record<string, unknown>) {
    const unique = [...new Set(userIds.filter(Boolean))];

    for (const batch of this.chunk(unique, 1000)) {
      await this.prisma.notification.createMany({
        data: batch.map((userId) => ({
          userId: BigInt(userId),
          type,
          payload: payload as never,
        })),
      });
    }

    return unique.length;
  }

  async sendGiftToUser(
    userId: bigint | string,
    payload: { title: string; body: string; amount?: string; type?: string },
  ) {
    try {
      const tokenRows = await this.prisma.pushToken.findMany({
        where: { userId: BigInt(userId) },
        select: { token: true, platform: true },
      });
      const tokens = this.cleanTokens(tokenRows.map((row) => row.token));

      if (!tokens.length) {
        this.logger.warn(`Regalo sin push: usuario ${userId} no tiene tokens FCM`);
        return { ok: false, reason: 'no_tokens' as const };
      }

      this.initFirebaseAdmin();
      const response = await getMessaging().sendEachForMulticast(
        this.buildMulticastMessage(tokens, {
          title: payload.title,
          body: payload.body,
          url: '/',
          type: payload.type || 'admin_points_gift',
          extraData: {
            amount: String(payload.amount || ''),
          },
        }),
      );

      this.logPushFailures(tokens, response);
      this.logger.log(
        `Push regalo usuario ${userId}: ${response.successCount}/${tokens.length} enviados (${tokenRows.map((row) => row.platform).join(', ')})`,
      );

      return {
        ok: response.successCount > 0,
        sent: response.successCount,
        failed: response.failureCount,
      };
    } catch (error) {
      this.logger.error(`Push regalo falló para usuario ${userId}: ${(error as Error).message}`);
      return { ok: false, reason: 'send_failed' as const };
    }
  }

  async users(search = '', limitValue = '50') {
    const query = String(search || '').trim();
    const limit = Math.min(Math.max(Number(limitValue) || 50, 1), 100);

    const users = await this.prisma.user.findMany({
      where: {
        pushTokens: { some: {} },
        ...(query
          ? {
              OR: [
                { displayName: { contains: query, mode: 'insensitive' } },
                { username: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        displayName: true,
        username: true,
        email: true,
        pushTokens: {
          orderBy: { updatedAt: 'desc' },
          select: { id: true, token: true, platform: true, updatedAt: true },
        },
      },
    });

    return serialize(users.map((user) => ({
      id: user.id,
      name: user.displayName || user.username || user.email || `Usuario #${user.id.toString()}`,
      username: user.username,
      email: user.email,
      tokenCount: user.pushTokens.length,
      platforms: [...new Set(user.pushTokens.map((row) => row.platform))],
      latestTokenAt: user.pushTokens[0]?.updatedAt || null,
      sampleToken: user.pushTokens[0]?.token || '',
      sampleTokenShort: user.pushTokens[0]?.token ? `${user.pushTokens[0].token.slice(0, 18)}...` : '',
    })));
  }

  async tokens(userId?: string) {
    const rows = await this.prisma.pushToken.findMany({
      where: userId ? { userId: BigInt(userId) } : {},
      take: 100,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, displayName: true, username: true, email: true } },
      },
    });

    return serialize(rows.map((row) => ({
      id: row.id,
      token: row.token,
      tokenShort: `${row.token.slice(0, 18)}...${row.token.slice(-8)}`,
      platform: row.platform,
      permission: row.permission,
      updatedAt: row.updatedAt,
      userId: row.userId,
      userName: row.user?.displayName || row.user?.username || row.user?.email || `Usuario #${row.userId.toString()}`,
    })));
  }

  async send(payload: SendPushPayload) {
    const title = String(payload.title || '').trim();
    const body = String(payload.body || '').trim();
    const titleEn = String(payload.titleEn || '').trim();
    const bodyEn = String(payload.bodyEn || '').trim();
    const url = String(payload.url || '/').trim() || '/';

    if (!title || !body) {
      throw new BadRequestException('Titulo y mensaje son obligatorios.');
    }

    const userIds = (payload.userIds || []).map((id) => String(id || '').trim()).filter(Boolean);
    let tokenRows: Array<{ token: string; userId: bigint | null }> = [];

    if (payload.sendToAll) {
      tokenRows = await this.collectAllTokens('all');
    } else if (userIds.length) {
      tokenRows = await this.prisma.pushToken.findMany({
        where: { userId: { in: userIds.map((id) => BigInt(id)) } },
        select: { token: true, userId: true },
      });
    }

    const manualTokens = this.cleanTokens(payload.tokens || []);
    const tokens = this.cleanTokens([...tokenRows.map((row) => row.token), ...manualTokens]);

    if (!tokens.length) {
      throw new BadRequestException('No hay tokens para enviar.');
    }

    const jobId = randomUUID();
    const job: PushJobState = {
      id: jobId,
      status: 'queued',
      title,
      body,
      url,
      sendToAll: Boolean(payload.sendToAll),
      total: tokens.length,
      processed: 0,
      sent: 0,
      failed: 0,
      percent: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
    };
    await this.savePushJob(job);

    void this.runPushJob(jobId, tokens, tokenRows, {
      title,
      body,
      titleEn,
      bodyEn,
      url,
    }).catch((error) => {
      this.logger.error(`Push job ${jobId} fallo: ${(error as Error).message}`);
    });

    return serialize({
      ok: true,
      jobId,
      total: tokens.length,
      status: 'queued',
    });
  }

  private async runPushJob(
    jobId: string,
    tokens: string[],
    tokenRows: Array<{ token: string; userId: bigint | null }>,
    payload: { title: string; body: string; titleEn: string; bodyEn: string; url: string },
  ) {
    const raw = await this.redis.client.get(this.pushJobKey(jobId));
    if (!raw) {
      return;
    }

    const job = JSON.parse(raw) as PushJobState;
    job.status = 'running';
    await this.savePushJob(job);

    try {
      const result = await this.dispatch(
        tokens,
        {
          title: payload.title,
          body: payload.body,
          url: payload.url,
          type: 'admin_push',
          extraData: {
            ...(payload.titleEn ? { titleEn: payload.titleEn } : {}),
            ...(payload.bodyEn ? { bodyEn: payload.bodyEn } : {}),
          },
        },
        async (progress) => {
          job.processed = progress.processed;
          job.sent = progress.sent;
          job.failed = progress.failed;
          job.total = progress.total;
          job.percent =
            progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 100;
          await this.savePushJob(job);
        },
      );

      this.logger.log(`Push admin job ${jobId}: ${result.sent}/${result.total} enviados`);

      const notifiedUserIds = tokenRows
        .map((row) => row.userId?.toString())
        .filter((value): value is string => Boolean(value));
      await this.createInAppNotifications(notifiedUserIds, 'admin_push', {
        title: payload.title,
        titleEn: payload.titleEn,
        message: payload.body,
        messageEn: payload.bodyEn,
        body: payload.body,
        bodyEn: payload.bodyEn,
        url: payload.url,
      });

      job.status = 'done';
      job.processed = result.total;
      job.sent = result.sent;
      job.failed = result.failed;
      job.total = result.total;
      job.percent = 100;
      job.errors = result.errors;
      job.finishedAt = new Date().toISOString();
      await this.savePushJob(job);
    } catch (error) {
      job.status = 'failed';
      job.error = `No se pudo enviar push. Revisa FIREBASE_SERVICE_ACCOUNT_PATH o FIREBASE_SERVICE_ACCOUNT_JSON. ${(error as Error).message}`;
      job.finishedAt = new Date().toISOString();
      await this.savePushJob(job);
      throw error;
    }
  }

  async sendArtistFollowers(artistId: string, payload: SendPushPayload) {
    const artist = await this.prisma.artist.findFirst({
      where: {
        OR: [
          { id: BigInt(Number(artistId) || 0) },
          { slug: artistId },
          { firebaseId: artistId },
        ],
      },
      select: { id: true, name: true, slug: true },
    });

    if (!artist) {
      throw new BadRequestException('El artista no existe.');
    }

    const followers = await this.prisma.artistFollower.findMany({
      where: { artistId: artist.id },
      select: {
        userId: true,
        user: {
          select: {
            pushTokens: {
              select: { token: true, userId: true },
            },
          },
        },
      },
    });

    const tokenRows = followers.flatMap((follower) => follower.user.pushTokens);
    const tokens = this.cleanTokens(tokenRows.map((row) => row.token));

    if (!tokens.length) {
      throw new BadRequestException('Este artista no tiene seguidores con push activo.');
    }

    const title = String(payload.title || `${artist.name} tiene novedades`).trim();
    const body = String(payload.body || `Mira el perfil de ${artist.name} y sus votaciones.`).trim();
    const url = String(payload.url || `/artista/${artist.slug || artist.id.toString()}`).trim();

    try {
      const result = await this.dispatch(tokens, {
        title,
        body,
        url,
        type: 'artist_push',
        extraData: {
          artistId: artist.id.toString(),
        },
      });

      await this.createInAppNotifications(
        followers.map((follower) => follower.userId.toString()),
        'artist_push',
        { title, message: body, url, artistId: artist.id.toString(), artistName: artist.name },
      );

      return {
        ok: result.failed === 0,
        artistId: artist.id.toString(),
        artistName: artist.name,
        followers: followers.length,
        ...result,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `No se pudo enviar push del artista. Revisa FIREBASE_SERVICE_ACCOUNT_PATH o FIREBASE_SERVICE_ACCOUNT_JSON. ${(error as Error).message}`,
      );
    }
  }
}
