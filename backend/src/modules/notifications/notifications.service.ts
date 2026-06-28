import { Injectable } from '@nestjs/common';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findForUser(userId: bigint, limit = 30) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      take: Math.min(limit, 100),
      orderBy: { createdAt: 'desc' },
    });

    return serialize(notifications);
  }

  async markRead(userId: bigint, id: string) {
    await this.prisma.notification.updateMany({
      where: { id: BigInt(id), userId },
      data: { readAt: new Date() },
    });
    const notification = await this.prisma.notification.findFirst({
      where: { id: BigInt(id), userId },
    });

    return serialize(notification);
  }

  async registerPushToken(
    userId: bigint,
    payload: { token?: string; platform?: string; permission?: string },
    userAgent?: string,
  ) {
    const token = String(payload.token || '').trim();
    if (!token) {
      return { ok: false, reason: 'missing_token' };
    }

    const pushToken = await this.prisma.pushToken.upsert({
      where: { token },
      update: {
        userId,
        platform: payload.platform || 'web',
        permission: payload.permission || 'granted',
        userAgent: userAgent || null,
      },
      create: {
        userId,
        token,
        platform: payload.platform || 'web',
        permission: payload.permission || 'granted',
        userAgent: userAgent || null,
      },
    });

    return serialize({ ok: true, id: pushToken.id });
  }

  async unregisterPushToken(userId: bigint, token: string) {
    const value = String(token || '').trim();
    if (!value) {
      return { ok: true };
    }

    await this.prisma.pushToken.deleteMany({
      where: { userId, token: value },
    });

    return { ok: true };
  }
}
