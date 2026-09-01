import { Prisma } from '@prisma/client';
import { normalizeSlug } from './poll-lookup';

export { normalizeSlug };

const bigintId = (value: string): bigint | null => {
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

/** Condición Prisma para resolver un artista por id, slug ES, slug EN o firebaseId. */
export const artistLookupWhere = (id: string): Prisma.ArtistWhereInput => {
  const key = String(id || '').trim();
  const or: Prisma.ArtistWhereInput[] = [
    { slug: key },
    { firebaseId: key },
    { metadata: { path: ['slugEn'], equals: key } },
  ];
  const numericId = bigintId(key);
  if (numericId !== null) or.unshift({ id: numericId });
  return { OR: or };
};
