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
}
