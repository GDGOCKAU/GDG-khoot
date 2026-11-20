/* `npm run phone`: the dev server over https so phones allow the share menu.
   Makes a self-signed certificate in .cert/ the first time (needs openssl, built into macOS). */
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
/* same proxy as vite.config.js, so phones on https reach the API and the live game */
import { proxy, allowedHosts } from './vite.config.js'

const key = '.cert/key.pem', cert = '.cert/cert.pem'
if (!fs.existsSync(key) || !fs.existsSync(cert)) {
  fs.mkdirSync('.cert', { recursive: true })
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${key} -out ${cert} -days 825 -subj "/CN=GDG KAUHOOT dev"`, { stdio: 'ignore' })
}

export default defineConfig({
  plugins: [react()],
  server: { host: true, proxy, allowedHosts, https: { key: fs.readFileSync(key), cert: fs.readFileSync(cert) } },
})
