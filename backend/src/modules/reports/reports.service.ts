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
import { emptyReporterTrust, reporterTrustFromStatusRows } from '../../common/reporter-trust';
import { serialize } from '../../common/serialize';
import { AdminPushService } from '../admin/admin-push.service';
import { ModerationService } from '../admin/moderation.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const VALID_REASONS = new Set<string>(Object.values(ContentReportReason));
const VALID_TARGET_TYPES = new Set<string>(Object.values(ContentReportTargetType));
const VALID_STATUSES = new Set<string>(Object.values(ContentReportStatus));
const MAX_DETAILS_LENGTH = 500;
const MAX_REPORTS_PER_HOUR = 10;
const MAX_THANKS_POINTS = 500;

const THANKS_COPY = {
  es: {
    title: 'Gracias por tu reporte',
    message: 'Gracias por reportar. Denuncias como la tuya hacen la comunidad más segura.',
    withPoints: (points: number) =>
      `Gracias por reportar. Denuncias como la tuya hacen la comunidad más segura. Te dimos ${points} puntos por colaborar.`,
  },
  en: {
    title: 'Thanks for your report',
    message: 'Thanks for reporting. Reports like yours help keep the community safer.',
    withPoints: (points: number) =>
      `Thanks for reporting. Reports like yours help keep the community safer. We gave you ${points} points for helping out.`,
  },
} as const;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly moderation: ModerationService,
    private readonly adminPush: AdminPushService,
  ) {}

  private resolveUserLocale(metadata: unknown): 'es' | 'en' {
    const meta =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};
    const raw = String(meta.locale || meta.lang || meta.language || '')
      .trim()
      .toLowerCase();
    return raw.startsWith('es') ? 'es' : 'en';
  }

  private reportMetadata(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  }

  private thanksFromMetadata(metadata: Record<string, unknown>) {
    const thanks = metadata.thanks;
    if (!thanks || typeof thanks !== 'object' || Array.isArray(thanks)) {
      return null;
    }

    const data = thanks as Record<string, unknown>;
    const at = String(data.at || '').trim();
    if (!at) {
      return null;
    }

    return {
      at,
      points: Math.max(0, Number(data.points || 0)),
      locale: String(data.locale || '') === 'es' ? 'es' : 'en',
    };
  }

  private clipText(value: unknown, max: number) {
    return String(value || '').trim().slice(0, max);
  }

  private buildThanksCopy(
    locale: 'es' | 'en',
    points: number,
    body: Record<string, unknown> = {},
  ) {
    const esMessage = points > 0 ? THANKS_COPY.es.withPoints(points) : THANKS_COPY.es.message;
    const enMessage = points > 0 ? THANKS_COPY.en.withPoints(points) : THANKS_COPY.en.message;
    const titleEs = this.clipText(body.titleEs, 120) || THANKS_COPY.es.title;
    const titleEn = this.clipText(body.titleEn, 120) || THANKS_COPY.en.title;
    const messageEs = this.clipText(body.messageEs, 800) || esMessage;
    const messageEn = this.clipText(body.messageEn, 800) || enMessage;
    const customTitle = this.clipText(body.title, 120);
    const customMessage = this.clipText(body.message, 800);

    const resolvedTitleEs = locale === 'es' && customTitle ? customTitle : titleEs;
    const resolvedTitleEn = locale === 'en' && customTitle ? customTitle : titleEn;
    const resolvedMessageEs = locale === 'es' && customMessage ? customMessage : messageEs;
    const resolvedMessageEn = locale === 'en' && customMessage ? customMessage : messageEn;

    return {
      locale,
      title: locale === 'en' ? resolvedTitleEn : resolvedTitleEs,
      message: locale === 'en' ? resolvedMessageEn : resolvedMessageEs,
      titleEs: resolvedTitleEs,
      titleEn: resolvedTitleEn,
      messageEs: resolvedMessageEs,
      messageEn: resolvedMessageEn,
    };
  }

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

  async listForAdmin(status?: string, limit = 50, page = 1) {
    const parsedStatus = status && VALID_STATUSES.has(status)
      ? (status as ContentReportStatus)
      : undefined;

    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const currentPage = Math.max(Number(page) || 1, 1);
    const skip = (currentPage - 1) * pageSize;
    const where = parsedStatus ? { status: parsedStatus } : undefined;

    const [total, pendingCount, reports] = await Promise.all([
      this.prisma.contentReport.count({ where }),
      this.prisma.contentReport.count({ where: { status: ContentReportStatus.pending } }),
      this.prisma.contentReport.findMany({
        where,
        take: pageSize,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
              displayName: true,
              email: true,
              photoUrl: true,
              metadata: true,
            },
          },
          reportedUser: {
            select: { id: true, username: true, displayName: true, email: true, photoUrl: true },
          },
          poll: { select: { id: true, title: true, slug: true } },
        },
      }),
    ]);

    const reporterIds = [...new Set(reports.map((report) => report.reporterId))];
    const statusRows = reporterIds.length
      ? await this.prisma.contentReport.groupBy({
          by: ['reporterId', 'status'],
          where: { reporterId: { in: reporterIds } },
          _count: { _all: true },
        })
      : [];
    const trustByReporter = new Map<string, ReturnType<typeof reporterTrustFromStatusRows>>();

    for (const reporterId of reporterIds) {
      trustByReporter.set(
        reporterId.toString(),
        reporterTrustFromStatusRows(
          statusRows
            .filter((row) => row.reporterId === reporterId)
            .map((row) => ({ status: row.status, _count: row._count })),
        ),
      );
    }

    const enriched = await Promise.all(
      reports.map(async (report) => {
        let targetPreview: Record<string, unknown> | null = null;

        if (report.targetType === ContentReportTargetType.comment) {
          const comment = await this.prisma.comment.findUnique({
            where: { id: BigInt(Number(report.targetId) || 0) },
            select: { text: true, displayName: true, deletedAt: true, gif: true, userId: true },
          });

          targetPreview = comment
            ? {
                text: comment.text,
                displayName: comment.displayName,
                deleted: Boolean(comment.deletedAt),
                gif: comment.gif,
                userId: comment.userId ? comment.userId.toString() : null,
              }
            : { missing: true };
        } else if (report.reportedUser) {
          const user = await this.prisma.user.findUnique({
            where: { id: report.reportedUser.id },
            select: { username: true, displayName: true, photoUrl: true, email: true, metadata: true },
          });

          targetPreview = user
            ? {
                username: user.username,
                displayName: user.displayName,
                photoUrl: user.photoUrl,
                email: user.email,
                bio: (user.metadata as Record<string, unknown>)?.bio || '',
              }
            : { missing: true };
        }

        const metadata = this.reportMetadata(report.metadata);
        const { metadata: reporterMetadata, ...reporter } = report.reporter;

        return {
          ...report,
          reporter,
          reporterLocale: this.resolveUserLocale(reporterMetadata),
          reporterTrust: trustByReporter.get(report.reporterId.toString()) || emptyReporterTrust(),
          thanks: this.thanksFromMetadata(metadata),
          targetPreview,
        };
      }),
    );

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return serialize({
      items: enriched,
      total,
      pendingCount,
      page: currentPage,
      pageSize,
      totalPages,
    });
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

      if (body.blockUser === true && report.reportedUserId) {
        await this.moderation.blockUser(
          report.reportedUserId.toString(),
          String(body.blockReason || 'Denuncia de comentario'),
          null,
          body.durationHours as string | number | null | undefined,
        );
      }
    }

    if (
      nextStatus === ContentReportStatus.action_taken
      && report.targetType === ContentReportTargetType.user_profile
      && report.reportedUserId
    ) {
      if (body.clearBio === true) {
        const user = await this.prisma.user.findUnique({
          where: { id: report.reportedUserId },
          select: { metadata: true },
        });
        const metadata =
          user?.metadata && typeof user.metadata === 'object'
            ? { ...(user.metadata as Record<string, unknown>) }
            : {};
        delete metadata.bio;
        await this.prisma.user.update({
          where: { id: report.reportedUserId },
          data: { metadata: metadata as any },
        });
      }

      if (body.blockUser === true) {
        await this.moderation.blockUser(
          report.reportedUserId.toString(),
          String(body.blockReason || 'Denuncia de perfil'),
          null,
          body.durationHours as string | number | null | undefined,
        );
      }
    }

    return serialize(updated);
  }

  async thankReporter(id: string, body: Record<string, unknown>) {
    const report = await this.prisma.contentReport.findUnique({
      where: { id: BigInt(Number(id) || 0) },
      include: {
        reporter: {
          select: { id: true, points: true, metadata: true, displayName: true },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Reporte no encontrado.');
    }

    const metadata = this.reportMetadata(report.metadata);
    if (this.thanksFromMetadata(metadata)) {
      throw new ConflictException('Ya se envió un agradecimiento por esta denuncia.');
    }

    const points = Math.max(0, Math.min(MAX_THANKS_POINTS, Math.floor(Number(body.points ?? 0) || 0)));
    const requestedLocale = String(body.locale || '').trim().toLowerCase();
    const locale = requestedLocale === 'es' || requestedLocale === 'en'
      ? requestedLocale
      : this.resolveUserLocale(report.reporter.metadata);
    const copy = this.buildThanksCopy(locale, points, body);
    const thanksAt = new Date().toISOString();

    const result = await this.prisma.$transaction(async (tx) => {
      let pointsAfter = report.reporter.points;

      if (points > 0) {
        const updatedUser = await tx.user.update({
          where: { id: report.reporterId },
          data: { points: { increment: BigInt(points) } },
          select: { points: true },
        });
        pointsAfter = updatedUser.points;
      }

      await tx.notification.create({
        data: {
          userId: report.reporterId,
          type: 'report_thanks',
          payload: {
            reportId: report.id.toString(),
            amount: points.toString(),
            title: copy.titleEs,
            titleEn: copy.titleEn,
            message: copy.messageEs,
            messageEn: copy.messageEn,
          },
        },
      });

      const updatedReport = await tx.contentReport.update({
        where: { id: report.id },
        data: {
          metadata: {
            ...metadata,
            thanks: {
              at: thanksAt,
              points,
              locale,
              title: copy.title,
              message: copy.message,
            },
          } as any,
        },
      });

      return { updatedReport, pointsAfter };
    });

    try {
      await this.redis.client.publish(
        `user:${report.reporterId.toString()}:events`,
        JSON.stringify({
          type: points > 0 ? 'points_gift' : 'report_thanks',
          amount: points.toString(),
          points: Number(result.pointsAfter),
          title: copy.title,
          message: copy.message,
          at: thanksAt,
        }),
      );
    } catch {
      // Best-effort realtime.
    }

    await this.adminPush.sendGiftToUser(report.reporterId, {
      title: copy.title,
      body: copy.message,
      amount: points > 0 ? points.toString() : undefined,
      type: 'report_thanks',
    });

    return serialize({
      ok: true,
      report: {
        ...result.updatedReport,
        thanks: { at: thanksAt, points, locale },
      },
      locale,
      pointsAwarded: points,
      title: copy.title,
      message: copy.message,
    });
  }
}
