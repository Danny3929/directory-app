import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Tests talk to a fake backend, never the real one.
    setupFiles: ['./src/test/setup.js'],
  },
})
