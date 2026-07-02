import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContentReportReason,
  ContentReportStatus,
  ContentReportTargetType,
} from '@prisma/client';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const VALID_REASONS = new Set<string>(Object.values(ContentReportReason));
const VALID_TARGET_TYPES = new Set<string>(Object.values(ContentReportTargetType));
const VALID_STATUSES = new Set<string>(Object.values(ContentReportStatus));
const MAX_DETAILS_LENGTH = 500;
const MAX_REPORTS_PER_HOUR = 10;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private parseReason(value: unknown): ContentReportReason {
    const reason = String(value || '').trim().toLowerCase();

    if (!VALID_REASONS.has(reason)) {
      throw new BadRequestException('Motivo de reporte invalido.');
    }

    return reason as ContentReportReason;
  }

  private parseTargetType(value: unknown): ContentReportTargetType {
    const targetType = String(value || '').trim().toLowerCase();

    if (!VALID_TARGET_TYPES.has(targetType)) {
      throw new BadRequestException('Tipo de contenido invalido.');
    }

    return targetType as ContentReportTargetType;
  }

  private async assertRateLimit(reporterId: bigint) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.prisma.contentReport.count({
      where: { reporterId, createdAt: { gte: since } },
    });

    if (recentCount >= MAX_REPORTS_PER_HOUR) {
      throw new BadRequestException('Has enviado demasiados reportes. Intenta mas tarde.');
    }
  }

  private async resolveCommentTarget(targetId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: BigInt(Number(targetId) || 0), deletedAt: null },
      select: { id: true, pollId: true, userId: true, text: true, displayName: true },
    });

    if (!comment) {
      throw new NotFoundException('Comentario no encontrado.');
    }

    return {
      pollId: comment.pollId,
      reportedUserId: comment.userId,
      snapshot: {
        commentText: comment.text,
        displayName: comment.displayName,
      },
    };
  }

  private async resolveUserProfileTarget(targetId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: BigInt(Number(targetId) || 0) },
          { username: targetId.trim().toLowerCase() },
        ],
      },
      select: { id: true, username: true, displayName: true },
    });

    if (!user) {
      throw new NotFoundException('Perfil no encontrado.');
    }

    return {
      targetId: user.id.toString(),
      reportedUserId: user.id,
      snapshot: {
        username: user.username,
        displayName: user.displayName,
      },
    };
  }

  async create(reporterId: bigint, body: Record<string, unknown>) {
    const targetType = this.parseTargetType(body.targetType);
    let targetId = String(body.targetId || '').trim();
    const reason = this.parseReason(body.reason);
    const details = String(body.details || '').trim().slice(0, MAX_DETAILS_LENGTH);

    if (!targetId) {
      throw new BadRequestException('Falta el contenido a reportar.');
    }

    if (targetType === ContentReportTargetType.user_profile && reporterId.toString() === targetId) {
      throw new BadRequestException('No puedes reportar tu propio perfil.');
    }

    await this.assertRateLimit(reporterId);

    let pollId: bigint | null = body.pollId ? BigInt(Number(body.pollId) || 0) : null;
    let reportedUserId: bigint | null = body.reportedUserId
      ? BigInt(Number(body.reportedUserId) || 0)
      : null;
    let snapshot: Record<string, unknown> = {};

    if (targetType === ContentReportTargetType.comment) {
      const resolved = await this.resolveCommentTarget(targetId);
      pollId = resolved.pollId;
      reportedUserId = resolved.reportedUserId;
      snapshot = resolved.snapshot;

      if (reportedUserId && reportedUserId === reporterId) {
        throw new BadRequestException('No puedes reportar tu propio comentario.');
      }
    } else {
      const resolved = await this.resolveUserProfileTarget(targetId);
      targetId = resolved.targetId;
      reportedUserId = resolved.reportedUserId;
      snapshot = resolved.snapshot;

      if (reportedUserId === reporterId) {
        throw new BadRequestException('No puedes reportar tu propio perfil.');
      }
    }

    try {
      const report = await this.prisma.contentReport.create({
        data: {
          reporterId,
          targetType,
          targetId,
          reportedUserId,
          pollId,
          reason,
          details: details || null,
          metadata: snapshot as any,
        },
      });

      return serialize(report);
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Ya reportaste este contenido.');
      }

      throw error;
    }
  }

  async listForAdmin(status?: string, limit = 50) {
    const parsedStatus = status && VALID_STATUSES.has(status)
      ? (status as ContentReportStatus)
      : undefined;

    const reports = await this.prisma.contentReport.findMany({
      where: parsedStatus ? { status: parsedStatus } : undefined,
      take: Math.min(Math.max(Number(limit) || 50, 1), 200),
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, username: true, displayName: true, email: true } },
        reportedUser: { select: { id: true, username: true, displayName: true } },
        poll: { select: { id: true, title: true, slug: true } },
      },
    });

    const enriched = await Promise.all(
      reports.map(async (report) => {
        let targetPreview: Record<string, unknown> | null = null;

        if (report.targetType === ContentReportTargetType.comment) {
          const comment = await this.prisma.comment.findUnique({
            where: { id: BigInt(Number(report.targetId) || 0) },
            select: { text: true, displayName: true, deletedAt: true, gif: true },
          });

          targetPreview = comment
            ? {
                text: comment.text,
                displayName: comment.displayName,
                deleted: Boolean(comment.deletedAt),
                gif: comment.gif,
              }
            : { missing: true };
        } else if (report.reportedUser) {
          const user = await this.prisma.user.findUnique({
            where: { id: report.reportedUser.id },
            select: { username: true, displayName: true, photoUrl: true, metadata: true },
          });

          targetPreview = user
            ? {
                username: user.username,
                displayName: user.displayName,
                photoUrl: user.photoUrl,
                bio: (user.metadata as Record<string, unknown>)?.bio || '',
              }
            : { missing: true };
        }

        return { ...report, targetPreview };
      }),
    );

    return serialize(enriched);
  }

  async updateStatus(id: string, body: Record<string, unknown>) {
    const report = await this.prisma.contentReport.findUnique({
      where: { id: BigInt(Number(id) || 0) },
    });

    if (!report) {
      throw new NotFoundException('Reporte no encontrado.');
    }

    const nextStatus = String(body.status || '').trim().toLowerCase();
    if (!VALID_STATUSES.has(nextStatus)) {
      throw new BadRequestException('Estado invalido.');
    }

    const adminNote = body.adminNote === undefined
      ? undefined
      : String(body.adminNote || '').trim().slice(0, 500) || null;

    const updated = await this.prisma.contentReport.update({
      where: { id: report.id },
      data: {
        status: nextStatus as ContentReportStatus,
        adminNote,
        reviewedAt: new Date(),
      },
    });

    if (
      nextStatus === ContentReportStatus.action_taken
      && report.targetType === ContentReportTargetType.comment
    ) {
      const commentId = BigInt(Number(report.targetId) || 0);
      await this.prisma.comment.updateMany({
        where: { id: commentId, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      if (report.pollId) {
        try {
          await this.redis.client.publish(
            `poll:${report.pollId.toString()}:comment`,
            JSON.stringify({ action: 'deleted', commentId: report.targetId }),
          );
        } catch {
          // Best-effort realtime sync.
        }
      }
    }

    return serialize(updated);
  }
}
