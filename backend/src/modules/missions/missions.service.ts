import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const missions = await this.prisma.mission.findMany({
      where: { active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return serialize(missions);
  }

  async findForUser(userId: bigint) {
    const missions = await this.prisma.mission.findMany({
      where: { active: true },
      include: {
        completions: {
          where: { userId },
          take: 1,
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return serialize(
      missions.map((mission) => {
        const completion = mission.completions[0] || null;
        const { completions, ...missionData } = mission;

        return {
          ...missionData,
          progress: completion?.progress || 0,
          completedAt: completion?.completedAt || null,
          rewardedAt: completion?.rewardedAt || null,
        };
      }),
    );
  }

  async complete(missionId: string, userId: bigint) {
    const mission = await this.prisma.mission.findFirst({
      where: {
        OR: [{ id: BigInt(Number(missionId) || 0) }, { firebaseId: missionId }],
        active: true,
      },
    });

    if (!mission) {
      throw new NotFoundException('La mision no existe.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const completion = await tx.missionCompletion.upsert({
        where: { missionId_userId: { missionId: mission.id, userId } },
        update: {
          progress: { increment: 1 },
        },
        create: {
          missionId: mission.id,
          userId,
          progress: 1,
        },
      });
      const nextProgress = Math.min(Math.max(completion.progress, 1), mission.target);

      if (completion.rewardedAt) {
        return { completion, awarded: false, pointsAfter: null };
      }

      if (nextProgress < mission.target) {
        const updatedCompletion = await tx.missionCompletion.update({
          where: { id: completion.id },
          data: { progress: nextProgress },
        });

        return { completion: updatedCompletion, awarded: false, pointsAfter: null };
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

      const updatedCompletion = await tx.missionCompletion.update({
        where: { id: completion.id },
        data: {
          progress: mission.target,
          completedAt: new Date(),
          rewardedAt: new Date(),
        },
      });

      return {
        completion: updatedCompletion,
        awarded: true,
        pointsAfter: updatedUser.points,
      };
    });

    return serialize({ mission, ...result });
  }

  assertManualMissionAllowed(type: string) {
    if (type === 'manual') {
      throw new BadRequestException('Esta mision requiere validacion manual de administrador.');
    }
  }
}
