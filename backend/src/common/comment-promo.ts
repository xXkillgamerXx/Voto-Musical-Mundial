/**
 * Comentarios: diccionario barato, sin IA.
 * No bloquea al usuario por sospecha — solo detecta señales para alertas admin.
 * Los enlaces externos siguen bloqueados (regla dura, cero tokens).
 */

import {
  scanCommentDictionary,
  type CommentDictionaryScan,
} from './moderation-dictionary';

export { scanCommentDictionary, type CommentDictionaryScan };

export const BLOCKED_PROMO_MESSAGE =
  'No se permiten enlaces a otras páginas en comentarios.';

export const containsExternalLink = (text: string): boolean => {
  const scan = scanCommentDictionary(text);
  return scan.externalUrls.length > 0;
};

/** Solo bloquea URLs externas. El resto pasa y genera alerta aparte. */
export const isCommentHardBlocked = (text: string): boolean => containsExternalLink(text);

/** Compat legacy */
export const isCommentPromoBlocked = async (text: string): Promise<boolean> =>
  isCommentHardBlocked(text);

export const containsExternalPromoOrLink = (text: string): boolean =>
  containsExternalLink(text);

export const looksLikePossibleDiversion = (text: string): boolean => {
  const scan = scanCommentDictionary(text);
  return scan.primaryType === 'diversion' || scan.primaryType === 'promo';
};
