export type UserBlockMeta = {
  reason: string;
  at: string;
  by: string | null;
  label?: string | null;
  expiresAt?: string | null;
};

export type UserBlockStatus = {
  blocked: boolean;
  reason: string;
  at: string;
  by: string | null;
  expiresAt: string | null;
  permanent: boolean;
};

export const USER_BLOCKED_ERROR = 'USER_BLOCKED';

export const parseUserBlockMeta = (raw?: string): UserBlockMeta | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserBlockMeta;
  } catch {
    return { reason: raw, at: '', by: null };
  }
};

export const isUserBlockExpired = (meta: UserBlockMeta | null | undefined) => {
  if (!meta?.expiresAt) return false;
  const expiresAt = new Date(meta.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
};

export const toUserBlockStatus = (meta: UserBlockMeta | null | undefined): UserBlockStatus | null => {
  if (!meta || isUserBlockExpired(meta)) return null;
  return {
    blocked: true,
    reason: String(meta.reason || '').trim() || 'Bloqueo manual',
    at: meta.at || '',
    by: meta.by || null,
    expiresAt: meta.expiresAt || null,
    permanent: !meta.expiresAt,
  };
};
