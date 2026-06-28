import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = 'throttle:options';

export interface ThrottleOptions {
  /** Max allowed requests per IP within the window. */
  limit: number;
  /** Window size in seconds. */
  windowSec: number;
  /** Optional stable name for the limiter bucket (defaults to method:route). */
  name?: string;
}

/**
 * Per-IP request throttling backed by Redis. Apply together with RedisThrottleGuard.
 */
export const Throttle = (options: ThrottleOptions) => SetMetadata(THROTTLE_KEY, options);
