import { Prisma } from '@prisma/client';
import { normalizeSlug } from './poll-lookup';

export { normalizeSlug };

/** Condición Prisma para resolver un artista por id, slug ES, slug EN o firebaseId. */
export const artistLookupWhere = (id: string): Prisma.ArtistWhereInput => {
  const key = String(id || '').trim();
  const numericId = BigInt(Number(key) || 0);

  return {
    OR: [
      { id: numericId },
      { slug: key },
      { firebaseId: key },
      { metadata: { path: ['slugEn'], equals: key } },
    ],
  };
};
