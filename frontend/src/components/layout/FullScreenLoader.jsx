import Loader from '@/components/common/Loader.jsx'

function FullScreenLoader() {
  return (
    <main
      aria-label="Loading your account"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center"
      role="status"
    >
      <Loader className="text-primary" label="Loading your account" />
    </main>
  )
}

export default FullScreenLoader
