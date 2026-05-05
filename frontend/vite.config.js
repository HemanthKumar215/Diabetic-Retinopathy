import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    proxy: {
      '/predict': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true
      },
      '/static': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true
      }
    }
  }
})
