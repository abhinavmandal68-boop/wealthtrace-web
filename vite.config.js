import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'firebase-vendor'
          if (id.includes('/framer-motion/') || id.includes('/motion-dom/') || id.includes('/motion-utils/')) return 'animation-vendor'
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charts-vendor'
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router')) return 'react-vendor'
          return undefined
        },
      },
    },
  },
})
