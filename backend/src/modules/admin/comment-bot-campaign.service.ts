import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { pollLookupWhere } from '../../common/poll-lookup';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { generateBotNames } from './bot-name.util';
import { buildCommentBotMessages, sanitizeCommentBotMessages } from './comment-bot-message.util';

const toBigInt = (value?: string | number | bigint | null) => BigInt(Number(value || 0));

const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 720;
const MAX_COMMENTS = 2000;
const MAX_BOTS = 500;

@Injectable()
export class CommentBotCampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(params: {
    pollId: string;
    totalComments: number;
    botsCount: number;
    durationMinutes: number;
    messages?: unknown;
    createdBy?: string | null;
  }) {
    const totalComments = Math.trunc(Number(params.totalComments || 0));
    const botsCount = Math.trunc(Number(params.botsCount || 0));
    const durationMinutes = Math.trunc(Number(params.durationMinutes || 0));

    if (!Number.isFinite(totalComments) || totalComments < 1 || totalComments > MAX_COMMENTS) {
      throw new BadRequestException(`La cantidad de comentarios debe estar entre 1 y ${MAX_COMMENTS}.`);
    }
    if (!Number.isFinite(botsCount) || botsCount < 1 || botsCount > MAX_BOTS) {
      throw new BadRequestException(`La cantidad de bots debe estar entre 1 y ${MAX_BOTS}.`);
    }
    if (
      !Number.isFinite(durationMinutes) ||
      durationMinutes < MIN_DURATION_MINUTES ||
      durationMinutes > MAX_DURATION_MINUTES
    ) {
      throw new BadRequestException(
        `La duración debe estar entre ${MIN_DURATION_MINUTES} y ${MAX_DURATION_MINUTES} minutos.`,
      );
    }

    const poll = await this.prisma.poll.findFirst({
      where: pollLookupWhere(params.pollId),
      select: { id: true, title: true },
    });

    if (!poll) {
      throw new NotFoundException('La votación no existe.');
    }

    const custom = sanitizeCommentBotMessages(params.messages);
    let messages = custom;

    if (!messages.length) {
      const contestants = await this.prisma.contestant.findMany({
        where: { pollId: poll.id },
        select: { artist: { select: { name: true } } },
        take: 60,
      });
      const artistNames = contestants
        .map((row) => row.artist?.name || '')
        .filter((name): name is string => Boolean(name));
      messages = buildCommentBotMessages(Math.min(totalComments, 60), artistNames);
    }

    const durationSeconds = durationMinutes * 60;
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + durationSeconds * 1000);
    const botNames = generateBotNames(Math.min(botsCount, totalComments));

    const campaign = await this.prisma.commentBotCampaign.create({
      data: {
        pollId: poll.id,
        totalComments,
        botsCount: botNames.length,
        durationSeconds,
        appliedCount: 0,
        status: 'running',
        botNames,
        messages,
        createdBy: params.createdBy || null,
        startedAt,
        endsAt,
      },
    });

    return serialize(this.shape(campaign));
  }

  async listForPoll(pollId: string) {
    const poll = await this.prisma.poll.findFirst({
      where: pollLookupWhere(pollId),
      select: { id: true },
    });

    if (!poll) {
      throw new NotFoundException('La votación no existe.');
    }

    const rows = await this.prisma.commentBotCampaign.findMany({
      where: { pollId: poll.id },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    return serialize(rows.map((row) => this.shape(row)));
  }

  async getDetail(id: string) {
    const campaign = await this.prisma.commentBotCampaign.findUnique({
      where: { id: toBigInt(id) },
    });

    if (!campaign) {
      throw new NotFoundException('La campaña no existe.');
    }

    const [posted, deleted, recent] = await Promise.all([
      this.prisma.comment.count({ where: { botCampaignId: campaign.id, deletedAt: null } }),
      this.prisma.comment.count({ where: { botCampaignId: campaign.id, NOT: { deletedAt: null } } }),
      this.prisma.comment.findMany({
        where: { botCampaignId: campaign.id },
        orderBy: { createdAt: 'desc' },
        take: 60,
        select: {
          id: true,
          displayName: true,
          text: true,
          createdAt: true,
          deletedAt: true,
        },
      }),
    ]);

    return serialize({
      ...this.shape(campaign),
      recentComments: recent.map((row) => ({
        id: row.id.toString(),
        name: row.displayName,
        text: row.text,
        createdAt: row.createdAt,
        deleted: Boolean(row.deletedAt),
      })),
      stats: {
        posted,
        deleted,
        botsTotal: this.names(campaign).length,
        messagesTotal: this.texts(campaign).length,
      },
    });
  }

  async cancel(id: string) {
    const campaign = await this.prisma.commentBotCampaign.findUnique({
      where: { id: toBigInt(id) },
    });

    if (!campaign) {
      throw new NotFoundException('La campaña no existe.');
    }

    if (campaign.status !== 'running' && campaign.status !== 'paused') {
      return serialize(this.shape(campaign));
    }

    const updated = await this.prisma.commentBotCampaign.update({
      where: { id: campaign.id },
      data: { status: 'cancelled' },
    });

    return serialize(this.shape(updated));
  }

  async deleteComments(id: string) {
    const campaign = await this.prisma.commentBotCampaign.findUnique({
      where: { id: toBigInt(id) },
    });

    if (!campaign) {
      throw new NotFoundException('La campaña no existe.');
    }

    const pending = await this.prisma.comment.findMany({
      where: { botCampaignId: campaign.id, deletedAt: null },
      select: { id: true },
    });

    if (!pending.length) {
      return serialize({ ...this.shape(campaign), removed: 0 });
    }

    await this.prisma.comment.updateMany({
      where: { id: { in: pending.map((row) => row.id) } },
      data: { deletedAt: new Date() },
    });

    for (const row of pending) {
      await this.publish(campaign.pollId, { action: 'deleted', commentId: row.id.toString() });
    }

    const updated =
      campaign.status === 'running' || campaign.status === 'paused'
        ? await this.prisma.commentBotCampaign.update({
            where: { id: campaign.id },
            data: { status: 'cancelled' },
          })
        : campaign;

    return serialize({ ...this.shape(updated), removed: pending.length });
  }

  private async publish(pollId: bigint, payload: Record<string, unknown>) {
    try {
      await this.redis.client.publish(`poll:${pollId.toString()}:comment`, JSON.stringify(payload));
    } catch {
      // Best-effort: el borrado ya quedó aplicado en la base.
    }
  }

  private names(campaign: any): string[] {
    return Array.isArray(campaign.botNames) ? (campaign.botNames as string[]) : [];
  }

  private texts(campaign: any): string[] {
    return Array.isArray(campaign.messages) ? (campaign.messages as string[]) : [];
  }

  private shape(campaign: any) {
    const total = Number(campaign.totalComments || 0);
    const applied = Number(campaign.appliedCount || 0);
    const names = this.names(campaign);
    const messages = this.texts(campaign);
    const remaining = Math.max(0, total - applied);
    const percent = total > 0 ? Math.min(100, Math.round((applied / total) * 100)) : 0;
    const endsAtMs = campaign.endsAt ? new Date(campaign.endsAt).getTime() : 0;
    const etaMs = campaign.status === 'running' ? Math.max(0, endsAtMs - Date.now()) : 0;

    return {
      id: campaign.id?.toString?.() ?? campaign.id,
      pollId: campaign.pollId?.toString?.() ?? campaign.pollId,
      totalComments: total,
      botsCount: Number(campaign.botsCount || names.length || 0),
      durationSeconds: Number(campaign.durationSeconds || 0),
      appliedCount: applied,
      remainingCount: remaining,
      percent,
      status: campaign.status,
      botNames: names,
      botNamesPreview: names.slice(0, 8),
      messages,
      messagesPreview: messages.slice(0, 6),
      createdBy: campaign.createdBy || null,
      startedAt: campaign.startedAt,
      endsAt: campaign.endsAt,
      etaMs,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }
}
