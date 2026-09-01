import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { allowsCampaignEmail } from '../../common/email-preferences';
import { serialize } from '../../common/serialize';
import { buildAdminTestEmail } from '../mail/admin-test.email';
import { buildEmailVerificationEmail } from '../mail/email-verification.email';
import {
  EmailVerificationLocaleCopy,
} from '../mail/email-verification.config';
import { buildPollNotifyEmail } from '../mail/poll-notify.email';
import { MAIL_LOGO_CID } from '../mail/transactional-email.layout';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type MailRecipient = {
  userId: string;
  email: string;
  name: string;
  locale: 'es' | 'en';
};

type MailJobState = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  subject: string;
  template: 'broadcast' | 'poll';
  sendToAll: boolean;
  total: number;
  processed: number;
  sent: number;
  failed: number;
  percent: number;
  errors: Array<{ email: string; message: string }>;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

@Injectable()
export class AdminMailService {
  private readonly logger = new Logger(AdminMailService.name);
  private static readonly MAIL_JOB_TTL_SECONDS = 60 * 60;
  private static readonly PREVIEW_LOGO_URL = 'https://vote.musicmundial.com/logo-votos.png';
  private static readonly SEND_DELAY_MS = 80;
  private static readonly RECENT_JOBS_KEY = 'mail:jobs:recent';
  private static readonly RECENT_JOBS_TTL_SECONDS = 120 * 24 * 3600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
  ) {}

  private mailJobKey(jobId: string) {
    return `admin-mail-job:${jobId}`;
  }

  private async saveMailJob(job: MailJobState) {
    await this.redis.client.set(
      this.mailJobKey(job.id),
      JSON.stringify(job),
      'EX',
      AdminMailService.MAIL_JOB_TTL_SECONDS,
    );
  }

  private async archiveMailJob(job: MailJobState) {
    const summary = {
      id: job.id,
      status: job.status,
      subject: job.subject,
      template: job.template || 'broadcast',
      sendToAll: job.sendToAll,
      total: job.total,
      sent: job.sent,
      failed: job.failed,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      error: job.error,
    };
    await this.redis.client.lpush(AdminMailService.RECENT_JOBS_KEY, JSON.stringify(summary));
    await this.redis.client.ltrim(AdminMailService.RECENT_JOBS_KEY, 0, 39);
    await this.redis.client.expire(
      AdminMailService.RECENT_JOBS_KEY,
      AdminMailService.RECENT_JOBS_TTL_SECONDS,
    );
  }

  async getMetrics() {
    const [stats, withEmail, optedOut, recentRaw] = await Promise.all([
      this.mail.getSendStats(30),
      this.prisma.user.count({ where: { email: { not: null } } }),
      this.prisma.user.count({
        where: {
          email: { not: null },
          metadata: { path: ['emailCampaigns'], equals: false },
        },
      }),
      this.redis.client.lrange(AdminMailService.RECENT_JOBS_KEY, 0, 19),
    ]);

    const recentJobs = recentRaw
      .map((row) => {
        try {
          return JSON.parse(row) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return serialize({
      audience: {
        withEmail,
        optedOut,
        campaignable: Math.max(0, withEmail - optedOut),
      },
      today: stats.today,
      last7: stats.last7,
      last30: stats.last30,
      series: stats.series,
      recentJobs,
    });
  }

  private isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private toRecipient(user: {
    id: bigint;
    email: string | null;
    displayName: string | null;
    username: string | null;
    metadata?: unknown;
  }): MailRecipient | null {
    const email = String(user.email || '')
      .trim()
      .toLowerCase();
    if (!email || !this.isValidEmail(email)) return null;
    if (!allowsCampaignEmail(user.metadata)) return null;
    return {
      userId: user.id.toString(),
      email,
      name: user.displayName || user.username || email,
      locale: this.resolveUserLocale(user.metadata),
    };
  }

  private resolveUserLocale(metadata: unknown): 'es' | 'en' {
    const meta =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};
    const raw = String(meta.locale || meta.lang || meta.language || '')
      .trim()
      .toLowerCase();
    return raw.startsWith('es') ? 'es' : 'en';
  }

  private htmlForPreview(html: string) {
    return html.replace(new RegExp(`cid:${MAIL_LOGO_CID}`, 'g'), AdminMailService.PREVIEW_LOGO_URL);
  }

  async users(search = '', limitValue = '80') {
    const query = String(search || '').trim();
    const limit = Math.min(Math.max(Number(limitValue) || 80, 1), 200);

    const users = await this.prisma.user.findMany({
      where: {
        email: { not: null },
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
        emailVerifiedAt: true,
        updatedAt: true,
      },
    });

    const totalWithEmail = await this.prisma.user.count({
      where: { email: { not: null } },
    });

    return serialize({
      totalWithEmail,
      users: users.flatMap((user) => {
        const recipient = this.toRecipient(user);
        if (!recipient) return [];
        return [
          {
            id: recipient.userId,
            name: recipient.name,
            email: recipient.email,
            emailVerified: Boolean(user.emailVerifiedAt),
            updatedAt: user.updatedAt,
          },
        ];
      }),
    });
  }

  preview(input: {
    subject?: string;
    message?: string;
    mode?: 'test' | 'broadcast' | 'verification' | 'poll';
    locale?: string | null;
    name?: string;
    code?: string;
    copy?: Partial<EmailVerificationLocaleCopy> | null;
    ctaUrl?: string | null;
    ctaLabel?: string | null;
    coverImageUrl?: string | null;
    subtitle?: string | null;
    vars?: Record<string, string | null | undefined>;
  }) {
    if (input.mode === 'verification') {
      const built = buildEmailVerificationEmail({
        name: String(input.name || 'Usuario').trim() || 'Usuario',
        code: String(input.code || '847291').trim() || '847291',
        locale: input.locale || 'en',
        copy: input.copy,
      });

      return {
        subject: built.subject,
        html: this.htmlForPreview(built.html),
        text: built.text,
        mode: 'verification' as const,
        locale: built.locale,
      };
    }

    if (input.mode === 'poll') {
      const built = buildPollNotifyEmail({
        subject: input.subject,
        message: input.message,
        locale: input.locale || 'en',
        ctaUrl: input.ctaUrl,
        ctaLabel: input.ctaLabel,
        coverImageUrl: input.coverImageUrl,
        subtitle: input.subtitle,
        vars: {
          name: input.name || input.vars?.name || (input.locale === 'en' ? 'User' : 'Usuario'),
          pollTitle: input.vars?.pollTitle || '',
          ...(input.vars || {}),
        },
      });

      return {
        subject: built.subject,
        html: this.htmlForPreview(built.html),
        text: built.text,
        mode: 'poll' as const,
        locale: built.locale,
        ctaUrl: built.ctaUrl,
      };
    }

    const mode = input.mode === 'broadcast' ? 'broadcast' : 'test';
    const built = buildAdminTestEmail({
      subject: input.subject,
      message: input.message,
      mode,
      locale: input.locale || 'en',
      ctaUrl: input.ctaUrl,
      ctaLabel: input.ctaLabel,
      vars: {
        name: input.name || input.vars?.name || (input.locale === 'en' ? 'User' : 'Usuario'),
        pollTitle: input.vars?.pollTitle || '',
        ...(input.vars || {}),
      },
    });

    return {
      subject: built.subject,
      html: this.htmlForPreview(built.html),
      text: built.text,
      mode,
      locale: built.locale,
      ctaUrl: built.ctaUrl,
    };
  }

  getVerificationCopy() {
    return this.mail.getEmailVerificationCopy();
  }

  saveVerificationCopy(body: {
    es?: Partial<EmailVerificationLocaleCopy>;
    en?: Partial<EmailVerificationLocaleCopy>;
  }) {
    if (!body?.es && !body?.en) {
      throw new BadRequestException('Debes enviar el contenido en español y/o inglés.');
    }
    return this.mail.saveEmailVerificationCopy(body);
  }

  async getJob(jobId: string) {
    const raw = await this.redis.client.get(this.mailJobKey(String(jobId || '').trim()));
    if (!raw) {
      throw new NotFoundException('Trabajo de correo no encontrado.');
    }
    return JSON.parse(raw) as MailJobState;
  }

  private async collectRecipients(payload: {
    userIds?: string[];
    sendToAll?: boolean;
  }): Promise<MailRecipient[]> {
    if (payload.sendToAll) {
      const recipients: MailRecipient[] = [];
      let cursor: bigint | undefined;

      for (;;) {
        const page = await this.prisma.user.findMany({
          where: { email: { not: null } },
          take: 500,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: 'asc' },
          select: {
            id: true,
            email: true,
            displayName: true,
            username: true,
            metadata: true,
          },
        });

        if (!page.length) break;

        for (const user of page) {
          const recipient = this.toRecipient(user);
          if (recipient) recipients.push(recipient);
        }

        cursor = page[page.length - 1].id;
      }

      return recipients;
    }

    const userIds = (payload.userIds || [])
      .map((id) => String(id || '').trim())
      .filter(Boolean);

    if (!userIds.length) {
      throw new BadRequestException('Selecciona usuarios o marca enviar a todos.');
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds.map((id) => BigInt(id)) },
        email: { not: null },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
        metadata: true,
      },
    });

    return users
      .map((user) => this.toRecipient(user))
      .filter((row): row is MailRecipient => Boolean(row));
  }

  async sendBulk(payload: {
    subject?: string;
    message?: string;
    subjectEn?: string;
    messageEn?: string;
    userIds?: string[];
    sendToAll?: boolean;
    ctaUrl?: string | null;
    ctaLabel?: string | null;
    ctaLabelEn?: string | null;
    pollTitle?: string | null;
    pollTitleEn?: string | null;
    template?: 'broadcast' | 'poll';
    coverImageUrl?: string | null;
    subtitle?: string | null;
    subtitleEn?: string | null;
  }) {
    if (!this.mail.isConfigured()) {
      throw new BadRequestException(
        'SMTP no configurado. Revisa SMTP_HOST, SMTP_USER y SMTP_PASS en backend/.env',
      );
    }

    const subject = String(payload.subject || '').trim();
    const message = String(payload.message || '').trim();
    const subjectEn = String(payload.subjectEn || '').trim() || subject;
    const messageEn = String(payload.messageEn || '').trim() || message;

    if (!subject || !message) {
      throw new BadRequestException('Asunto y mensaje en español son obligatorios.');
    }

    const recipients = await this.collectRecipients(payload);
    if (!recipients.length) {
      throw new BadRequestException('No hay correos válidos para enviar.');
    }

    const ctaUrl = String(payload.ctaUrl || '').trim() || null;
    const ctaLabel = String(payload.ctaLabel || '').trim() || null;
    const ctaLabelEn = String(payload.ctaLabelEn || '').trim() || ctaLabel;
    const pollTitle = String(payload.pollTitle || '').trim() || null;
    const pollTitleEn = String(payload.pollTitleEn || '').trim() || pollTitle;
    const template = payload.template === 'poll' ? 'poll' : 'broadcast';
    const coverImageUrl = String(payload.coverImageUrl || '').trim() || null;
    const subtitle = String(payload.subtitle || '').trim() || null;
    const subtitleEn = String(payload.subtitleEn || '').trim() || subtitle;

    const jobId = randomUUID();
    const job: MailJobState = {
      id: jobId,
      status: 'queued',
      subject,
      template,
      sendToAll: Boolean(payload.sendToAll),
      total: recipients.length,
      processed: 0,
      sent: 0,
      failed: 0,
      percent: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
    };
    await this.saveMailJob(job);

    void this.runMailJob(jobId, recipients, {
      subject,
      message,
      subjectEn,
      messageEn,
      ctaUrl,
      ctaLabel,
      ctaLabelEn,
      pollTitle,
      pollTitleEn,
      template,
      coverImageUrl,
      subtitle,
      subtitleEn,
    }).catch((error) => {
      this.logger.error(`Mail job ${jobId} fallo: ${(error as Error).message}`);
    });

    return serialize({
      ok: true,
      jobId,
      total: recipients.length,
      status: 'queued',
    });
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async runMailJob(
    jobId: string,
    recipients: MailRecipient[],
    payload: {
      subject: string;
      message: string;
      subjectEn: string;
      messageEn: string;
      ctaUrl?: string | null;
      ctaLabel?: string | null;
      ctaLabelEn?: string | null;
      pollTitle?: string | null;
      pollTitleEn?: string | null;
      template?: 'broadcast' | 'poll';
      coverImageUrl?: string | null;
      subtitle?: string | null;
      subtitleEn?: string | null;
    },
  ) {
    const raw = await this.redis.client.get(this.mailJobKey(jobId));
    if (!raw) return;

    const job = JSON.parse(raw) as MailJobState;
    job.status = 'running';
    await this.saveMailJob(job);

    try {
      for (const recipient of recipients) {
        try {
          const isEn = recipient.locale === 'en';
          await this.mail.sendTestEmail({
            to: recipient.email,
            subject: isEn ? payload.subjectEn : payload.subject,
            message: isEn ? payload.messageEn : payload.message,
            mode: payload.template === 'poll' ? 'poll' : 'broadcast',
            locale: recipient.locale,
            ctaUrl: payload.ctaUrl,
            ctaLabel: isEn ? payload.ctaLabelEn || payload.ctaLabel : payload.ctaLabel,
            coverImageUrl: payload.coverImageUrl,
            subtitle: isEn ? payload.subtitleEn || payload.subtitle : payload.subtitle,
            vars: {
              name: recipient.name,
              pollTitle: (isEn ? payload.pollTitleEn : payload.pollTitle) || '',
            },
          });
          job.sent += 1;
        } catch (error) {
          job.failed += 1;
          if (job.errors.length < 25) {
            job.errors.push({
              email: recipient.email,
              message: String((error as Error)?.message || 'Error al enviar'),
            });
          }
        }

        job.processed += 1;
        job.percent =
          job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 100;
        await this.saveMailJob(job);

        if (AdminMailService.SEND_DELAY_MS > 0) {
          await this.sleep(AdminMailService.SEND_DELAY_MS);
        }
      }

      job.status = 'done';
      job.percent = 100;
      job.finishedAt = new Date().toISOString();
      await this.saveMailJob(job);
      await this.archiveMailJob(job);
      this.logger.log(`Mail admin job ${jobId}: ${job.sent}/${job.total} enviados`);
    } catch (error) {
      job.status = 'failed';
      job.error = String((error as Error)?.message || 'No se pudo completar el envío.');
      job.finishedAt = new Date().toISOString();
      await this.saveMailJob(job);
      await this.archiveMailJob(job);
      throw error;
    }
  }
}
