const FIRST = [
  'Army',
  'Blink',
  'Stay',
  'Once',
  'Midzy',
  'Atiny',
  'Carat',
  'Engene',
  'Moa',
  'Sofi',
  'Dani',
  'Alex',
  'Val',
  'Nico',
  'Luna',
  'Kai',
  'Mina',
  'Sora',
  'Yuri',
  'Hana',
  'Leo',
  'Mari',
  'Fer',
  'Gaby',
  'Cam',
  'Isa',
  'Noa',
  'Ren',
  'Vale',
  'Tomi',
];

const SECOND = [
  'Fan',
  'Lover',
  'Wave',
  'Heart',
  'Dream',
  'Light',
  'Night',
  'Sky',
  'Glow',
  'Beat',
  'Vibe',
  'Soul',
  'Spark',
  'Bloom',
  'Star',
  'Moon',
  'Fire',
  'Rain',
];

const SUFFIX = ['07', '13', '24', '99', 'x', 'xo', 'kr', 'latam', 'ok', 'vip', ''];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export const generateBotNames = (count: number): string[] => {
  const target = Math.max(1, Math.min(500, Math.floor(count)));
  const names = new Set<string>();
  let guard = 0;

  while (names.size < target && guard < target * 40) {
    guard += 1;
    const style = Math.random();
    let name: string;
    if (style < 0.35) {
      const suffix = pick(SUFFIX);
      name = `${pick(FIRST)}${pick(SECOND)}${suffix}`;
    } else if (style < 0.6) {
      name = `${pick(FIRST)}_${pick(SECOND)}`;
    } else if (style < 0.8) {
      name = `${pick(FIRST)}${Math.floor(Math.random() * 90) + 10}`;
    } else {
      name = `${pick(SECOND)}${pick(FIRST)}${Math.floor(Math.random() * 90) + 10}`;
    }
    names.add(name.slice(0, 24));
  }

  while (names.size < target) {
    names.add(`${pick(FIRST)}${Math.floor(Math.random() * 9000) + 1000}`);
  }

  return [...names];
};
