import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react({
      babel: {
        plugins: ['@emotion/babel-plugin']
      }
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 512,
      compressionOptions: { level: 11 }
    }),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 512,
      compressionOptions: { level: 9 }
    }),
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'framer-motion', '@emotion/react', '@emotion/styled'],
          icons: ['react-icons'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log'],
        passes: 2,
        ecma: 2020
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    },
    reportCompressedSize: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', '@emotion/react', '@emotion/styled', 'react-icons'],
  },
})
