import { Injectable, Logger } from '@nestjs/common';
import { PollStatus } from '@prisma/client';
import { allowsCampaignEmail } from '../../common/email-preferences';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AdminMailService } from './admin-mail.service';
import { AdminPushService } from './admin-push.service';

const SITE = 'https://vote.musicmundial.com';
const CLOSING_REMINDER_MIN_MS = 30 * 60 * 1000;
const CLOSING_REMINDER_MAX_DAYS = 14;
const DEFAULT_CLOSING_REMINDER_DAYS = 1;

type Locale = 'es' | 'en';

type WelcomeUser = {
  id: bigint | number | string;
  email?: string | null;
  displayName?: string | null;
  username?: string | null;
  metadata?: unknown;
};

@Injectable()
export class LifecycleNotifyService {
  private readonly logger = new Logger(LifecycleNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly adminMail: AdminMailService,
    private readonly adminPush: AdminPushService,
  ) {}

  private resolveLocale(metadata: unknown): Locale {
    const meta =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};
    const raw = String(meta.locale || meta.lang || meta.language || '')
      .trim()
      .toLowerCase();
    return raw.startsWith('es') ? 'es' : 'en';
  }

  private displayName(user: WelcomeUser) {
    return (
      String(user.displayName || '').trim() ||
      String(user.username || '').trim() ||
      String(user.email || '').trim() ||
      (this.resolveLocale(user.metadata) === 'en' ? 'User' : 'Usuario')
    );
  }

  private pollConfig(poll: { config?: unknown }) {
    return poll?.config && typeof poll.config === 'object' && !Array.isArray(poll.config)
      ? (poll.config as Record<string, unknown>)
      : {};
  }

  private pollTitles(poll: { title: string; config?: unknown }) {
    const config = this.pollConfig(poll);
    const titleEs = String(poll.title || '').trim() || 'Votación';
    const titleEn = String(config.titleEn || '').trim() || titleEs;
    return { titleEs, titleEn };
  }

  private pollPath(poll: { id: bigint; slug?: string | null; config?: unknown }, locale: Locale) {
    const config = this.pollConfig(poll);
    const year =
      Number(config.year) ||
      new Date().getFullYear();
    const slugEs = String(poll.slug || '').trim();
    const slugEn = String(config.slugEn || '').trim() || slugEs;
    const slug = (locale === 'en' ? slugEn : slugEs) || String(poll.id);
    const prefix = locale === 'en' ? '/poll' : '/votacion';
    return `${prefix}/${year}/${slug}`;
  }

  private pollUrl(poll: { id: bigint; slug?: string | null; config?: unknown }, locale: Locale = 'en') {
    return `${SITE}${this.pollPath(poll, locale)}`;
  }

  private pollBannerUrl(poll: { config?: unknown }) {
    const config = this.pollConfig(poll);
    const banner = String(config.banner || config.imageUrl || config.cover || '').trim();
    if (!banner) return '';
    if (/^https?:\/\//i.test(banner)) return banner;
    if (banner.startsWith('//')) return `https:${banner}`;
    return `${SITE}${banner.startsWith('/') ? banner : `/${banner}`}`;
  }

  private stripHtml(value: unknown) {
    return String(value || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Días antes del cierre para el recordatorio. 0 = desactivado. Default 1. */
  private closingReminderDays(poll: { config?: unknown }) {
    const raw = Number(this.pollConfig(poll).closingReminderDays);
    if (!Number.isFinite(raw)) {
      return DEFAULT_CLOSING_REMINDER_DAYS;
    }
    return Math.min(CLOSING_REMINDER_MAX_DAYS, Math.max(0, Math.floor(raw)));
  }

  private async claimOnce(key: string, ttlSeconds: number) {
    const result = await this.redis.client.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  private fireAndForget(label: string, work: () => Promise<unknown>) {
    void work().catch((error) => {
      this.logger.warn(`${label}: ${(error as Error).message}`);
    });
  }

  /** Bienvenida tras verificar correo o registro Google nuevo. */
  async notifyWelcome(user: WelcomeUser) {
    const userId = String(user.id);
    const claimed = await this.claimOnce(`lifecycle:welcome:${userId}`, 60 * 60 * 24 * 30);
    if (!claimed) {
      return { ok: true, skipped: 'already_sent' as const };
    }

    const locale = this.resolveLocale(user.metadata);
    const name = this.displayName(user);
    const email = String(user.email || '')
      .trim()
      .toLowerCase();
    const canEmail = allowsCampaignEmail(user.metadata);

    const copy =
      locale === 'en'
        ? {
            subject: 'Welcome to Music Mundial VOTING',
            message:
              'Hi {{name}},\n\nYour account is ready. Explore live polls, earn points, and support your favorite artists.\n\nThanks for joining Music Mundial VOTING.',
            title: 'Welcome to Music Mundial VOTING',
            body: 'Your account is ready. Explore live polls and support your artists.',
            ctaLabel: 'Go to Music Mundial VOTING',
          }
        : {
            subject: 'Bienvenido a Music Mundial VOTING',
            message:
              'Hola {{name}},\n\nTu cuenta ya está lista. Explora las votaciones en vivo, gana puntos y apoya a tus artistas favoritos.\n\nGracias por unirte a Music Mundial VOTING.',
            title: 'Bienvenido a Music Mundial VOTING',
            body: 'Tu cuenta ya está lista. Explora las votaciones y apoya a tus artistas.',
            ctaLabel: 'Ir a Music Mundial VOTING',
          };

    if (canEmail && email && this.mail.isConfigured()) {
      try {
        await this.mail.sendTestEmail({
          to: email,
          subject: copy.subject,
          message: copy.message,
          mode: 'broadcast',
          locale,
          ctaUrl: SITE,
          ctaLabel: copy.ctaLabel,
          vars: { name },
        });
      } catch (error) {
        this.logger.warn(`Welcome email falló (${email}): ${(error as Error).message}`);
      }
    }

    try {
      await this.adminPush.createInAppNotifications(
        [userId],
        'welcome',
        {
          title: 'Bienvenido a Music Mundial VOTING',
          titleEn: 'Welcome to Music Mundial VOTING',
          message: 'Tu cuenta ya está lista. Explora las votaciones y apoya a tus artistas.',
          messageEn: 'Your account is ready. Explore live polls and support your artists.',
          url: '/',
        },
      );
    } catch (error) {
      this.logger.warn(`Welcome in-app falló (${userId}): ${(error as Error).message}`);
    }

    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: { userId: BigInt(userId) },
        select: { token: true },
      });
      if (tokens.length) {
        await this.adminPush.dispatch(
          tokens.map((row) => row.token),
          {
            title: copy.title,
            body: copy.body,
            url: '/',
            type: 'welcome',
          },
        );
      }
    } catch (error) {
      this.logger.warn(`Welcome push falló (${userId}): ${(error as Error).message}`);
    }

    this.logger.log(`Welcome enviado a usuario ${userId}`);
    return { ok: true };
  }

  notifyWelcomeAsync(user: WelcomeUser) {
    this.fireAndForget('welcome', () => this.notifyWelcome(user));
  }

  /** Aviso a todos cuando se lanza una ronda en vivo. */
  async notifyPollLive(pollId: string) {
    const poll = await this.prisma.poll.findUnique({ where: { id: BigInt(pollId) } });
    if (!poll) {
      return { ok: false, reason: 'not_found' as const };
    }

    const claimed = await this.claimOnce(
      `lifecycle:live:${poll.id}:${poll.updatedAt.toISOString().slice(0, 16)}`,
      60 * 60 * 48,
    );
    if (!claimed) {
      return { ok: true, skipped: 'already_sent' as const };
    }

    const { titleEs, titleEn } = this.pollTitles(poll);
    const urlEs = this.pollUrl(poll, 'es');
    const config = this.pollConfig(poll);
    const subtitleEs = this.stripHtml(poll.description || config.description || '');
    const subtitleEn = this.stripHtml(config.descriptionEn || '') || subtitleEs;

    const subject = '¡Ya está en vivo! · {{pollTitle}}';
    const message =
      'Hola {{name}},\n\nLa votación «{{pollTitle}}» ya está en vivo. Entra ahora y apoya a tu artista favorito.';
    const subjectEn = 'It\'s live! · {{pollTitle}}';
    const messageEn =
      'Hi {{name}},\n\nThe poll "{{pollTitle}}" is now live. Jump in and support your favorite artist.';

    await this.broadcastPoll({
      label: `live:${pollId}`,
      subject,
      message,
      subjectEn,
      messageEn,
      pollTitle: titleEs,
      pollTitleEn: titleEn,
      ctaUrl: urlEs,
      ctaLabel: 'Ir a votar',
      ctaLabelEn: 'Go vote',
      template: 'poll',
      coverImageUrl: this.pollBannerUrl(poll) || null,
      subtitle: subtitleEs || null,
      subtitleEn: subtitleEn || null,
      pushTitle: `¡En vivo! ${titleEs}`,
      pushBody: 'Entra ahora y vota por tu artista favorito.',
      pushTitleEn: `Live now! ${titleEn}`,
      pushBodyEn: 'Jump in and vote for your favorite artist.',
      pushUrl: urlEs.replace(SITE, '') || '/votaciones',
      notificationType: 'poll_live',
      inAppPayload: {
        title: `¡En vivo! ${titleEs}`,
        titleEn: `Live now! ${titleEn}`,
        message: `La votación «${titleEs}» ya está abierta.`,
        messageEn: `The poll "${titleEn}" is now open.`,
        url: urlEs.replace(SITE, '') || '/votaciones',
        pollId: String(poll.id),
      },
    });

    return { ok: true };
  }

  notifyPollLiveAsync(pollId: string) {
    this.fireAndForget(`poll-live:${pollId}`, () => this.notifyPollLive(pollId));
  }

  /** Recordatorio programable N días antes del cierre (worker). */
  async runClosingReminders() {
    const now = Date.now();
    const notTooSoon = new Date(now + CLOSING_REMINDER_MIN_MS);
    const maxHorizon = new Date(now + CLOSING_REMINDER_MAX_DAYS * 24 * 60 * 60 * 1000);

    const polls = await this.prisma.poll.findMany({
      where: {
        status: PollStatus.live,
        activeEndAt: {
          gt: notTooSoon,
          lte: maxHorizon,
        },
      },
      take: 50,
    });

    let sent = 0;
    for (const poll of polls) {
      if (!poll.activeEndAt) continue;

      const days = this.closingReminderDays(poll);
      if (days <= 0) continue;

      const remainingMs = poll.activeEndAt.getTime() - now;
      const windowMs = days * 24 * 60 * 60 * 1000;
      if (remainingMs > windowMs) continue;

      const claimTtl = Math.max(60 * 60 * 48, days * 24 * 60 * 60 + 24 * 60 * 60);
      const claimed = await this.claimOnce(
        `lifecycle:closing:${poll.id}:${poll.activeEndAt.toISOString()}`,
        claimTtl,
      );
      if (!claimed) continue;

      const { titleEs, titleEn } = this.pollTitles(poll);
      const urlEs = this.pollUrl(poll, 'es');
      const endsLabelEs = poll.activeEndAt.toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const endsLabelEn = poll.activeEndAt.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const timingEs =
        days === 1
          ? 'Queda aproximadamente 1 día'
          : `Quedan aproximadamente ${days} días`;
      const timingEn =
        days === 1
          ? 'About 1 day left'
          : `About ${days} days left`;

      await this.broadcastPoll({
        label: `closing:${poll.id}`,
        subject: `${timingEs} · {{pollTitle}}`,
        message: `Hola {{name}},\n\n${timingEs} para votar en «{{pollTitle}}». Cierra aproximadamente el ${endsLabelEs}. ¡No te quedes fuera!`,
        subjectEn: `${timingEn} · {{pollTitle}}`,
        messageEn: `Hi {{name}},\n\n${timingEn} to vote in "{{pollTitle}}". It closes around ${endsLabelEn}. Don't miss out!`,
        pollTitle: titleEs,
        pollTitleEn: titleEn,
        ctaUrl: urlEs,
        ctaLabel: 'Ir a votar',
        ctaLabelEn: 'Go vote',
        template: 'poll',
        coverImageUrl: this.pollBannerUrl(poll) || null,
        pushTitle: `${timingEs}: ${titleEs}`,
        pushBody: 'Queda poco tiempo para votar. ¡Apoya a tu artista!',
        pushTitleEn: `${timingEn}: ${titleEn}`,
        pushBodyEn: 'Time is running out. Support your artist!',
        pushUrl: urlEs.replace(SITE, '') || '/votaciones',
        notificationType: 'poll_closing',
        inAppPayload: {
          title: `${timingEs}: ${titleEs}`,
          titleEn: `${timingEn}: ${titleEn}`,
          message: 'Queda poco tiempo para votar.',
          messageEn: 'Time is running out to vote.',
          url: urlEs.replace(SITE, '') || '/votaciones',
          pollId: String(poll.id),
          closingReminderDays: days,
        },
      });
      sent += 1;
    }

    if (sent) {
      this.logger.log(`Closing reminders enviados: ${sent}`);
    }
    return { ok: true, sent };
  }

  /** Resultados cuando se cierra la votación. */
  async notifyPollResults(pollId: string) {
    const poll = await this.prisma.poll.findUnique({ where: { id: BigInt(pollId) } });
    if (!poll) {
      return { ok: false, reason: 'not_found' as const };
    }

    const claimed = await this.claimOnce(`lifecycle:results:${poll.id}`, 60 * 60 * 24 * 14);
    if (!claimed) {
      return { ok: true, skipped: 'already_sent' as const };
    }

    const winners = await this.prisma.contestant.findMany({
      where: { pollId: poll.id },
      include: { artist: { select: { name: true } } },
      orderBy: [{ votes: 'desc' }, { order: 'asc' }],
      take: 40,
    });

    const winnerNames = winners
      .filter((row) => {
        const meta =
          row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : {};
        return Boolean(meta.isWinner);
      })
      .sort((a, b) => {
        const rank = (row: (typeof winners)[number]) => {
          const meta =
            row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
              ? (row.metadata as Record<string, unknown>)
              : {};
          return Number(meta.winnerRank || 999);
        };
        return rank(a) - rank(b);
      })
      .map((row) => row.artist?.name || 'Artista')
      .slice(0, 5);

    const leadersFallback = winners
      .slice()
      .sort((a, b) => Number(b.votes + b.manualVotes - (a.votes + a.manualVotes)))
      .slice(0, 3)
      .map((row) => row.artist?.name || 'Artista');

    const names = winnerNames.length ? winnerNames : leadersFallback;
    const namesLine = names.length ? names.join(', ') : '';

    const { titleEs, titleEn } = this.pollTitles(poll);
    const urlEs = this.pollUrl(poll, 'es');

    const resultsEs = namesLine
      ? `Resultados destacados: ${namesLine}.`
      : 'Ya puedes ver los resultados.';
    const resultsEn = namesLine
      ? `Top results: ${namesLine}.`
      : 'You can check the results now.';

    await this.broadcastPoll({
      label: `results:${pollId}`,
      subject: 'Resultados · {{pollTitle}}',
      message: `Hola {{name}},\n\nLa votación «{{pollTitle}}» ya cerró. ${resultsEs}\n\nEntra para ver el ranking completo.`,
      subjectEn: 'Results · {{pollTitle}}',
      messageEn: `Hi {{name}},\n\nThe poll "{{pollTitle}}" has closed. ${resultsEn}\n\nOpen the app to see the full ranking.`,
      pollTitle: titleEs,
      pollTitleEn: titleEn,
      ctaUrl: urlEs,
      ctaLabel: 'Ver resultados',
      ctaLabelEn: 'See results',
      template: 'poll',
      coverImageUrl: this.pollBannerUrl(poll) || null,
      pushTitle: `Resultados: ${titleEs}`,
      pushBody: resultsEs,
      pushTitleEn: `Results: ${titleEn}`,
      pushBodyEn: resultsEn,
      pushUrl: urlEs.replace(SITE, '') || '/votaciones',
      notificationType: 'poll_results',
      inAppPayload: {
        title: `Resultados: ${titleEs}`,
        titleEn: `Results: ${titleEn}`,
        message: resultsEs,
        messageEn: resultsEn,
        url: urlEs.replace(SITE, '') || '/votaciones',
        pollId: String(poll.id),
      },
    });

    return { ok: true };
  }

  notifyPollResultsAsync(pollId: string) {
    this.fireAndForget(`poll-results:${pollId}`, () => this.notifyPollResults(pollId));
  }

  private async broadcastPoll(input: {
    label: string;
    subject: string;
    message: string;
    subjectEn: string;
    messageEn: string;
    pollTitle: string;
    pollTitleEn: string;
    ctaUrl: string;
    ctaLabel: string;
    ctaLabelEn: string;
    template?: 'broadcast' | 'poll';
    coverImageUrl?: string | null;
    subtitle?: string | null;
    subtitleEn?: string | null;
    pushTitle: string;
    pushBody: string;
    pushTitleEn: string;
    pushBodyEn: string;
    pushUrl: string;
    notificationType: string;
    inAppPayload: Record<string, unknown>;
  }) {
    if (this.mail.isConfigured()) {
      try {
        await this.adminMail.sendBulk({
          subject: input.subject,
          message: input.message,
          subjectEn: input.subjectEn,
          messageEn: input.messageEn,
          sendToAll: true,
          template: input.template || 'poll',
          ctaUrl: input.ctaUrl,
          ctaLabel: input.ctaLabel,
          ctaLabelEn: input.ctaLabelEn,
          pollTitle: input.pollTitle,
          pollTitleEn: input.pollTitleEn,
          coverImageUrl: input.coverImageUrl,
          subtitle: input.subtitle,
          subtitleEn: input.subtitleEn,
        });
      } catch (error) {
        this.logger.warn(`Email ${input.label}: ${(error as Error).message}`);
      }
    } else {
      this.logger.warn(`Email ${input.label} omitido: SMTP no configurado`);
    }

    try {
      const tokenRows = await this.adminPush.collectAllTokens('all');
      const tokens = [...new Set(tokenRows.map((row) => row.token).filter(Boolean))];
      if (tokens.length) {
        await this.adminPush.dispatch(tokens, {
          title: input.pushTitle,
          body: input.pushBody,
          url: input.pushUrl,
          type: input.notificationType,
          extraData: {
            titleEn: input.pushTitleEn,
            bodyEn: input.pushBodyEn,
          },
        });
      } else {
        this.logger.warn(`Push ${input.label}: sin tokens`);
      }
    } catch (error) {
      this.logger.warn(`Push ${input.label}: ${(error as Error).message}`);
    }

    try {
      const userIds: string[] = [];
      let cursor: bigint | undefined;
      for (;;) {
        const page = await this.prisma.user.findMany({
          take: 1000,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: 'asc' },
          select: { id: true },
        });
        if (!page.length) break;
        userIds.push(...page.map((row) => row.id.toString()));
        cursor = page[page.length - 1].id;
        if (page.length < 1000) break;
      }

      if (userIds.length) {
        await this.adminPush.createInAppNotifications(
          userIds,
          input.notificationType,
          input.inAppPayload,
        );
      }
    } catch (error) {
      this.logger.warn(`In-app ${input.label}: ${(error as Error).message}`);
    }

    this.logger.log(`Lifecycle broadcast listo: ${input.label}`);
  }
}
