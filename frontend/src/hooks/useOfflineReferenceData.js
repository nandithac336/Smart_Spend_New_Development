import { useEffect, useState } from 'react'
import { getReferenceSnapshot, saveReferenceSnapshot } from '@/services/offlineSync.js'

export function useOfflineReferenceData(userId, name, data) {
  const [snapshot, setSnapshot] = useState(null)
  const [storageError, setStorageError] = useState(null)

  useEffect(() => {
    if (!userId) return
    let active = true
    const updateSnapshot = async () => {
      try {
        if (data !== undefined) {
          await saveReferenceSnapshot(userId, name, data)
          if (active) setSnapshot(data)
        } else {
          const cached = await getReferenceSnapshot(userId, name)
          if (active) setSnapshot(cached)
        }
      } catch (error) {
        if (active) setStorageError(error)
      }
    }
    updateSnapshot()
    return () => {
      active = false
    }
  }, [data, name, userId])

  return {
    data: data ?? snapshot,
    storageError,
  }
}
