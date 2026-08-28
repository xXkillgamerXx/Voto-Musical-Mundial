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
import { RedisService } from '../redis/redis.service';
import { resolveMailLocale } from './transactional-email.layout';

export type MailPublicStatus = {
  configured: boolean;
  from: string;
  host: string | null;
  port: number | null;
  verified: boolean;
};

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
      'Votos Mundial <noreply@musicmundial.com>';

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
    mode?: 'test' | 'broadcast';
  }) {
    const to = String(input.to || '')
      .trim()
      .toLowerCase();
    const { subject, text, html } = buildAdminTestEmail({
      subject: input.subject,
      message: input.message,
      mode: input.mode === 'broadcast' ? 'broadcast' : 'test',
    });

    const info = await this.sendMail({
      to,
      subject,
      text,
      html,
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

  private async sendMail(input: {
    to: string;
    subject: string;
    text: string;
    html: string;
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

    return this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });
  }
}
