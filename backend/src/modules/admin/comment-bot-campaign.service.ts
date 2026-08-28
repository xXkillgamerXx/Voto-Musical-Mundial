import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { pollLookupWhere } from '../../common/poll-lookup';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { generateBotNames } from './bot-name.util';
import { buildCommentLengthProfile, sanitizeCommentBotMessages } from './comment-bot-message.util';
import { generateCommentBotMessagesWithAi } from './comment-bot-ai.util';
import { commentBotLanguageLabel } from './comment-bot-language.util';

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

  async suggestMessages(params: {
    pollId: string;
    topic?: string;
    count?: number;
    artistId?: string;
    artistName?: string;
    rivalArtistName?: string;
    language?: string;
  }) {
    const poll = await this.prisma.poll.findFirst({
      where: pollLookupWhere(params.pollId),
      select: { id: true, title: true },
    });

    if (!poll) {
      throw new NotFoundException('La votación no existe.');
    }

    const focusArtistName = await this.resolveFocusArtistName(poll.id, params);
    const rivalArtistName = String(params.rivalArtistName || '').trim();
    const sampleComments = await this.loadReferenceComments(poll.id, focusArtistName);
    const sampleTexts = sampleComments.map((row) => row.text);
    const contestants = await this.prisma.contestant.findMany({
      where: { pollId: poll.id },
      select: { artist: { select: { name: true } } },
      take: 60,
    });
    const artistNames = contestants
      .map((row) => row.artist?.name || '')
      .filter((name): name is string => Boolean(name));
    const topic =
      String(params.topic || '').trim() ||
      (focusArtistName && rivalArtistName
        ? `Fans apoyando a ${focusArtistName} en el duelo contra ${rivalArtistName}`
        : focusArtistName
          ? `Apoyo, hype y votos por ${focusArtistName}`
          : '');

    const result = await generateCommentBotMessagesWithAi({
      topic,
      count: Number(params.count || 25),
      pollTitle: poll.title,
      artistNames: focusArtistName ? [focusArtistName] : artistNames,
      focusArtistName,
      rivalArtistName,
      sampleComments: sampleTexts,
      language: params.language,
    });

    const previewNames = generateBotNames(Math.min(12, Math.max(8, Number(params.count || 8))));
    const lengthProfile = buildCommentLengthProfile(sampleTexts);
    const previewAvgLength =
      result.messages.length > 0
        ? Math.round(result.messages.reduce((sum, line) => sum + line.length, 0) / result.messages.length)
        : 0;

    return serialize({
      messages: result.messages,
      source: result.source,
      language: result.language,
      languageLabel: commentBotLanguageLabel(result.language),
      languageRejectedCount: Number(result.languageRejectedCount || 0),
      topic,
      focusArtistName,
      sampleCommentsCount: sampleComments.length,
      sampleCommentsPreview: sampleComments.slice(0, 6),
      botNamesPreview: previewNames,
      promptSummary: topic,
      lengthProfile,
      previewAvgLength,
      pollTitle: poll.title,
      artistNames: focusArtistName ? [focusArtistName] : artistNames.slice(0, 12),
    });
  }

  async create(params: {
    pollId: string;
    totalComments: number;
    botsCount: number;
    durationMinutes: number;
    messages?: unknown;
    topic?: string;
    artistId?: string;
    artistName?: string;
    rivalArtistName?: string;
    language?: string;
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
      const focusArtistName = await this.resolveFocusArtistName(poll.id, params);
      const rivalArtistName = String(params.rivalArtistName || '').trim();
      const sampleComments = await this.loadReferenceComments(poll.id, focusArtistName);
      const sampleTexts = sampleComments.map((row) => row.text);
      const contestants = await this.prisma.contestant.findMany({
        where: { pollId: poll.id },
        select: { artist: { select: { name: true } } },
        take: 60,
      });
      const artistNames = contestants
        .map((row) => row.artist?.name || '')
        .filter((name): name is string => Boolean(name));
      const topic =
        String(params.topic || '').trim() ||
        (focusArtistName && rivalArtistName
          ? `Fans apoyando a ${focusArtistName} en el duelo contra ${rivalArtistName}`
          : focusArtistName
            ? `Apoyo, hype y votos por ${focusArtistName}`
            : 'Comentarios de fans en la votación');

      const generated = await generateCommentBotMessagesWithAi({
        topic,
        count: Math.min(80, Math.max(10, totalComments)),
        pollTitle: poll.title,
        artistNames: focusArtistName ? [focusArtistName] : artistNames,
        focusArtistName,
        rivalArtistName,
        sampleComments: sampleTexts,
        language: params.language,
      });
      messages = generated.messages;
    }

    if (!messages.length) {
      throw new BadRequestException(
        'No se pudieron generar comentarios con IA. Revisa la configuración del servidor e inténtalo de nuevo.',
      );
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

  private async resolveFocusArtistName(
    pollId: bigint,
    params: { artistId?: string; artistName?: string },
  ) {
    const directName = String(params.artistName || '').trim();
    if (directName) {
      return directName;
    }

    const artistId = String(params.artistId || '').trim();
    if (!artistId) {
      return '';
    }

    const contestant = await this.prisma.contestant.findFirst({
      where: {
        pollId,
        OR: [{ artistId: toBigInt(artistId) }, { id: toBigInt(artistId) }],
      },
      include: { artist: { select: { name: true } } },
    });

    return contestant?.artist?.name || '';
  }

  private async loadReferenceComments(pollId: bigint, focusArtistName: string) {
    const rows = await this.prisma.comment.findMany({
      where: {
        pollId,
        deletedAt: null,
        botCampaignId: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 180,
      select: { text: true, displayName: true, photoUrl: true },
    });

    const cleaned = rows
      .map((row) => ({
        text: String(row.text || '').trim(),
        displayName: String(row.displayName || 'Fan').trim() || 'Fan',
        photoUrl: row.photoUrl ? String(row.photoUrl) : '',
      }))
      .filter((row) => row.text.length >= 3);

    const uniqueByText = (items: typeof cleaned) => {
      const seen = new Set<string>();
      const kept: typeof cleaned = [];
      for (const item of items) {
        const key = item.text.toLowerCase();
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        kept.push(item);
      }
      return kept;
    };

    if (!focusArtistName) {
      return uniqueByText(cleaned).sort((a, b) => b.text.length - a.text.length).slice(0, 20);
    }

    const focusLower = focusArtistName.toLowerCase();
    const aboutArtist = cleaned.filter((row) => row.text.toLowerCase().includes(focusLower));
    const general = cleaned.filter((row) => !row.text.toLowerCase().includes(focusLower));

    return uniqueByText([...aboutArtist, ...general])
      .sort((a, b) => b.text.length - a.text.length)
      .slice(0, 20);
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
