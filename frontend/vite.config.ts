import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'))

// O navegador só conversa com o Vite: as chamadas saem como /api (relativas) e
// são repassadas ao Flask, que fica sempre nesta mesma máquina. Assim o app
// funciona de qualquer aparelho da rede sem IP fixo — e sem CORS.
const proxy = {
  '/api': { target: 'http://127.0.0.1:5001', changeOrigin: true },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  // host: true escuta em todas as interfaces, não só no localhost.
  server: { host: true, port: 5173, proxy },
  preview: { host: true, port: 4173, proxy },
})
