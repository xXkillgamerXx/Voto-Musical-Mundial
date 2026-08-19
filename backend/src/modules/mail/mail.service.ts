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

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly logoPath: string | null;

  constructor(config: ConfigService) {
    const host = String(config.get<string>('SMTP_HOST') || '').trim();
    const user = String(config.get<string>('SMTP_USER') || '').trim();
    const pass = String(config.get<string>('SMTP_PASS') || '').trim();
    const port = Number(config.get<string>('SMTP_PORT') || 2525);
    this.from =
      String(config.get<string>('MAIL_FROM') || '').trim() ||
      'Vote Music Mundial <noreply@vote.musicmundial.com>';

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
      this.logger.log('SMTP listo para enviar correos.');
    } catch (error) {
      this.logger.warn(`SMTP no responde: ${(error as Error).message}`);
    }
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

    await this.transporter.sendMail({
      from: this.from,
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
}
