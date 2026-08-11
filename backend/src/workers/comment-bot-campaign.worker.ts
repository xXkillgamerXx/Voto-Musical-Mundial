import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { serialize } from '../common/serialize';
import { PrismaService } from '../modules/prisma/prisma.service';
import { RedisService } from '../modules/redis/redis.service';

type CampaignRow = {
  id: bigint;
  pollId: bigint;
  totalComments: number;
  appliedCount: number;
  durationSeconds: number;
  botNames: unknown;
  messages: unknown;
  startedAt: Date;
  endsAt: Date;
};

const TICK_MS = 5000;
/** Comentar es mucho menos frecuente que votar, por eso el burst es chico. */
const MAX_BURST = 3;

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

@Injectable()
export class CommentBotCampaignWorker implements OnModuleDestroy {
  private readonly logger = new Logger(CommentBotCampaignWorker.name);
  private interval?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async start() {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      this.tick().catch((error) => this.logger.error(error));
    }, TICK_MS);

    await this.tick();
    this.logger.log('Comment bot campaign worker started');
  }

  async tick() {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const campaigns = (await this.prisma.commentBotCampaign.findMany({
        where: { status: 'running' },
        orderBy: { id: 'asc' },
        take: 25,
      })) as CampaignRow[];

      for (const campaign of campaigns) {
        await this.processCampaign(campaign);
      }
    } finally {
      this.running = false;
    }
  }

  private async processCampaign(campaign: CampaignRow) {
    const total = Number(campaign.totalComments || 0);
    const applied = Number(campaign.appliedCount || 0);
    const remaining = total - applied;
    const now = Date.now();
    const startedAt = new Date(campaign.startedAt).getTime();
    const endsAt = new Date(campaign.endsAt).getTime();
    const durationMs = Math.max(1000, endsAt - startedAt);

    if (remaining <= 0 || now >= endsAt) {
      // Al vencer el plazo no se vuelca el resto de golpe: quedaría un bloque
      // de comentarios con la misma marca de tiempo y se notaría el bot.
      await this.prisma.commentBotCampaign.update({
        where: { id: campaign.id },
        data: {
          appliedCount: Math.min(total, applied),
          status: 'done',
        },
      });
      return;
    }

    const elapsed = Math.max(0, now - startedAt);
    const progress = Math.min(1, elapsed / durationMs);
    const curved = progress * progress * (3 - 2 * progress);
    const jitter = 0.9 + Math.random() * 0.2;
    const targetApplied = Math.min(total, Math.floor(total * curved * jitter));
    let due = Math.max(0, targetApplied - applied);

    const maxBurst = Math.max(
      1,
      Math.min(MAX_BURST, Math.ceil(total / Math.max(30, campaign.durationSeconds / 5))),
    );
    due = Math.min(due, maxBurst, remaining);

    if (due <= 0 && remaining > 0 && Math.random() < 0.25) {
      due = 1;
    }

    if (due <= 0) {
      return;
    }

    const posted = await this.emitComments(campaign, due);
    if (posted <= 0) {
      return;
    }

    const nextApplied = applied + posted;
    await this.prisma.commentBotCampaign.update({
      where: { id: campaign.id },
      data: {
        appliedCount: nextApplied,
        status: nextApplied >= total ? 'done' : 'running',
      },
    });
  }

  private async emitComments(campaign: CampaignRow, count: number) {
    const names = Array.isArray(campaign.botNames) ? (campaign.botNames as string[]) : [];
    const messages = Array.isArray(campaign.messages) ? (campaign.messages as string[]) : [];

    if (!names.length || !messages.length) {
      await this.prisma.commentBotCampaign.update({
        where: { id: campaign.id },
        data: { status: 'done' },
      });
      return 0;
    }

    const recent = await this.prisma.comment.findMany({
      where: { botCampaignId: campaign.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { text: true },
    });
    const usedRecently = new Set(recent.map((row) => row.text));

    let posted = 0;
    for (let i = 0; i < count; i += 1) {
      let text = pick(messages);
      for (let attempt = 0; attempt < 6 && usedRecently.has(text); attempt += 1) {
        text = pick(messages);
      }
      usedRecently.add(text);

      try {
        const comment = await this.prisma.comment.create({
          data: {
            pollId: campaign.pollId,
            userId: null,
            displayName: pick(names),
            photoUrl: null,
            text,
            botCampaignId: campaign.id,
          },
        });

        posted += 1;
        await this.publish(campaign.pollId, {
          action: 'new',
          comment: serialize(comment),
        });
      } catch (error) {
        this.logger.error(error);
      }
    }

    return posted;
  }

  private async publish(pollId: bigint, payload: Record<string, unknown>) {
    try {
      await this.redis.client.publish(`poll:${pollId.toString()}:comment`, JSON.stringify(payload));
    } catch {
      // Best-effort: el comentario ya quedó guardado en la base.
    }
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}
