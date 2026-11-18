import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const obfuscatorPlugin = process.env.NODE_ENV === 'production'
  ? (await import('vite-plugin-javascript-obfuscator')).default
  : null

export default defineConfig({
  plugins: [
    react(),
    obfuscatorPlugin && obfuscatorPlugin({
      options: {
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.3,
        stringEncryption: true,
        stringEncryptionThreshold: 0.5,
        identifierNamesGenerator: 'hexadecimal',
        selfDefending: false,
        disableConsoleOutput: false,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
