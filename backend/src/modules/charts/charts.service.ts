import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

type TrackInput = Record<string, unknown>;

type PackInput = {
  boardKey: string;
  code?: string;
  chart?: string | null;
  chartName?: string | null;
  date?: string | null;
  week?: string | null;
  source?: string | null;
  note?: string | null;
  country?: string | null;
  section?: string | null;
  period?: string | null;
  scrapedAt?: string | null;
  publishedAt?: string | null;
  meta?: Record<string, unknown>;
  tracks?: TrackInput[];
};

const CORE_KEYS = new Set([
  'position',
  'artist',
  'title',
  'coverUrl',
  'trackId',
  'artistId',
  'videoId',
  'change',
]);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

@Injectable()
export class ChartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  assertIngestSecret(provided?: string) {
    const expected = String(this.config.get<string>('CHARTS_INGEST_SECRET') || '').trim();
    if (!expected) {
      throw new UnauthorizedException('Charts ingest is not configured.');
    }
    const got = String(provided || '').trim();
    if (!got) throw new UnauthorizedException('Missing ingest secret.');
    const a = createHash('sha256').update(expected).digest();
    const b = createHash('sha256').update(got).digest();
    if (!timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid ingest secret.');
    }
  }

  async ingestPack(input: PackInput) {
    const boardKey = String(input.boardKey || '').trim();
    if (!boardKey) throw new BadRequestException('boardKey is required.');
    const code = String(input.code || 'global').trim().toLowerCase() || 'global';
    const tracks = Array.isArray(input.tracks) ? input.tracks : [];
    const scrapedAt = input.scrapedAt ? new Date(input.scrapedAt) : null;
    const publishedAt = input.publishedAt ? new Date(input.publishedAt) : new Date();

    const board = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.chartBoard.upsert({
        where: { boardKey_code: { boardKey, code } },
        create: {
          boardKey,
          code,
          chartName: String(input.chartName || input.chart || '') || null,
          chartDate: input.date ? String(input.date) : null,
          week: input.week ? String(input.week) : null,
          source: input.source ? String(input.source) : null,
          note: input.note ? String(input.note) : null,
          country: input.country ? String(input.country) : null,
          section: input.section ? String(input.section) : null,
          period: input.period ? String(input.period) : null,
          scrapedAt: scrapedAt && !Number.isNaN(scrapedAt.getTime()) ? scrapedAt : null,
          publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
          meta: asRecord(input.meta) as Prisma.InputJsonValue,
        },
        update: {
          chartName: String(input.chartName || input.chart || '') || null,
          chartDate: input.date ? String(input.date) : null,
          week: input.week ? String(input.week) : null,
          source: input.source ? String(input.source) : null,
          note: input.note ? String(input.note) : null,
          country: input.country ? String(input.country) : null,
          section: input.section ? String(input.section) : null,
          period: input.period ? String(input.period) : null,
          scrapedAt: scrapedAt && !Number.isNaN(scrapedAt.getTime()) ? scrapedAt : null,
          publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
          meta: asRecord(input.meta) as Prisma.InputJsonValue,
        },
      });

      await tx.chartTrack.deleteMany({ where: { boardId: saved.id } });

      if (tracks.length) {
        await tx.chartTrack.createMany({
          data: tracks.map((raw, index) => {
            const track = asRecord(raw);
            const metrics: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(track)) {
              if (!CORE_KEYS.has(key)) metrics[key] = value;
            }
            return {
              boardId: saved.id,
              position: Number(track.position || index + 1),
              artist: track.artist == null ? null : String(track.artist),
              title: track.title == null ? null : String(track.title),
              coverUrl: track.coverUrl == null ? null : String(track.coverUrl),
              trackId: track.trackId == null ? null : String(track.trackId),
              artistId: track.artistId == null ? null : String(track.artistId),
              videoId: track.videoId == null ? null : String(track.videoId),
              change:
                track.change === undefined
                  ? undefined
                  : (track.change as Prisma.InputJsonValue),
              metrics: metrics as Prisma.InputJsonValue,
            };
          }),
        });
      }

      return saved;
    });

    return {
      ok: true,
      boardKey,
      code,
      tracks: tracks.length,
      boardId: board.id.toString(),
      publishedAt: board.publishedAt,
    };
  }

  async ingestBundle(body: {
    packs?: PackInput[];
    data?: Record<string, PackInput & { tracks?: TrackInput[] }>;
    countries?: Array<{ code?: string; country?: string; date?: string | null; count?: number }>;
  }) {
    const packs: PackInput[] = [];
    if (Array.isArray(body.packs)) packs.push(...body.packs);

    const data = asRecord(body.data);
    for (const [boardKey, pack] of Object.entries(data)) {
      const row = asRecord(pack);
      packs.push({
        boardKey,
        code: String(row.code || 'global'),
        chart: row.chart == null ? null : String(row.chart),
        date: row.date == null ? null : String(row.date),
        week: row.week == null ? null : String(row.week),
        source: row.source == null ? null : String(row.source),
        note: row.note == null ? null : String(row.note),
        country: row.country == null ? null : String(row.country),
        section: row.section == null ? null : String(row.section),
        period: row.period == null ? null : String(row.period),
        scrapedAt: row.scrapedAt == null ? null : String(row.scrapedAt),
        publishedAt: row.publishedAt == null ? null : String(row.publishedAt),
        meta: asRecord(row.meta),
        tracks: Array.isArray(row.tracks) ? (row.tracks as TrackInput[]) : [],
      });
    }

    if (!packs.length) throw new BadRequestException('No chart packs to ingest.');

    const results: Array<{
      ok: boolean;
      boardKey: string;
      code: string;
      tracks: number;
      boardId: string;
      publishedAt: Date;
    }> = [];
    for (const pack of packs) {
      results.push(await this.ingestPack(pack));
    }

    if (Array.isArray(body.countries)) {
      const countriesMeta = {
        available: body.countries,
        packed: body.countries,
      } as Prisma.InputJsonValue;
      await this.prisma.chartBoard.upsert({
        where: { boardKey_code: { boardKey: 'countries', code: 'meta' } },
        create: {
          boardKey: 'countries',
          code: 'meta',
          chartName: 'Spotify countries',
          publishedAt: new Date(),
          meta: countriesMeta,
        },
        update: {
          publishedAt: new Date(),
          meta: countriesMeta,
        },
      });
    }

    return { ok: true, ingested: results.length, results };
  }

  private trackToJson(track: {
    position: number;
    artist: string | null;
    title: string | null;
    coverUrl: string | null;
    trackId: string | null;
    artistId: string | null;
    videoId: string | null;
    change: unknown;
    metrics: unknown;
  }) {
    const metrics = asRecord(track.metrics);
    return {
      position: track.position,
      artist: track.artist,
      title: track.title,
      coverUrl: track.coverUrl,
      trackId: track.trackId,
      artistId: track.artistId,
      videoId: track.videoId,
      change: track.change,
      ...metrics,
    };
  }

  private boardToPack(board: {
    chartName: string | null;
    chartDate: string | null;
    week: string | null;
    source: string | null;
    note: string | null;
    country: string | null;
    code: string;
    section: string | null;
    period: string | null;
    scrapedAt: Date | null;
    publishedAt: Date;
    meta: unknown;
    tracks: Array<{
      position: number;
      artist: string | null;
      title: string | null;
      coverUrl: string | null;
      trackId: string | null;
      artistId: string | null;
      videoId: string | null;
      change: unknown;
      metrics: unknown;
    }>;
  }) {
    const meta = asRecord(board.meta);
    return {
      source: board.source,
      section: board.section,
      country: board.country,
      code: board.code === 'global' ? 'global' : board.code,
      period: board.period,
      chart: board.chartName,
      date: board.chartDate,
      week: board.week,
      scrapedAt: board.scrapedAt?.toISOString() || null,
      publishedAt: board.publishedAt.toISOString(),
      note: board.note,
      count: board.tracks.length,
      ...meta,
      tracks: board.tracks
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((track) => this.trackToJson(track)),
    };
  }

  async getSiteData() {
    const keys = ['daily', 'listeners', 'latest', 'trending', 'insights', 'radio'];
    const boards = await this.prisma.chartBoard.findMany({
      where: {
        boardKey: { in: keys },
        code: 'global',
      },
      include: {
        tracks: { orderBy: { position: 'asc' } },
      },
    });

    if (!boards.length) {
      throw new NotFoundException('No charts data in database yet.');
    }

    const out: Record<string, unknown> = {};
    for (const key of keys) {
      const board = boards.find((row) => row.boardKey === key);
      out[key] = board ? this.boardToPack(board) : { tracks: [] };
    }
    return out;
  }

  async getCountryDaily(code: string) {
    const normalized = String(code || '').trim().toLowerCase();
    if (!normalized || normalized === 'global') {
      const board = await this.prisma.chartBoard.findUnique({
        where: { boardKey_code: { boardKey: 'daily', code: 'global' } },
        include: { tracks: { orderBy: { position: 'asc' } } },
      });
      if (!board) throw new NotFoundException('Global daily chart missing.');
      return this.boardToPack(board);
    }

    const board = await this.prisma.chartBoard.findUnique({
      where: { boardKey_code: { boardKey: 'daily', code: normalized } },
      include: { tracks: { orderBy: { position: 'asc' } } },
    });
    if (!board) throw new NotFoundException(`No daily chart for ${normalized}.`);
    return this.boardToPack(board);
  }

  async getCountriesMeta() {
    const metaBoard = await this.prisma.chartBoard.findUnique({
      where: { boardKey_code: { boardKey: 'countries', code: 'meta' } },
    });
    if (metaBoard) {
      const meta = asRecord(metaBoard.meta);
      return {
        frequent: ['us', 'gb', 'br', 'mx', 'co'],
        available: meta.available || meta.packed || [],
        packed: meta.packed || meta.available || [],
      };
    }

    const boards = await this.prisma.chartBoard.findMany({
      where: { boardKey: 'daily', NOT: { code: 'global' } },
      orderBy: { code: 'asc' },
      select: {
        code: true,
        country: true,
        chartDate: true,
        _count: { select: { tracks: true } },
      },
    });

    const packed = boards.map((board) => ({
      code: board.code,
      country: board.country || board.code.toUpperCase(),
      date: board.chartDate,
      count: board._count.tracks,
    }));

    return {
      frequent: ['us', 'gb', 'br', 'mx', 'co'],
      available: packed,
      packed,
    };
  }
}
