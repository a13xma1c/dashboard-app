/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tests': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Vendor libraries change far less often than app code — give them
        // their own long-cacheable chunks. Pages are lazy-loaded in App.tsx.
        codeSplitting: {
          groups: [
            { name: 'recharts', test: /node_modules[\\/](recharts|d3-|victory-vendor|es-toolkit|@reduxjs|immer|redux|reselect)/ },
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|react-router|@tanstack|axios|scheduler)/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Page tests render full Recharts SVG trees under jsdom; give them headroom on slow CI runners.
    testTimeout: 20_000,
    css: { modules: { classNameStrategy: 'non-scoped' } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.d.ts'],
    },
  },
})
