import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PollStatus, RoundType, UserRole } from '@prisma/client';
import { serialize } from '../../common/serialize';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

const toBigInt = (value?: string | number | bigint | null) => BigInt(Number(value || 0));
const toDate = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};
const statusFor = (value: unknown) =>
  Object.values(PollStatus).includes(value as PollStatus) ? (value as PollStatus) : PollStatus.draft;
const roundTypeFor = (value: unknown) =>
  Object.values(RoundType).includes(value as RoundType) ? (value as RoundType) : RoundType.standard;

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.superadmin, UserRole.owner)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

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
    return serialize(await this.prisma.user.update({
      where: { id: toBigInt(id) },
      data: {
        role: body.role,
        points: body.points === undefined ? undefined : toBigInt(body.points),
        displayName: body.displayName,
        username: body.username,
      },
    }));
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
    return serialize(await this.prisma.poll.update({
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
    }));
  }

  @Delete('polls/:id')
  async deletePoll(@Param('id') id: string) {
    await this.prisma.poll.delete({ where: { id: toBigInt(id) } });
    return { ok: true };
  }

  @Get('polls/:pollId/rounds')
  async rounds(@Param('pollId') pollId: string) {
    return serialize(await this.prisma.round.findMany({ where: { pollId: toBigInt(pollId) }, orderBy: { createdAt: 'asc' }, include: { contestants: { include: { artist: true } } } }));
  }

  @Post('polls/:pollId/rounds')
  async createRound(@Param('pollId') pollId: string, @Body() body: any) {
    return serialize(await this.prisma.round.create({
      data: { pollId: toBigInt(pollId), title: body.title || body.name || null, type: roundTypeFor(body.type), status: statusFor(body.status), config: body, startsAt: toDate(body.startsAt || body.startAt), endsAt: toDate(body.endsAt || body.endAt) },
    }));
  }

  @Patch('polls/:pollId/rounds/:id')
  async updateRound(@Param('id') id: string, @Body() body: any) {
    return serialize(await this.prisma.round.update({
      where: { id: toBigInt(id) },
      data: { title: body.title || body.name, type: body.type ? roundTypeFor(body.type) : undefined, status: body.status ? statusFor(body.status) : undefined, config: body, startsAt: body.startsAt || body.startAt ? toDate(body.startsAt || body.startAt) : undefined, endsAt: body.endsAt || body.endAt ? toDate(body.endsAt || body.endAt) : undefined },
    }));
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
