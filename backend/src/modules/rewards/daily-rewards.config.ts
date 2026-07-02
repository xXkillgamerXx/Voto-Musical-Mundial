export type DailyRewardDay = {
  day: number;
  points: number;
};

export const DEFAULT_DAILY_REWARD_SCHEDULE: DailyRewardDay[] = [
  { day: 1, points: 5 },
  { day: 2, points: 10 },
  { day: 3, points: 15 },
  { day: 4, points: 20 },
  { day: 5, points: 25 },
  { day: 6, points: 30 },
  { day: 7, points: 50 },
];

export const DAILY_REWARDS_REDIS_KEY = 'app:settings:daily_rewards';

export const normalizeDailyRewardSchedule = (input: unknown): DailyRewardDay[] => {
  const days = Array.isArray(input)
    ? input
    : Array.isArray((input as { days?: unknown })?.days)
      ? (input as { days: unknown[] }).days
      : DEFAULT_DAILY_REWARD_SCHEDULE;

  const normalized = days
    .map((entry, index) => ({
      day: Math.min(7, Math.max(1, Number((entry as DailyRewardDay)?.day || index + 1))),
      points: Math.min(100000, Math.max(0, Math.floor(Number((entry as DailyRewardDay)?.points || 0)))),
    }))
    .sort((left, right) => left.day - right.day);

  const byDay = new Map<number, DailyRewardDay>();
  normalized.forEach((entry) => {
    byDay.set(entry.day, entry);
  });

  return DEFAULT_DAILY_REWARD_SCHEDULE.map((defaultDay) => byDay.get(defaultDay.day) || defaultDay);
};

export const dailyRewardPointsMap = (schedule: DailyRewardDay[]) =>
  Object.fromEntries(schedule.map((entry) => [entry.day, entry.points])) as Record<number, number>;

export const weeklyRewardTotal = (schedule: DailyRewardDay[]) =>
  schedule.reduce((total, entry) => total + Number(entry.points || 0), 0);

export const buildDailyRewardSchedulePayload = (schedule: DailyRewardDay[]) => ({
  days: schedule,
  weeklyTotal: weeklyRewardTotal(schedule),
  weekLength: schedule.length,
});
