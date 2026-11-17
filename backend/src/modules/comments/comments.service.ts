import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import {
  BLOCKED_LANGUAGE_MESSAGE,
  isCommentLanguageBlocked,
} from '../../common/comment-profanity';
import {
  BLOCKED_PROMO_MESSAGE,
  isCommentHardBlocked,
} from '../../common/comment-promo';
import { getClientIp, hashIp } from '../../common/request';
import { pollLookupWhere } from '../../common/poll-lookup';
import { serialize } from '../../common/serialize';
import { toPublicComment } from '../../common/public-comment';
import { ModerationService } from '../admin/moderation.service';
import { ModerationDictionaryService } from '../admin/moderation-dictionary.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { FanService } from '../fan/fan.service';

const COOLDOWN_MS = 5 * 60 * 1000;
const MIN_LENGTH = 3;
const MAX_LENGTH = 500;
const ADMIN_ROLES = new Set<UserRole>([UserRole.admin, UserRole.superadmin, UserRole.owner]);
const ALLOWED_REACTIONS = new Set(['like', 'heart', 'fire', 'laugh', 'angry']);
const EMPTY_REACTIONS = () => ({ like: 0, heart: 0, fire: 0, laugh: 0, angry: 0 });

export type CommentSort = 'latest' | 'popular' | 'oldest';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly moderation: ModerationService,
    private readonly dictionary: ModerationDictionaryService,
    private readonly config: ConfigService,
    private readonly fan: FanService,
  ) {}

  private async publishComment(pollId: bigint, payload: Record<string, unknown>) {
    try {
      await this.redis.client.publish(`poll:${pollId.toString()}:comment`, JSON.stringify(payload));
    } catch {
      // Best-effort: si Redis falla, el comentario igual queda guardado en la base.
    }
  }

  private async resolvePoll(pollId: string) {
    const poll = await this.prisma.poll.findFirst({
      where: pollLookupWhere(pollId),
      select: { id: true },
    });

    if (!poll) {
      throw new NotFoundException('La votacion no existe.');
    }

    return poll;
  }

  private normalizeSort(sort?: string): CommentSort {
    const value = String(sort || 'latest').trim().toLowerCase();
    if (value === 'popular' || value === 'oldest') return value;
    return 'latest';
  }

  private orderByFor(sort: CommentSort) {
    if (sort === 'popular') {
      return [{ reactionsCount: 'desc' as const }, { createdAt: 'desc' as const }];
    }
    if (sort === 'oldest') {
      return [{ createdAt: 'asc' as const }];
    }
    return [{ createdAt: 'desc' as const }];
  }

  private async reactionMaps(commentIds: bigint[], viewerUserId?: bigint | null) {
    const empty = EMPTY_REACTIONS();
    const reactionsById = new Map<string, ReturnType<typeof EMPTY_REACTIONS>>();
    const mineById = new Map<string, string>();

    if (!commentIds.length) {
      return { reactionsById, mineById };
    }

    const grouped = await this.prisma.commentReaction.groupBy({
      by: ['commentId', 'reaction'],
      where: { commentId: { in: commentIds } },
      _count: { _all: true },
    });

    for (const row of grouped) {
      const key = row.commentId.toString();
      const bucket = reactionsById.get(key) || { ...empty };
      if (row.reaction in bucket) {
        bucket[row.reaction as keyof typeof bucket] = row._count._all;
      }
      reactionsById.set(key, bucket);
    }

    if (viewerUserId) {
      const mine = await this.prisma.commentReaction.findMany({
        where: { commentId: { in: commentIds }, userId: viewerUserId },
        select: { commentId: true, reaction: true },
      });
      for (const row of mine) {
        mineById.set(row.commentId.toString(), row.reaction);
      }
    }

    return { reactionsById, mineById };
  }

  private async enrichComments(
    comments: Array<Record<string, unknown> & { id: bigint; userId: bigint | null }>,
    viewerUserId?: bigint | null,
  ) {
    const skuMap = await this.fan.fanSkuByUserIds(
      comments.map((comment) => comment.userId).filter((id): id is bigint => Boolean(id)),
    );
    const { reactionsById, mineById } = await this.reactionMaps(
      comments.map((comment) => comment.id),
      viewerUserId,
    );

    return comments.map((comment) => {
      const id = comment.id.toString();
      return {
        ...toPublicComment(comment),
        fanSku: comment.userId ? skuMap.get(comment.userId.toString()) || null : null,
        reactions: reactionsById.get(id) || EMPTY_REACTIONS(),
        myReaction: mineById.get(id) || null,
      };
    });
  }

  async list(
    pollId: string,
    limit = 20,
    offset = 0,
    sort: string = 'latest',
    viewerUserId?: bigint | null,
  ) {
    const poll = await this.resolvePoll(pollId);
    const where = { pollId: poll.id, deletedAt: null };
    const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const skip = Math.max(0, Number(offset) || 0);
    const normalizedSort = this.normalizeSort(sort);

    const [total, comments] = await Promise.all([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        take,
        skip,
        orderBy: this.orderByFor(normalizedSort),
      }),
    ]);

    const items = await this.enrichComments(comments, viewerUserId);

    return serialize({
      items,
      total,
      limit: take,
      offset: skip,
      sort: normalizedSort,
      hasMore: skip + items.length < total,
    });
  }

  async create(pollId: string, userId: bigint, body: any, request?: Request) {
    await this.moderation.assertUserNotBlocked(userId, 'comentar');

    const poll = await this.resolvePoll(pollId);
    const text = String(body?.text || '').trim();
    const gif =
      body?.gif && body.gif.url
        ? { url: String(body.gif.url), title: String(body.gif.title || ''), source: 'giphy' }
        : null;

    if (text.length < MIN_LENGTH && !gif) {
      throw new BadRequestException(`Escribe al menos ${MIN_LENGTH} letras para comentar.`);
    }

    if (text.length > MAX_LENGTH) {
      throw new BadRequestException('El comentario es demasiado largo.');
    }

    if (text && isCommentHardBlocked(text)) {
      throw new BadRequestException(BLOCKED_PROMO_MESSAGE);
    }

    const promoScan = text ? await this.dictionary.scanComment(text) : null;

    if (text && (await isCommentLanguageBlocked(text))) {
      throw new BadRequestException(BLOCKED_LANGUAGE_MESSAGE);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, username: true, photoUrl: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const isAdmin = ADMIN_ROLES.has(user.role);

    if (!isAdmin) {
      const lock = await this.prisma.commentLock.findUnique({
        where: { pollId_userId: { pollId: poll.id, userId } },
      });

      if (lock) {
        const elapsed = Date.now() - lock.lastCommentAt.getTime();
        if (elapsed < COOLDOWN_MS) {
          throw new HttpException(
            { message: 'Espera antes de comentar otra vez.', remainingMs: COOLDOWN_MS - elapsed },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    }

    const displayName = user.displayName || user.username || 'Fan';
    const comment = await this.prisma.comment.create({
      data: {
        pollId: poll.id,
        userId,
        displayName,
        photoUrl: user.photoUrl || null,
        text,
        gif: gif as any,
      },
    });

    if (!isAdmin) {
      await this.prisma.commentLock.upsert({
        where: { pollId_userId: { pollId: poll.id, userId } },
        create: { pollId: poll.id, userId, lastCommentAt: new Date() },
        update: { lastCommentAt: new Date() },
      });
    }

    const payload = {
      ...toPublicComment(comment as Record<string, unknown>),
      fanSku: (await this.fan.getVoteBoost(userId)).sku,
      reactions: EMPTY_REACTIONS(),
      myReaction: null,
    };
    await this.publishComment(poll.id, { action: 'new', comment: payload });

    if (promoScan?.suspicious && !isAdmin) {
      const clientIp = request ? getClientIp(request) : null;
      const ipHash =
        clientIp && clientIp !== 'unknown'
          ? hashIp(clientIp, this.config.get<string>('IP_HASH_SALT') || 'votomusicamundial')
          : null;
      void this.moderation
        .createCommentSuspicionAlert({
          text,
          scan: promoScan,
          userId,
          userName: displayName,
          pollId: poll.id,
          commentId: comment.id,
          ipHash,
        })
        .catch(() => {});
    }

    return payload;
  }

  async react(pollId: string, userId: bigint, commentId: string, reactionRaw: string) {
    await this.moderation.assertUserNotBlocked(userId, 'reaccionar');

    const poll = await this.resolvePoll(pollId);
    const id = BigInt(Number(commentId) || 0);
    const comment = await this.prisma.comment.findFirst({
      where: { id, pollId: poll.id, deletedAt: null },
      select: { id: true, reactionsCount: true },
    });

    if (!comment) {
      throw new NotFoundException('Comentario no encontrado.');
    }

    const reaction = String(reactionRaw || '').trim().toLowerCase();
    if (!ALLOWED_REACTIONS.has(reaction)) {
      throw new BadRequestException('Reacción no válida.');
    }

    const existing = await this.prisma.commentReaction.findUnique({
      where: { commentId_userId: { commentId: comment.id, userId } },
    });

    let myReaction: string | null = reaction;
    let delta = 0;

    if (existing?.reaction === reaction) {
      await this.prisma.commentReaction.delete({
        where: { commentId_userId: { commentId: comment.id, userId } },
      });
      myReaction = null;
      delta = -1;
    } else if (existing) {
      await this.prisma.commentReaction.update({
        where: { commentId_userId: { commentId: comment.id, userId } },
        data: { reaction },
      });
      delta = 0;
    } else {
      await this.prisma.commentReaction.create({
        data: { commentId: comment.id, userId, reaction },
      });
      delta = 1;
    }

    if (delta !== 0) {
      await this.prisma.comment.update({
        where: { id: comment.id },
        data: { reactionsCount: { increment: delta } },
      });
    }

    const { reactionsById } = await this.reactionMaps([comment.id], userId);
    const reactions = reactionsById.get(comment.id.toString()) || EMPTY_REACTIONS();
    const reactionsCount = Object.values(reactions).reduce((sum, n) => sum + n, 0);

    await this.publishComment(poll.id, {
      action: 'reaction',
      commentId: comment.id.toString(),
      reactions,
      reactionsCount,
      // myReaction is per-user; clients apply locally for the actor
    });

    return serialize({
      id: comment.id.toString(),
      reactions,
      reactionsCount,
      myReaction,
    });
  }

  async remove(pollId: string, userId: bigint, role: UserRole, id: string) {
    const poll = await this.resolvePoll(pollId);
    const comment = await this.prisma.comment.findFirst({
      where: { id: BigInt(Number(id) || 0), pollId: poll.id },
    });

    if (!comment) {
      throw new NotFoundException('Comentario no encontrado.');
    }

    const isAdmin = ADMIN_ROLES.has(role);
    if (!isAdmin && comment.userId !== userId) {
      throw new ForbiddenException('No puedes borrar este comentario.');
    }

    await this.prisma.comment.update({
      where: { id: comment.id },
      data: { deletedAt: new Date() },
    });

    await this.publishComment(poll.id, { action: 'deleted', commentId: comment.id.toString() });

    return { ok: true };
  }
}
