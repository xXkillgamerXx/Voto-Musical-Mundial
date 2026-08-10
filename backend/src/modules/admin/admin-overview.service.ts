import { Injectable } from '@nestjs/common';
import { PollStatus } from '@prisma/client';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';

type DayRow = { day: Date; value: number };

const OPEN_STATUSES: PollStatus[] = [PollStatus.live, PollStatus.selecting_winners];

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const daysAgo = (days: number) => {
  const date = startOfDay(new Date());
  date.setDate(date.getDate() - days);
  return date;
};

const dayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Variación porcentual entre dos periodos comparables. */
const growth = (current: number, previous: number) => {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
};

@Injectable()
export class AdminOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  private toSeries(rows: DayRow[], days: number) {
    const byDay = new Map<string, number>();
    for (const row of rows) {
      byDay.set(dayKey(new Date(row.day)), Number(row.value || 0));
    }

    const series: Array<{ date: string; value: number }> = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = daysAgo(offset);
      const key = dayKey(date);
      series.push({ date: key, value: byDay.get(key) || 0 });
    }

    return series;
  }

  async overview(daysValue?: string) {
    const days = Math.min(Math.max(Number(daysValue) || 30, 7), 90);
    const since = daysAgo(days - 1);
    const today = startOfDay(new Date());
    const yesterday = daysAgo(1);
    const last7 = daysAgo(6);
    const prev7Start = daysAgo(13);
    const last30 = daysAgo(29);

    const [
      totalUsers,
      usersToday,
      usersYesterday,
      usersLast7,
      usersPrev14,
      usersLast30,
      referredUsers,
      usersWithPush,
      totalPolls,
      openPolls,
      totalArtists,
      totalComments,
      pollVotesAgg,
      pointsAgg,
      votesTodayAgg,
      votesYesterdayAgg,
      votesLast7Agg,
      votesPrev14Agg,
      pushByPlatform,
      topPolls,
      recentUsers,
      topReferrers,
      usersByDay,
      votesByDay,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.user.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
      this.prisma.user.count({ where: { createdAt: { gte: last7 } } }),
      this.prisma.user.count({ where: { createdAt: { gte: prev7Start, lt: last7 } } }),
      this.prisma.user.count({ where: { createdAt: { gte: last30 } } }),
      this.prisma.user.count({ where: { referredById: { not: null } } }),
      this.prisma.user.count({ where: { pushTokens: { some: {} } } }),
      this.prisma.poll.count(),
      this.prisma.poll.count({ where: { status: { in: OPEN_STATUSES } } }),
      this.prisma.artist.count(),
      this.prisma.comment.count({ where: { deletedAt: null } }),
      this.prisma.poll.aggregate({ _sum: { totalVotes: true } }),
      this.prisma.user.aggregate({ _sum: { points: true } }),
      this.prisma.voteLedger.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.voteLedger.aggregate({
        where: { createdAt: { gte: yesterday, lt: today } },
        _sum: { amount: true },
      }),
      this.prisma.voteLedger.aggregate({
        where: { createdAt: { gte: last7 } },
        _sum: { amount: true },
      }),
      this.prisma.voteLedger.aggregate({
        where: { createdAt: { gte: prev7Start, lt: last7 } },
        _sum: { amount: true },
      }),
      this.prisma.pushToken.groupBy({ by: ['platform'], _count: { _all: true } }),
      this.prisma.poll.findMany({
        orderBy: { totalVotes: 'desc' },
        take: 5,
        select: { id: true, title: true, slug: true, status: true, totalVotes: true },
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          photoUrl: true,
          points: true,
          createdAt: true,
          referredById: true,
        },
      }),
      this.prisma.user.findMany({
        where: { referralSignups: { gt: 0 } },
        orderBy: { referralSignups: 'desc' },
        take: 5,
        select: {
          id: true,
          username: true,
          displayName: true,
          referralSignups: true,
          referralPoints: true,
        },
      }),
      this.prisma.$queryRaw<DayRow[]>`
        SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS value
        FROM users
        WHERE created_at >= ${since}
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.$queryRaw<DayRow[]>`
        SELECT date_trunc('day', created_at) AS day, COALESCE(SUM(amount), 0)::int AS value
        FROM vote_ledger
        WHERE created_at >= ${since}
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

    const votesToday = Number(votesTodayAgg._sum.amount || 0);
    const votesYesterday = Number(votesYesterdayAgg._sum.amount || 0);
    const votesLast7 = Number(votesLast7Agg._sum.amount || 0);
    const votesPrev7 = Number(votesPrev14Agg._sum.amount || 0);

    return serialize({
      generatedAt: new Date().toISOString(),
      rangeDays: days,
      users: {
        total: totalUsers,
        today: usersToday,
        yesterday: usersYesterday,
        last7: usersLast7,
        prev7: usersPrev14,
        last30: usersLast30,
        growth7: growth(usersLast7, usersPrev14),
        growthToday: growth(usersToday, usersYesterday),
        referred: referredUsers,
        withPush: usersWithPush,
      },
      votes: {
        total: Number(pollVotesAgg._sum.totalVotes || 0),
        today: votesToday,
        yesterday: votesYesterday,
        last7: votesLast7,
        prev7: votesPrev7,
        growth7: growth(votesLast7, votesPrev7),
        growthToday: growth(votesToday, votesYesterday),
        rowsToday: Number(votesTodayAgg._count._all || 0),
      },
      content: {
        polls: totalPolls,
        openPolls,
        artists: totalArtists,
        comments: totalComments,
        points: Number(pointsAgg._sum.points || 0),
      },
      pushByPlatform: pushByPlatform.map((row) => ({
        platform: row.platform,
        count: Number(row._count._all || 0),
      })),
      series: {
        users: this.toSeries(usersByDay, days),
        votes: this.toSeries(votesByDay, days),
      },
      topPolls,
      recentUsers,
      topReferrers,
    });
  }
}
