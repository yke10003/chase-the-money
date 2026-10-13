import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5179,
    strictPort: true,
  },
  preview: {
    port: 5179,
    strictPort: true,
  },
})
