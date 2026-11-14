import { useEffect, useState, useSyncExternalStore } from 'react'

const EFFECTS_KEY = 'smart-spend-effects'
const DEFAULT_EFFECTS_MODE = 'auto'
const EFFECTS_MODES = new Set(['auto', 'full', 'reduced'])

let forcedLowPower = false
const forceSubscribers = new Set()
const effectsSubscribers = new Set()

function normalizeEffectsMode(mode) {
  return EFFECTS_MODES.has(mode) ? mode : DEFAULT_EFFECTS_MODE
}

function safeStorageGet() {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(EFFECTS_KEY) : null
  } catch {
    return null
  }
}

function safeStorageSet(value) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(EFFECTS_KEY, value)
    }
  } catch {
    // Storage can be blocked in private mode; keep the in-memory setting.
  }
}

function getEffectsModeValue() {
  return normalizeEffectsMode(safeStorageGet())
}

export function getEffectsMode() {
  return getEffectsModeValue()
}

export function setEffectsMode(mode) {
  const nextMode = normalizeEffectsMode(mode)
  safeStorageSet(nextMode)
  const lowPower = nextMode === 'reduced' ? true : nextMode === 'full' ? false : detectLowPower()
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.lowPower = String(lowPower)
  }
  effectsSubscribers.forEach((callback) => callback())
  return nextMode
}

function subscribeToForcedLowPower(callback) {
  forceSubscribers.add(callback)
  return () => forceSubscribers.delete(callback)
}

function subscribeToEffectsMode(callback) {
  effectsSubscribers.add(callback)
  return () => effectsSubscribers.delete(callback)
}

function getForcedLowPower() {
  return forcedLowPower
}

function setForcedLowPower(enabled) {
  forcedLowPower = Boolean(enabled)
  forceSubscribers.forEach((callback) => callback())
}

function detectLowPower() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  const isSlowConnection =
    connection?.saveData === true ||
    connection?.effectiveType === '2g' ||
    connection?.effectiveType === 'slow-2g'
  const limitedHardware =
    (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2) ||
    (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2)

  return Boolean(isSlowConnection || limitedHardware)
}

function applyLowPowerAttribute(lowPower) {
  document.documentElement.dataset.lowPower = String(Boolean(lowPower))
}

export function useLowPower() {
  const [deviceLowPower, setDeviceLowPower] = useState(detectLowPower)
  const effectMode = useSyncExternalStore(subscribeToEffectsMode, getEffectsMode, () => DEFAULT_EFFECTS_MODE)
  const forceLowPower = useSyncExternalStore(
    subscribeToForcedLowPower,
    getForcedLowPower,
    () => false,
  )

  const lowPower =
    effectMode === 'reduced'
      ? true
      : effectMode === 'full'
        ? false
        : deviceLowPower || forceLowPower

  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    const update = () => setDeviceLowPower(detectLowPower())

    connection?.addEventListener?.('change', update)
    applyLowPowerAttribute(lowPower)

    return () => connection?.removeEventListener?.('change', update)
  }, [lowPower])

  return { lowPower, forceLowPower, setForceLowPower: setForcedLowPower }
}
