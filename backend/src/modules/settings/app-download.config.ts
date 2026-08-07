export const APP_DOWNLOAD_REDIS_KEY = 'app:settings:app_download';

export type AppDownloadConfig = {
  enabled: boolean;
  playStoreUrl: string;
};

export const DEFAULT_APP_DOWNLOAD: AppDownloadConfig = {
  enabled: true,
  playStoreUrl: 'https://play.google.com/store/apps/details?id=vote.musicmundial.com',
};

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const normalizeAppDownloadConfig = (raw: unknown): AppDownloadConfig => {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const playStoreUrl = String(input.playStoreUrl ?? DEFAULT_APP_DOWNLOAD.playStoreUrl)
    .trim()
    .slice(0, 500);
  const enabled =
    typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_APP_DOWNLOAD.enabled;

  return {
    enabled,
    playStoreUrl: playStoreUrl || DEFAULT_APP_DOWNLOAD.playStoreUrl,
  };
};

export const buildAppDownloadPayload = (config: AppDownloadConfig) => ({
  enabled: config.enabled,
  playStoreUrl: config.playStoreUrl,
  visible: Boolean(config.enabled && config.playStoreUrl && isValidHttpUrl(config.playStoreUrl)),
});

export const assertAppDownloadUrl = (url: string) => {
  if (!isValidHttpUrl(url)) {
    throw new Error('La URL de Google Play no es valida.');
  }
};
