import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: [
        'index.html',
        'como-jogar.html',
        'sobre.html',
        'privacidade.html',
      ],
    },
  },
  test: {
    environment: 'node',
    // calibration roda ~15min (travas de distribuição com N=600); fica em projeto próprio
    // para `npm test` seguir rápido. Ver HANDOFF "Débitos deferidos".
    projects: [
      {
        extends: true,
        test: { name: 'unit', exclude: ['**/node_modules/**', '**/calibration.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'calibration', include: ['tests/engine/calibration.test.ts'] },
      },
    ],
  },
})
