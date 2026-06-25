import { createI18n } from 'vue-i18n'
import en from './locales/en'
import es from './locales/es'

export const DEFAULT_LOCALE = 'es'
export const LOCALE_STORAGE_KEY = 'vmm-locale'

export const availableLocales = [
  { code: 'es', labelKey: 'common.language.spanish' },
  { code: 'en', labelKey: 'common.language.english' },
]

const getStoredLocale = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE
  }

  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)

  return availableLocales.some((locale) => locale.code === storedLocale)
    ? storedLocale
    : DEFAULT_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: getStoredLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    es,
    en,
  },
})

export const setLocale = (locale) => {
  if (!availableLocales.some((item) => item.code === locale)) {
    return
  }

  i18n.global.locale.value = locale
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  document.documentElement.lang = locale
}

export const translate = (...args) => i18n.global.t(...args)

document.documentElement.lang = i18n.global.locale.value
