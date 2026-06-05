import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        workbox: {
          maximumFileSizeToCacheInBytes: 3000000,
        },
        manifest: {
          name: 'RumahSekolah',
          short_name: 'RumahSekolah',
          description: 'แพลตฟอร์มอีคอมเมิร์ซที่ทันสมัยและครบวงจร',
          theme_color: '#7C3AED',
          icons: [
            {
              src: 'icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve('.'),
        'firebase/firestore': path.resolve('./src/db.ts'),
        'firebase/auth': path.resolve('./src/auth.ts'),
        'firebase/storage': path.resolve('./src/storage_mock.ts'),
      },
    },
    server: {
      port: 3000,
      host: true,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
