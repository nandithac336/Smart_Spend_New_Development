import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'

function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <section className="glass-strong w-full max-w-md p-8 text-center">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you requested doesn&apos;t exist.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Go home</Link>
        </Button>
      </section>
    </main>
  )
}

export default NotFound
