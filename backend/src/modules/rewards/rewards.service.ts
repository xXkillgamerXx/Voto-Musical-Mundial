import { BadRequestException, Injectable } from '@nestjs/common';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';

const DAILY_REWARD_POINTS: Record<number, number> = {
  1: 10,
  2: 15,
  3: 20,
  4: 25,
  5: 30,
  6: 40,
  7: 50,
};

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const points = DAILY_REWARD_POINTS[streakDay];

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
                missionId: mission.id.toString(),
                rewardPoints: mission.rewardPoints,
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

      await tx.notification.create({
        data: {
          userId,
          type: 'daily_reward_claimed',
          payload: { points, streak: nextStreak, streakDay },
        },
      });

      return {
        reward,
        user: finalUser,
        missionRewardPoints,
      };
    });

    return serialize(result);
  }
}
