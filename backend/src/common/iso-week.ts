const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const utcMonday = (now = new Date()) => {
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

export const isoWeekFromMonday = (monday: Date) => {
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Monday = utcMonday(jan4);
  const week = 1 + Math.round((monday.getTime() - jan4Monday.getTime()) / WEEK_MS);
  return { year, week };
};

export const chartWeekWindow = (now = new Date()) => {
  const weekStart = utcMonday(now);
  const weekEnd = new Date(weekStart.getTime() + WEEK_MS);
  const current = isoWeekFromMonday(weekStart);
  const prevStart = new Date(weekStart.getTime() - WEEK_MS);
  const previous = isoWeekFromMonday(prevStart);
  return {
    weekStart,
    weekEnd,
    year: current.year,
    week: current.week,
    key: weekKey(current.year, current.week),
    prevStart,
    prevEnd: weekStart,
    prevYear: previous.year,
    prevWeek: previous.week,
    prevKey: weekKey(previous.year, previous.week),
  };
};

export const weekKey = (year: number, week: number) =>
  `${year}-W${String(week).padStart(2, '0')}`;

export const previousWeekKeys = (year: number, week: number, count = 52) => {
  const keys: string[] = [];
  let monday = utcMonday(new Date(Date.UTC(year, 0, 4)));
  monday = new Date(monday.getTime() + (week - 1) * WEEK_MS);
  for (let i = 1; i <= count; i += 1) {
    monday = new Date(monday.getTime() - WEEK_MS);
    const item = isoWeekFromMonday(monday);
    keys.push(weekKey(item.year, item.week));
  }
  return keys;
};
