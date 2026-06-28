import { createHash } from 'crypto';
import { Request } from 'express';

export const getClientIp = (request: Request) => {
  // With `trust proxy` configured in bootstrap, Express resolves request.ip to the real
  // client (the right-most untrusted hop), which cannot be spoofed by a client-supplied
  // X-Forwarded-For. We must NOT trust the raw header ourselves.
  const resolved = request.ip || request.socket?.remoteAddress || 'unknown';
  return resolved.replace(/^::ffff:/, '');
};

export const hashIp = (ip: string, salt: string) =>
  createHash('sha256').update(`${salt}:${ip}`).digest('hex');
