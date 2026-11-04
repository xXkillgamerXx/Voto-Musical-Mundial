import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Allows anonymous access; attaches user when a valid JWT is present. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const result = super.canActivate(context);
    if (typeof (result as Promise<boolean>)?.then === 'function') {
      return (result as Promise<boolean>).catch(() => true);
    }
    return result;
  }

  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser | null {
    return user || null;
  }
}
