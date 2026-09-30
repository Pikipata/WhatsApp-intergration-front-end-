import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.API_PROXY_TARGET || 'http://127.0.0.1:8000'
  const staffKey = process.env.API_STAFF_KEY || env.API_STAFF_KEY
  const apiProxy: ProxyOptions = {
    target: backend,
    changeOrigin: true,
    configure(proxy) {
      proxy.on('proxyReq', (proxyRequest) => {
        if (staffKey) proxyRequest.setHeader('Authorization', `Bearer ${staffKey}`)
      })
    },
  }

  return {
    plugins: [react()],
    server: { proxy: { '/api': apiProxy, '/health': apiProxy } },
  }
})
