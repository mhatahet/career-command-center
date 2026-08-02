import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { jsonFileBridge } from './tooling/json-file-bridge'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), jsonFileBridge({ dataDir: path.resolve(__dirname, 'data') })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5273,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
