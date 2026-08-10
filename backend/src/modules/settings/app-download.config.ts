export const APP_DOWNLOAD_REDIS_KEY = 'app:settings:app_download';

export type AndroidEntryMode = 'off' | 'redirect' | 'modal';

export type AppDownloadConfig = {
  enabled: boolean;
  playStoreUrl: string;
  /** Bonus the first time the user opens the official mobile app. */
  firstOpenRewardEnabled: boolean;
  firstOpenRewardPoints: number;
  /**
   * What happens when someone opens the website on Android:
   * - off: nothing
   * - redirect: go straight to Google Play
   * - modal: show download prompt modal
   */
  androidEntryMode: AndroidEntryMode;
};

export const DEFAULT_APP_DOWNLOAD: AppDownloadConfig = {
  enabled: true,
  playStoreUrl: 'https://play.google.com/store/apps/details?id=vote.musicmundial.com',
  firstOpenRewardEnabled: true,
  firstOpenRewardPoints: 15,
  androidEntryMode: 'redirect',
};

const ANDROID_ENTRY_MODES: AndroidEntryMode[] = ['off', 'redirect', 'modal'];

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizePoints = (raw: unknown, fallback: number) => {
  const value = Math.floor(Number(raw));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(10000, value));
};

const normalizeAndroidEntryMode = (raw: unknown): AndroidEntryMode => {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (ANDROID_ENTRY_MODES.includes(value as AndroidEntryMode)) {
    return value as AndroidEntryMode;
  }
  return DEFAULT_APP_DOWNLOAD.androidEntryMode;
};

export const normalizeAppDownloadConfig = (raw: unknown): AppDownloadConfig => {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const playStoreUrl = String(input.playStoreUrl ?? DEFAULT_APP_DOWNLOAD.playStoreUrl)
    .trim()
    .slice(0, 500);
  const enabled =
    typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_APP_DOWNLOAD.enabled;
  const firstOpenRewardEnabled =
    typeof input.firstOpenRewardEnabled === 'boolean'
      ? input.firstOpenRewardEnabled
      : DEFAULT_APP_DOWNLOAD.firstOpenRewardEnabled;

  return {
    enabled,
    playStoreUrl: playStoreUrl || DEFAULT_APP_DOWNLOAD.playStoreUrl,
    firstOpenRewardEnabled,
    firstOpenRewardPoints: normalizePoints(
      input.firstOpenRewardPoints,
      DEFAULT_APP_DOWNLOAD.firstOpenRewardPoints,
    ),
    androidEntryMode: normalizeAndroidEntryMode(input.androidEntryMode),
  };
};

export const buildAppDownloadPayload = (config: AppDownloadConfig) => ({
  enabled: config.enabled,
  playStoreUrl: config.playStoreUrl,
  visible: Boolean(config.enabled && config.playStoreUrl && isValidHttpUrl(config.playStoreUrl)),
  firstOpenRewardEnabled: config.firstOpenRewardEnabled,
  firstOpenRewardPoints: config.firstOpenRewardPoints,
  androidEntryMode: config.androidEntryMode,
});

export const assertAppDownloadUrl = (url: string) => {
  if (!isValidHttpUrl(url)) {
    throw new Error('La URL de Google Play no es valida.');
  }
};
