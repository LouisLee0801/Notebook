/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages 部署在 /Notebook/ 子路徑下；本機開發用根路徑
const base = process.env.GITHUB_PAGES ? '/Notebook/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    // PWA（#9）：手機瀏覽器開網址 → 加入主畫面 → 像 App 一樣使用、可離線開
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Notebook',
        short_name: 'Notebook',
        description: '視覺化知識管理筆記本',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        theme_color: '#111827',
        background_color: '#ffffff',
        lang: 'zh-Hant',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 單頁應用：導覽都回退到 index，離線也能開
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
