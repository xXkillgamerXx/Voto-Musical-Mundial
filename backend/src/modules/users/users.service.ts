import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { allowsCampaignEmail } from '../../common/email-preferences';
import { serialize } from '../../common/serialize';
import { ModerationService } from '../admin/moderation.service';
import { MissionProgressService } from '../missions/mission-progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { FanService } from '../fan/fan.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly missionProgress: MissionProgressService,
    private readonly moderation: ModerationService,
    private readonly fan: FanService,
  ) {}

  private readonly publicSelect = {
    id: true,
    username: true,
    email: true,
    displayName: true,
    photoUrl: true,
    role: true,
    points: true,
    spentPoints: true,
    referralCode: true,
    referralSignups: true,
    referralPoints: true,
    dailyRewardStreak: true,
    dailyRewardStreakDay: true,
    lastDailyRewardClaimDate: true,
    emailVerifiedAt: true,
    metadata: true,
    followingArtists: {
      include: { artist: true },
      orderBy: { createdAt: 'desc' },
    },
  } as const;

  async findById(id: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.publicSelect,
    });

    if (!user) throw new NotFoundException('Usuario no encontrado.');
    const accountBlock = await this.moderation.getActiveUserBlock(id.toString());
    return await this.profilePayload(user, true, accountBlock);
  }

  async findPublicByUsername(username: string) {
    const user = await this.prisma.user.findFirst({
      where: { username: username.toLowerCase().trim() },
      select: this.publicSelect,
    });

    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return await this.profilePayload(user, false);
  }

  async updateProfile(id: bigint, body: any) {
    const normalizedUsername = body?.username ? String(body.username).toLowerCase().trim() : undefined;

    if (normalizedUsername && !this.isValidUsername(normalizedUsername)) {
      throw new ConflictException('Username invalido.');
    }

    if (normalizedUsername) {
      const existing = await this.prisma.user.findFirst({
        where: { username: normalizedUsername, NOT: { id } },
        select: { id: true },
      });
      if (existing) throw new ConflictException('Ese username ya esta en uso.');
    }

    const current = await this.prisma.user.findUnique({ where: { id }, select: { metadata: true } });
    const currentMeta =
      current?.metadata && typeof current.metadata === 'object' && !Array.isArray(current.metadata)
        ? (current.metadata as Record<string, unknown>)
        : {};
    const metadata: Record<string, unknown> = { ...currentMeta };

    if (Object.prototype.hasOwnProperty.call(body || {}, 'country')) {
      metadata.country = String(body.country || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'bio')) {
      metadata.bio = String(body.bio || '').trim();
    }
    if (
      Object.prototype.hasOwnProperty.call(body || {}, 'banner') ||
      Object.prototype.hasOwnProperty.call(body || {}, 'bannerUrl')
    ) {
      metadata.banner = String(body?.banner || body?.bannerUrl || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'emailCampaigns')) {
      metadata.emailCampaigns = Boolean(body.emailCampaigns);
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'locale')) {
      const raw = String(body.locale || '')
        .trim()
        .toLowerCase();
      metadata.locale = raw.startsWith('es') ? 'es' : 'en';
    }

    const data: Record<string, unknown> = {
      metadata: metadata as any,
    };

    if (normalizedUsername) {
      data.username = normalizedUsername;
    }

    const nextDisplayName = String(body?.displayName || body?.name || '').trim();
    if (nextDisplayName) {
      data.displayName = nextDisplayName;
    }

    if (Object.prototype.hasOwnProperty.call(body || {}, 'photoUrl') ||
        Object.prototype.hasOwnProperty.call(body || {}, 'photoURL')) {
      data.photoUrl = String(body?.photoUrl || body?.photoURL || '').trim() || null;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: data as any,
      select: this.publicSelect,
    });

    void this.missionProgress.trackProfileComplete(updated).catch(() => {});

    const accountBlock = await this.moderation.getActiveUserBlock(id.toString());
    return await this.profilePayload(updated, true, accountBlock);
  }

  async checkUsername(username: string, currentUserId: bigint) {
    const normalizedUsername = username.toLowerCase().trim();

    if (!this.isValidUsername(normalizedUsername)) {
      return {
        username: normalizedUsername,
        valid: false,
        available: false,
        message: 'Usa 3 a 32 caracteres: letras, numeros o guion bajo.',
      };
    }

    const existing = await this.prisma.user.findFirst({
      where: { username: normalizedUsername, NOT: { id: currentUserId } },
      select: { id: true },
    });

    return {
      username: normalizedUsername,
      valid: true,
      available: !existing,
      message: existing ? 'Ese username ya esta en uso.' : 'Username disponible.',
    };
  }

  async referral(userId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        referralCode: true,
        username: true,
        referralSignups: true,
        referralPoints: true,
      },
    });

    void this.missionProgress.trackReferralShare(userId).catch(() => {});

    return serialize(user);
  }

  private async profilePayload(user: any, includeEmail = true, accountBlock: any = null) {
    const metadata = (user.metadata as Record<string, unknown>) || {};
    const followedArtists = (user.followingArtists || [])
      .map((follow: any) => {
        const artist = follow.artist;
        const artistMetadata = (artist?.metadata as Record<string, unknown>) || {};
        const image = artist?.photoUrl || artistMetadata.image || artistMetadata.imageUrl || artistMetadata.photoUrl || artistMetadata.banner || '';

        return artist ? {
          id: follow.id,
          artistId: artist.id,
          artistSlug: artist.slug,
          artistName: artist.name,
          artistImage: image,
          artistPhoto: image,
          artistGroup: artistMetadata.group || artistMetadata.fandom || artist.genre || '',
          followedAt: follow.createdAt,
        } : null;
      })
      .filter(Boolean);

    return serialize({
      id: user.id,
      username: user.username,
      email: includeEmail ? user.email : null,
      displayName: user.displayName,
      name: metadata.name || user.displayName,
      photoUrl: user.photoUrl,
      photoURL: user.photoUrl,
      banner: metadata.banner || '',
      bannerUrl: metadata.banner || '',
      country: metadata.country || '',
      bio: metadata.bio || '',
      role: user.role,
      points: user.points,
      spentPoints: user.spentPoints,
      referralCode: user.referralCode,
      referralSignups: user.referralSignups,
      referralPoints: user.referralPoints,
      dailyRewardStreak: user.dailyRewardStreak,
      dailyRewardStreakDay: user.dailyRewardStreakDay,
      lastDailyRewardClaimDate: user.lastDailyRewardClaimDate,
      emailVerified: Boolean(user.emailVerifiedAt),
      emailCampaigns: includeEmail ? allowsCampaignEmail(metadata) : undefined,
      locale: String(metadata.locale || metadata.lang || metadata.language || '')
        .trim()
        .toLowerCase()
        .startsWith('es')
        ? 'es'
        : 'en',
      accountStatus: accountBlock?.blocked ? 'blocked' : 'active',
      accountBlock: accountBlock?.blocked ? accountBlock : null,
      followedArtists,
      fanMembership: includeEmail
        ? (await this.fan.getMembershipPayload(user.id)).membership
        : await this.fan.publicMembership(user.id),
    });
  }

  private isValidUsername(username: string) {
    return /^[a-zA-Z0-9_]{3,32}$/.test(username);
  }
}
