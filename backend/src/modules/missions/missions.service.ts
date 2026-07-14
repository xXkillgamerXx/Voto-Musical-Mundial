import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';

// Mission types that are credited by the backend itself (referrals, daily streak) or that
// require manual/admin validation. None of these may be self-completed via the public endpoint.
const SERVER_MANAGED_MISSION_TYPES = new Set([
  'manual',
  'referral_signup',
  'referral_signup_milestone',
  'daily_streak',
]);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const withMissionLocales = <T extends { title: string; description: string | null; metadata?: unknown }>(
  mission: T,
) => {
  const metadata = asRecord(mission.metadata);
  const titleEn = String(metadata.titleEn || metadata.title_en || '').trim();
  const descriptionEn = String(metadata.descriptionEn || metadata.description_en || '').trim();

  return {
    ...mission,
    titleEs: mission.title,
    descriptionEs: mission.description || '',
    titleEn,
    descriptionEn,
  };
};

const localizeMission = <T extends { title: string; description: string | null; titleEn?: string; descriptionEn?: string }>(
  mission: T,
  lang?: string,
) => {
  const useEn = String(lang || '').trim().toLowerCase().startsWith('en');
  if (!useEn) {
    return mission;
  }

  return {
    ...mission,
    title: mission.titleEn?.trim() || mission.title,
    description: mission.descriptionEn?.trim() || mission.description,
  };
};

@Injectable()
export class MissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(lang?: string) {
    const missions = await this.prisma.mission.findMany({
      where: { active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return serialize(missions.map((mission) => localizeMission(withMissionLocales(mission), lang)));
  }

  async findForUser(userId: bigint, lang?: string) {
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
        const localized = localizeMission(withMissionLocales(missionData), lang);

        return {
          ...localized,
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

    this.assertSelfCompletable(mission.type);

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

  assertSelfCompletable(type: string) {
    if (SERVER_MANAGED_MISSION_TYPES.has(type)) {
      throw new BadRequestException('Esta mision se valida automaticamente y no puede completarse manualmente.');
    }
  }
}
