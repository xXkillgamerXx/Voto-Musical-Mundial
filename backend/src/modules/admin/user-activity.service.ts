import { Injectable, NotFoundException } from '@nestjs/common';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';

const toBigInt = (value?: string | number | bigint | null) => BigInt(Number(value || 0));

const MAX_EVENTS = 300;
const DEFAULT_EVENTS = 120;
const MAX_DAYS = 365;
const DEFAULT_DAYS = 90;

type ActivityEvent = {
  id: string;
  type: string;
  at: Date;
  title: string;
  detail?: string | null;
  points?: number | null;
  context?: Record<string, unknown>;
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

@Injectable()
export class UserActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(id: string) {
    const userId = toBigInt(id);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        referredBy: { select: { id: true, displayName: true, username: true, email: true } },
        pushTokens: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: { id: true, platform: true, userAgent: true, permission: true, updatedAt: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('El usuario no existe.');
    }

    const [
      voteAggregate,
      voteRows,
      commentsCount,
      dailyRewardsCount,
      missionsDone,
      referralsCount,
      reportsSent,
      reportsReceived,
      followingCount,
      activeDaysCount,
      firstActivity,
      lastVote,
    ] = await Promise.all([
      this.prisma.voteLedger.aggregate({
        where: { userId },
        _sum: { amount: true, pointsSpent: true },
      }),
      this.prisma.voteLedger.count({ where: { userId } }),
      this.prisma.comment.count({ where: { userId, deletedAt: null } }),
      this.prisma.dailyReward.count({ where: { userId } }),
      this.prisma.missionCompletion.count({ where: { userId, NOT: { completedAt: null } } }),
      this.prisma.referralSignup.count({ where: { referrerId: userId } }),
      this.prisma.contentReport.count({ where: { reporterId: userId } }),
      this.prisma.contentReport.count({ where: { reportedUserId: userId } }),
      this.prisma.artistFollower.count({ where: { userId } }),
      this.prisma.userActivityDay.count({ where: { userId } }),
      this.prisma.userActivityDay.findFirst({
        where: { userId },
        orderBy: { day: 'asc' },
        select: { day: true },
      }),
      this.prisma.voteLedger.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const today = dayKey(new Date());
    const yesterday = dayKey(new Date(Date.now() - 86400000));
    const recentDays = await this.prisma.userActivityDay.findMany({
      where: { userId, day: { in: [today, yesterday] } },
      select: { day: true },
    });
    const seenDays = new Set(recentDays.map((row) => row.day));

    return serialize({
      user: {
        id: user.id.toString(),
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
        role: user.role,
        points: user.points,
        spentPoints: user.spentPoints,
        referralCode: user.referralCode,
        referralSignups: user.referralSignups,
        referralPoints: user.referralPoints,
        dailyRewardStreak: user.dailyRewardStreak,
        lastDailyRewardClaimDate: user.lastDailyRewardClaimDate,
        lastSeenAt: user.lastSeenAt,
        createdAt: user.createdAt,
        referredBy: user.referredBy
          ? {
              id: user.referredBy.id.toString(),
              name:
                user.referredBy.displayName ||
                user.referredBy.username ||
                user.referredBy.email ||
                'Fan',
            }
          : null,
      },
      devices: user.pushTokens.map((token) => ({
        id: token.id.toString(),
        platform: token.platform,
        userAgent: token.userAgent,
        permission: token.permission,
        updatedAt: token.updatedAt,
      })),
      stats: {
        votes: Number(voteAggregate._sum.amount || 0),
        voteEvents: voteRows,
        pointsSpentOnVotes: Number(voteAggregate._sum.pointsSpent || 0),
        comments: commentsCount,
        dailyRewards: dailyRewardsCount,
        missionsCompleted: missionsDone,
        referrals: referralsCount,
        reportsSent,
        reportsReceived,
        followingArtists: followingCount,
        activeDays: activeDaysCount,
        firstActiveDay: firstActivity?.day || null,
        lastVoteAt: lastVote?.createdAt || null,
        seenToday: seenDays.has(today),
        seenYesterday: seenDays.has(yesterday),
      },
    });
  }

  async getActivityDays(id: string, daysValue?: number) {
    const userId = toBigInt(id);
    const days = Math.min(Math.max(Number(daysValue) || DEFAULT_DAYS, 7), MAX_DAYS);
    const since = new Date(Date.now() - (days - 1) * 86400000);

    const rows = await this.prisma.userActivityDay.findMany({
      where: { userId, day: { gte: dayKey(since) } },
      orderBy: { day: 'asc' },
      select: { day: true, hits: true, firstSeenAt: true, lastSeenAt: true },
    });

    const byDay = new Map(rows.map((row) => [row.day, row]));
    const series: Array<{ day: string; hits: number; active: boolean }> = [];

    for (let i = 0; i < days; i += 1) {
      const day = dayKey(new Date(since.getTime() + i * 86400000));
      const row = byDay.get(day);
      series.push({ day, hits: row?.hits ?? 0, active: Boolean(row) });
    }

    const activeCount = series.filter((entry) => entry.active).length;

    return serialize({
      days,
      series,
      activeDays: activeCount,
      rate: series.length ? Math.round((activeCount / series.length) * 100) : 0,
      currentStreak: this.streakFrom(series),
    });
  }

  async getActivity(id: string, limitValue?: number) {
    const userId = toBigInt(id);
    const limit = Math.min(Math.max(Number(limitValue) || DEFAULT_EVENTS, 10), MAX_EVENTS);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, createdAt: true },
    });

    if (!user) {
      throw new NotFoundException('El usuario no existe.');
    }

    const [votes, comments, rewards, missions, referrals, reports, follows, notifications] =
      await Promise.all([
        this.prisma.voteLedger.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            amount: true,
            pointsSpent: true,
            ipHash: true,
            createdAt: true,
            poll: { select: { title: true } },
            contestant: { select: { artist: { select: { name: true } } } },
          },
        }),
        this.prisma.comment.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            text: true,
            createdAt: true,
            deletedAt: true,
            poll: { select: { title: true } },
          },
        }),
        this.prisma.dailyReward.findMany({
          where: { userId },
          orderBy: { claimedAt: 'desc' },
          take: limit,
          select: { id: true, points: true, streak: true, streakDay: true, claimedAt: true },
        }),
        this.prisma.missionCompletion.findMany({
          where: { userId, NOT: { completedAt: null } },
          orderBy: { completedAt: 'desc' },
          take: limit,
          select: {
            id: true,
            completedAt: true,
            mission: { select: { title: true, rewardPoints: true } },
          },
        }),
        this.prisma.referralSignup.findMany({
          where: { referrerId: userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            pointsAwarded: true,
            createdAt: true,
            user: { select: { displayName: true, username: true, email: true } },
          },
        }),
        this.prisma.contentReport.findMany({
          where: { reporterId: userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: { id: true, reason: true, targetType: true, status: true, createdAt: true },
        }),
        this.prisma.artistFollower.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: { id: true, createdAt: true, artist: { select: { name: true } } },
        }),
        this.prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: { id: true, type: true, payload: true, readAt: true, createdAt: true },
        }),
      ]);

    const events: ActivityEvent[] = [];

    for (const row of votes) {
      events.push({
        id: `vote-${row.id}`,
        type: 'vote',
        at: row.createdAt,
        title: `Votó ${row.amount} a ${row.contestant?.artist?.name || 'un artista'}`,
        detail: row.poll?.title || null,
        points: -Number(row.pointsSpent || 0),
        context: { ipHash: row.ipHash },
      });
    }

    for (const row of comments) {
      events.push({
        id: `comment-${row.id}`,
        type: 'comment',
        at: row.createdAt,
        title: row.deletedAt ? 'Comentario (borrado)' : 'Comentó',
        detail: `${row.poll?.title ? `${row.poll.title}: ` : ''}${row.text}`,
      });
    }

    for (const row of rewards) {
      events.push({
        id: `reward-${row.id}`,
        type: 'daily_reward',
        at: row.claimedAt,
        title: `Reclamó su recompensa diaria (día ${row.streakDay})`,
        detail: `Racha de ${row.streak}`,
        points: Number(row.points || 0),
      });
    }

    for (const row of missions) {
      events.push({
        id: `mission-${row.id}`,
        type: 'mission',
        at: row.completedAt as Date,
        title: `Completó la misión "${row.mission?.title || 'Misión'}"`,
        points: Number(row.mission?.rewardPoints || 0),
      });
    }

    for (const row of referrals) {
      const name = row.user?.displayName || row.user?.username || row.user?.email || 'Alguien';
      events.push({
        id: `referral-${row.id}`,
        type: 'referral',
        at: row.createdAt,
        title: `Invitó a ${name}`,
        points: Number(row.pointsAwarded || 0),
      });
    }

    for (const row of reports) {
      events.push({
        id: `report-${row.id}`,
        type: 'report',
        at: row.createdAt,
        title: `Denunció ${row.targetType === 'comment' ? 'un comentario' : 'un perfil'}`,
        detail: `Motivo: ${row.reason} · ${row.status}`,
      });
    }

    for (const row of follows) {
      events.push({
        id: `follow-${row.id}`,
        type: 'follow',
        at: row.createdAt,
        title: `Empezó a seguir a ${row.artist?.name || 'un artista'}`,
      });
    }

    for (const row of notifications) {
      const payload =
        row.payload && typeof row.payload === 'object'
          ? (row.payload as Record<string, unknown>)
          : {};
      events.push({
        id: `notification-${row.id}`,
        type: 'notification',
        at: row.createdAt,
        title: String(payload.title || `Notificación: ${row.type}`),
        detail: payload.body ? String(payload.body) : null,
        context: { read: Boolean(row.readAt), notificationType: row.type },
      });
    }

    events.push({
      id: `signup-${user.id}`,
      type: 'signup',
      at: user.createdAt,
      title: 'Se registró en la plataforma',
    });

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return serialize({ items: events.slice(0, limit), total: events.length });
  }

  private streakFrom(series: Array<{ day: string; active: boolean }>) {
    let streak = 0;
    for (let i = series.length - 1; i >= 0; i -= 1) {
      if (!series[i].active) {
        // Que hoy todavía no tenga actividad no debería cortar la racha de ayer.
        if (i === series.length - 1) continue;
        break;
      }
      streak += 1;
    }
    return streak;
  }
}
