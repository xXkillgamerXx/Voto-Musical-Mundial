import { UserRole } from '@prisma/client';

export type TokenType = 'access' | 'refresh' | 'anonymous';

export interface JwtPayload {
  sub: string;
  type: TokenType;
  role?: UserRole;
  username?: string | null;
}

export interface VoteIdentity {
  type: 'user' | 'anonymous';
  id: string;
  userId?: bigint;
  role?: UserRole;
}
