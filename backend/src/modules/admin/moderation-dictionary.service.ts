import { BadRequestException, Injectable } from '@nestjs/common';
import {
  dictionaryPhraseKey,
  listBuiltinDictionaryEntries,
  scanCommentDictionary,
  type CommentDictionaryScan,
  type DictionaryOverrides,
} from '../../common/moderation-dictionary';
import { RedisService } from '../redis/redis.service';
import {
  DEFAULT_MODERATION_DICTIONARY_CONFIG,
  MOD_DICTIONARY_CONFIG_KEY,
  ModerationDictionaryConfig,
  normalizeModerationDictionaryConfig,
} from './moderation-dictionary.config';
import type { UpdateModerationDictionaryDto } from './dto/update-moderation-dictionary.dto';

const CACHE_TTL_MS = 30_000;

@Injectable()
export class ModerationDictionaryService {
  private cache: { config: ModerationDictionaryConfig; expiresAt: number } | null = null;

  constructor(private readonly redis: RedisService) {}

  private invalidateCache() {
    this.cache = null;
  }

  async getConfig(): Promise<ModerationDictionaryConfig> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.config;
    }

    let config = { ...DEFAULT_MODERATION_DICTIONARY_CONFIG };

    try {
      const raw = await this.redis.client.get(MOD_DICTIONARY_CONFIG_KEY);
      if (raw) {
        config = normalizeModerationDictionaryConfig(JSON.parse(raw));
      }
    } catch {
      // Fall back to defaults when Redis is unavailable or payload is invalid.
    }

    this.cache = { config, expiresAt: now + CACHE_TTL_MS };
    return config;
  }

  async getOverrides(): Promise<DictionaryOverrides> {
    const config = await this.getConfig();
    return {
      customPromo: config.customPromo,
      customDiversion: config.customDiversion,
      disabledKeys: new Set(config.disabledKeys),
    };
  }

  async scanComment(text: string): Promise<CommentDictionaryScan> {
    const overrides = await this.getOverrides();
    return scanCommentDictionary(text, overrides);
  }

  async getAdminView() {
    const config = await this.getConfig();
    const disabled = new Set(config.disabledKeys);
    const builtin = listBuiltinDictionaryEntries();

    const mapBuiltin = (
      entries: Array<{
        id: string;
        phrase: string;
        type: 'promo' | 'diversion';
        key: string;
        categoryLabel: string;
        source: 'builtin';
      }>,
    ) =>
      entries.map((entry) => ({
        ...entry,
        enabled: !disabled.has(entry.key),
      }));

    const customPromo = config.customPromo.map((entry) => ({
      ...entry,
      type: 'promo' as const,
      key: dictionaryPhraseKey(entry.id, entry.phrase),
      categoryLabel: 'Personalizada · promo',
      source: 'custom' as const,
      enabled: true,
    }));

    const customDiversion = config.customDiversion.map((entry) => ({
      ...entry,
      type: 'diversion' as const,
      key: dictionaryPhraseKey(entry.id, entry.phrase),
      categoryLabel: 'Personalizada · diversion',
      source: 'custom' as const,
      enabled: true,
    }));

    const promo = [...mapBuiltin(builtin.promo), ...customPromo];
    const diversion = [...mapBuiltin(builtin.diversion), ...customDiversion];

    return {
      config: {
        customPromo: config.customPromo,
        customDiversion: config.customDiversion,
        disabledKeys: config.disabledKeys,
        updatedAt: config.updatedAt || null,
      },
      promo,
      diversion,
      regexes: builtin.regexes,
      stats: {
        builtinPromo: builtin.promo.length,
        builtinDiversion: builtin.diversion.length,
        enabledPromo: promo.filter((entry) => entry.enabled).length,
        enabledDiversion: diversion.filter((entry) => entry.enabled).length,
        customPromo: config.customPromo.length,
        customDiversion: config.customDiversion.length,
        disabledCount: config.disabledKeys.length,
      },
    };
  }

  async updateConfig(body: UpdateModerationDictionaryDto) {
    const current = await this.getConfig();
    const next = normalizeModerationDictionaryConfig({
      customPromo: (body.customPromo ?? current.customPromo) as ModerationDictionaryConfig['customPromo'],
      customDiversion: (body.customDiversion ?? current.customDiversion) as ModerationDictionaryConfig['customDiversion'],
      disabledKeys: body.disabledKeys ?? current.disabledKeys,
      updatedAt: new Date().toISOString(),
    });

    const totalCustom = next.customPromo.length + next.customDiversion.length;
    if (totalCustom > 500) {
      throw new BadRequestException('El diccionario personalizado no puede superar 500 frases.');
    }

    await this.redis.client.set(MOD_DICTIONARY_CONFIG_KEY, JSON.stringify(next));
    this.invalidateCache();
    return this.getAdminView();
  }

  async testPhrase(text: string) {
    const sample = String(text || '').trim();
    if (!sample) {
      throw new BadRequestException('Escribe un texto para probar.');
    }

    if (sample.length > 500) {
      throw new BadRequestException('El texto de prueba es demasiado largo.');
    }

    const scan = await this.scanComment(sample);
    return {
      text: sample,
      scan,
    };
  }
}
