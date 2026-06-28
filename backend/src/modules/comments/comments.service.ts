import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const COOLDOWN_MS = 5 * 60 * 1000;
const MIN_LENGTH = 3;
const MAX_LENGTH = 500;
const ADMIN_ROLES = new Set<UserRole>([UserRole.admin, UserRole.superadmin, UserRole.owner]);

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
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
      where: { OR: [{ id: BigInt(Number(pollId) || 0) }, { slug: pollId }, { firebaseId: pollId }] },
      select: { id: true },
    });

    if (!poll) {
      throw new NotFoundException('La votacion no existe.');
    }

    return poll;
  }

  async list(pollId: string, limit = 100) {
    const poll = await this.resolvePoll(pollId);
    const comments = await this.prisma.comment.findMany({
      where: { pollId: poll.id, deletedAt: null },
      take: Math.min(Math.max(Number(limit) || 100, 1), 200),
      orderBy: { createdAt: 'desc' },
    });

    return serialize(comments);
  }

  async create(pollId: string, userId: bigint, body: any) {
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

    const payload = serialize(comment);
    await this.publishComment(poll.id, { action: 'new', comment: payload });

    return payload;
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
