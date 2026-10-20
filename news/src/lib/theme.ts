export type SiteTheme = 'light' | 'dark'

const KEY = 'vmm-theme'

const readTheme = (): SiteTheme => {
  try {
    const stored = window.localStorage.getItem(KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const applyTheme = (theme: SiteTheme) => {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export const getTheme = (): SiteTheme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : readTheme()

export const setTheme = (theme: SiteTheme) => {
  applyTheme(theme)
  try {
    window.localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
}

export const toggleTheme = () => {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark')
}

applyTheme(readTheme())
