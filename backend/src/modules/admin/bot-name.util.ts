const FIRST = [
  'Sofi',
  'Mateo',
  'Vale',
  'Camila',
  'Diego',
  'Lucia',
  'Juan',
  'Ana',
  'Carlos',
  'Maria',
  'Pedro',
  'Laura',
  'Andres',
  'Paula',
  'Nicolas',
  'Emma',
  'Sebas',
  'Mari',
  'Dani',
  'Alex',
  'Gaby',
  'Fer',
  'Isa',
  'Leo',
  'Noa',
  'Ren',
  'Tomi',
  'Kari',
  'Lu',
  'Max',
  'Eli',
  'Rafa',
  'Nico',
  'Sara',
  'Bruno',
  'Elena',
  'Joaco',
  'Belen',
  'Thiago',
  'Mia',
  'Luis',
  'Pablo',
  'Julia',
  'Kevin',
  'Rosa',
  'Hugo',
  'Clara',
  'Ivan',
  'Moni',
  'Edu',
];

const NICK = [
  'sofi',
  'mate',
  'vale',
  'cami',
  'diego',
  'lucho',
  'juancho',
  'anita',
  'charly',
  'mary',
  'pepe',
  'lau',
  'pipe',
  'pau',
  'nico',
  'emma',
  'seba',
  'dani',
  'gaby',
  'fer',
  'isa',
  'leo',
  'noa',
  'tomi',
  'maxi',
  'eli',
  'rafa',
  'sara',
  'bruno',
  'belu',
  'thi',
  'mia',
  'luis',
  'juli',
  'kevin',
  'rosa',
  'hugo',
  'clau',
  'ivan',
  'moni',
];

const TAGS = ['mx', 've', 'co', 'ar', 'cl', 'pe', 'rd', 'ok', 'x', 'r', 'm', 'vega', 'rios', 'sol'];

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

const capitalizeDisplay = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return 'Usuario';
  }
  if (/^[a-z]/.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  return trimmed;
};

const buildNaturalName = () => {
  const style = Math.random();
  const nick = pick(NICK);
  const first = pick(FIRST);

  if (style < 0.22) {
    return capitalizeDisplay(`${nick}${Math.floor(Math.random() * 90) + 10}`);
  }
  if (style < 0.42) {
    return capitalizeDisplay(`${nick}_${pick(TAGS)}`);
  }
  if (style < 0.58) {
    return capitalizeDisplay(`${nick}.${Math.floor(Math.random() * 900) + 100}`);
  }
  if (style < 0.72) {
    return capitalizeDisplay(`${first.toLowerCase()}${pick(['_', '.'])}${Math.floor(Math.random() * 90) + 10}`);
  }
  if (style < 0.86) {
    return capitalizeDisplay(`${nick}${pick(['aa', 'ita', 'ito', 'ux', 'ee', ''])}`);
  }
  return capitalizeDisplay(`${first.charAt(0).toLowerCase()}${pick(NICK).slice(0, 4)}${Math.floor(Math.random() * 900) + 10}`);
};

export const generateBotNames = (count: number): string[] => {
  const target = Math.max(1, Math.min(500, Math.floor(count)));
  const names = new Set<string>();
  let guard = 0;

  while (names.size < target && guard < target * 40) {
    guard += 1;
    const name = buildNaturalName().slice(0, 24);
    if (name.length >= 3) {
      names.add(name);
    }
  }

  while (names.size < target) {
    names.add(capitalizeDisplay(`${pick(NICK)}${Math.floor(Math.random() * 9000) + 1000}`).slice(0, 24));
  }

  return [...names];
};
