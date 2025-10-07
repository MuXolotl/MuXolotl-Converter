import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      fastRefresh: true,
      jsxRuntime: 'automatic',
    }),
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    hmr: { overlay: false },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'motion-vendor': ['framer-motion'],
          'tauri-vendor': ['@tauri-apps/api'],
          'icons-vendor': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', '@tauri-apps/api', 'lucide-react'],
  },
});
