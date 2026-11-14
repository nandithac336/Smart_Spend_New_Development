import { AnimatePresence, m } from 'motion/react'
import { Input } from '@/components/ui/input.jsx'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

function AuthInput({ id, label, icon: Icon, error, trailing, ...inputProps }) {
  const motionDisabled = useMotionDisabled()

  return (
    <div className="min-w-0">
      <div className="group relative">
        <Icon aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <Input
          {...inputProps}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`auth-input peer h-14 rounded-xl pl-11 pr-11 pt-5 pb-1 ${inputProps.className ?? ''}`}
          placeholder=" "
        />
        <label
          className="pointer-events-none absolute left-11 top-1/2 z-10 -translate-y-1/2 text-sm text-muted-foreground transition-all duration-150 peer-focus:top-3.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[10px]"
          htmlFor={id}
        >
          {label}
        </label>
        {trailing}
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <m.p
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            className="overflow-hidden pt-1.5 text-sm text-destructive"
            exit={{ opacity: 0, height: 0, y: -4 }}
            id={`${id}-error`}
            initial={{ opacity: 0, height: 0, y: motionDisabled ? 0 : -4 }}
            role="alert"
            transition={{ duration: motionDisabled ? 0 : 0.18 }}
          >
            {error}
          </m.p>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AuthInput
