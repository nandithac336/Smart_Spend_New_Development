import { useCallback, useEffect, useRef } from 'react'

export function useDelayedAuthCommit(motionDisabled) {
  const pendingCommitRef = useRef(null)
  const successTimerRef = useRef(null)
  const successResolveRef = useRef(null)

  useEffect(() => () => {
    if (successTimerRef.current !== null) {
      window.clearTimeout(successTimerRef.current)
    }
    successTimerRef.current = null
    successResolveRef.current?.()
    successResolveRef.current = null
    const commit = pendingCommitRef.current
    pendingCommitRef.current = null
    commit?.()
  }, [])

  return useCallback(async (commit) => {
    pendingCommitRef.current = commit
    await new Promise((resolve) => {
      successResolveRef.current = resolve
      successTimerRef.current = window.setTimeout(() => {
        successResolveRef.current = null
        successTimerRef.current = null
        resolve()
      }, motionDisabled ? 0 : 450)
    })
    if (pendingCommitRef.current === commit) {
      pendingCommitRef.current = null
      commit()
    }
  }, [motionDisabled])
}
