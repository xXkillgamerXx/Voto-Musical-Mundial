export const serialize = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_key, current) =>
      typeof current === 'bigint' ? current.toString() : current,
    ),
  );

export const toNumber = (value: bigint | number | null | undefined) => Number(value || 0);
