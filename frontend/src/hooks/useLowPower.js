import { useEffect, useState, useSyncExternalStore } from 'react'

let forcedLowPower = false
const subscribers = new Set()

function subscribeToForcedLowPower(callback) {
  subscribers.add(callback)
  return () => subscribers.delete(callback)
}

function getForcedLowPower() {
  return forcedLowPower
}

function setForcedLowPower(enabled) {
  forcedLowPower = Boolean(enabled)
  subscribers.forEach((callback) => callback())
}

function detectLowPower() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  const limitedHardware =
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)

  return Boolean(connection?.saveData || connection?.effectiveType === '2g' || limitedHardware)
}

export function useLowPower() {
  const [deviceLowPower, setDeviceLowPower] = useState(detectLowPower)
  const forceLowPower = useSyncExternalStore(
    subscribeToForcedLowPower,
    getForcedLowPower,
    () => false,
  )
  const lowPower = deviceLowPower || forceLowPower

  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    const update = () => setDeviceLowPower(detectLowPower())

    connection?.addEventListener?.('change', update)
    document.documentElement.dataset.lowPower = String(lowPower)

    return () => connection?.removeEventListener?.('change', update)
  }, [lowPower])

  return { lowPower, forceLowPower, setForceLowPower: setForcedLowPower }
}
