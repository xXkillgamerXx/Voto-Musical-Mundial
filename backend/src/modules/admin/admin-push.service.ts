import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { readFileSync } from 'fs';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class AdminPushService {
  private readonly logger = new Logger(AdminPushService.name);

  constructor(private readonly prisma: PrismaService) {}

  private firebaseReady = false;

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

  async sendGiftToUser(
    userId: bigint | string,
    payload: { title: string; body: string; amount?: string },
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
          type: 'admin_points_gift',
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
      tokenRows = await this.prisma.pushToken.findMany({
        take: 500,
        orderBy: { updatedAt: 'desc' },
        select: { token: true, userId: true },
      });
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

    try {
      this.initFirebaseAdmin();
      const response = await getMessaging().sendEachForMulticast(
        this.buildMulticastMessage(tokens, {
          title,
          body,
          url,
          type: 'admin_push',
          extraData: {
            ...(titleEn ? { titleEn } : {}),
            ...(bodyEn ? { bodyEn } : {}),
          },
        }),
      );

      this.logPushFailures(tokens, response);
      this.logger.log(`Push admin: ${response.successCount}/${tokens.length} enviados`);

      const notifiedUserIds = [
        ...new Set(tokenRows.map((row) => row.userId?.toString()).filter((value): value is string => Boolean(value))),
      ];
      if (notifiedUserIds.length) {
        await this.prisma.notification.createMany({
          data: notifiedUserIds.map((userId) => ({
            userId: BigInt(userId),
            type: 'admin_push',
            payload: { title, titleEn, message: body, messageEn: bodyEn, body, bodyEn, url },
          })),
        });
      }

      return {
        ok: response.failureCount === 0,
        sent: response.successCount,
        failed: response.failureCount,
        total: tokens.length,
        errors: response.responses
          .map((item, index) => item.success ? null : ({
            token: `${tokens[index].slice(0, 18)}...${tokens[index].slice(-8)}`,
            code: item.error?.code || 'unknown',
            message: item.error?.message || 'No se pudo enviar.',
          }))
          .filter(Boolean),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `No se pudo enviar push. Revisa FIREBASE_SERVICE_ACCOUNT_PATH o FIREBASE_SERVICE_ACCOUNT_JSON. ${(error as Error).message}`,
      );
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
      this.initFirebaseAdmin();
      const response = await getMessaging().sendEachForMulticast(
        this.buildMulticastMessage(tokens, {
          title,
          body,
          url,
          type: 'artist_push',
          extraData: {
            artistId: artist.id.toString(),
          },
        }),
      );

      this.logPushFailures(tokens, response);

      const followerUserIds = [...new Set(followers.map((follower) => follower.userId.toString()))];
      await this.prisma.notification.createMany({
        data: followerUserIds.map((userId) => ({
          userId: BigInt(userId),
          type: 'artist_push',
          payload: { title, message: body, url, artistId: artist.id.toString(), artistName: artist.name },
        })),
      });

      return {
        ok: response.failureCount === 0,
        artistId: artist.id.toString(),
        artistName: artist.name,
        followers: followers.length,
        sent: response.successCount,
        failed: response.failureCount,
        total: tokens.length,
        errors: response.responses
          .map((item, index) => item.success ? null : ({
            token: `${tokens[index].slice(0, 18)}...${tokens[index].slice(-8)}`,
            code: item.error?.code || 'unknown',
            message: item.error?.message || 'No se pudo enviar.',
          }))
          .filter(Boolean),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `No se pudo enviar push del artista. Revisa FIREBASE_SERVICE_ACCOUNT_PATH o FIREBASE_SERVICE_ACCOUNT_JSON. ${(error as Error).message}`,
      );
    }
  }
}
