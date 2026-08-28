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

  constructor(config: ConfigService) {
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
      'Music Mundial <noreply@musicmundial.com>';

    const candidate = join(process.cwd(), 'assets', 'email', 'logo-votos.png');
    this.logoPath = existsSync(candidate) ? candidate : null;

    this.transporter =
      host && user && pass
        ? nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
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

  async sendTestEmail(input: { to: string; subject?: string; message?: string }) {
    const to = String(input.to || '')
      .trim()
      .toLowerCase();
    const subject = String(input.subject || '').trim() || 'Prueba de correo — Music Mundial';
    const message =
      String(input.message || '').trim() ||
      'Este es un correo de prueba enviado desde el panel de administración de Music Mundial.';

    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:0 auto;padding:24px">
        <p style="margin:0 0 16px;font-size:14px;color:#6b7280">Music Mundial · Admin</p>
        <h1 style="margin:0 0 16px;font-size:22px">${subject}</h1>
        <p style="margin:0 0 16px;white-space:pre-wrap">${message.replace(/</g, '&lt;')}</p>
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">Enviado desde noreply@musicmundial.com</p>
      </div>
    `.trim();

    const info = await this.sendMail({
      to,
      subject,
      text: message,
      html,
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
