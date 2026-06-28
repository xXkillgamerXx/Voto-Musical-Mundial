import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface SiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: ConfigService) {}

  /** Turnstile is active only when a secret is configured and not explicitly disabled. */
  isEnabled(): boolean {
    if (String(this.config.get('TURNSTILE_ENABLED') || '').toLowerCase() === 'false') {
      return false;
    }
    return Boolean(this.config.get<string>('TURNSTILE_SECRET'));
  }

  async verify(token: string | undefined, remoteIp?: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    if (!token) {
      throw new BadRequestException('Completa la verificacion de seguridad para votar.');
    }

    const secret = this.config.get<string>('TURNSTILE_SECRET') as string;
    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', token);
    if (remoteIp && remoteIp !== 'unknown') {
      form.set('remoteip', remoteIp);
    }

    let outcome: SiteverifyResponse;
    try {
      const response = await fetch(SITEVERIFY_URL, { method: 'POST', body: form });
      outcome = (await response.json()) as SiteverifyResponse;
    } catch (error) {
      this.logger.error(`Turnstile siteverify request failed: ${String(error)}`);
      throw new ServiceUnavailableException('No se pudo verificar la seguridad. Intenta de nuevo.');
    }

    if (!outcome?.success) {
      this.logger.warn(`Turnstile verification rejected: ${JSON.stringify(outcome?.['error-codes'] || [])}`);
      throw new ForbiddenException('La verificacion de seguridad no fue valida. Intenta de nuevo.');
    }
  }
}
