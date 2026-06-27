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

      await tx.notification.create({
        data: {
          userId,
          type: 'daily_reward_claimed',
          payload: { points, streak: nextStreak, streakDay },
        },
      });

      return { reward, user: updatedUser };
    });

    return serialize(result);
  }
}
