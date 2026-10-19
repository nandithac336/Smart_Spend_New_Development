import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { LazyMotion, MotionConfig, domMax } from 'motion/react'
import { queryClient } from './lib/queryClient.js'
import { useLowPower } from './hooks/useLowPower.js'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import { router } from './App.jsx'

const browserRouter = createBrowserRouter(router)

export function AppProviders() {
  useLowPower()

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={browserRouter} />
          <Toaster richColors position="top-right" />
        </QueryClientProvider>
      </LazyMotion>
    </MotionConfig>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
)
