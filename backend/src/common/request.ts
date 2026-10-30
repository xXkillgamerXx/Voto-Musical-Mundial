import { createHash } from 'crypto';
import { Request } from 'express';

const IP_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]+)$/i;

const isPrivatePeer = (value: string) =>
  /^(::ffff:)?(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$)/.test(value);

const firstHeader = (request: Request, name: string) =>
  String(request.headers[name] || '')
    .split(',')[0]
    .trim();

export const getClientIp = (request: Request) => {
  const peer = String(request.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  // Cloudflare -> Apache -> nmm-nginx. Only trust CF-Connecting-IP from a private hop.
  if (isPrivatePeer(peer)) {
    const cloudflareIp = firstHeader(request, 'cf-connecting-ip');
    if (IP_RE.test(cloudflareIp)) return cloudflareIp.replace(/^::ffff:/, '');
  }
  const resolved = request.ip || peer || 'unknown';
  return resolved.replace(/^::ffff:/, '');
};

export const hashIp = (ip: string, salt: string) =>
  createHash('sha256').update(`${salt}:${ip}`).digest('hex');
