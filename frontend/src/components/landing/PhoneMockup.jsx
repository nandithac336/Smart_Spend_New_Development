import React from 'react'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

function Toast({ amount = 40, category = 'Food' }) {
  return (
    <div className="glass-strong rounded-lg p-3 w-64 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{category}</div>
          <div className="text-xs text-muted-foreground">Added</div>
        </div>
        <div className="text-sm font-bold">₹{amount}</div>
      </div>
    </div>
  )
}

export default function PhoneMockup() {
  const motionDisabled = useMotionDisabled()

  return (
    <div className="relative w-64">
      <div className="mx-auto w-52 rounded-3xl border border-border glass p-3">
        <div className="h-64 bg-gradient-to-b from-transparent to-transparent rounded-xl flex flex-col items-stretch gap-3 p-3">
          <div className="mt-auto">
            <div className="flex items-center gap-3">
              <input className="flex-1 rounded-md border border-input px-3 py-2 bg-transparent" placeholder="Add amount" aria-label="add amount" />
              <button className="rounded-md bg-primary px-3 py-2 text-primary-foreground">+ Add</button>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">Category • Food</div>
          </div>
        </div>
      </div>

      <div className={`absolute left-1/2 -translate-x-1/2 -bottom-8 w-full flex justify-center ${motionDisabled ? '' : 'animate-[float_3s_ease-in-out_infinite]'}`} style={{pointerEvents: 'none'}}>
        <div className="w-full flex justify-center">
          <Toast />
        </div>
      </div>

      <style>{`
        @keyframes float { 0%{transform:translateY(0)}50%{transform:translateY(-6px)}100%{transform:translateY(0)} }
      `}</style>
    </div>
  )
}
