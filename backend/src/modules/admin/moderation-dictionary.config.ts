import { MOD_DICTIONARY_CONFIG_KEY } from '../../common/moderation-keys';

export { MOD_DICTIONARY_CONFIG_KEY };

export type CustomDictionaryPhrase = {
  id: string;
  phrase: string;
};

export type ModerationDictionaryConfig = {
  customPromo: CustomDictionaryPhrase[];
  customDiversion: CustomDictionaryPhrase[];
  disabledKeys: string[];
  updatedAt?: string;
};

export const DEFAULT_MODERATION_DICTIONARY_CONFIG: ModerationDictionaryConfig = {
  customPromo: [],
  customDiversion: [],
  disabledKeys: [],
};

const normalizePhraseList = (entries: unknown, fallbackId: string): CustomDictionaryPhrase[] => {
  if (!Array.isArray(entries)) return [];

  const seen = new Set<string>();
  const result: CustomDictionaryPhrase[] = [];

  for (const entry of entries) {
    const phrase = String((entry as CustomDictionaryPhrase)?.phrase || '').trim();
    if (phrase.length < 2 || phrase.length > 120) continue;

    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const id = String((entry as CustomDictionaryPhrase)?.id || fallbackId).trim() || fallbackId;
    result.push({ id, phrase });
  }

  return result;
};

export const normalizeModerationDictionaryConfig = (
  raw: Partial<ModerationDictionaryConfig> | null | undefined,
): ModerationDictionaryConfig => ({
  customPromo: normalizePhraseList(raw?.customPromo, 'custom_promo'),
  customDiversion: normalizePhraseList(raw?.customDiversion, 'custom_diversion'),
  disabledKeys: Array.isArray(raw?.disabledKeys)
    ? [...new Set(raw!.disabledKeys.map((key) => String(key || '').trim()).filter(Boolean))]
    : [],
  updatedAt: raw?.updatedAt || undefined,
});
