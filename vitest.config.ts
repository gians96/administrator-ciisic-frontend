import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Pruebas unitarias de utilidades puras (formateo, errores, filtros).
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
