import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';
import { AdminPushService } from './admin-push.service';

type CampaignInput = {
  title?: string;
  titleEn?: string;
  body?: string;
  bodyEn?: string;
  url?: string;
  platform?: string;
  status?: string;
  intervalMinutes?: number | string;
  maxSends?: number | string | null;
  nextRunAt?: string | null;
};

const PLATFORMS = new Set(['all', 'android', 'ios', 'web']);
const STATUSES = new Set(['active', 'paused', 'done']);
const MIN_INTERVAL_MINUTES = 5;

@Injectable()
export class NotificationCampaignsService {
  private readonly logger = new Logger(NotificationCampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: AdminPushService,
  ) {}

  private parseInterval(value: unknown, fallback = 1440) {
    const minutes = Math.round(Number(value));
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return fallback;
    }
    return Math.max(MIN_INTERVAL_MINUTES, Math.min(minutes, 60 * 24 * 365));
  }

  private parseMaxSends(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private parseDate(value: unknown) {
    if (!value) {
      return null;
    }
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  async list() {
    const rows = await this.prisma.notificationCampaign.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return serialize(rows);
  }

  async create(input: CampaignInput, createdBy?: string) {
    const title = String(input.title || '').trim();
    const body = String(input.body || '').trim();

    if (!title || !body) {
      throw new BadRequestException('Titulo y mensaje en español son obligatorios.');
    }

    const intervalMinutes = this.parseInterval(input.intervalMinutes);
    const status = STATUSES.has(String(input.status)) ? String(input.status) : 'paused';
    const nextRunAt =
      this.parseDate(input.nextRunAt) ||
      (status === 'active' ? new Date(Date.now() + intervalMinutes * 60_000) : null);

    const campaign = await this.prisma.notificationCampaign.create({
      data: {
        title,
        titleEn: String(input.titleEn || '').trim() || null,
        body,
        bodyEn: String(input.bodyEn || '').trim() || null,
        url: String(input.url || '/').trim() || '/',
        platform: PLATFORMS.has(String(input.platform)) ? String(input.platform) : 'all',
        status,
        intervalMinutes,
        maxSends: this.parseMaxSends(input.maxSends),
        nextRunAt,
        createdBy: createdBy || null,
      },
    });

    return serialize(campaign);
  }

  async update(id: string, input: CampaignInput) {
    const current = await this.prisma.notificationCampaign.findUnique({ where: { id: BigInt(id) } });

    if (!current) {
      throw new NotFoundException('La campaña no existe.');
    }

    const intervalMinutes =
      input.intervalMinutes === undefined
        ? current.intervalMinutes
        : this.parseInterval(input.intervalMinutes, current.intervalMinutes);
    const status = STATUSES.has(String(input.status)) ? String(input.status) : current.status;
    const explicitNextRun = this.parseDate(input.nextRunAt);

    // Reactivar una campaña sin fecha pendiente la programa para el siguiente intervalo.
    const nextRunAt =
      explicitNextRun ||
      (status === 'active'
        ? current.nextRunAt || new Date(Date.now() + intervalMinutes * 60_000)
        : null);

    const campaign = await this.prisma.notificationCampaign.update({
      where: { id: current.id },
      data: {
        ...(input.title !== undefined ? { title: String(input.title).trim() } : {}),
        ...(input.titleEn !== undefined ? { titleEn: String(input.titleEn).trim() || null } : {}),
        ...(input.body !== undefined ? { body: String(input.body).trim() } : {}),
        ...(input.bodyEn !== undefined ? { bodyEn: String(input.bodyEn).trim() || null } : {}),
        ...(input.url !== undefined ? { url: String(input.url).trim() || '/' } : {}),
        ...(input.platform !== undefined && PLATFORMS.has(String(input.platform))
          ? { platform: String(input.platform) }
          : {}),
        ...(input.maxSends !== undefined ? { maxSends: this.parseMaxSends(input.maxSends) } : {}),
        intervalMinutes,
        status,
        nextRunAt,
      },
    });

    return serialize(campaign);
  }

  async remove(id: string) {
    await this.prisma.notificationCampaign.delete({ where: { id: BigInt(id) } });
    return { ok: true };
  }

  async sendNow(id: string) {
    const campaign = await this.prisma.notificationCampaign.findUnique({ where: { id: BigInt(id) } });

    if (!campaign) {
      throw new NotFoundException('La campaña no existe.');
    }

    const result = await this.run(campaign);

    if (!result.ok && result.reason === 'no_tokens') {
      throw new BadRequestException('No hay tokens push para esa plataforma.');
    }

    return result;
  }

  /** Envía la campaña a todos los usuarios con push y reprograma el siguiente disparo. */
  async run(campaign: {
    id: bigint;
    title: string;
    titleEn: string | null;
    body: string;
    bodyEn: string | null;
    url: string;
    platform: string;
    intervalMinutes: number;
    maxSends: number | null;
    sentCount: number;
  }) {
    const tokenRows = await this.push.collectAllTokens(campaign.platform);
    const tokens = [...new Set(tokenRows.map((row) => row.token.trim()).filter(Boolean))];
    const sentAt = new Date();
    const nextSentCount = campaign.sentCount + 1;
    const reachedLimit = campaign.maxSends ? nextSentCount >= campaign.maxSends : false;

    if (!tokens.length) {
      await this.prisma.notificationCampaign.update({
        where: { id: campaign.id },
        data: {
          nextRunAt: new Date(sentAt.getTime() + campaign.intervalMinutes * 60_000),
          lastResult: { ok: false, reason: 'no_tokens', at: sentAt.toISOString() },
        },
      });

      return { ok: false as const, reason: 'no_tokens' as const, sent: 0, failed: 0, total: 0 };
    }

    const titleEn = campaign.titleEn || '';
    const bodyEn = campaign.bodyEn || '';

    const result = await this.push.dispatch(tokens, {
      title: campaign.title,
      body: campaign.body,
      url: campaign.url || '/',
      type: 'admin_push',
      extraData: {
        campaignId: campaign.id.toString(),
        ...(titleEn ? { titleEn } : {}),
        ...(bodyEn ? { bodyEn } : {}),
      },
    });

    await this.push.createInAppNotifications(
      tokenRows.map((row) => row.userId.toString()),
      'admin_push',
      {
        title: campaign.title,
        titleEn,
        message: campaign.body,
        messageEn: bodyEn,
        body: campaign.body,
        bodyEn,
        url: campaign.url || '/',
        campaignId: campaign.id.toString(),
      },
    );

    await this.prisma.notificationCampaign.update({
      where: { id: campaign.id },
      data: {
        sentCount: nextSentCount,
        lastSentAt: sentAt,
        status: reachedLimit ? 'done' : undefined,
        nextRunAt: reachedLimit
          ? null
          : new Date(sentAt.getTime() + campaign.intervalMinutes * 60_000),
        lastResult: {
          ok: result.failed === 0,
          sent: result.sent,
          failed: result.failed,
          total: result.total,
          at: sentAt.toISOString(),
        },
      },
    });

    this.logger.log(
      `Campaña ${campaign.id.toString()} enviada: ${result.sent}/${result.total} (envío #${nextSentCount})`,
    );

    return { ok: result.failed === 0, reason: 'sent' as const, ...result };
  }

  /** Ejecutado por el worker: dispara las campañas activas vencidas. */
  async runDue(limit = 5) {
    const now = new Date();
    const due = await this.prisma.notificationCampaign.findMany({
      where: { status: 'active', nextRunAt: { not: null, lte: now } },
      orderBy: { nextRunAt: 'asc' },
      take: limit,
    });

    for (const campaign of due) {
      try {
        await this.run(campaign);
      } catch (error) {
        this.logger.error(
          `Campaña ${campaign.id.toString()} falló: ${(error as Error).message}`,
        );
        await this.prisma.notificationCampaign.update({
          where: { id: campaign.id },
          data: {
            nextRunAt: new Date(Date.now() + campaign.intervalMinutes * 60_000),
            lastResult: { ok: false, reason: 'error', message: (error as Error).message },
          },
        });
      }
    }

    return due.length;
  }
}
