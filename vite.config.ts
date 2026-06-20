import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/plugins': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'lucide-react': path.resolve(__dirname, 'node_modules/lucide-react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native-web'),
      '@saybridge/ui': path.resolve(__dirname, '../ui/src'),
      '@saybridge/composer': path.resolve(__dirname, '../composer/src'),
      '@saybridge/crypto': path.resolve(__dirname, '../crypto/src'),
    },
  },
})
