import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

// Mission types that are credited by the backend itself (referrals, daily streak) or that
// require manual/admin validation. None of these may be self-completed via the public endpoint.
const SERVER_MANAGED_MISSION_TYPES = new Set([
  'manual',
  'referral_signup',
  'referral_signup_milestone',
  'daily_streak',
  'visit_page',
]);

const VISIT_SESSION_TTL_SECONDS = 24 * 60 * 60;
const VISIT_PAGES_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_VISIT_URLS = 10;

type VisitMode = 'exact' | 'host';

type VisitConfig = {
  urls: string[];
  mode: VisitMode;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const withMissionLocales = <T extends { title: string; description: string | null; metadata?: unknown; actionUrl?: string | null }>(
  mission: T,
) => {
  const metadata = asRecord(mission.metadata);
  const titleEn = String(metadata.titleEn || metadata.title_en || '').trim();
  const descriptionEn = String(metadata.descriptionEn || metadata.description_en || '').trim();
  const visitConfig = buildVisitConfig(mission.actionUrl, metadata);

  return {
    ...mission,
    titleEs: mission.title,
    descriptionEs: mission.description || '',
    titleEn,
    descriptionEn,
    visitMode: visitConfig.mode,
    visitUrls: visitConfig.urls,
  };
};

const localizeMission = <T extends { title: string; description: string | null; titleEn?: string; descriptionEn?: string }>(
  mission: T,
  lang?: string,
) => {
  const useEn = String(lang || '').trim().toLowerCase().startsWith('en');
  if (!useEn) {
    return mission;
  }

  return {
    ...mission,
    title: mission.titleEn?.trim() || mission.title,
    description: mission.descriptionEn?.trim() || mission.description,
  };
};

const normalizePath = (value: string) => {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return {
      host: url.hostname.replace(/^www\./, '').toLowerCase(),
      path: path.toLowerCase(),
    };
  } catch {
    return null;
  }
};

const buildVisitConfig = (actionUrl: string | null | undefined, metadata: Record<string, unknown>): VisitConfig => {
  const urls: string[] = [];
  const fromMeta = Array.isArray(metadata.visitUrls) ? metadata.visitUrls : [];

  for (const entry of fromMeta) {
    const value = String(entry || '').trim();
    if (value) {
      urls.push(value);
    }
  }

  const primary = String(actionUrl || '').trim();
  if (primary) {
    urls.unshift(primary);
  }

  const unique = [...new Set(urls)].slice(0, MAX_VISIT_URLS);
  const mode = String(metadata.visitMode || 'exact').toLowerCase() === 'host' ? 'host' : 'exact';

  return { urls: unique, mode };
};

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async findAll(lang?: string) {
    const missions = await this.prisma.mission.findMany({
      where: { active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return serialize(missions.map((mission) => localizeMission(withMissionLocales(mission), lang)));
  }

  async findForUser(userId: bigint, lang?: string) {
    const missions = await this.prisma.mission.findMany({
      where: { active: true },
      include: {
        completions: {
          where: { userId },
          take: 1,
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    const rows = await Promise.all(
      missions.map(async (mission) => {
        const completion = mission.completions[0] || null;
        const { completions, ...missionData } = mission;
        const localized = localizeMission(withMissionLocales(missionData), lang);
        let progress = completion?.progress || 0;

        if (mission.type === 'visit_page' && !completion?.rewardedAt) {
          const uniquePages = await this.redis.client.scard(this.visitPagesKey(mission.id, userId));
          progress = Math.max(progress, Number(uniquePages || 0));
        }

        return {
          ...localized,
          progress,
          completedAt: completion?.completedAt || null,
          rewardedAt: completion?.rewardedAt || null,
        };
      }),
    );

    return serialize(rows);
  }

  async complete(missionId: string, userId: bigint) {
    const mission = await this.findActiveMission(missionId);
    this.assertSelfCompletable(mission.type);
    return this.awardMission(mission, userId, { forceComplete: true });
  }

  async createVisitToken(missionId: string, userId: bigint) {
    const mission = await this.findActiveMission(missionId);

    if (mission.type !== 'visit_page') {
      throw new BadRequestException('Esta mision no usa validacion por visita.');
    }

    const visitConfig = this.getVisitConfig(mission);
    if (!visitConfig.urls.length) {
      throw new BadRequestException('La mision no tiene una URL de destino configurada.');
    }

    const existing = await this.prisma.missionCompletion.findUnique({
      where: { missionId_userId: { missionId: mission.id, userId } },
    });

    if (existing?.rewardedAt) {
      throw new BadRequestException('Ya completaste esta mision.');
    }

    const exp = Math.floor(Date.now() / 1000) + VISIT_SESSION_TTL_SECONDS;
    const nonce = randomBytes(12).toString('hex');
    const payload = Buffer.from(
      JSON.stringify({
        u: userId.toString(),
        m: mission.id.toString(),
        e: exp,
        n: nonce,
        k: 'session',
      }),
    ).toString('base64url');
    const signature = this.signVisitPayload(payload);
    const token = `${payload}.${signature}`;
    const startUrl = visitConfig.urls[0];
    const url = this.appendVisitToken(startUrl, token);

    await this.redis.client.set(
      `mission:visit:session:${nonce}`,
      userId.toString(),
      'EX',
      VISIT_SESSION_TTL_SECONDS,
    );

    return {
      token,
      url,
      expiresIn: VISIT_SESSION_TTL_SECONDS,
      missionId: mission.id.toString(),
      actionUrl: startUrl,
      visitMode: visitConfig.mode,
      visitUrls: visitConfig.urls,
      target: mission.target,
      progress: existing?.progress || 0,
    };
  }

  async validateVisit(token: string, pageUrl: string) {
    const parsed = this.parseVisitToken(token);
    const mission = await this.findActiveMission(parsed.missionId);

    if (mission.type !== 'visit_page') {
      throw new BadRequestException('Esta mision no usa validacion por visita.');
    }

    const sessionKey = `mission:visit:session:${parsed.nonce}`;
    const reserved = await this.redis.client.get(sessionKey);

    if (!reserved) {
      throw new UnauthorizedException('La sesion de visita expiro. Vuelve a abrir la mision.');
    }

    if (reserved !== parsed.userId) {
      throw new UnauthorizedException('Token de visita invalido.');
    }

    return this.recordPageVisit(mission, BigInt(parsed.userId), pageUrl);
  }

  async reportAuthenticatedVisit(userId: bigint, pageUrl: string) {
    const missions = await this.prisma.mission.findMany({
      where: { active: true, type: 'visit_page' },
      include: {
        completions: {
          where: { userId },
          take: 1,
        },
      },
    });

    const updates: Array<{
      missionId: string;
      progress: number;
      target: number;
      awarded: boolean;
      isNewPage: boolean;
    }> = [];

    for (const mission of missions) {
      if (mission.completions[0]?.rewardedAt) {
        continue;
      }

      const config = this.getVisitConfig(mission);
      if (!this.pageMatchesVisitConfig(config, pageUrl)) {
        continue;
      }

      try {
        const result = await this.recordPageVisit(mission, userId, pageUrl);
        updates.push({
          missionId: mission.id.toString(),
          progress: Number(result.progress || 0),
          target: mission.target,
          awarded: Boolean(result.awarded),
          isNewPage: Boolean(result.isNewPage),
        });
      } catch {
        // Skip non-matching / invalid pages quietly for bulk reporting.
      }
    }

    return { ok: true, updates };
  }

  assertSelfCompletable(type: string) {
    if (SERVER_MANAGED_MISSION_TYPES.has(type)) {
      throw new BadRequestException('Esta mision se valida automaticamente y no puede completarse manualmente.');
    }
  }

  private async findActiveMission(missionId: string) {
    const mission = await this.prisma.mission.findFirst({
      where: {
        OR: [{ id: BigInt(Number(missionId) || 0) }, { firebaseId: missionId }],
        active: true,
      },
    });

    if (!mission) {
      throw new NotFoundException('La mision no existe.');
    }

    return mission;
  }

  private getVisitConfig(mission: { actionUrl?: string | null; metadata?: unknown }): VisitConfig {
    return buildVisitConfig(mission.actionUrl, asRecord(mission.metadata));
  }

  private pageMatchesVisitConfig(config: VisitConfig, pageUrl: string) {
    const page = normalizePath(pageUrl);
    if (!page || !config.urls.length) {
      return false;
    }

    if (config.mode === 'host') {
      const hosts = new Set(
        config.urls
          .map((url) => normalizePath(url)?.host)
          .filter((host): host is string => Boolean(host)),
      );
      return hosts.has(page.host);
    }

    return config.urls.some((url) => {
      const target = normalizePath(url);
      if (!target) {
        return false;
      }

      return target.host === page.host && target.path === page.path;
    });
  }

  private pageKey(pageUrl: string) {
    const page = normalizePath(pageUrl);
    return page ? `${page.host}${page.path}` : '';
  }

  private visitPagesKey(missionId: bigint, userId: bigint) {
    return `mission:visit:pages:${missionId.toString()}:${userId.toString()}`;
  }

  private async recordPageVisit(
    mission: { id: bigint; title: string; rewardPoints: number; target: number; actionUrl?: string | null; metadata?: unknown; type?: string },
    userId: bigint,
    pageUrl: string,
  ) {
    const config = this.getVisitConfig(mission);

    if (!this.pageMatchesVisitConfig(config, pageUrl)) {
      throw new BadRequestException('La pagina visitada no coincide con la mision.');
    }

    const key = this.pageKey(pageUrl);
    if (!key) {
      throw new BadRequestException('URL de pagina invalida.');
    }

    const setKey = this.visitPagesKey(mission.id, userId);
    const added = await this.redis.client.sadd(setKey, key);
    await this.redis.client.expire(setKey, VISIT_PAGES_TTL_SECONDS);
    const uniqueCount = Number(await this.redis.client.scard(setKey));
    const result = await this.awardMission(mission, userId, {
      progress: uniqueCount,
      forceComplete: false,
    });

    return {
      ok: true,
      awarded: result.awarded,
      pointsAfter: result.pointsAfter,
      missionId: mission.id.toString(),
      progress: uniqueCount,
      target: mission.target,
      isNewPage: added === 1,
      visitMode: config.mode,
    };
  }

  private async awardMission(
    mission: {
      id: bigint;
      title: string;
      rewardPoints: number;
      target: number;
    },
    userId: bigint,
    options: { progress?: number; forceComplete?: boolean } = {},
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.missionCompletion.findUnique({
        where: { missionId_userId: { missionId: mission.id, userId } },
      });

      if (existing?.rewardedAt) {
        return { completion: existing, awarded: false, pointsAfter: null };
      }

      const nextProgress = Math.min(
        mission.target,
        Math.max(
          1,
          options.forceComplete
            ? mission.target
            : Number(options.progress ?? (existing?.progress || 0) + 1),
        ),
      );

      const completion = existing
        ? await tx.missionCompletion.update({
            where: { id: existing.id },
            data: { progress: nextProgress },
          })
        : await tx.missionCompletion.create({
            data: {
              missionId: mission.id,
              userId,
              progress: nextProgress,
            },
          });

      if (nextProgress < mission.target) {
        return { completion, awarded: false, pointsAfter: null };
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { points: { increment: mission.rewardPoints } },
      });

      await tx.notification.create({
        data: {
          userId,
          type: 'mission_completed',
          payload: {
            title: 'Mision completada',
            message: `Completaste "${mission.title}" y ganaste ${mission.rewardPoints} puntos.`,
            missionId: mission.id.toString(),
            missionTitle: mission.title,
            rewardPoints: mission.rewardPoints,
            pointsAfter: updatedUser.points.toString(),
            url: '/notificaciones',
          },
        },
      });

      const updatedCompletion = await tx.missionCompletion.update({
        where: { id: completion.id },
        data: {
          progress: mission.target,
          completedAt: new Date(),
          rewardedAt: new Date(),
        },
      });

      return {
        completion: updatedCompletion,
        awarded: true,
        pointsAfter: updatedUser.points,
      };
    });

    return serialize({ mission, ...result });
  }

  private visitSecret() {
    return (
      this.config.get<string>('MISSION_VISIT_SECRET') ||
      this.config.get<string>('JWT_ACCESS_SECRET') ||
      'change-me-access-secret'
    );
  }

  private signVisitPayload(payload: string) {
    return createHmac('sha256', this.visitSecret()).update(payload).digest('base64url');
  }

  private parseVisitToken(token: string) {
    const [payload, signature] = String(token || '').split('.');

    if (!payload || !signature) {
      throw new UnauthorizedException('Token de visita invalido.');
    }

    const expected = this.signVisitPayload(payload);
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);

    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new UnauthorizedException('Token de visita invalido.');
    }

    let data: { u?: string; m?: string; e?: number; n?: string };

    try {
      data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Token de visita invalido.');
    }

    if (!data?.u || !data?.m || !data?.e || !data?.n) {
      throw new UnauthorizedException('Token de visita invalido.');
    }

    if (Number(data.e) < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('El token de visita expiro.');
    }

    return {
      userId: String(data.u),
      missionId: String(data.m),
      nonce: String(data.n),
      exp: Number(data.e),
    };
  }

  private appendVisitToken(actionUrl: string, token: string) {
    const url = new URL(actionUrl);
    url.searchParams.set('vmm', token);
    return url.toString();
  }
}
