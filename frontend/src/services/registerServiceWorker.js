export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.')
  }
  return navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' })
}
