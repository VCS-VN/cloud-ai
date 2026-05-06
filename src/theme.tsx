import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type AppTheme = 'dark' | 'light' | 'system'
export type EffectiveAppTheme = 'dark' | 'light'

type ThemeContextValue = {
  theme: AppTheme
  effectiveTheme: EffectiveAppTheme
  setTheme: (theme: AppTheme) => void
}

const THEME_STORAGE_KEY = 'cloud-ai-theme'
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getSystemTheme(): EffectiveAppTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function resolveTheme(theme: AppTheme): EffectiveAppTheme {
  return theme === 'system' ? getSystemTheme() : theme
}

function readSavedTheme(): AppTheme {
  if (typeof window === 'undefined') return 'dark'
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system' ? savedTheme : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('dark')
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveAppTheme>('dark')

  useEffect(() => {
    const savedTheme = readSavedTheme()
    const nextEffectiveTheme = resolveTheme(savedTheme)
    setThemeState(savedTheme)
    setEffectiveTheme(nextEffectiveTheme)
    document.documentElement.dataset.theme = nextEffectiveTheme
  }, [])

  useEffect(() => {
    if (theme !== 'system') return undefined

    const media = window.matchMedia('(prefers-color-scheme: light)')
    function handleSystemThemeChange() {
      const nextEffectiveTheme = resolveTheme('system')
      setEffectiveTheme(nextEffectiveTheme)
      document.documentElement.dataset.theme = nextEffectiveTheme
    }

    media.addEventListener('change', handleSystemThemeChange)
    return () => media.removeEventListener('change', handleSystemThemeChange)
  }, [theme])

  function setTheme(nextTheme: AppTheme) {
    const nextEffectiveTheme = resolveTheme(nextTheme)
    setThemeState(nextTheme)
    setEffectiveTheme(nextEffectiveTheme)
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    document.documentElement.dataset.theme = nextEffectiveTheme
  }

  const value = useMemo(() => ({ theme, effectiveTheme, setTheme }), [theme, effectiveTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider')
  return value
}
