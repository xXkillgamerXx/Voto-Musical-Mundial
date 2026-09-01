import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { join } from 'path';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  buildPasswordResetEmail,
  PASSWORD_RESET_LOGO_CID,
} from './password-reset.email';
import {
  buildEmailVerificationEmail,
  EMAIL_VERIFICATION_LOGO_CID,
} from './email-verification.email';
import {
  DEFAULT_EMAIL_VERIFICATION_COPY,
  EMAIL_VERIFICATION_COPY_REDIS_KEY,
  EmailVerificationCopySettings,
  EmailVerificationLocaleCopy,
  normalizeEmailVerificationCopy,
} from './email-verification.config';
import { buildAdminTestEmail } from './admin-test.email';
import { buildPollNotifyEmail } from './poll-notify.email';
import { RedisService } from '../redis/redis.service';
import { resolveMailLocale } from './transactional-email.layout';

export type MailPublicStatus = {
  configured: boolean;
  from: string;
  host: string | null;
  port: number | null;
  verified: boolean;
};

export const MAIL_METRIC_KINDS = [
  'verification',
  'password_reset',
  'broadcast',
  'poll',
  'lifecycle',
  'test',
] as const;

export type MailMetricKind = (typeof MAIL_METRIC_KINDS)[number];

type MailKindTotals = Record<MailMetricKind, { sent: number; failed: number }>;

const emptyKindTotals = (): MailKindTotals =>
  Object.fromEntries(MAIL_METRIC_KINDS.map((kind) => [kind, { sent: 0, failed: 0 }])) as MailKindTotals;

const MAIL_METRICS_TTL_SECONDS = 120 * 24 * 3600;

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly logoPath: string | null;
  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private smtpVerified = false;

  constructor(
    config: ConfigService,
    private readonly redis: RedisService,
  ) {
    const host = String(
      config.get<string>('SMTP_HOST') || config.get<string>('MAIL_HOST') || '',
    ).trim();
    const user = String(
      config.get<string>('SMTP_USER') || config.get<string>('MAIL_USERNAME') || '',
    ).trim();
    const pass = String(
      config.get<string>('SMTP_PASS') || config.get<string>('MAIL_PASSWORD') || '',
    ).trim();
    const port = Number(
      config.get<string>('SMTP_PORT') || config.get<string>('MAIL_PORT') || 2525,
    );
    this.smtpHost = host;
    this.smtpPort = port;
    this.from =
      String(config.get<string>('MAIL_FROM') || '').trim() ||
      'Music Mundial VOTING <noreply@musicmundial.com>';

    const candidate = join(process.cwd(), 'assets', 'email', 'logo-votos.png');
    this.logoPath = existsSync(candidate) ? candidate : null;

    const isInternalHost =
      host === '127.0.0.1' ||
      host === 'localhost' ||
      host.startsWith('172.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.');

    this.transporter =
      host && user && pass
        ? nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            requireTLS: port === 587,
            auth: { user, pass },
            ...(isInternalHost ? { tls: { rejectUnauthorized: false } } : {}),
          })
        : null;
  }

  isConfigured() {
    return Boolean(this.transporter);
  }

  async onModuleInit() {
    if (!this.transporter) {
      this.logger.warn('SMTP no configurado: no se enviaran correos.');
      return;
    }

    try {
      await this.transporter.verify();
      this.smtpVerified = true;
      this.logger.log('SMTP listo para enviar correos.');
    } catch (error) {
      this.smtpVerified = false;
      this.logger.warn(`SMTP no responde: ${(error as Error).message}`);
    }
  }

  getPublicStatus(): MailPublicStatus {
    return {
      configured: this.isConfigured(),
      from: this.from,
      host: this.smtpHost || null,
      port: this.smtpHost ? this.smtpPort : null,
      verified: this.smtpVerified,
    };
  }

  async sendPasswordReset(input: {
    to: string;
    name: string;
    resetUrl: string;
    locale?: string | null;
  }) {
    if (!this.transporter) {
      throw new Error('SMTP no configurado.');
    }

    const { subject, text, html } = buildPasswordResetEmail(input);

    await this.sendMail({
      to: input.to,
      subject,
      text,
      html,
      kind: 'password_reset',
      attachments: this.logoPath
        ? [
            {
              filename: 'logo-votos.png',
              path: this.logoPath,
              cid: PASSWORD_RESET_LOGO_CID,
              contentType: 'image/png',
            },
          ]
        : undefined,
    });
  }

  async getEmailVerificationCopy(): Promise<EmailVerificationCopySettings> {
    try {
      const raw = await this.redis.client.get(EMAIL_VERIFICATION_COPY_REDIS_KEY);
      if (raw) {
        return normalizeEmailVerificationCopy(JSON.parse(raw));
      }
    } catch {
      // Fall back to defaults when Redis is unavailable or payload is invalid.
    }

    return { ...DEFAULT_EMAIL_VERIFICATION_COPY };
  }

  async saveEmailVerificationCopy(body: {
    es?: Partial<EmailVerificationLocaleCopy>;
    en?: Partial<EmailVerificationLocaleCopy>;
  }): Promise<EmailVerificationCopySettings> {
    const current = await this.getEmailVerificationCopy();
    const next = normalizeEmailVerificationCopy({
      es: { ...current.es, ...(body.es || {}) },
      en: { ...current.en, ...(body.en || {}) },
      updatedAt: new Date().toISOString(),
    });
    await this.redis.client.set(EMAIL_VERIFICATION_COPY_REDIS_KEY, JSON.stringify(next));
    return next;
  }

  async sendEmailVerification(input: {
    to: string;
    name: string;
    code: string;
    locale?: string | null;
    copy?: Partial<EmailVerificationLocaleCopy> | null;
  }) {
    if (!this.transporter) {
      throw new Error('SMTP no configurado.');
    }

    const locale = resolveMailLocale(input.locale);
    const settings = await this.getEmailVerificationCopy();
    const { subject, text, html } = buildEmailVerificationEmail({
      ...input,
      copy: input.copy || settings[locale],
    });

    await this.sendMail({
      to: input.to,
      subject,
      text,
      html,
      kind: 'verification',
      attachments: this.logoPath
        ? [
            {
              filename: 'logo-votos.png',
              path: this.logoPath,
              cid: EMAIL_VERIFICATION_LOGO_CID,
              contentType: 'image/png',
            },
          ]
        : undefined,
    });
  }

  async sendTestVerificationEmail(input: {
    to: string;
    name?: string;
    code?: string;
    locale?: string | null;
    copy?: Partial<EmailVerificationLocaleCopy> | null;
  }) {
    const to = String(input.to || '')
      .trim()
      .toLowerCase();
    const locale = resolveMailLocale(input.locale);
    const settings = await this.getEmailVerificationCopy();
    const { subject, text, html } = buildEmailVerificationEmail({
      name: String(input.name || 'Usuario').trim() || 'Usuario',
      code: String(input.code || '847291').trim() || '847291',
      locale,
      copy: input.copy || settings[locale],
    });

    const info = await this.sendMail({
      to,
      subject,
      text,
      html,
      kind: 'test',
      attachments: this.logoPath
        ? [
            {
              filename: 'logo-votos.png',
              path: this.logoPath,
              cid: EMAIL_VERIFICATION_LOGO_CID,
              contentType: 'image/png',
            },
          ]
        : undefined,
    });

    return {
      ok: true,
      to,
      subject,
      messageId: info.messageId || null,
    };
  }

  async sendTestEmail(input: {
    to: string;
    subject?: string;
    message?: string;
    mode?: 'test' | 'broadcast' | 'poll';
    kind?: MailMetricKind;
    locale?: string | null;
    ctaUrl?: string | null;
    ctaLabel?: string | null;
    coverImageUrl?: string | null;
    subtitle?: string | null;
    vars?: Record<string, string | null | undefined>;
  }) {
    const to = String(input.to || '')
      .trim()
      .toLowerCase();
    const built =
      input.mode === 'poll'
        ? buildPollNotifyEmail({
            subject: input.subject,
            message: input.message,
            locale: input.locale,
            ctaUrl: input.ctaUrl,
            ctaLabel: input.ctaLabel,
            coverImageUrl: input.coverImageUrl,
            subtitle: input.subtitle,
            vars: input.vars,
          })
        : buildAdminTestEmail({
            subject: input.subject,
            message: input.message,
            mode: input.mode === 'broadcast' ? 'broadcast' : 'test',
            locale: input.locale,
            ctaUrl: input.ctaUrl,
            ctaLabel: input.ctaLabel,
            vars: input.vars,
          });
    const { subject, text, html } = built;

    const info = await this.sendMail({
      to,
      subject,
      text,
      html,
      kind:
        input.kind ||
        (input.mode === 'poll' ? 'poll' : input.mode === 'broadcast' ? 'broadcast' : 'test'),
      attachments: this.logoPath
        ? [
            {
              filename: 'logo-votos.png',
              path: this.logoPath,
              cid: PASSWORD_RESET_LOGO_CID,
              contentType: 'image/png',
            },
          ]
        : undefined,
    });

    return {
      ok: true,
      to,
      subject,
      messageId: info.messageId || null,
    };
  }

  private metricsDayKey(isoDay: string) {
    return `mail:metrics:${isoDay}`;
  }

  private todayUtc(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private utcDaysBack(days: number): string[] {
    const out: string[] = [];
    const now = Date.now();
    for (let i = days - 1; i >= 0; i -= 1) {
      out.push(new Date(now - i * 86400000).toISOString().slice(0, 10));
    }
    return out;
  }

  private parseKindTotals(hash: Record<string, string>): { sent: number; failed: number; byKind: MailKindTotals } {
    const byKind = emptyKindTotals();
    for (const kind of MAIL_METRIC_KINDS) {
      byKind[kind] = {
        sent: Number(hash[`sent:${kind}`] || 0),
        failed: Number(hash[`failed:${kind}`] || 0),
      };
    }
    return {
      sent: Number(hash.sent || 0),
      failed: Number(hash.failed || 0),
      byKind,
    };
  }

  private sumTotals(rows: Array<{ sent: number; failed: number; byKind: MailKindTotals }>) {
    const byKind = emptyKindTotals();
    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      sent += row.sent;
      failed += row.failed;
      for (const kind of MAIL_METRIC_KINDS) {
        byKind[kind].sent += row.byKind[kind].sent;
        byKind[kind].failed += row.byKind[kind].failed;
      }
    }
    return { sent, failed, byKind };
  }

  private async recordSend(kind: MailMetricKind, ok: boolean) {
    try {
      const day = this.todayUtc();
      const key = this.metricsDayKey(day);
      const resultField = ok ? 'sent' : 'failed';
      await this.redis.client
        .multi()
        .hincrby(key, resultField, 1)
        .hincrby(key, `${resultField}:${kind}`, 1)
        .expire(key, MAIL_METRICS_TTL_SECONDS)
        .exec();
    } catch (error) {
      this.logger.warn(`No se pudo guardar métrica de correo: ${(error as Error).message}`);
    }
  }

  async getSendStats(days = 30) {
    const windowDays = Math.min(Math.max(Number(days) || 30, 1), 90);
    const dates = this.utcDaysBack(windowDays);
    const pipeline = this.redis.client.multi();
    for (const date of dates) {
      pipeline.hgetall(this.metricsDayKey(date));
    }
    const raw = (await pipeline.exec()) || [];
    const series = dates.map((date, index) => {
      const hash = (raw[index]?.[1] || {}) as Record<string, string>;
      const parsed = this.parseKindTotals(hash);
      return { date, ...parsed };
    });
    const last7 = this.sumTotals(series.slice(-7));
    const last30 = this.sumTotals(series.slice(-30));
    const today = series[series.length - 1] || { date: this.todayUtc(), sent: 0, failed: 0, byKind: emptyKindTotals() };

    return {
      today: { sent: today.sent, failed: today.failed, byKind: today.byKind },
      last7,
      last30,
      series: series.map((row) => ({
        date: row.date,
        sent: row.sent,
        failed: row.failed,
        value: row.sent,
      })),
    };
  }

  private async sendMail(input: {
    to: string;
    subject: string;
    text: string;
    html: string;
    kind?: MailMetricKind;
    attachments?: Array<{
      filename: string;
      path: string;
      cid: string;
      contentType: string;
    }>;
  }) {
    if (!this.transporter) {
      throw new Error('SMTP no configurado.');
    }

    const kind: MailMetricKind = MAIL_METRIC_KINDS.includes(input.kind as MailMetricKind)
      ? (input.kind as MailMetricKind)
      : 'test';

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        attachments: input.attachments,
      });
      await this.recordSend(kind, true);
      return info;
    } catch (error) {
      await this.recordSend(kind, false);
      throw error;
    }
  }
}
