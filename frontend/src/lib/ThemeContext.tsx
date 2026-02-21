import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { themes, getThemeById, DEFAULT_THEME_ID, DEFAULT_PANEL_OPACITY, type Theme } from './themes'
import { interpolateThemeColors } from './colorExtractor'

type ThemeColors = Theme['colors']

// How much the video influences the base theme (0 = none, 1 = full override)
const AMBIENT_MIX = 0.10

interface ThemeContextValue {
  currentTheme: Theme
  setThemeById: (id: string) => void
  panelOpacity: number
  setPanelOpacity: (opacity: number) => void
  themes: Theme[]
  setAmbientColors: (colors: ThemeColors | null) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const TRANSITION_DURATION = 600 // ms for manual theme switches

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function applyColors(colors: ThemeColors) {
  const root = document.documentElement.style
  for (const [key, value] of Object.entries(colors)) {
    root.setProperty(key, value)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('wp_theme')
    return getThemeById(stored || DEFAULT_THEME_ID)
  })

  const [panelOpacity, setPanelOpacityState] = useState<number>(() => {
    const stored = localStorage.getItem('wp_panel_opacity')
    return stored ? parseFloat(stored) : DEFAULT_PANEL_OPACITY
  })

  // Animation refs (only used for manual theme transitions)
  const prevColorsRef = useRef<ThemeColors>(currentTheme.colors)
  const targetColorsRef = useRef<ThemeColors>(currentTheme.colors)
  const animationRef = useRef<number>(0)
  const animStartRef = useRef<number>(0)
  const currentThemeRef = useRef(currentTheme)

  useEffect(() => { currentThemeRef.current = currentTheme }, [currentTheme])

  const setAmbientColors = useCallback((colors: ThemeColors | null) => {
    // Blend video colors into the base theme and apply directly —
    // the hook drives smooth rAF drifting so no extra animation needed.
    if (colors) {
      const blended = interpolateThemeColors(currentThemeRef.current.colors, colors, AMBIENT_MIX)
      applyColors(blended)
    }
  }, [])

  const setThemeById = (id: string) => {
    const theme = getThemeById(id)
    setCurrentTheme(theme)
    localStorage.setItem('wp_theme', id)
  }

  const setPanelOpacity = (opacity: number) => {
    setPanelOpacityState(opacity)
    localStorage.setItem('wp_panel_opacity', String(opacity))
  }

  // Animated transition for manual theme switches
  useEffect(() => {
    const newTarget = currentTheme.colors

    prevColorsRef.current = targetColorsRef.current
    targetColorsRef.current = newTarget
    animStartRef.current = performance.now()

    const animate = (now: number) => {
      const elapsed = now - animStartRef.current
      const rawT = Math.min(elapsed / TRANSITION_DURATION, 1)
      const t = easeInOutCubic(rawT)

      const interpolated = interpolateThemeColors(prevColorsRef.current, targetColorsRef.current, t)
      applyColors(interpolated)

      if (rawT < 1) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    cancelAnimationFrame(animationRef.current)
    animationRef.current = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animationRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTheme.id])

  // Apply panel opacity separately
  useEffect(() => {
    document.documentElement.style.setProperty('--panel-opacity', String(panelOpacity))
  }, [panelOpacity])

  return (
    <ThemeContext.Provider value={{
      currentTheme,
      setThemeById,
      panelOpacity,
      setPanelOpacity,
      themes,
      setAmbientColors,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
