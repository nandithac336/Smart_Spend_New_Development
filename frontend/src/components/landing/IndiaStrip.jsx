import React from 'react'

export default function IndiaStrip() {
  return (
    <div className="mx-auto max-w-6xl rounded-xl p-6 glass text-center">
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <div>
          <div className="text-sm font-semibold">India-first</div>
          <div className="text-xs text-muted-foreground">₹ amounts, UPI and cash support. Receipt scanning & voice entry: coming soon.</div>
        </div>
        <div className="mt-3 sm:mt-0">
          <div className="text-sm font-semibold">Works on ₹</div>
        </div>
      </div>
    </div>
  )
}
