import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import os from 'os'

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  define: {
    __LOCAL_IP__: JSON.stringify(getLocalIp())
  },
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
