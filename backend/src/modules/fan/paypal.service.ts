import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type PaypalMode = 'sandbox' | 'live';

type PaypalAccessToken = {
  value: string;
  expiresAt: number;
};

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private token: PaypalAccessToken | null = null;

  constructor(private readonly config: ConfigService) {}

  mode(): PaypalMode {
    const raw = String(this.config.get<string>('PAYPAL_MODE') || 'sandbox').toLowerCase();
    return raw === 'live' ? 'live' : 'sandbox';
  }

  clientId() {
    return String(this.config.get<string>('PAYPAL_CLIENT_ID') || '').trim();
  }

  isConfigured() {
    return Boolean(this.clientId() && String(this.config.get<string>('PAYPAL_CLIENT_SECRET') || '').trim());
  }

  publicConfig() {
    return {
      enabled: this.isConfigured(),
      clientId: this.isConfigured() ? this.clientId() : '',
      mode: this.mode(),
      currency: 'USD',
    };
  }

  private baseUrl() {
    return this.mode() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }

  private secret() {
    return String(this.config.get<string>('PAYPAL_CLIENT_SECRET') || '').trim();
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new BadRequestException('PayPal sandbox no está configurado.');
    }
  }

  private async accessToken() {
    this.assertConfigured();
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    if (this.secret().length < 40) {
      this.logger.warn('PAYPAL_CLIENT_SECRET looks truncated; PayPal secrets are usually ~80 characters.');
    }
    const auth = Buffer.from(`${this.clientId()}:${this.secret()}`).toString('base64');
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: 'grant_type=client_credentials',
      });
    } catch (error) {
      this.logger.warn(`PayPal token network error: ${error instanceof Error ? error.message : 'fetch'}`);
      throw new BadRequestException('No se pudo conectar con PayPal. Revisa la red y PAYPAL_MODE=sandbox.');
    }
    const payload = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !payload.access_token) {
      this.logger.warn(`PayPal token failed: ${payload.error || payload.error_description || response.status}`);
      if (response.status === 401 || payload.error === 'invalid_client') {
        throw new BadRequestException(
          'PayPal rechazó el Secret. En developer.paypal.com abre la app Sandbox, copia el Secret completo y reinicia el API.',
        );
      }
      throw new BadRequestException('No se pudo conectar con PayPal.');
    }
    this.token = {
      value: payload.access_token,
      expiresAt: Date.now() + Number(payload.expires_in || 300) * 1000,
    };
    return this.token.value;
  }

  private async request(path: string, init: RequestInit = {}) {
    const token = await this.accessToken();
    const response = await fetch(`${this.baseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        (payload as { message?: string; details?: Array<{ description?: string }> }).details?.[0]
          ?.description ||
        (payload as { message?: string }).message ||
        `PayPal ${response.status}`;
      this.logger.warn(`PayPal ${path} failed: ${message}`);
      throw new BadRequestException(message);
    }
    return payload as Record<string, unknown>;
  }

  async createOrder(input: { amount: number; currency: string; description: string; customId: string }) {
    this.assertConfigured();
    const value = Number(input.amount).toFixed(2);
    const order = await this.request('/v2/checkout/orders', {
      method: 'POST',
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: 'fan-store',
            custom_id: String(input.customId).slice(0, 127),
            description: String(input.description).slice(0, 127),
            amount: {
              currency_code: String(input.currency || 'USD').toUpperCase(),
              value,
            },
          },
        ],
      }),
    });
    const id = String(order.id || '');
    if (!id) throw new BadRequestException('PayPal no devolvió una orden.');
    return { orderId: id };
  }

  async captureOrder(orderId: string) {
    this.assertConfigured();
    const id = String(orderId || '').trim();
    if (!id) throw new BadRequestException('Falta el id de PayPal.');
    return this.request(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`, { method: 'POST' });
  }

  async getOrder(orderId: string) {
    this.assertConfigured();
    const id = String(orderId || '').trim();
    if (!id) throw new BadRequestException('Falta el id de PayPal.');
    return this.request(`/v2/checkout/orders/${encodeURIComponent(id)}`);
  }

  capturedAmount(order: Record<string, unknown>) {
    const units = Array.isArray(order.purchase_units) ? order.purchase_units : [];
    const unit = (units[0] || {}) as {
      custom_id?: string;
      amount?: { value?: string; currency_code?: string };
      payments?: { captures?: Array<{ amount?: { value?: string; currency_code?: string }; status?: string }> };
    };
    const capture = unit.payments?.captures?.find((row) => String(row.status || '').toUpperCase() === 'COMPLETED');
    if (!capture?.amount) {
      return { value: 0, currency: 'USD', status: String(order.status || ''), customId: String(unit.custom_id || '') };
    }
    return {
      value: Number(capture.amount.value || 0),
      currency: String(capture.amount.currency_code || 'USD').toUpperCase(),
      status: String(order.status || 'COMPLETED').toUpperCase(),
      customId: String(unit.custom_id || ''),
    };
  }

  orderCustomId(order: Record<string, unknown>) {
    const units = Array.isArray(order.purchase_units) ? order.purchase_units : [];
    const unit = (units[0] || {}) as { custom_id?: string };
    return String(unit.custom_id || '').trim();
  }
}
