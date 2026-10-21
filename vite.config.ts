import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { attachSync } from './server/sync.mjs'
import { middlewareHeiwa } from './server/heiwa.mjs'
import { middlewareAdmin } from './server/adminVite.mjs'

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

/**
 * Le catalogue vient de HeiwaStream, que le navigateur ne peut pas appeler
 * lui-même : l'API ne renvoie pas d'en-tête CORS, et la clé ne doit pas
 * entrer dans le bundle. Le greffon monte donc le proxy sur /api/hs, en
 * développement comme en aperçu — voir server/heiwa.mjs.
 */
function heiwa(): PluginOption {
  return {
    name: 'lucarne-heiwa',
    configureServer(server) {
      server.middlewares.use(middlewareHeiwa())
    },
    configurePreviewServer(server) {
      server.middlewares.use(middlewareHeiwa())
    },
  }
}

/**
 * L'administration est une seconde entrée, pas une route du site. Son code
 * n'est référencé par aucune page publique, donc un visiteur ne le
 * télécharge jamais — et en production le serveur refuse de le servir sans
 * session. En développement, le greffon fait la même garde : /admin rend la
 * page de connexion tant qu'on n'est pas administrateur.
 */
function admin(): PluginOption {
  return {
    name: 'lucarne-admin',
    configureServer(server) {
      server.middlewares.use(middlewareAdmin())
    },
    configurePreviewServer(server) {
      server.middlewares.use(middlewareAdmin())
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), sync(), heiwa(), admin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    /**
     * Le manifeste dit quels fichiers appartiennent à quelle entrée. Le
     * serveur s'en sert pour refuser ceux qui n'appartiennent qu'à
     * l'administration, sans toucher à ceux que les deux partagent.
     */
    manifest: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
  /**
   * strictPort: fail loudly rather than slide to 5174. The shared-room relay
   * lives in this server, so a second one on another port means two rooms
   * that cannot hear each other — a confusing failure to chase down.
   */
  server: { host: true, port: 5173, strictPort: true },
  preview: { host: true, port: 4173, strictPort: true },
})
