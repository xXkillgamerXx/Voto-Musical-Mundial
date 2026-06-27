import { Injectable } from '@nestjs/common';
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
