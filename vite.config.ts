import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Shade Walk NYC',
        short_name: 'Shade Walk',
        description: 'Find a more shaded walk through New York City.',
        theme_color: '#173d35',
        background_color: '#f5f0e5',
        display: 'standalone',
        start_url: '/',
        icons: []
      }
    })
  ]
})
