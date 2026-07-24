import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';
import { generateBotNames } from './bot-name.util';

const toBigInt = (value?: string | number | bigint | null) => BigInt(Number(value || 0));

const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 180;
const MAX_AMOUNT = 1_000_000;
const MAX_BOTS = 500;

@Injectable()
export class VoteBotCampaignService {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    pollId: string;
    contestantId: string;
    amount: number;
    botsCount: number;
    durationMinutes: number;
    createdBy?: string | null;
  }) {
    const amount = Math.trunc(Number(params.amount || 0));
    const botsCount = Math.trunc(Number(params.botsCount || 0));
    const durationMinutes = Math.trunc(Number(params.durationMinutes || 0));

    if (!Number.isFinite(amount) || amount < 1 || amount > MAX_AMOUNT) {
      throw new BadRequestException(`La cantidad debe estar entre 1 y ${MAX_AMOUNT}.`);
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

    const contestant = await this.prisma.contestant.findFirst({
      where: {
        id: toBigInt(params.contestantId),
        pollId: toBigInt(params.pollId),
      },
      include: {
        artist: { select: { id: true, name: true } },
        poll: { select: { id: true, title: true, slug: true, config: true } },
      },
    });

    if (!contestant) {
      throw new NotFoundException('El participante no existe en esta votación.');
    }

    const durationSeconds = durationMinutes * 60;
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + durationSeconds * 1000);
    const botNames = generateBotNames(Math.min(botsCount, amount));

    const campaign = await this.prisma.voteBotCampaign.create({
      data: {
        pollId: contestant.pollId,
        roundId: contestant.roundId,
        contestantId: contestant.id,
        artistId: contestant.artistId,
        totalAmount: amount,
        botsCount: botNames.length,
        durationSeconds,
        appliedAmount: 0,
        status: 'running',
        botNames,
        createdBy: params.createdBy || null,
        startedAt,
        endsAt,
      },
      include: {
        contestant: {
          include: { artist: { select: { id: true, name: true, photoUrl: true } } },
        },
      },
    });

    return serialize(this.shape(campaign));
  }

  async listForPoll(pollId: string) {
    const rows = await this.prisma.voteBotCampaign.findMany({
      where: { pollId: toBigInt(pollId) },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        contestant: {
          include: { artist: { select: { id: true, name: true, photoUrl: true } } },
        },
      },
    });

    return serialize(rows.map((row) => this.shape(row)));
  }

  async getDetail(id: string) {
    const campaign = await this.prisma.voteBotCampaign.findUnique({
      where: { id: toBigInt(id) },
      include: {
        contestant: {
          include: { artist: { select: { id: true, name: true, photoUrl: true } } },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('La campaña no existe.');
    }

    const campaignId = campaign.id.toString();
    const names = Array.isArray(campaign.botNames) ? (campaign.botNames as string[]) : [];

    const ledgerRows = await this.prisma.voteLedger.findMany({
      where: {
        contestantId: campaign.contestantId,
        isAnonymous: true,
        createdAt: { gte: campaign.startedAt },
      },
      orderBy: { createdAt: 'desc' },
      take: 8000,
      select: {
        id: true,
        amount: true,
        metadata: true,
        createdAt: true,
      },
    });

    const campaignVotes = ledgerRows.filter((row) => {
      const metadata =
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : {};
      return String(metadata.botCampaignId || '') === campaignId;
    });

    const votesByName = new Map<string, { name: string; votes: number; hits: number; lastAt: Date | null }>();
    for (const name of names) {
      votesByName.set(name, { name, votes: 0, hits: 0, lastAt: null });
    }

    const recentVotes: Array<{ id: string; name: string; amount: number; createdAt: Date }> = [];

    for (const row of campaignVotes) {
      const metadata =
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : {};
      const name = String(metadata.displayName || metadata.userDisplayName || 'Fan');
      const amount = Math.max(1, Number(row.amount || 1));
      const current = votesByName.get(name) || { name, votes: 0, hits: 0, lastAt: null as Date | null };
      current.votes += amount;
      current.hits += 1;
      if (!current.lastAt || row.createdAt > current.lastAt) {
        current.lastAt = row.createdAt;
      }
      votesByName.set(name, current);

      if (recentVotes.length < 80) {
        recentVotes.push({
          id: row.id.toString(),
          name,
          amount,
          createdAt: row.createdAt,
        });
      }
    }

    const bots = [...votesByName.values()]
      .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name))
      .map((bot) => ({
        name: bot.name,
        votes: bot.votes,
        hits: bot.hits,
        lastAt: bot.lastAt,
        hasVoted: bot.votes > 0,
      }));

    const votedBots = bots.filter((bot) => bot.hasVoted).length;
    const ledgerTotal = bots.reduce((sum, bot) => sum + bot.votes, 0);

    return serialize({
      ...this.shape(campaign),
      bots,
      recentVotes,
      stats: {
        botsTotal: bots.length,
        botsVoted: votedBots,
        botsPending: Math.max(0, bots.length - votedBots),
        ledgerVotes: ledgerTotal,
      },
    });
  }

  async cancel(id: string) {
    const campaign = await this.prisma.voteBotCampaign.findUnique({
      where: { id: toBigInt(id) },
      include: {
        contestant: {
          include: { artist: { select: { id: true, name: true, photoUrl: true } } },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('La campaña no existe.');
    }

    if (campaign.status !== 'running' && campaign.status !== 'paused') {
      return serialize(this.shape(campaign));
    }

    const updated = await this.prisma.voteBotCampaign.update({
      where: { id: campaign.id },
      data: { status: 'cancelled' },
      include: {
        contestant: {
          include: { artist: { select: { id: true, name: true, photoUrl: true } } },
        },
      },
    });

    return serialize(this.shape(updated));
  }

  async listRunning() {
    return this.prisma.voteBotCampaign.findMany({
      where: { status: 'running' },
      orderBy: { id: 'asc' },
      include: {
        poll: { select: { id: true, title: true, slug: true, config: true } },
        contestant: {
          include: { artist: { select: { id: true, name: true, photoUrl: true } } },
        },
      },
    });
  }

  private shape(campaign: any) {
    const total = Number(campaign.totalAmount || 0);
    const applied = Number(campaign.appliedAmount || 0);
    const names = Array.isArray(campaign.botNames) ? campaign.botNames : [];
    const remaining = Math.max(0, total - applied);
    const percent = total > 0 ? Math.min(100, Math.round((applied / total) * 100)) : 0;
    const endsAtMs = campaign.endsAt ? new Date(campaign.endsAt).getTime() : 0;
    const etaMs = campaign.status === 'running' ? Math.max(0, endsAtMs - Date.now()) : 0;

    return {
      id: campaign.id?.toString?.() ?? campaign.id,
      pollId: campaign.pollId?.toString?.() ?? campaign.pollId,
      roundId: campaign.roundId?.toString?.() ?? null,
      contestantId: campaign.contestantId?.toString?.() ?? campaign.contestantId,
      artistId: campaign.artistId?.toString?.() ?? campaign.artistId,
      artistName: campaign.contestant?.artist?.name || null,
      artistPhotoUrl: campaign.contestant?.artist?.photoUrl || null,
      totalAmount: total,
      botsCount: Number(campaign.botsCount || names.length || 0),
      durationSeconds: Number(campaign.durationSeconds || 0),
      appliedAmount: applied,
      remainingAmount: remaining,
      percent,
      status: campaign.status,
      botNames: names,
      botNamesPreview: names.slice(0, 8),
      createdBy: campaign.createdBy || null,
      startedAt: campaign.startedAt,
      endsAt: campaign.endsAt,
      etaMs,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }
}
