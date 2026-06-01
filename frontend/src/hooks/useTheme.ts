import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { cycleThemeMode, setThemeMode, syncAutoTheme } from '../store/slices/uiSlice'
import type { ThemeMode } from '../utils/theme'
import { applyThemeToDocument, THEME_MODE_ICONS, THEME_MODE_LABELS } from '../utils/theme'

export function useTheme() {
  const dispatch = useAppDispatch()
  const { themeMode, resolvedTheme } = useAppSelector(s => s.ui)

  useEffect(() => {
    applyThemeToDocument(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (themeMode !== 'auto') return
    dispatch(syncAutoTheme())
    const timer = window.setInterval(() => dispatch(syncAutoTheme()), 60_000)
    return () => window.clearInterval(timer)
  }, [themeMode, dispatch])

  const cycle = useCallback(() => dispatch(cycleThemeMode()), [dispatch])
  const setMode = useCallback((mode: ThemeMode) => dispatch(setThemeMode(mode)), [dispatch])

  return {
    themeMode,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    cycle,
    setMode,
    label: THEME_MODE_LABELS[themeMode],
    icon: THEME_MODE_ICONS[themeMode],
  }
}
