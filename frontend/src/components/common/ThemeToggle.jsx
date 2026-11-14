import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

const STORAGE_KEY = 'smart-spend-theme'

function getSavedTheme() {
  try {
    const savedTheme = window.localStorage.getItem(STORAGE_KEY)
    return ['light', 'dark', 'system'].includes(savedTheme) ? savedTheme : 'system'
  } catch {
    return 'system'
  }
}

function saveTheme(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage can be blocked; keep the theme active for this session.
  }
}

function applyTheme(theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.classList.toggle('light', !dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

function ThemeToggle({ compact = false }) {
  const [theme, setTheme] = useState(getSavedTheme)
  const motionDisabled = useMotionDisabled()

  useEffect(() => {
    applyTheme(theme)
    saveTheme(theme)

    const handleThemeChange = (event) => setTheme(event.detail)
    const handleStorageChange = (event) => {
      if (event.key === STORAGE_KEY) setTheme(getSavedTheme())
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = () => {
      if (theme === 'system') applyTheme('system')
    }
    window.addEventListener('smart-spend-theme-change', handleThemeChange)
    window.addEventListener('storage', handleStorageChange)
    media.addEventListener('change', handleSystemThemeChange)
    return () => {
      window.removeEventListener('smart-spend-theme-change', handleThemeChange)
      window.removeEventListener('storage', handleStorageChange)
      media.removeEventListener('change', handleSystemThemeChange)
    }
  }, [theme])

  function changeTheme(nextTheme) {
    saveTheme(nextTheme)
    applyTheme(nextTheme)
    window.dispatchEvent(new CustomEvent('smart-spend-theme-change', { detail: nextTheme }))
    setTheme(nextTheme)
  }

  const choices = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  if (compact) {
    const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
    return (
      <Button
        aria-label={`Theme: ${theme}. Change theme`}
        className="size-10 rounded-xl"
        onClick={() => changeTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
        size="icon"
        title={`Theme: ${theme}`}
        variant="ghost"
      >
        <AnimatePresence initial={false} mode="wait">
          <m.span
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            className="inline-flex"
            exit={{ opacity: 0, rotate: motionDisabled ? 0 : -35, scale: 0.75 }}
            initial={{ opacity: 0, rotate: motionDisabled ? 0 : 35, scale: 0.75 }}
            key={theme}
            transition={{ duration: motionDisabled ? 0 : 0.16 }}
          >
            <Icon aria-hidden="true" className="size-4" />
          </m.span>
        </AnimatePresence>
      </Button>
    )
  }

  return (
    <div aria-label="Color theme" className="glass-flat grid grid-cols-3 gap-1 rounded-xl p-1" role="group">
      {choices.map(({ value, label, icon: Icon }) => (
        <button
          aria-pressed={theme === value}
          className={`relative flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs transition-colors ${theme === value ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          key={value}
          onClick={() => changeTheme(value)}
          type="button"
        >
          {theme === value && (
            <m.span
              className="absolute inset-0 rounded-lg bg-primary"
              layoutId="sidebar-theme-highlight"
              transition={motionDisabled ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 36 }}
            />
          )}
          <span className="relative z-10 inline-flex items-center gap-1.5">
            {theme === value && value !== 'system' ? (
              <AnimatePresence initial={false} mode="wait">
                <m.span
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  className="inline-flex"
                  exit={{ opacity: 0, rotate: motionDisabled ? 0 : -35, scale: 0.75 }}
                  initial={{ opacity: 0, rotate: motionDisabled ? 0 : 35, scale: 0.75 }}
                  key={value}
                  transition={{ duration: motionDisabled ? 0 : 0.16 }}
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                </m.span>
              </AnimatePresence>
            ) : <Icon aria-hidden="true" className="size-3.5" />}
            {label}
          </span>
        </button>
      ))}
    </div>
  )
}

export default ThemeToggle
