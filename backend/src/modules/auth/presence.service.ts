import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/** Ventana de agrupación: como mucho una escritura cada 5 minutos por usuario. */
const THROTTLE_SECONDS = 300;

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Marca al usuario como activo. Se llama en cada request autenticado, así que
   * Redis hace de amortiguador: sin él preferimos no escribir antes que golpear
   * la base en cada llamada.
   */
  async touch(userId: bigint) {
    const now = new Date();
    const day = dayKey(now);

    let shouldWrite = false;
    try {
      const reserved = await this.redis.client.set(
        `presence:${userId.toString()}:${day}`,
        '1',
        'EX',
        THROTTLE_SECONDS,
        'NX',
      );
      shouldWrite = reserved === 'OK';
    } catch {
      return;
    }

    if (!shouldWrite) {
      return;
    }

    try {
      await this.prisma.$transaction([
        this.prisma.userActivityDay.upsert({
          where: { userId_day: { userId, day } },
          create: { userId, day, hits: 1, firstSeenAt: now, lastSeenAt: now },
          update: { hits: { increment: 1 }, lastSeenAt: now },
        }),
      ]);
    } catch (error) {
      this.logger.debug(`No se pudo registrar presencia: ${(error as Error).message}`);
    }
  }
}
