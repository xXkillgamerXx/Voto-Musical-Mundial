import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { serialize } from '../../common/serialize';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.profilePayload(user);
  }

  async findPublicByUsername(username: string) {
    const user = await this.prisma.user.findFirst({
      where: { username: username.toLowerCase().trim() },
      select: this.publicSelect,
    });

    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return this.profilePayload(user, false);
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
    const metadata = {
      ...((current?.metadata as Record<string, unknown>) || {}),
      country: String(body?.country || '').trim(),
      bio: String(body?.bio || '').trim(),
      banner: String(body?.banner || body?.bannerUrl || '').trim(),
    };
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        username: normalizedUsername,
        displayName: String(body?.displayName || body?.name || '').trim() || undefined,
        photoUrl: String(body?.photoUrl || body?.photoURL || '').trim() || null,
        metadata: metadata as any,
      },
      select: this.publicSelect,
    });

    return this.profilePayload(updated);
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

    return serialize(user);
  }

  private profilePayload(user: any, includeEmail = true) {
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
      followedArtists,
    });
  }

  private isValidUsername(username: string) {
    return /^[a-zA-Z0-9_]{3,32}$/.test(username);
  }
}
