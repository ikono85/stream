import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { attachSync } from './server/sync.mjs'

/**
 * Runs the shared-room relay inside the dev server, on /sync, so `npm run dev`
 * stays the only command. Vite's own hot-reload socket uses a different path
 * and is untouched.
 */
function sync(): PluginOption {
  return {
    name: 'lucarne-sync',
    configureServer(server) {
      if (server.httpServer) attachSync(server.httpServer)
    },
    configurePreviewServer(server) {
      if (server.httpServer) attachSync(server.httpServer)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), sync()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  /**
   * strictPort: fail loudly rather than slide to 5174. The shared-room relay
   * lives in this server, so a second one on another port means two rooms
   * that cannot hear each other — a confusing failure to chase down.
   */
  server: { host: true, port: 5173, strictPort: true },
  preview: { host: true, port: 4173, strictPort: true },
})
