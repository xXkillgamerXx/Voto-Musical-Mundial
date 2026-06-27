import { createHash } from 'crypto';
import { Request } from 'express';

export const getClientIp = (request: Request) => {
  const forwardedFor = request.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const firstForwardedIp = String(forwardedIp || '').split(',')[0].trim();

  return firstForwardedIp || request.ip || request.socket.remoteAddress || 'unknown';
};

export const hashIp = (ip: string, salt: string) =>
  createHash('sha256').update(`${salt}:${ip}`).digest('hex');
