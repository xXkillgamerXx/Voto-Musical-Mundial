import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export const SERVER_MANAGED_MISSION_TYPES = new Set([
  'referral_signup',
  'referral_signup_milestone',
  'referral_first_vote',
  'referral_share',
  'daily_streak',
  'daily_login',
  'daily_open',
  'daily_view_polls',
  'daily_poll',
  'visit_page',
  'follow_social',
  'like_social_post',
  'comment_social_post',
  'vote_count',
  'follow_artist',
  'complete_profile',
  'share_whatsapp',
  'share_facebook',
  'share_twitter',
  'share_instagram_story',
  'share_poll',
]);

export const MISSION_VISIT_TYPES = new Set([
  'visit_page',
  'follow_social',
  'like_social_post',
  'comment_social_post',
]);

const SHARE_PLATFORM_MISSION_TYPES: Record<string, string> = {
  whatsapp: 'share_whatsapp',
  facebook: 'share_facebook',
  twitter: 'share_twitter',
  x: 'share_twitter',
  instagram: 'share_instagram_story',
  more: 'share_poll',
};

const utcDayKey = () => new Date().toISOString().slice(0, 10);

type MissionAwardResult = {
  awarded: boolean;
  progress: number;
  pointsAfter: number | null;
  missionId: string;
};

@Injectable()
export class MissionProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  isServerManaged(type: string) {
    return SERVER_MANAGED_MISSION_TYPES.has(String(type || '').trim());
  }

  isVisitType(type: string) {
    return MISSION_VISIT_TYPES.has(String(type || '').trim());
  }

  async progressForTypes(userId: bigint, types: string[], increment = 1) {
    if (!types.length || increment <= 0) {
      return [];
    }

    const uniqueTypes = [...new Set(types.map((type) => String(type || '').trim()).filter(Boolean))];
    const missions = await this.prisma.mission.findMany({
      where: { active: true, type: { in: uniqueTypes } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    const results: MissionAwardResult[] = [];
    for (const mission of missions) {
      results.push(await this.awardProgress(mission, userId, increment));
    }

    return results;
  }

  async progressForTypesInTx(
    tx: Prisma.TransactionClient,
    userId: bigint,
    types: string[],
    increment = 1,
  ) {
    if (!types.length || increment <= 0) {
      return [];
    }

    const uniqueTypes = [...new Set(types.map((type) => String(type || '').trim()).filter(Boolean))];
    const missions = await tx.mission.findMany({
      where: { active: true, type: { in: uniqueTypes } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    const results: MissionAwardResult[] = [];
    for (const mission of missions) {
      results.push(await this.awardProgress(mission, userId, increment, tx));
    }

    return results;
  }

  async progressDailyForTypes(userId: bigint, types: string[]) {
    const day = utcDayKey();
    const pendingTypes: string[] = [];

    for (const type of types) {
      const normalized = String(type || '').trim();
      if (!normalized) {
        continue;
      }

      const redisKey = `mission:daily:${normalized}:${userId.toString()}:${day}`;
      const inserted = await this.redis.client.set(redisKey, '1', 'EX', 86400, 'NX');
      if (inserted) {
        pendingTypes.push(normalized);
      }
    }

    if (!pendingTypes.length) {
      return [];
    }

    return this.progressForTypes(userId, pendingTypes, 1);
  }

  async trackLogin(userId: bigint) {
    return this.progressDailyForTypes(userId, ['daily_login']);
  }

  async trackAppOpen(userId: bigint) {
    return this.progressDailyForTypes(userId, ['daily_open']);
  }

  async trackPollView(userId: bigint) {
    return this.progressDailyForTypes(userId, ['daily_view_polls']);
  }

  async trackReferralShare(userId: bigint) {
    return this.progressDailyForTypes(userId, ['referral_share']);
  }

  async trackVote(userId: bigint, amount = 1) {
    const increment = Math.max(1, Math.floor(Number(amount) || 1));
    await this.progressDailyForTypes(userId, ['daily_poll']);
    await this.progressForTypes(userId, ['vote_count'], increment);
    await this.trackReferralFirstVote(userId);
  }

  async trackArtistFollow(userId: bigint) {
    return this.progressForTypes(userId, ['follow_artist'], 1);
  }

  async trackShareClaim(userId: bigint, platform?: string) {
    const normalized = String(platform || 'more').toLowerCase();
    const missionType = SHARE_PLATFORM_MISSION_TYPES[normalized] || 'share_poll';
    return this.progressForTypes(userId, [missionType, 'share_poll'], 1);
  }

  async trackProfileComplete(user: {
    id: bigint;
    username?: string | null;
    displayName?: string | null;
    photoUrl?: string | null;
    metadata?: unknown;
  }) {
    if (!this.isProfileComplete(user)) {
      return [];
    }

    const redisKey = `mission:profile-complete:${user.id.toString()}`;
    const inserted = await this.redis.client.set(redisKey, '1', 'NX');
    if (!inserted) {
      return [];
    }

    return this.progressForTypes(user.id, ['complete_profile'], 1);
  }

  isProfileComplete(user: {
    username?: string | null;
    displayName?: string | null;
    photoUrl?: string | null;
    metadata?: unknown;
  }) {
    const metadata =
      user.metadata && typeof user.metadata === 'object' && !Array.isArray(user.metadata)
        ? (user.metadata as Record<string, unknown>)
        : {};
    const username = String(user.username || '').trim();
    const displayName = String(user.displayName || '').trim();
    const photoUrl = String(user.photoUrl || '').trim();
    const country = String(metadata.country || '').trim();
    const bio = String(metadata.bio || '').trim();

    return Boolean(username.length >= 3 && displayName && photoUrl && country && bio);
  }

  private async trackReferralFirstVote(voterUserId: bigint) {
    const signup = await this.prisma.referralSignup.findFirst({
      where: { userId: voterUserId },
      select: { referrerId: true },
    });

    if (!signup?.referrerId) {
      return [];
    }

    const redisKey = `mission:referral-first-vote:${voterUserId.toString()}`;
    const inserted = await this.redis.client.set(redisKey, signup.referrerId.toString(), 'NX');
    if (!inserted) {
      return [];
    }

    return this.progressForTypes(signup.referrerId, ['referral_first_vote'], 1);
  }

  private async awardProgress(
    mission: { id: bigint; title: string; rewardPoints: number; target: number },
    userId: bigint,
    increment: number,
    tx?: Prisma.TransactionClient,
  ): Promise<MissionAwardResult> {
    const result = await (tx
      ? this.runAwardInTx(tx, mission, userId, increment)
      : this.runAward(mission, userId, increment));

    const serialized = serialize({ missionId: mission.id.toString(), ...result });

    return {
      missionId: String(serialized.missionId),
      awarded: Boolean(serialized.awarded),
      progress: Number(serialized.progress || 0),
      pointsAfter:
        serialized.pointsAfter == null ? null : Number(serialized.pointsAfter),
    };
  }

  private async runAward(
    mission: { id: bigint; title: string; rewardPoints: number; target: number },
    userId: bigint,
    increment: number,
  ) {
    return this.prisma.$transaction(async (tx) => this.runAwardInTx(tx, mission, userId, increment));
  }

  private async runAwardInTx(
    tx: Prisma.TransactionClient,
    mission: { id: bigint; title: string; rewardPoints: number; target: number },
    userId: bigint,
    increment: number,
  ) {
    const existing = await tx.missionCompletion.findUnique({
      where: { missionId_userId: { missionId: mission.id, userId } },
    });

    if (existing?.rewardedAt) {
      return { awarded: false, progress: mission.target, pointsAfter: null };
    }

    const nextProgress = Math.min(
      mission.target,
      Math.max(0, Number(existing?.progress || 0) + Math.max(1, increment)),
    );

    const completion = existing
      ? await tx.missionCompletion.update({
          where: { id: existing.id },
          data: { progress: nextProgress },
        })
      : await tx.missionCompletion.create({
          data: {
            missionId: mission.id,
            userId,
            progress: nextProgress,
          },
        });

    if (nextProgress < mission.target) {
      return { awarded: false, progress: nextProgress, pointsAfter: null };
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { points: { increment: mission.rewardPoints } },
    });

    await tx.notification.create({
      data: {
        userId,
        type: 'mission_completed',
        payload: {
          title: 'Mision completada',
          message: `Completaste "${mission.title}" y ganaste ${mission.rewardPoints} puntos.`,
          missionId: mission.id.toString(),
          missionTitle: mission.title,
          rewardPoints: mission.rewardPoints,
          pointsAfter: updatedUser.points.toString(),
          url: '/notificaciones',
        },
      },
    });

    await tx.missionCompletion.update({
      where: { id: completion.id },
      data: {
        progress: mission.target,
        completedAt: new Date(),
        rewardedAt: new Date(),
      },
    });

    return {
      awarded: true,
      progress: mission.target,
      pointsAfter: updatedUser.points,
    };
  }
}
