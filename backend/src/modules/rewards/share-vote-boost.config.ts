export const SHARE_VOTE_BOOST_REDIS_KEY = 'app:settings:share_vote_boost';

export type ShareVoteBoostConfig = {
  enabled: boolean;
  multiplier: number;
  durationMinutes: number;
  oncePerDay: boolean;
};

export const DEFAULT_SHARE_VOTE_BOOST: ShareVoteBoostConfig = {
  enabled: true,
  multiplier: 2,
  durationMinutes: 10,
  oncePerDay: true,
};

export const normalizeShareVoteBoostConfig = (raw: unknown): ShareVoteBoostConfig => {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const durationMinutes = Math.min(
    24 * 60,
    Math.max(1, Math.floor(Number(input.durationMinutes ?? DEFAULT_SHARE_VOTE_BOOST.durationMinutes) || 10)),
  );
  const multiplier = Math.min(
    10,
    Math.max(2, Math.floor(Number(input.multiplier ?? DEFAULT_SHARE_VOTE_BOOST.multiplier) || 2)),
  );
  const enabled =
    typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_SHARE_VOTE_BOOST.enabled;
  const oncePerDay =
    typeof input.oncePerDay === 'boolean' ? input.oncePerDay : DEFAULT_SHARE_VOTE_BOOST.oncePerDay;

  return { enabled, multiplier, durationMinutes, oncePerDay };
};

export const buildShareVoteBoostPayload = (config: ShareVoteBoostConfig) => ({
  enabled: config.enabled,
  multiplier: config.multiplier,
  durationMinutes: config.durationMinutes,
  oncePerDay: config.oncePerDay,
});
