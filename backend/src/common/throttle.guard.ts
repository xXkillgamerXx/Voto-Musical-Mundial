import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RedisService } from '../modules/redis/redis.service';
import { getClientIp } from './request';
import { THROTTLE_KEY, ThrottleOptions } from './throttle.decorator';

@Injectable()
export class RedisThrottleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<ThrottleOptions>(THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ip = getClientIp(request);
    const name = options.name || `${request.method}:${(request as any).route?.path || request.url}`;
    const bucket = Math.floor(Date.now() / (options.windowSec * 1000));
    const key = `rl:http:${name}:${ip}:${bucket}`;

    let count = 0;
    try {
      const result = await this.redis.client.multi().incr(key).expire(key, options.windowSec).exec();
      count = Number(result?.[0]?.[1] || 0);
    } catch {
      // If Redis is unavailable, fail open rather than blocking all traffic.
      return true;
    }

    if (count > options.limit) {
      throw new HttpException('Demasiadas solicitudes. Intenta de nuevo mas tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
