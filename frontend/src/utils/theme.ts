export type ThemeMode = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'buyzo_theme_mode'

/** 6:00 – 17:59 = sáng, còn lại = tối (giờ máy người dùng) */
export const DAY_START_HOUR = 6
export const DAY_END_HOUR = 18

export function isDaytime(date = new Date()): boolean {
  const hour = date.getHours()
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR
}

export function getAutoTheme(date = new Date()): ResolvedTheme {
  return isDaytime(date) ? 'light' : 'dark'
}

export function resolveThemeFromMode(mode: ThemeMode, date = new Date()): ResolvedTheme {
  if (mode === 'auto') return getAutoTheme(date)
  return mode
}

export function loadThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored
  return 'auto'
}

export function saveThemeMode(mode: ThemeMode): void {
  localStorage.setItem(THEME_STORAGE_KEY, mode)
}

export function applyThemeToDocument(theme: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

/** Gọi trước React render để tránh nháy theme */
export function initThemeOnLoad(): void {
  const mode = loadThemeMode()
  applyThemeToDocument(resolveThemeFromMode(mode))
}

export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  auto: 'Tự động',
  light: 'Sáng',
  dark: 'Tối',
}

export const THEME_MODE_ICONS: Record<ThemeMode, string> = {
  auto: '🌓',
  light: '☀️',
  dark: '🌙',
}
