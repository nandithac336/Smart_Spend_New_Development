import axios from 'axios'
import { useEffect, useState } from 'react'

function HealthCheck() {
  const [status, setStatus] = useState('Checking backend...')

  useEffect(() => {
    let active = true

    async function checkBackend() {
      try {
        const response = await axios.get('/api/health')
        if (active && response.data.success) {
          setStatus('Backend: ok')
        } else if (active) {
          setStatus('Backend: the health endpoint returned an unexpected response.')
        }
      } catch (error) {
        if (active) {
          setStatus(
            `Backend: ${error.response?.data?.error?.message ?? error.message}`,
          )
        }
      }
    }

    checkBackend()
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
      <section className="w-full rounded-xl border bg-card p-8 text-card-foreground shadow-sm">
        <p className="mb-2 text-sm font-medium text-primary">Smart Spend</p>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight">
          Frontend setup check
        </h1>
        <p aria-live="polite" role="status" className="text-muted-foreground">
          {status}
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Temporary page for verifying the local API proxy.
        </p>
      </section>
    </main>
  )
}

export default HealthCheck
