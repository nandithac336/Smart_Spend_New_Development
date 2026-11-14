import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ command, mode }) => {
  const { VITE_API_URL: apiUrl } = loadEnv(
    mode,
    fileURLToPath(new URL('.', import.meta.url)),
    'VITE_',
  )
  if (command === 'build') {
    if (!apiUrl?.trim()) {
      throw new Error('VITE_API_URL must be configured for production builds')
    }

    let parsedApiUrl
    try {
      parsedApiUrl = new URL(apiUrl.trim())
    } catch {
      throw new Error('VITE_API_URL must be an absolute HTTPS API URL')
    }
    if (parsedApiUrl.protocol !== 'https:' || !parsedApiUrl.pathname.replace(/\/+$/, '').endsWith('/api')) {
      throw new Error('VITE_API_URL must use HTTPS and end with /api')
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': 'http://localhost:5000',
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      maxWorkers: 2,
      testTimeout: 20_000,
    },
  }
})
