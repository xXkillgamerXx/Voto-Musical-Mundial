import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { artistLookupWhere } from '../../common/artist-lookup';
import { chartWeekWindow, previousWeekKeys } from '../../common/iso-week';
import { serialize } from '../../common/serialize';
import { MissionProgressService } from '../missions/mission-progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const ARTISTS_CACHE_SECONDS = 300;
const RANKING_CACHE_SECONDS = 120;

@Injectable()
export class ArtistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly missionProgress: MissionProgressService,
  ) {}

  async findAll(limit = 250) {
    const key = `cache:artists:${limit}`;
    const cached = await this.redis.client.get(key);
    if (cached) return JSON.parse(cached);

    const artists = await this.prisma.artist.findMany({
      take: Math.min(limit, 500),
      orderBy: { name: 'asc' },
    });
    const payload = serialize(artists);

    await this.redis.client.set(key, JSON.stringify(payload), 'EX', ARTISTS_CACHE_SECONDS);
    return payload;
  }

  async findOne(id: string) {
    const artist = await this.prisma.artist.findFirst({
      where: artistLookupWhere(id),
    });

    return serialize(artist);
  }

  private async resolveArtist(id: string) {
    const artist = await this.prisma.artist.findFirst({
      where: artistLookupWhere(id),
      select: { id: true, followersCount: true },
    });

    if (!artist) {
      throw new NotFoundException('No encontramos ese artista.');
    }

    return artist;
  }

  async followStatus(id: string, userId: bigint) {
    const artist = await this.resolveArtist(id);
    const follower = await this.prisma.artistFollower.findUnique({
      where: {
        artistId_userId: {
          artistId: artist.id,
          userId,
        },
      },
    });

    return {
      artistId: artist.id.toString(),
      following: Boolean(follower),
      followersCount: Number(artist.followersCount),
    };
  }

  async follow(id: string, userId: bigint) {
    const artist = await this.resolveArtist(id);

    const existing = await this.prisma.artistFollower.findUnique({
      where: {
        artistId_userId: {
          artistId: artist.id,
          userId,
        },
      },
    });

    if (!existing) {
      await this.prisma.$transaction([
        this.prisma.artistFollower.create({
          data: {
            artistId: artist.id,
            userId,
          },
        }),
        this.prisma.artist.update({
          where: { id: artist.id },
          data: {
            followersCount: { increment: 1 },
            popularityScore: { increment: 10 },
          },
        }),
      ]);
      void this.missionProgress.trackArtistFollow(userId).catch(() => {});
    }

    const updated = await this.prisma.artist.findUnique({
      where: { id: artist.id },
      select: { followersCount: true },
    });

    await this.clearArtistCaches();

    return {
      artistId: artist.id.toString(),
      following: true,
      followersCount: Number(updated?.followersCount || artist.followersCount),
    };
  }

  async unfollow(id: string, userId: bigint) {
    const artist = await this.resolveArtist(id);

    const deleted = await this.prisma.artistFollower.deleteMany({
      where: {
        artistId: artist.id,
        userId,
      },
    });

    if (deleted.count) {
      await this.prisma.artist.update({
        where: { id: artist.id },
        data: {
          followersCount: { decrement: 1 },
          popularityScore: { decrement: 10 },
        },
      });
    }

    const updated = await this.prisma.artist.findUnique({
      where: { id: artist.id },
      select: { followersCount: true },
    });

    await this.clearArtistCaches();

    return {
      artistId: artist.id.toString(),
      following: false,
      followersCount: Math.max(0, Number(updated?.followersCount || 0)),
    };
  }

  private async clearArtistCaches() {
    const keys = await this.redis.client.keys('cache:artists*');
    if (keys.length) {
      await this.redis.client.del(...keys);
    }
  }

  async popularityRanking(limit = 100) {
    const take = Math.min(Math.max(Number(limit) || 100, 1), 250);
    const window = chartWeekWindow();
    const cacheKey = `cache:artists:ranking:weekly:${window.key}:${take}`;
    const cached = await this.redis.client.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [thisWeek, lastWeek] = await Promise.all([
      this.artistWeekTotals(window.weekStart, window.weekEnd),
      this.artistWeekTotals(window.prevStart, window.prevEnd),
    ]);
    const lastWeekRanks = this.ranksFromTotals(lastWeek);
    const ordered = [...thisWeek.entries()]
      .filter(([, stats]) => stats.score > 0)
      .sort(
        (current, next) =>
          next[1].score - current[1].score ||
          next[1].votes - current[1].votes ||
          next[1].follows - current[1].follows,
      )
      .slice(0, take);

    const thisWeekRanks = new Map(
      ordered.map(([artistId], index) => [artistId, index + 1]),
    );
    const history = await this.loadWeeklyRankHistory(window.year, window.week);

    const artistIds = ordered.map(([artistId]) => BigInt(artistId));
    const artists = artistIds.length
      ? await this.prisma.artist.findMany({
          where: { id: { in: artistIds } },
        })
      : [];
    const byId = new Map(
      artists.map((artist) => [artist.id.toString(), artist]),
    );

    const payload = ordered
      .map(([artistId, stats], index) => {
        const artist = byId.get(artistId);
        if (!artist) return null;
        const rank = index + 1;
        const lastWeekRank = lastWeekRanks.get(artistId);
        const previousRanks = [...(history.get(artistId) || [])];
        if (lastWeekRank && !previousRanks.length) {
          previousRanks.push(lastWeekRank);
        }
        const peakPosition = Math.min(rank, ...previousRanks);
        return {
          ...serialize(artist),
          popularityScore: stats.score,
          totalVotes: stats.votes,
          lastWeekRank: lastWeekRank ? String(lastWeekRank) : 'NEW',
          peakPosition,
          weeksOnChart: 1 + previousRanks.length,
          rank,
          chartYear: window.year,
          chartWeek: window.week,
        };
      })
      .filter(Boolean);

    await this.redis.client.set(
      `ranking:weekly:${window.key}`,
      JSON.stringify(Object.fromEntries(thisWeekRanks)),
      'EX',
      60 * 60 * 24 * 400,
    );
    await this.redis.client.set(
      cacheKey,
      JSON.stringify(payload),
      'EX',
      RANKING_CACHE_SECONDS,
    );
    return payload;
  }

  private async artistWeekTotals(from: Date, to: Date) {
    const [voteRows, followRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ artist_id: bigint; votes: bigint }>>(Prisma.sql`
        SELECT c.artist_id, COALESCE(SUM(v.amount), 0)::bigint AS votes
        FROM vote_ledger v
        INNER JOIN contestants c ON c.id = v.contestant_id
        WHERE v.created_at >= ${from} AND v.created_at < ${to}
        GROUP BY c.artist_id
      `),
      this.prisma.$queryRaw<Array<{ artist_id: bigint; follows: bigint }>>(Prisma.sql`
        SELECT artist_id, COUNT(*)::bigint AS follows
        FROM artist_followers
        WHERE created_at >= ${from} AND created_at < ${to}
        GROUP BY artist_id
      `),
    ]);

    const totals = new Map<
      string,
      { votes: number; follows: number; score: number }
    >();
    const bump = (
      artistId: bigint,
      field: 'votes' | 'follows',
      amount: number,
    ) => {
      const key = artistId.toString();
      const current = totals.get(key) || { votes: 0, follows: 0, score: 0 };
      current[field] += amount;
      current.score = current.votes + current.follows * 10;
      totals.set(key, current);
    };

    for (const row of voteRows) bump(row.artist_id, 'votes', Number(row.votes));
    for (const row of followRows) {
      bump(row.artist_id, 'follows', Number(row.follows));
    }
    return totals;
  }

  private ranksFromTotals(
    totals: Map<string, { votes: number; follows: number; score: number }>,
  ) {
    return new Map(
      [...totals.entries()]
        .filter(([, stats]) => stats.score > 0)
        .sort(
          (current, next) =>
            next[1].score - current[1].score || next[1].votes - current[1].votes,
        )
        .map(([artistId], index) => [artistId, index + 1]),
    );
  }

  private async loadWeeklyRankHistory(year: number, week: number) {
    const keys = previousWeekKeys(year, week, 52).map(
      (key) => `ranking:weekly:${key}`,
    );
    const history = new Map<string, number[]>();
    if (!keys.length) return history;

    const rows = await this.redis.client.mget(...keys);
    for (const row of rows) {
      if (!row) continue;
      try {
        const ranks = JSON.parse(row) as Record<string, number>;
        for (const [artistId, rank] of Object.entries(ranks)) {
          const list = history.get(artistId) || [];
          list.push(Number(rank));
          history.set(artistId, list);
        }
      } catch {
        // ignore broken snapshots
      }
    }
    return history;
  }
}
