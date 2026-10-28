import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base relativa + HashRouter: o mesmo build funciona em
// https://<org>.github.io/<repositório>/, num domínio próprio ou no `vite preview`.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5180 },
  // MUI + Markdown num só pacote: ~230 kB com gzip, aceitável para um site estático.
  build: { chunkSizeWarningLimit: 900 },
})
