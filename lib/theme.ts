import type { UserSettings } from './types'

export type ThemePalette = 'ocaso' | 'brisa' | 'neon'

export const PALETTE_OPTIONS: Array<{ value: ThemePalette; label: string; description: string; swatches: string[] }> = [
  {
    value: 'ocaso',
    label: 'Ocaso',
    description: 'Rojo, sol y bosque',
    swatches: ['#b82f0f', '#ffde77', '#7ac9d8', '#3e868c', '#2f7059'],
  },
  {
    value: 'brisa',
    label: 'Brisa Coral',
    description: 'Menta, coral y arena',
    swatches: ['#8fd0c2', '#ef8c4d', '#9dd8cf', '#f0b7eb', '#3d2d27'],
  },
  {
    value: 'neon',
    label: 'Neón Rosa',
    description: 'Rosa, menta y grafito',
    swatches: ['#f49ce2', '#faf4ff', '#54d08a', '#3f725e', '#ff40ba'],
  },
]

export const DEFAULT_PALETTE: ThemePalette = 'ocaso'

export function getResolvedTheme(theme: UserSettings['theme']) {
  if (theme === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark' as const
    }

    return 'light' as const
  }

  return theme
}

export function applyThemeSettings(settings: Pick<UserSettings, 'theme' | 'palette'>) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const resolvedTheme = getResolvedTheme(settings.theme)

  root.classList.toggle('dark', resolvedTheme === 'dark')
  root.dataset.palette = settings.palette || DEFAULT_PALETTE
  root.style.colorScheme = resolvedTheme
}
