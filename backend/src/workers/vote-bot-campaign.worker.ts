import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../modules/prisma/prisma.service';
import { RedisService } from '../modules/redis/redis.service';

type CampaignRow = {
  id: bigint;
  pollId: bigint;
  roundId: bigint | null;
  contestantId: bigint;
  artistId: bigint;
  totalAmount: number;
  appliedAmount: number;
  durationSeconds: number;
  botNames: unknown;
  startedAt: Date;
  endsAt: Date;
  poll?: { id: bigint; title: string; slug: string | null; config: unknown } | null;
  contestant?: {
    artist?: { id: bigint; name: string; photoUrl: string | null } | null;
  } | null;
};

/** Stable synthetic id so live feed counts each bot name as an active fan. */
const publicFanId = (name: string) => {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `f${(hash >>> 0).toString(16)}`;
};

@Injectable()
export class VoteBotCampaignWorker implements OnModuleDestroy {
  private readonly logger = new Logger(VoteBotCampaignWorker.name);
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
    }, 3000);

    await this.tick();
    this.logger.log('Vote bot campaign worker started');
  }

  async tick() {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const campaigns = (await this.prisma.voteBotCampaign.findMany({
        where: { status: 'running' },
        orderBy: { id: 'asc' },
        take: 25,
        include: {
          poll: { select: { id: true, title: true, slug: true, config: true } },
          contestant: {
            include: { artist: { select: { id: true, name: true, photoUrl: true } } },
          },
        },
      })) as CampaignRow[];

      for (const campaign of campaigns) {
        await this.processCampaign(campaign);
      }
    } finally {
      this.running = false;
    }
  }

  private async processCampaign(campaign: CampaignRow) {
    const total = Number(campaign.totalAmount || 0);
    const applied = Number(campaign.appliedAmount || 0);
    const remaining = total - applied;
    const now = Date.now();
    const startedAt = new Date(campaign.startedAt).getTime();
    const endsAt = new Date(campaign.endsAt).getTime();
    const durationMs = Math.max(1000, endsAt - startedAt);

    if (remaining <= 0 || now >= endsAt) {
      if (remaining > 0 && now >= endsAt) {
        await this.emitVotes(campaign, remaining);
        await this.prisma.voteBotCampaign.update({
          where: { id: campaign.id },
          data: {
            appliedAmount: total,
            status: 'done',
          },
        });
        return;
      }

      await this.prisma.voteBotCampaign.update({
        where: { id: campaign.id },
        data: {
          appliedAmount: Math.min(total, applied),
          status: 'done',
        },
      });
      return;
    }

    const elapsed = Math.max(0, now - startedAt);
    const progress = Math.min(1, elapsed / durationMs);
    // Ease-in-out-ish target with slight random jitter so it does not look linear.
    const curved = progress * progress * (3 - 2 * progress);
    const jitter = 0.92 + Math.random() * 0.16;
    const targetApplied = Math.min(
      total,
      Math.floor(total * curved * jitter),
    );
    let due = Math.max(0, targetApplied - applied);

    // Cap burst size per tick so activity looks human.
    const maxBurst = Math.max(1, Math.min(12, Math.ceil(total / Math.max(20, campaign.durationSeconds / 3))));
    due = Math.min(due, maxBurst, remaining);

    // Always drip at least 1 vote occasionally when behind schedule.
    if (due <= 0 && remaining > 0 && Math.random() < 0.35) {
      due = 1;
    }

    if (due <= 0) {
      return;
    }

    await this.emitVotes(campaign, due);
    const nextApplied = applied + due;
    await this.prisma.voteBotCampaign.update({
      where: { id: campaign.id },
      data: {
        appliedAmount: nextApplied,
        status: nextApplied >= total ? 'done' : 'running',
      },
    });
  }

  private async emitVotes(campaign: CampaignRow, amount: number) {
    const names = Array.isArray(campaign.botNames)
      ? (campaign.botNames as string[])
      : [];
    const pollId = campaign.pollId.toString();
    const roundId = campaign.roundId ? campaign.roundId.toString() : '';
    const roundKey = roundId || '_root';
    const contestantId = campaign.contestantId.toString();
    const artistId = campaign.artistId.toString();
    const artistName = campaign.contestant?.artist?.name || 'Artista';
    const pollTitle = campaign.poll?.title || '';
    const pollSlug = campaign.poll?.slug || '';
    const pollConfig =
      campaign.poll?.config && typeof campaign.poll.config === 'object'
        ? (campaign.poll.config as Record<string, unknown>)
        : {};
    const pollYear = Number(pollConfig.year || new Date().getFullYear());
    const counterKey = `votes:poll:${pollId}:round:${roundKey}`;
    const rankingKey = `ranking:poll:${pollId}:round:${roundKey}`;
    const channel = `poll:${pollId}:votes`;
    const campaignId = campaign.id.toString();

    // Mostly 1 vote (like a normal fan), sometimes 2–3 so it looks natural.
    let left = amount;
    const packets: Array<{ amount: number; name: string }> = [];
    while (left > 0) {
      const chunk =
        Math.random() < 0.72
          ? 1
          : Math.min(left, 1 + Math.floor(Math.random() * 2));
      const name =
        names.length > 0
          ? names[Math.floor(Math.random() * names.length)]
          : `Fan${Math.floor(Math.random() * 9000) + 1000}`;
      packets.push({ amount: chunk, name });
      left -= chunk;
    }

    const multi = this.redis.client.multi();
    multi.hincrby(counterKey, contestantId, amount);
    multi.zincrby(rankingKey, amount, contestantId);

    for (const packet of packets) {
      const createdAt = new Date().toISOString();
      // Ledger stays anonymous + tagged for moderation; live feed sees a normal fan.
      const anonymousId = `anon:${campaignId}:${packet.name}`;
      const publicUserId = publicFanId(packet.name);
      multi.xadd(
        'votes:stream',
        'MAXLEN',
        '~',
        '1000000',
        '*',
        'pollId',
        pollId,
        'roundId',
        roundId,
        'contestantId',
        contestantId,
        'artistId',
        artistId,
        'userId',
        '',
        'username',
        '',
        'userDisplayName',
        packet.name,
        'userPhotoUrl',
        '',
        'anonymousId',
        anonymousId,
        'ipHash',
        '',
        'voteScope',
        '',
        'amount',
        String(packet.amount),
        'pointsSpent',
        '0',
        'isAnonymous',
        '1',
        'botCampaignId',
        campaignId,
        'createdAt',
        createdAt,
      );
      multi.publish(
        channel,
        JSON.stringify({
          type: 'vote_delta',
          pollId,
          pollTitle,
          pollSlug,
          pollYear,
          roundId: roundId || null,
          contestantId,
          artistId,
          artistName,
          userId: publicUserId,
          username: packet.name,
          userDisplayName: packet.name,
          userPhotoUrl: null,
          amount: packet.amount,
          pointsSpent: packet.amount,
          isAnonymous: false,
          staffVote: false,
          createdAt,
        }),
      );
    }

    await multi.exec();
  }

  async onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}
