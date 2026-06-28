import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PollStatus, RoundType, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { serialize } from '../../common/serialize';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../metrics/metrics.service';

const toBigInt = (value?: string | number | bigint | null) => BigInt(Number(value || 0));
const toDate = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};
const endDateFor = (body: any) => {
  if (Object.prototype.hasOwnProperty.call(body, 'endsAt')) return toDate(body.endsAt);
  if (Object.prototype.hasOwnProperty.call(body, 'endAt')) return toDate(body.endAt);
  if (Object.prototype.hasOwnProperty.call(body, 'end_at')) return toDate(body.end_at);
  return undefined;
};
const statusFor = (value: unknown) =>
  Object.values(PollStatus).includes(value as PollStatus) ? (value as PollStatus) : PollStatus.draft;
const roundTypeFor = (value: unknown) =>
  Object.values(RoundType).includes(value as RoundType) ? (value as RoundType) : RoundType.standard;
const allowedUploadTypes = new Set(['poll-banner', 'artist-banner', 'artist-profile']);
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const adminUploadsPath = join(process.cwd(), 'uploads', 'admin');
const uploadTypeFor = (value: unknown) => {
  const type = String(value || '');
  if (!allowedUploadTypes.has(type)) {
    throw new BadRequestException('Tipo de subida invalido.');
  }

  return type;
};

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.superadmin, UserRole.owner)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {}

  @Get('metrics')
  async metricsSnapshot() {
    const base = this.metrics.snapshot();

    let votesStreamLength = 0;
    try {
      votesStreamLength = await this.redis.client.xlen('votes:stream');
    } catch {
      votesStreamLength = 0;
    }

    const [polls, users, artists, comments, votes] = await Promise.all([
      this.prisma.poll.count(),
      this.prisma.user.count(),
      this.prisma.artist.count(),
      this.prisma.comment.count({ where: { deletedAt: null } }),
      this.prisma.voteLedger.count(),
    ]);

    return {
      ...base,
      votesStreamLength,
      db: { polls, users, artists, comments, votes },
    };
  }

  private async publishPollState(pollId: bigint | string, payload: Record<string, unknown>) {
    try {
      await this.redis.client.publish(
        `poll:${pollId.toString()}:state`,
        JSON.stringify({ ...payload, at: new Date().toISOString() }),
      );
    } catch {
      // Realtime es best-effort: si Redis falla, el estado igual queda en la base.
    }
  }

  private async publishUserEvent(userId: bigint | string, payload: Record<string, unknown>) {
    try {
      await this.redis.client.publish(
        `user:${userId.toString()}:events`,
        JSON.stringify({ ...payload, at: new Date().toISOString() }),
      );
    } catch {
      // Best-effort: el regalo igual queda como notificacion en la base.
    }
  }

  @Post('uploads/:type')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (request, _file, callback) => {
          try {
            const type = uploadTypeFor(request.params?.type);
            const destination = join(adminUploadsPath, type);

            if (!existsSync(destination)) {
              mkdirSync(destination, { recursive: true });
            }

            callback(null, destination);
          } catch (error) {
            callback(error as Error, '');
          }
        },
        filename: (_request, file, callback) => {
          const extension = extname(file.originalname || '').toLowerCase() || '.jpg';
          callback(null, `${Date.now()}-${randomUUID()}${extension}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (!allowedImageTypes.has(file.mimetype)) {
          callback(new BadRequestException('Solo se permiten imagenes JPG, PNG o WEBP.'), false);
          return;
        }

        callback(null, true);
      },
    }),
  )
  uploadImage(@Param('type') typeValue: string, @UploadedFile() file: any) {
    const type = uploadTypeFor(typeValue);

    if (!file) {
      throw new BadRequestException('No se recibio ninguna imagen.');
    }

    const path = `/uploads/admin/${type}/${file.filename}`;

    return {
      url: path,
      path,
    };
  }

  @Get('dashboard')
  async dashboard() {
    const [polls, users, artists, missions] = await Promise.all([
      this.prisma.poll.findMany({ take: 100, orderBy: { createdAt: 'desc' }, include: { category: true } }),
      this.prisma.user.findMany({ take: 100, orderBy: { createdAt: 'desc' } }),
      this.prisma.artist.findMany({ take: 100, orderBy: { createdAt: 'desc' } }),
      this.prisma.mission.findMany({ take: 100, orderBy: [{ order: 'asc' }, { createdAt: 'desc' }] }),
    ]);
    return serialize({ polls, users, artists, missions });
  }

  @Get('users')
  async users(@Query('limit') limit = '100') {
    return serialize(await this.prisma.user.findMany({ take: Math.min(Number(limit) || 100, 500), orderBy: { createdAt: 'desc' } }));
  }

  @Patch('users/:id')
  async updateUser(@Param('id') id: string, @Body() body: any) {
    const userId = toBigInt(id);
    const requestedPoints = body.points === undefined ? undefined : toBigInt(body.points);

    const result = await this.prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({ where: { id: userId } });
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          role: body.role,
          points: requestedPoints,
          displayName: body.displayName,
          username: body.username,
        },
      });

      const pointsDelta = requestedPoints === undefined || !currentUser
        ? BigInt(0)
        : requestedPoints - currentUser.points;

      if (currentUser && pointsDelta > BigInt(0)) {
        await tx.notification.create({
          data: {
            userId,
            type: 'admin_points_gift',
            payload: {
              amount: pointsDelta.toString(),
              pointsBefore: currentUser.points.toString(),
              pointsAfter: updatedUser.points.toString(),
              title: 'Te enviaron un regalo',
              message: `Recibiste ${pointsDelta.toString()} puntos de regalo.`,
            },
          },
        });
      }

      return { updatedUser, pointsDelta };
    });

    if (result.pointsDelta > BigInt(0)) {
      await this.publishUserEvent(userId, {
        type: 'points_gift',
        amount: result.pointsDelta.toString(),
        points: Number(result.updatedUser.points),
        title: 'Te enviaron un regalo',
        message: `Recibiste ${result.pointsDelta.toString()} puntos de regalo.`,
      });
    }

    return serialize(result.updatedUser);
  }

  @Get('artists')
  async artists(@Query('limit') limit = '250') {
    return serialize(await this.prisma.artist.findMany({ take: Math.min(Number(limit) || 250, 500), orderBy: { createdAt: 'desc' } }));
  }

  @Post('artists')
  async createArtist(@Body() body: any) {
    return serialize(await this.prisma.artist.create({
      data: {
        name: body.name,
        slug: body.slug || null,
        photoUrl: body.photoUrl || body.imageUrl || null,
        country: body.country || null,
        genre: body.genre || null,
        followersCount: toBigInt(body.followersCount || 0),
        totalVotes: toBigInt(body.totalVotes || 0),
        popularityScore: toBigInt(body.popularityScore || 0),
        metadata: body,
      },
    }));
  }

  @Patch('artists/:id')
  async updateArtist(@Param('id') id: string, @Body() body: any) {
    return serialize(await this.prisma.artist.update({
      where: { id: toBigInt(id) },
      data: {
        name: body.name,
        slug: body.slug,
        photoUrl: body.photoUrl || body.imageUrl,
        country: body.country,
        genre: body.genre,
        followersCount: body.followersCount === undefined ? undefined : toBigInt(body.followersCount),
        totalVotes: body.totalVotes === undefined ? undefined : toBigInt(body.totalVotes),
        popularityScore: body.popularityScore === undefined ? undefined : toBigInt(body.popularityScore),
        metadata: body,
      },
    }));
  }

  @Delete('artists/:id')
  async deleteArtist(@Param('id') id: string) {
    await this.prisma.artist.delete({ where: { id: toBigInt(id) } });
    return { ok: true };
  }

  @Get('poll-categories')
  async categories() {
    return serialize(await this.prisma.pollCategory.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'desc' }] }));
  }

  @Post('poll-categories')
  async createCategory(@Body() body: any) {
    return serialize(await this.prisma.pollCategory.create({
      data: { slug: body.slug || null, name: body.name, description: body.description || null, active: body.active !== false, order: Number(body.order || 0), metadata: body },
    }));
  }

  @Patch('poll-categories/:id')
  async updateCategory(@Param('id') id: string, @Body() body: any) {
    return serialize(await this.prisma.pollCategory.update({
      where: { id: toBigInt(id) },
      data: { slug: body.slug, name: body.name, description: body.description, active: body.active, order: body.order === undefined ? undefined : Number(body.order), metadata: body },
    }));
  }

  @Delete('poll-categories/:id')
  async deleteCategory(@Param('id') id: string) {
    await this.prisma.pollCategory.delete({ where: { id: toBigInt(id) } });
    return { ok: true };
  }

  @Get('polls')
  async polls(@Query('limit') limit = '100') {
    return serialize(await this.prisma.poll.findMany({
      take: Math.min(Number(limit) || 100, 500),
      orderBy: { createdAt: 'desc' },
      include: { category: true, rounds: { orderBy: { createdAt: 'asc' } }, contestants: { include: { artist: true } } },
    }));
  }

  @Post('polls')
  async createPoll(@Body() body: any) {
    return serialize(await this.prisma.poll.create({
      data: {
        categoryId: body.categoryId ? toBigInt(body.categoryId) : null,
        slug: body.slug || null,
        title: body.title || body.name,
        description: body.description || null,
        status: statusFor(body.status),
        type: roundTypeFor(body.type),
        config: body,
        startsAt: toDate(body.startsAt || body.startAt),
        endsAt: toDate(body.endsAt || body.endAt),
        activeEndAt: toDate(body.activeEndAt),
      },
    }));
  }

  @Patch('polls/:id')
  async updatePoll(@Param('id') id: string, @Body() body: any) {
    const poll = await this.prisma.poll.update({
      where: { id: toBigInt(id) },
      data: {
        categoryId: body.categoryId === undefined ? undefined : (body.categoryId ? toBigInt(body.categoryId) : null),
        slug: body.slug,
        title: body.title || body.name,
        description: body.description,
        status: body.status ? statusFor(body.status) : undefined,
        type: body.type ? roundTypeFor(body.type) : undefined,
        config: body,
        startsAt: body.startsAt || body.startAt ? toDate(body.startsAt || body.startAt) : undefined,
        endsAt: body.endsAt || body.endAt ? toDate(body.endsAt || body.endAt) : undefined,
        activeEndAt: body.activeEndAt ? toDate(body.activeEndAt) : undefined,
      },
    });

    if (body.status) {
      await this.publishPollState(poll.id, {
        reason: 'poll_status',
        status: poll.status,
        activeRoundId: body.activeRoundId ? String(body.activeRoundId) : null,
      });
    }

    return serialize(poll);
  }

  @Delete('polls/:id')
  async deletePoll(@Param('id') id: string) {
    await this.prisma.poll.delete({ where: { id: toBigInt(id) } });
    return { ok: true };
  }

  @Post('polls/:pollId/contestants')
  async createContestant(@Param('pollId') pollId: string, @Body() body: any) {
    return serialize(await this.prisma.contestant.create({
      data: {
        pollId: toBigInt(pollId),
        roundId: body.roundId ? toBigInt(body.roundId) : null,
        artistId: toBigInt(body.artistId),
        votes: toBigInt(body.votes || 0),
        manualVotes: toBigInt(body.manualVotes || 0),
        matchGroup: Number(body.matchGroup || 0),
        matchOrder: Number(body.matchOrder || 0),
        order: Number(body.order || 0),
        metadata: body,
      },
      include: { artist: true },
    }));
  }

  @Patch('polls/:pollId/contestants/:id')
  async updateContestant(@Param('id') id: string, @Body() body: any) {
    return serialize(await this.prisma.contestant.update({
      where: { id: toBigInt(id) },
      data: {
        votes: body.votes === undefined ? undefined : toBigInt(body.votes),
        manualVotes: body.manualVotes === undefined ? undefined : toBigInt(body.manualVotes),
        matchGroup: body.matchGroup === undefined ? undefined : Number(body.matchGroup || 0),
        matchOrder: body.matchOrder === undefined ? undefined : Number(body.matchOrder || 0),
        order: body.order === undefined ? undefined : Number(body.order || 0),
        metadata: body.metadata || body,
      },
      include: { artist: true },
    }));
  }

  @Delete('polls/:pollId/contestants/:id')
  async deleteContestant(@Param('id') id: string) {
    await this.prisma.contestant.delete({ where: { id: toBigInt(id) } });
    return { ok: true };
  }

  @Get('polls/:pollId/rounds')
  async rounds(@Param('pollId') pollId: string) {
    return serialize(await this.prisma.round.findMany({ where: { pollId: toBigInt(pollId) }, orderBy: { createdAt: 'asc' }, include: { contestants: { include: { artist: true } } } }));
  }

  @Post('polls/:pollId/rounds')
  async createRound(@Param('pollId') pollId: string, @Body() body: any) {
    return serialize(await this.prisma.round.create({
      data: { pollId: toBigInt(pollId), title: body.title || body.name || null, type: roundTypeFor(body.type), status: statusFor(body.status), config: body, startsAt: toDate(body.startsAt || body.startAt), endsAt: endDateFor(body) ?? null },
    }));
  }

  @Patch('polls/:pollId/rounds/:id')
  async updateRound(@Param('pollId') pollId: string, @Param('id') id: string, @Body() body: any) {
    const endsAt = endDateFor(body);

    const round = await this.prisma.round.update({
      where: { id: toBigInt(id) },
      data: { title: body.title || body.name, type: body.type ? roundTypeFor(body.type) : undefined, status: body.status ? statusFor(body.status) : undefined, config: body, startsAt: body.startsAt || body.startAt ? toDate(body.startsAt || body.startAt) : undefined, endsAt },
    });

    if (body.status) {
      await this.publishPollState(pollId, {
        reason: 'round_status',
        roundId: round.id.toString(),
        roundStatus: round.status,
      });
    }

    return serialize(round);
  }

  @Delete('polls/:pollId/rounds/:id')
  async deleteRound(@Param('pollId') pollId: string, @Param('id') id: string) {
    const round = await this.prisma.round.findFirst({
      where: {
        id: toBigInt(id),
        pollId: toBigInt(pollId),
      },
      select: { id: true, status: true },
    });

    if (!round) {
      throw new NotFoundException('La fase no existe.');
    }

    if (round.status !== PollStatus.draft) {
      throw new BadRequestException('Solo se puede eliminar una fase que aun no fue lanzada.');
    }

    await this.prisma.round.delete({ where: { id: round.id } });
    return { ok: true };
  }

  @Post('polls/:pollId/contestants/:id/manual-votes')
  async adjustManualVotes(
    @Param('pollId') pollId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const amount = Math.trunc(Number(body.amount || 0));
    if (!amount) {
      throw new BadRequestException('La cantidad de votos debe ser distinta de cero.');
    }

    const contestant = await this.prisma.contestant.findUnique({ where: { id: toBigInt(id) } });
    if (!contestant) {
      throw new BadRequestException('El participante no existe.');
    }

    const nextManual = Number(contestant.manualVotes) + amount;
    if (nextManual < 0) {
      throw new BadRequestException('Los votos no pueden quedar en negativo.');
    }

    const updated = await this.prisma.contestant.update({
      where: { id: contestant.id },
      data: { manualVotes: { increment: amount } },
      include: { artist: true },
    });

    await this.prisma.poll.update({
      where: { id: toBigInt(pollId) },
      data: { totalVotes: { increment: amount } },
    });

    return serialize(updated);
  }

  @Post('polls/:pollId/rounds/:roundId/finish')
  async finishRound(
    @Param('pollId') pollId: string,
    @Param('roundId') roundId: string,
    @Body() body: any,
  ) {
    const pollIdBig = toBigInt(pollId);
    const roundIdBig = toBigInt(roundId);
    const winnerIds: string[] = Array.isArray(body.winnerIds) ? body.winnerIds.map(String) : [];

    if (!winnerIds.length) {
      throw new BadRequestException('Debes seleccionar al menos un ganador.');
    }

    const round = await this.prisma.round.findUnique({ where: { id: roundIdBig } });
    if (!round) {
      throw new BadRequestException('La ronda no existe.');
    }

    const contestants = await this.prisma.contestant.findMany({
      where: { pollId: pollIdBig, roundId: roundIdBig },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const contestant of contestants) {
        const winnerIndex = winnerIds.indexOf(contestant.artistId.toString());
        const metadata = {
          ...((contestant.metadata as Record<string, unknown>) || {}),
          isWinner: winnerIndex >= 0,
          winnerRank: winnerIndex >= 0 ? winnerIndex + 1 : null,
        };
        await tx.contestant.update({ where: { id: contestant.id }, data: { metadata: metadata as any } });
      }

      const roundConfig = {
        ...((round.config as Record<string, unknown>) || {}),
        winnerIds,
        winnerCount: winnerIds.length,
        winnersSelectedAt: new Date().toISOString(),
      };
      await tx.round.update({
        where: { id: roundIdBig },
        data: { status: PollStatus.closed, config: roundConfig as any },
      });

      const poll = await tx.poll.findUnique({ where: { id: pollIdBig } });
      const pollConfig = {
        ...((poll?.config as Record<string, unknown>) || {}),
        activeRoundId: null,
        winnersStatus: 'pending',
      };
      await tx.poll.update({
        where: { id: pollIdBig },
        data: { status: PollStatus.selecting_winners, activeEndAt: null, config: pollConfig as any },
      });
    });

    await this.publishPollState(pollId, {
      reason: 'round_finished',
      roundId: roundId,
      status: PollStatus.selecting_winners,
      winnerIds,
    });

    return { ok: true, winnerIds };
  }

  @Post('polls/:pollId/rounds/:roundId/launch')
  async launchRound(@Param('pollId') pollId: string, @Param('roundId') roundId: string) {
    const pollIdBig = toBigInt(pollId);
    const roundIdBig = toBigInt(roundId);

    const rounds = await this.prisma.round.findMany({
      where: { pollId: pollIdBig },
      orderBy: { createdAt: 'asc' },
    });

    const index = rounds.findIndex((round) => round.id === roundIdBig);
    if (index === -1) {
      throw new NotFoundException('La ronda no existe.');
    }

    // Regla: no se puede lanzar una fase si una fase anterior no esta cerrada con ganadores.
    for (let i = 0; i < index; i += 1) {
      const previous = rounds[i];
      const winnerIds = ((previous.config as Record<string, unknown>)?.winnerIds as unknown[]) || [];
      if (previous.status !== PollStatus.closed || winnerIds.length === 0) {
        throw new BadRequestException('Debes elegir los ganadores de la fase anterior antes de lanzar esta.');
      }
    }

    const target = rounds[index];
    const shouldResetVotesOnLaunch = target.status === PollStatus.draft;

    await this.prisma.$transaction(async (tx) => {
      if (shouldResetVotesOnLaunch) {
        await tx.contestant.updateMany({
          where: { pollId: pollIdBig, roundId: roundIdBig },
          data: {
            votes: 0,
            manualVotes: 0,
          },
        });
      }

      for (const round of rounds) {
        if (round.id === roundIdBig) {
          const config = {
            ...((round.config as Record<string, unknown>) || {}),
            liveStartedAt: new Date().toISOString(),
          };
          await tx.round.update({ where: { id: round.id }, data: { status: PollStatus.live, config: config as any } });
        } else if (round.status === PollStatus.live) {
          await tx.round.update({ where: { id: round.id }, data: { status: PollStatus.closed } });
        }
      }

      const poll = await tx.poll.findUnique({ where: { id: pollIdBig } });
      const pollConfig = {
        ...((poll?.config as Record<string, unknown>) || {}),
        activeRoundId: target.id.toString(),
      };
      await tx.poll.update({
        where: { id: pollIdBig },
        data: { status: PollStatus.live, activeEndAt: target.endsAt, config: pollConfig as any },
      });
    });

    if (shouldResetVotesOnLaunch) {
      const pollKey = pollIdBig.toString();
      const roundKey = roundIdBig.toString();
      await this.redis.client.del(
        `votes:poll:${pollKey}:round:${roundKey}`,
        `ranking:poll:${pollKey}:round:${roundKey}`,
      );
    }

    await this.publishPollState(pollId, {
      reason: 'round_launched',
      roundId,
      status: PollStatus.live,
      activeRoundId: roundId,
    });

    return { ok: true };
  }

  @Post('polls/:pollId/close')
  async closePoll(@Param('pollId') pollId: string) {
    const poll = await this.prisma.poll.findUnique({ where: { id: toBigInt(pollId) } });
    const pollConfig = {
      ...((poll?.config as Record<string, unknown>) || {}),
      activeRoundId: null,
    };

    const updated = await this.prisma.poll.update({
      where: { id: toBigInt(pollId) },
      data: { status: PollStatus.closed, activeEndAt: null, config: pollConfig as any },
    });

    await this.publishPollState(pollId, { reason: 'poll_closed', status: PollStatus.closed });

    return serialize(updated);
  }

  @Post('polls/:pollId/rounds/:roundId/generate-versus')
  async generateVersus(@Param('pollId') pollId: string, @Param('roundId') roundId: string) {
    const contestants = await this.prisma.contestant.findMany({
      where: { pollId: toBigInt(pollId), roundId: toBigInt(roundId) },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    await this.prisma.$transaction(async (tx) => {
      let group = 0;
      for (let i = 0; i < contestants.length; i += 2) {
        group += 1;
        await tx.contestant.update({
          where: { id: contestants[i].id },
          data: { matchGroup: group, matchOrder: 0 },
        });
        if (contestants[i + 1]) {
          await tx.contestant.update({
            where: { id: contestants[i + 1].id },
            data: { matchGroup: group, matchOrder: 1 },
          });
        }
      }
    });

    await this.publishPollState(pollId, { reason: 'versus_generated', roundId });

    return { ok: true, groups: Math.ceil(contestants.length / 2) };
  }

  @Get('missions')
  async missions() {
    return serialize(await this.prisma.mission.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'desc' }] }));
  }

  @Post('missions')
  async createMission(@Body() body: any) {
    return serialize(await this.prisma.mission.create({
      data: { title: body.title, description: body.description || null, type: body.type || 'manual', icon: body.icon || null, actionUrl: body.actionUrl || null, rewardPoints: Number(body.rewardPoints || 0), target: Number(body.target || 1), active: body.active !== false, featured: Boolean(body.featured), order: Number(body.order || 0), metadata: body },
    }));
  }

  @Patch('missions/:id')
  async updateMission(@Param('id') id: string, @Body() body: any) {
    return serialize(await this.prisma.mission.update({
      where: { id: toBigInt(id) },
      data: { title: body.title, description: body.description, type: body.type, icon: body.icon, actionUrl: body.actionUrl, rewardPoints: body.rewardPoints === undefined ? undefined : Number(body.rewardPoints), target: body.target === undefined ? undefined : Number(body.target), active: body.active, featured: body.featured, order: body.order === undefined ? undefined : Number(body.order), metadata: body },
    }));
  }

  @Delete('missions/:id')
  async deleteMission(@Param('id') id: string) {
    await this.prisma.mission.delete({ where: { id: toBigInt(id) } });
    return { ok: true };
  }
}
