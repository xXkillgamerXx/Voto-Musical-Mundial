import { computed, ref } from 'vue'

export const THEME_STORAGE_KEY = 'vmm-theme'

const themes = ['dark', 'light']

const getPreferredTheme = () => {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

  if (themes.includes(storedTheme)) {
    return storedTheme
  }

  return window.matchMedia?.('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

export const activeTheme = ref(getPreferredTheme())

export const applyTheme = (theme) => {
  if (typeof document === 'undefined' || !themes.includes(theme)) {
    return
  }

  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export const setTheme = (theme) => {
  if (!themes.includes(theme)) {
    return
  }

  activeTheme.value = theme
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  applyTheme(theme)
}

export const toggleTheme = () => {
  setTheme(activeTheme.value === 'dark' ? 'light' : 'dark')
}

export const useTheme = () => ({
  activeTheme,
  isLightTheme: computed(() => activeTheme.value === 'light'),
  setTheme,
  toggleTheme,
})

applyTheme(activeTheme.value)
