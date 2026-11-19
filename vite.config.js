import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/* The app always calls its own origin; Vite forwards API, socket and image traffic to the
   backend. One address then works everywhere: localhost, the LAN IP, or a tunnel URL.
   KAUHOOT_API points at the backend (default: this machine, port 3000). */
const api = process.env.KAUHOOT_API || 'http://127.0.0.1:3000'
const proxy = {
  '/api': { target: api, changeOrigin: true },
  '/uploads': { target: api, changeOrigin: true },
  '/health': { target: api, changeOrigin: true },
  '/socket.io': { target: api, changeOrigin: true, ws: true },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
