import { useEffect, useState } from 'react'
import { getEffectsMode, setEffectsMode } from '@/hooks/useLowPower.js'

const OPTIONS = [
  { value: 'auto', label: 'Auto', helper: 'Adapts to your device' },
  { value: 'full', label: 'Full', helper: 'All glass and animation effects' },
  { value: 'reduced', label: 'Reduced', helper: 'Flat surfaces and simple fades, uses less battery' },
]

function EffectsSetting() {
  const [mode, setMode] = useState(getEffectsMode)

  useEffect(() => {
    const updateMode = () => setMode(getEffectsMode())
    window.addEventListener('storage', updateMode)
    return () => window.removeEventListener('storage', updateMode)
  }, [])

  function chooseMode(nextMode) {
    setMode(setEffectsMode(nextMode))
  }

  return (
    <div aria-label="Effects mode" className="mt-5 grid gap-2" role="radiogroup">
      {OPTIONS.map(({ value, label, helper }) => (
        <button
          aria-checked={mode === value}
          className={`rounded-xl border px-3 py-3 text-left transition-colors ${mode === value ? 'border-primary bg-primary/8 text-foreground' : 'border-border bg-transparent text-muted-foreground hover:text-foreground'}`}
          key={value}
          onClick={() => chooseMode(value)}
          role="radio"
          type="button"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{label}</span>
            {mode === value && <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </button>
      ))}
    </div>
  )
}

export default EffectsSetting
