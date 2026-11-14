import { Delete } from 'lucide-react'
import Pressable from '@/components/motion/Pressable.jsx'
import { Button } from '@/components/ui/button.jsx'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace']

function NumberPad({ onKey }) {
  const motionDisabled = useMotionDisabled()

  return (
    <div aria-label="Amount keypad" className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <Pressable
          className="rounded-2xl"
          key={key}
        >
          <Button
            aria-label={key === 'backspace' ? 'Delete last digit' : key === '.' ? 'Decimal point' : `Number ${key}`}
            className={`h-14 w-full rounded-2xl text-xl font-semibold tabular-nums ${motionDisabled ? '' : 'active:scale-95'}`}
            onClick={() => onKey(key)}
            type="button"
            variant={key === 'backspace' ? 'outline' : 'secondary'}
          >
            {key === 'backspace' ? <Delete aria-hidden="true" className="size-5" /> : key}
          </Button>
        </Pressable>
      ))}
    </div>
  )
}

export default NumberPad
