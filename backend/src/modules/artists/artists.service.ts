import { Injectable, NotFoundException } from '@nestjs/common';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const ARTISTS_CACHE_SECONDS = 300;
const RANKING_CACHE_SECONDS = 120;

@Injectable()
export class ArtistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
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
      where: {
        OR: [{ id: BigInt(Number(id) || 0) }, { slug: id }, { firebaseId: id }],
      },
    });

    return serialize(artist);
  }

  private async resolveArtist(id: string) {
    const artist = await this.prisma.artist.findFirst({
      where: {
        OR: [{ id: BigInt(Number(id) || 0) }, { slug: id }, { firebaseId: id }],
      },
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
    const key = `cache:artists:ranking:${limit}`;
    const cached = await this.redis.client.get(key);
    if (cached) return JSON.parse(cached);

    const artists = await this.prisma.artist.findMany({
      take: Math.min(limit, 250),
      orderBy: [{ popularityScore: 'desc' }, { totalVotes: 'desc' }],
    });
    const payload = serialize(artists);

    await this.redis.client.set(key, JSON.stringify(payload), 'EX', RANKING_CACHE_SECONDS);
    return payload;
  }
}
