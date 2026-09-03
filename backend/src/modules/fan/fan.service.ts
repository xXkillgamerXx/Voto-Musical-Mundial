import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FanItemType, FanPurchase, FanPurchaseStatus, Prisma, UserRole } from '@prisma/client';
import { artistLookupWhere } from '../../common/artist-lookup';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { FanStoreConfigService } from '../settings/fan-store-config.service';
import { FanCheckoutDto } from './dto/checkout.dto';
import { PaypalService } from './paypal.service';

const IVA_CO = 0.19;
const MONTHLY_BONUS: Record<string, number> = { FAN: 20, SUPER: 50, MEGA: 0 };
const THREE_MONTH_BONUS: Record<string, number> = { FAN: 80, SUPER: 200, MEGA: 400 };
const THREE_MONTH_MS = 90 * 86400000;
const PIN_MS = 24 * 60 * 60 * 1000;
const STORE_ADMIN_ROLES = new Set<UserRole>([UserRole.admin, UserRole.superadmin, UserRole.owner]);
const PAYPAL_ORDER_TTL_SEC = 60 * 60;
const PAYPAL_DONE_TTL_SEC = 7 * 24 * 60 * 60;
const paypalOrderKey = (orderId: string) => `fan:paypal:order:${orderId}`;
const paypalDoneKey = (orderId: string) => `fan:paypal:done:${orderId}`;

const pad = (value: number) => String(value).padStart(2, '0');

const tierOf = (sku: string, mega = false, featured = false) => {
  if (sku === 'MEGA' || mega) return 'mega';
  if (sku === 'SUPER' || featured) return 'super';
  return 'fan';
};

const monthKey = (date = new Date()) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;

@Injectable()
export class FanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: FanStoreConfigService,
    private readonly redis: RedisService,
    private readonly paypal: PaypalService,
  ) {}

  paypalPublicConfig() {
    return this.paypal.publicConfig();
  }

  private async assertCheckoutAllowed(userId: bigint) {
    const catalog = await this.store.getConfig();
    if (catalog.visibility === 'public') return catalog;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || !STORE_ADMIN_ROLES.has(user.role)) {
      throw new ForbiddenException('Este apartado no está disponible.');
    }
    return catalog;
  }

  private makeInvoiceId() {
    const now = new Date();
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const serial = pad(Math.floor(Math.random() * 90) + 10);
    return `VMM-${stamp}-${serial}`;
  }

  private activePlanWhere(userId: bigint): Prisma.FanPurchaseWhereInput {
    return {
      userId,
      type: FanItemType.plan,
      status: FanPurchaseStatus.paid,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };
  }

  async getActivePlan(userId: bigint) {
    await this.maybeGrantBonuses(userId);
    return this.prisma.fanPurchase.findFirst({
      where: this.activePlanWhere(userId),
      orderBy: { startedAt: 'desc' },
    });
  }

  async getVoteBoost(userId: bigint) {
    const plan = await this.prisma.fanPurchase.findFirst({
      where: this.activePlanWhere(userId),
      orderBy: { startedAt: 'desc' },
      select: { sku: true, multiplier: true, mega: true, featured: true },
    });
    return {
      multiplier: Math.max(1, Number(plan?.multiplier || 1)),
      sku: plan?.sku || null,
      mega: Boolean(plan?.mega || plan?.sku === 'MEGA'),
      featured: Boolean(plan?.featured || plan?.sku === 'SUPER'),
    };
  }

  async fanSkuByUserIds(userIds: bigint[]) {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return new Map<string, string>();
    const rows = await this.prisma.fanPurchase.findMany({
      where: {
        userId: { in: ids },
        type: FanItemType.plan,
        status: FanPurchaseStatus.paid,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { startedAt: 'desc' },
      select: { userId: true, sku: true, mega: true, featured: true },
    });
    const map = new Map<string, string>();
    for (const row of rows) {
      const key = row.userId.toString();
      if (!map.has(key)) map.set(key, row.sku);
    }
    return map;
  }

  daysLeft(record: { expiresAt?: Date | null } | null) {
    if (!record?.expiresAt) return 0;
    return Math.max(0, Math.ceil((record.expiresAt.getTime() - Date.now()) / 86400000));
  }

  toMembership(record: FanPurchase | null) {
    if (!record) return null;
    const expired = this.daysLeft(record) <= 0;
    return serialize({
      id: record.id,
      invoiceId: record.invoiceId,
      sku: record.sku,
      name: record.name,
      type: record.type,
      icon: record.icon || 'fa-solid fa-bolt',
      featured: record.featured,
      mega: record.mega || record.sku === 'MEGA',
      multiplier: record.multiplier,
      welcomePts: record.pointsAwarded,
      maxArtists: record.maxArtists,
      yearly: record.yearly,
      currency: record.currency,
      method: record.method,
      country: record.country,
      countryName: record.countryName,
      phone: record.phone,
      artists: Array.isArray(record.artists) ? record.artists : [],
      startedAt: record.startedAt,
      expiresAt: record.expiresAt,
      cancelledAt: record.cancelledAt,
      status: record.status,
      daysLeft: this.daysLeft(record),
      expired,
      base: record.base,
      tax: record.tax,
      total: record.total,
    });
  }

  async getMembershipPayload(userId: bigint, { includeHistory = true } = {}) {
    const plan = await this.getActivePlan(userId);
    const purchases = includeHistory
      ? await this.prisma.fanPurchase.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [];
    const sku = plan?.sku || '';
    const adsFree = sku === 'SUPER' || sku === 'MEGA' || Boolean(plan?.featured || plan?.mega);
    const packDiscount = sku === 'SUPER' || sku === 'MEGA' || Boolean(plan?.featured) ? 0.1 : 0;
    return serialize({
      membership: this.toMembership(plan),
      purchases: purchases.map((row) => this.toMembership(row)),
      adsFree,
      packDiscount,
    });
  }

  async publicMembership(userId: bigint) {
    const plan = await this.getActivePlan(userId);
    if (!plan) return null;
    const membership = this.toMembership(plan);
    return membership
      ? {
          id: membership.id,
          sku: membership.sku,
          name: membership.name,
          icon: membership.icon,
          mega: membership.mega,
          featured: membership.featured,
          multiplier: membership.multiplier,
          artists: membership.artists,
          startedAt: membership.startedAt,
          expiresAt: membership.expiresAt,
          daysLeft: membership.daysLeft,
          expired: membership.expired,
          status: membership.status,
        }
      : null;
  }

  private async checkoutPayload(
    purchase: FanPurchase,
    userId: bigint,
    extra: Record<string, unknown> = {},
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, username: true, email: true, photoUrl: true },
    });
    return serialize({
      ...this.toMembership(purchase),
      buyerName: user?.displayName || user?.username || '',
      buyerEmail: user?.email || '',
      buyerPhoto: user?.photoUrl || '',
      ...extra,
    });
  }

  private async resolveCheckoutArtist(row: { id?: string; name?: string; image?: string; slug?: string }) {
    const select = {
      id: true,
      name: true,
      photoUrl: true,
      slug: true,
      firebaseId: true,
      metadata: true,
    } as const;
    const key = String(row.id || row.slug || '').trim();
    if (key) {
      const byKey = await this.prisma.artist.findFirst({
        where: artistLookupWhere(key),
        select,
      });
      if (byKey) return byKey;
    }
    const name = String(row.name || '').trim();
    if (!name) return null;
    return this.prisma.artist.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select,
    });
  }

  private mapCheckoutArtist(
    artist: {
      id: bigint
      name: string
      photoUrl: string | null
      slug: string | null
      firebaseId: string | null
      metadata: unknown
    },
    fallback?: { name?: string; image?: string },
  ) {
    const metadata = (artist.metadata || {}) as Record<string, unknown>
    return {
      id: artist.id.toString(),
      name: String(fallback?.name || artist.name),
      image: String(fallback?.image || artist.photoUrl || metadata.image || ''),
      slug: String(artist.slug || artist.firebaseId || ''),
    }
  }

  private async listActiveSupportedArtists(userId: bigint) {
    const now = new Date()
    const previous = await this.prisma.artistSupporter.findMany({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      include: {
        artist: {
          select: { id: true, name: true, photoUrl: true, slug: true, firebaseId: true, metadata: true },
        },
      },
    })
    const artists: Array<{ id: string; name: string; image: string; slug: string }> = []
    const seen = new Set<string>()
    for (const row of previous) {
      if (!row.artist) continue
      const mapped = this.mapCheckoutArtist(row.artist)
      if (seen.has(mapped.id)) continue
      seen.add(mapped.id)
      artists.push(mapped)
    }
    return artists
  }

  async checkout(userId: bigint, dto: FanCheckoutDto, opts?: { paypalOrderId?: string }) {
    const catalog = await this.assertCheckoutAllowed(userId);
    if (dto.adopt) {
      const existing = await this.getActivePlan(userId);
      if (existing) return this.checkoutPayload(existing, userId);
    }
    const method = String(dto.method || 'paypal').slice(0, 40);
    if (method !== 'paypal' || !opts?.paypalOrderId) {
      throw new BadRequestException(
        method === 'paypal'
          ? 'El pago con PayPal debe confirmarse en PayPal.'
          : 'Por ahora el pago es solo con PayPal.',
      );
    }
    const sku = String(dto.sku || '').trim().toUpperCase();
    const plan = catalog.plans.find((item) => item.sku === sku && item.enabled);
    const pack = catalog.packs.find((item) => item.sku === sku && item.enabled);
    if (!plan && !pack) {
      throw new BadRequestException('Ese plan o pack no está disponible.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, username: true, email: true, photoUrl: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const isPack = Boolean(pack);
    const yearly = Boolean(dto.yearly);
    const currency = dto.currency === 'COP' ? 'COP' : 'USD';
    const country = String(dto.country || 'CO').trim().toUpperCase() || 'CO';
    const active = isPack ? null : await this.getActivePlan(userId);
    const packDiscount = isPack && (active?.sku === 'SUPER' || active?.sku === 'MEGA' || active?.featured)
      ? 0.1
      : 0;

    let base = 0;
    if (isPack) {
      base = currency === 'COP' ? pack!.cop : pack!.usd;
    } else if (yearly) {
      base = currency === 'COP' ? plan!.copYTotal : plan!.usdYTotal;
    } else {
      base = currency === 'COP' ? plan!.copM : plan!.usdM;
    }
    if (packDiscount) base = Number((base * (1 - packDiscount)).toFixed(2));
    const tax = country === 'CO' ? Number((base * IVA_CO).toFixed(2)) : 0;
    const total = Number((base + tax).toFixed(2));

    const maxArtists = isPack ? 0 : Number(plan!.maxArtists || 1);
    const requested = isPack ? [] : dto.artists || [];
    const artists: Array<{ id: string; name: string; image: string; slug: string }> = [];
    const seen = new Set<string>();
    const pushArtist = (row: { id: string; name: string; image: string; slug: string }) => {
      if (!row.id || seen.has(row.id)) return;
      seen.add(row.id);
      artists.push(row);
    };

    if (!isPack) {
      for (const row of await this.listActiveSupportedArtists(userId)) pushArtist(row);
    }
    const previousCount = artists.length;
    const cap = Math.max(maxArtists, previousCount);

    for (const row of requested) {
      if (artists.length >= cap) break;
      const artist = await this.resolveCheckoutArtist(row);
      if (!artist) continue;
      pushArtist(this.mapCheckoutArtist(artist, row));
    }
    if (!isPack && !artists.length) {
      throw new BadRequestException('Elige un artista para apoyar.');
    }

    const now = new Date();
    const durationDays = isPack ? 0 : yearly ? 365 : 30;
    const expiresAt = durationDays ? new Date(now.getTime() + durationDays * 86400000) : null;
    const welcomePts = isPack ? Number(pack!.pts || 0) : Number(plan!.welcomePts || 0);
    const pointsAwarded = dto.adopt ? 0 : welcomePts;
    const skuName = isPack ? `${Number(pack!.pts || 0)} pts` : plan!.name;
    const icon = isPack ? 'fa-solid fa-bolt' : plan!.icon;
    const featured = Boolean(plan?.featured);
    const mega = Boolean(plan?.mega || sku === 'MEGA');
    const multiplier = isPack ? 1 : Number(plan!.multiplier || 1);

    let invoiceId = this.makeInvoiceId();
    for (let i = 0; i < 5; i += 1) {
      const exists = await this.prisma.fanPurchase.findUnique({ where: { invoiceId }, select: { id: true } });
      if (!exists) break;
      invoiceId = this.makeInvoiceId();
    }

    const purchase = await this.prisma.$transaction(async (tx) => {
      if (!isPack) {
        await tx.fanPurchase.updateMany({
          where: this.activePlanWhere(userId),
          data: {
            status: FanPurchaseStatus.cancelled,
            cancelledAt: now,
            expiresAt: now,
          },
        });
        const keepIds = artists.map((row) => BigInt(row.id));
        await tx.artistSupporter.updateMany({
          where: {
            userId,
            ...(keepIds.length ? { artistId: { notIn: keepIds } } : {}),
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          data: { expiresAt: now },
        });
      }

      const created = await tx.fanPurchase.create({
        data: {
          userId,
          invoiceId,
          sku,
          name: skuName,
          type: isPack ? FanItemType.pack : FanItemType.plan,
          status: FanPurchaseStatus.paid,
          icon,
          yearly,
          currency,
          method: String(dto.method || 'card').slice(0, 40),
          country,
          countryName: String(dto.countryName || '').slice(0, 80) || null,
          phone: String(dto.phone || '').slice(0, 40) || null,
          base,
          tax,
          total,
          pointsAwarded,
          multiplier,
          maxArtists,
          featured,
          mega,
          artists,
          startedAt: now,
          expiresAt,
        },
      });

      if (pointsAwarded > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { points: { increment: pointsAwarded } },
        });
      }

      if (!isPack) {
        const pinnedUntil = mega ? new Date(now.getTime() + PIN_MS) : null;
        const supportTier = tierOf(sku, mega, featured);
        for (const artist of artists) {
          const artistId = BigInt(artist.id);
          await tx.artistSupporter.upsert({
            where: { artistId_userId: { artistId, userId } },
            create: {
              artistId,
              userId,
              purchaseId: created.id,
              sku,
              tier: supportTier,
              points: welcomePts,
              pinnedUntil,
              startedAt: now,
              expiresAt,
            },
            update: {
              purchaseId: created.id,
              sku,
              tier: supportTier,
              points: { increment: pointsAwarded },
              pinnedUntil: pinnedUntil || undefined,
              expiresAt,
            },
          });
        }
      }

      return created;
    });

    return this.checkoutPayload(purchase, userId, { pointsAwarded, packDiscount });
  }

  async createPaypalOrder(userId: bigint, dto: FanCheckoutDto) {
    const quote = await this.quoteCheckout(userId, { ...dto, method: 'paypal' });
    const currency = quote.currency === 'COP' ? 'COP' : 'USD';
    const created = await this.paypal.createOrder({
      amount: quote.total,
      currency,
      description: `Vote Music Mundial — ${quote.skuName}`,
      customId: userId.toString(),
    });
    const payload = {
      userId: userId.toString(),
      dto: { ...dto, method: 'paypal', currency },
      total: quote.total,
      currency,
    };
    await this.redis.client.set(
      paypalOrderKey(created.orderId),
      JSON.stringify(payload),
      'EX',
      PAYPAL_ORDER_TTL_SEC,
    );
    return { orderId: created.orderId, mode: this.paypal.mode() };
  }

  async capturePaypalOrder(userId: bigint, orderId: string) {
    const id = String(orderId || '').trim();
    if (!id) throw new BadRequestException('Falta el id de PayPal.');

    const doneRaw = await this.redis.client.get(paypalDoneKey(id));
    if (doneRaw) {
      const done = JSON.parse(doneRaw) as { invoiceId?: string; userId?: string };
      if (done.userId && done.userId !== userId.toString()) {
        throw new BadRequestException('Esa orden de PayPal no es tuya.');
      }
      if (done.invoiceId) {
        const purchase = await this.prisma.fanPurchase.findUnique({ where: { invoiceId: done.invoiceId } });
        if (purchase && purchase.userId === userId) {
          return this.checkoutPayload(purchase, userId);
        }
      }
    }

    const pendingRaw = await this.redis.client.get(paypalOrderKey(id));
    if (!pendingRaw) {
      throw new BadRequestException('La orden de PayPal expiró. Vuelve a intentarlo.');
    }
    const pending = JSON.parse(pendingRaw) as {
      userId: string;
      dto: FanCheckoutDto;
      total: number;
      currency: string;
    };
    if (pending.userId !== userId.toString()) {
      throw new BadRequestException('Esa orden de PayPal no es tuya.');
    }

    let order: Record<string, unknown>;
    try {
      order = await this.paypal.captureOrder(id);
    } catch {
      order = await this.paypal.getOrder(id);
    }
    const paid = this.paypal.capturedAmount(order);
    const customId = paid.customId || this.paypal.orderCustomId(order);
    if (customId && customId !== userId.toString()) {
      throw new BadRequestException('Esa orden de PayPal no es tuya.');
    }
    if (paid.status !== 'COMPLETED' || paid.value <= 0) {
      throw new BadRequestException('PayPal todavía no confirmó el pago.');
    }
    if (
      paid.currency !== pending.currency ||
      Math.round(paid.value * 100) !== Math.round(Number(pending.total) * 100)
    ) {
      throw new BadRequestException('El monto de PayPal no coincide con el checkout.');
    }

    const result = (await this.checkout(userId, { ...pending.dto, method: 'paypal' }, { paypalOrderId: id })) as {
      invoiceId?: string;
    };
    await this.redis.client.set(
      paypalDoneKey(id),
      JSON.stringify({ invoiceId: result.invoiceId, userId: userId.toString() }),
      'EX',
      PAYPAL_DONE_TTL_SEC,
    );
    await this.redis.client.del(paypalOrderKey(id));
    return result;
  }

  private async quoteCheckout(userId: bigint, dto: FanCheckoutDto) {
    const catalog = await this.assertCheckoutAllowed(userId);
    const sku = String(dto.sku || '').trim().toUpperCase();
    const plan = catalog.plans.find((item) => item.sku === sku && item.enabled);
    const pack = catalog.packs.find((item) => item.sku === sku && item.enabled);
    if (!plan && !pack) {
      throw new BadRequestException('Ese plan o pack no está disponible.');
    }
    const isPack = Boolean(pack);
    const yearly = Boolean(dto.yearly);
    const currency = dto.currency === 'COP' ? 'COP' : 'USD';
    const country = String(dto.country || 'CO').trim().toUpperCase() || 'CO';
    const active = isPack ? null : await this.getActivePlan(userId);
    const packDiscount =
      isPack && (active?.sku === 'SUPER' || active?.sku === 'MEGA' || active?.featured) ? 0.1 : 0;
    let base = 0;
    if (isPack) {
      base = currency === 'COP' ? pack!.cop : pack!.usd;
    } else if (yearly) {
      base = currency === 'COP' ? plan!.copYTotal : plan!.usdYTotal;
    } else {
      base = currency === 'COP' ? plan!.copM : plan!.usdM;
    }
    if (packDiscount) base = Number((base * (1 - packDiscount)).toFixed(2));
    const tax = country === 'CO' ? Number((base * IVA_CO).toFixed(2)) : 0;
    const total = Number((base + tax).toFixed(2));
    const skuName = isPack ? `${Number(pack!.pts || 0)} pts` : plan!.name;
    if (!isPack) {
      const requested = dto.artists || [];
      let found = 0;
      for (const row of requested) {
        if (await this.resolveCheckoutArtist(row)) found += 1;
      }
      if (!found) {
        const previous = await this.listActiveSupportedArtists(userId);
        if (!previous.length) throw new BadRequestException('Elige un artista para apoyar.');
      }
    }
    return { total, currency, skuName, sku };
  }

  async cancel(userId: bigint, purchaseId: string) {
    const id = BigInt(purchaseId);
    const row = await this.prisma.fanPurchase.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException('No encontramos esa compra.');
    if (row.type !== FanItemType.plan) {
      throw new BadRequestException('Solo se puede cancelar un plan.');
    }
    if (row.status !== FanPurchaseStatus.paid || this.daysLeft(row) <= 0) {
      throw new BadRequestException('Ese plan ya no está activo.');
    }
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.fanPurchase.update({
        where: { id: row.id },
        data: {
          status: FanPurchaseStatus.cancelled,
          cancelledAt: now,
          expiresAt: now,
        },
      });
      await tx.artistSupporter.updateMany({
        where: { userId, purchaseId: row.id },
        data: { expiresAt: now },
      });
      return next;
    });
    return this.toMembership(updated);
  }

  async listSupporters(artistKey: string) {
    const artist = await this.prisma.artist.findFirst({
      where: artistLookupWhere(artistKey),
      select: { id: true },
    });
    if (!artist) return [];
    const now = new Date();
    const rows = await this.prisma.artistSupporter.findMany({
      where: {
        artistId: artist.id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        user: { select: { id: true, displayName: true, username: true, photoUrl: true } },
      },
      orderBy: [{ pinnedUntil: 'desc' }, { points: 'desc' }, { startedAt: 'desc' }],
    });
    return serialize(
      rows.map((row) => ({
        id: `${row.userId.toString()}:${row.artistId.toString()}`,
        userId: row.userId.toString(),
        name: row.user?.displayName || row.user?.username || 'Fan',
        photo: row.user?.photoUrl || '',
        sku: row.sku,
        tier: row.tier,
        points: row.points,
        at: row.startedAt,
        startedAt: row.startedAt,
        expiresAt: row.expiresAt,
        pinnedUntil: row.pinnedUntil,
      })),
    );
  }

  async supporterCount(artistKey: string) {
    const artist = await this.prisma.artist.findFirst({
      where: artistLookupWhere(artistKey),
      select: { id: true },
    });
    if (!artist) return 0;
    return this.prisma.artistSupporter.count({
      where: {
        artistId: artist.id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  async maybeGrantBonuses(userId: bigint) {
    const plan = await this.prisma.fanPurchase.findFirst({
      where: this.activePlanWhere(userId),
      orderBy: { startedAt: 'desc' },
    });
    if (!plan) return;
    await this.grantBonusesForPlan(plan);
  }

  async grantDueBonuses(limit = 200) {
    const plans = await this.prisma.fanPurchase.findMany({
      where: {
        type: FanItemType.plan,
        status: FanPurchaseStatus.paid,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      take: limit,
      orderBy: { startedAt: 'asc' },
    });
    for (const plan of plans) {
      await this.grantBonusesForPlan(plan);
    }
  }

  private async grantBonusesForPlan(plan: FanPurchase) {
    const now = new Date();
    const sku = plan.sku;
    const monthly = MONTHLY_BONUS[sku] || 0;
    const threeMonth = THREE_MONTH_BONUS[sku] || 0;
    const currentMonth = monthKey(now);
    const monthsAlive = Math.floor((now.getTime() - plan.startedAt.getTime()) / (30 * 86400000));
    let points = 0;
    const data: Prisma.FanPurchaseUpdateInput = {};

    if (monthly > 0 && monthsAlive >= 1 && plan.lastBonusMonth !== currentMonth) {
      points += monthly;
      data.lastBonusMonth = currentMonth;
    }
    if (threeMonth > 0 && !plan.threeMonthBonusAt && now.getTime() - plan.startedAt.getTime() >= THREE_MONTH_MS) {
      points += threeMonth;
      data.threeMonthBonusAt = now;
    }
    if (!points) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.fanPurchase.update({ where: { id: plan.id }, data });
      await tx.user.update({
        where: { id: plan.userId },
        data: { points: { increment: points } },
      });
    });
  }
}
