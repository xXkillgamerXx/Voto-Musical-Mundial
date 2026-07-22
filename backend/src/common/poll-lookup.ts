import { Prisma } from '@prisma/client';

/** Condición Prisma para resolver una votación por id, slug ES, slug EN o firebaseId. */
export const pollLookupWhere = (id: string): Prisma.PollWhereInput => {
  const key = String(id || '').trim();
  const numericId = BigInt(Number(key) || 0);

  return {
    OR: [
      { id: numericId },
      { slug: key },
      { firebaseId: key },
      { config: { path: ['slugEn'], equals: key } },
    ],
  };
};

export const normalizeSlug = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
