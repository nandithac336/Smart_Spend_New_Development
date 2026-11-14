import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerServiceWorker } from './registerServiceWorker.js'

describe('registerServiceWorker', () => {
  afterEach(() => {
    delete navigator.serviceWorker
  })

  it('registers the static shell worker without caching API responses', async () => {
    const register = vi.fn().mockResolvedValue({ scope: '/' })
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    })

    await expect(registerServiceWorker()).resolves.toEqual({ scope: '/' })
    expect(register).toHaveBeenCalledWith('/service-worker.js', { updateViaCache: 'none' })
  })

  it('surfaces unsupported browser capability to its caller', async () => {
    delete navigator.serviceWorker
    await expect(registerServiceWorker()).rejects.toThrow('Service workers are not supported')
  })
})
