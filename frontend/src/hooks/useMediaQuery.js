import { useCallback, useSyncExternalStore } from 'react'

function getMatches(query) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(query).matches
}

export function useMediaQuery(query) {
  const subscribe = useCallback((onChange) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}

    const mediaQueryList = window.matchMedia(query)
    mediaQueryList.addEventListener?.('change', onChange)

    return () => {
      mediaQueryList.removeEventListener?.('change', onChange)
    }
  }, [query])

  const getSnapshot = useCallback(() => getMatches(query), [query])
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export default useMediaQuery
