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
        return completion;
      }

      if (nextProgress < mission.target) {
        return tx.missionCompletion.update({
          where: { id: completion.id },
          data: { progress: nextProgress },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { points: { increment: mission.rewardPoints } },
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

      return tx.missionCompletion.update({
        where: { id: completion.id },
        data: {
          progress: mission.target,
          completedAt: new Date(),
          rewardedAt: new Date(),
        },
      });
    });

    return serialize({ mission, completion: result });
  }

  assertManualMissionAllowed(type: string) {
    if (type === 'manual') {
      throw new BadRequestException('Esta mision requiere validacion manual de administrador.');
    }
  }
}
