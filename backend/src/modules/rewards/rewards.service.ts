import { BadRequestException, Injectable } from '@nestjs/common';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AppDownloadConfigService } from '../settings/app-download-config.service';
import { dailyRewardPointsMap } from './daily-rewards.config';
import { DailyRewardsConfigService } from './daily-rewards-config.service';

/** Puntos por video rewarded (debe coincidir con AdMobConfig.rewardedVideoPoints). */
const AD_REWARD_POINTS = 5;
/** Máximo de videos rewarded reclamables por día UTC. */
const AD_REWARD_DAILY_LIMIT = 5;

const APP_FIRST_OPEN_META_KEY = 'appFirstOpenRewardClaimedAt';

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyRewardsConfig: DailyRewardsConfigService,
    private readonly appDownloadConfig: AppDownloadConfigService,
    private readonly redis: RedisService,
  ) {}

  private adRewardKey(userId: bigint, day = new Date().toISOString().slice(0, 10)) {
    return `rewards:ad:${userId.toString()}:${day}`;
  }

  private secondsUntilUtcMidnight() {
    const now = Date.now();
    const tomorrow = Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth(),
      new Date(now).getUTCDate() + 1,
    );
    return Math.max(60, Math.ceil((tomorrow - now) / 1000));
  }

  async getAdRewardStatus(userId: bigint) {
    const raw = await this.redis.client.get(this.adRewardKey(userId));
    const claimed = Math.min(AD_REWARD_DAILY_LIMIT, Math.max(0, Number(raw || 0) || 0));
    return {
      pointsPerClaim: AD_REWARD_POINTS,
      dailyLimit: AD_REWARD_DAILY_LIMIT,
      claimedToday: claimed,
      remainingToday: Math.max(0, AD_REWARD_DAILY_LIMIT - claimed),
    };
  }

  async claimAdReward(userId: bigint) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Usuario no encontrado.');
    }

    const key = this.adRewardKey(userId);
    const claimed = await this.redis.client.incr(key);
    if (claimed === 1) {
      await this.redis.client.expire(key, this.secondsUntilUtcMidnight());
    }

    if (claimed > AD_REWARD_DAILY_LIMIT) {
      await this.redis.client.decr(key);
      throw new BadRequestException('Ya alcanzaste el límite de videos de hoy.');
    }

    const pointsBefore = Number(user.points || 0);
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { points: { increment: AD_REWARD_POINTS } },
      });

      return serialize({
        pointsAwarded: AD_REWARD_POINTS,
        pointsBefore,
        pointsAfter: Number(updatedUser.points || 0),
        dailyLimit: AD_REWARD_DAILY_LIMIT,
        claimedToday: claimed,
        remainingToday: Math.max(0, AD_REWARD_DAILY_LIMIT - claimed),
        user: updatedUser,
      });
    } catch (error) {
      await this.redis.client.decr(key);
      throw error;
    }
  }

  async claimAppFirstOpenReward(userId: bigint) {
    const config = await this.appDownloadConfig.getConfig();
    if (!config.firstOpenRewardEnabled || config.firstOpenRewardPoints <= 0) {
      throw new BadRequestException('El bonus de la app no está activo.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Usuario no encontrado.');
    }

    const metadata =
      user.metadata && typeof user.metadata === 'object' && !Array.isArray(user.metadata)
        ? { ...(user.metadata as Record<string, unknown>) }
        : {};

    if (metadata[APP_FIRST_OPEN_META_KEY]) {
      return serialize({
        alreadyClaimed: true,
        pointsAwarded: 0,
        pointsBefore: Number(user.points || 0),
        pointsAfter: Number(user.points || 0),
        user,
      });
    }

    const points = config.firstOpenRewardPoints;
    const pointsBefore = Number(user.points || 0);
    const claimedAt = new Date().toISOString();

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        points: { increment: points },
        metadata: {
          ...metadata,
          [APP_FIRST_OPEN_META_KEY]: claimedAt,
        } as any,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId,
        type: 'app_first_open_reward',
        payload: {
          title: 'Bienvenido a la app',
          message: `Entraste a la app por primera vez y ganaste ${points} puntos.`,
          amount: points,
          pointsBefore,
          pointsAfter: Number(updatedUser.points || 0),
          senderName: 'Music Mundial App',
          url: '/notificaciones',
        },
      },
    });

    return serialize({
      alreadyClaimed: false,
      pointsAwarded: points,
      pointsBefore,
      pointsAfter: Number(updatedUser.points || 0),
      user: updatedUser,
    });
  }

  async claimDaily(userId: bigint) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Usuario no encontrado.');
    }

    if (user.lastDailyRewardClaimDate === today) {
      throw new BadRequestException('Ya reclamaste la recompensa de hoy.');
    }

    const nextStreak = user.lastDailyRewardClaimDate === yesterday ? user.dailyRewardStreak + 1 : 1;
    const streakDay = ((nextStreak - 1) % 7) + 1;
    const rewardPoints = dailyRewardPointsMap(await this.dailyRewardsConfig.getSchedule());
    const points = rewardPoints[streakDay];

    if (!points) {
      throw new BadRequestException('La recompensa diaria no esta configurada.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const reward = await tx.dailyReward.create({
        data: {
          userId,
          claimDate: today,
          points,
          streak: nextStreak,
          streakDay,
        },
      });
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          points: { increment: points },
          dailyRewardStreak: nextStreak,
          dailyRewardStreakDay: streakDay,
          lastDailyRewardClaimDate: today,
        },
      });

      const streakMissions = await tx.mission.findMany({
        where: {
          active: true,
          type: 'daily_streak',
        },
      });
      let missionRewardPoints = 0;

      for (const mission of streakMissions) {
        const progress = Math.min(nextStreak, mission.target);
        const completion = await tx.missionCompletion.upsert({
          where: { missionId_userId: { missionId: mission.id, userId } },
          update: { progress },
          create: {
            missionId: mission.id,
            userId,
            progress,
          },
        });

        if (!completion.rewardedAt && progress >= mission.target) {
          missionRewardPoints += Number(mission.rewardPoints || 0);
          await tx.missionCompletion.update({
            where: { id: completion.id },
            data: {
              progress: mission.target,
              completedAt: new Date(),
              rewardedAt: new Date(),
            },
          });
          await tx.notification.create({
            data: {
              userId,
              type: 'mission_completed',
              payload: {
                title: 'Misión completada',
                message: `Completaste "${mission.title}" y ganaste ${mission.rewardPoints} puntos.`,
                missionId: mission.id.toString(),
                missionTitle: mission.title,
                rewardPoints: mission.rewardPoints,
                url: '/notificaciones',
              },
            },
          });
        }
      }

      const finalUser = missionRewardPoints
        ? await tx.user.update({
          where: { id: userId },
          data: { points: { increment: missionRewardPoints } },
        })
        : updatedUser;

      return {
        reward,
        user: finalUser,
        missionRewardPoints,
      };
    });

    return serialize(result);
  }
}
