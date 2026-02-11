import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest',
      writeBundle() {
        // Copy manifest after build
        const manifestSrc = resolve(__dirname, 'src/manifest.json');
        const manifestDest = resolve(__dirname, 'dist/manifest.json');
        if (existsSync(manifestSrc)) {
          copyFileSync(manifestSrc, manifestDest);
          console.log('✅ Manifest copied');
        }
        // Copy index.html for iframe UI (loads main.js so it runs without page CSP blocking)
        const indexSrc = resolve(__dirname, 'src/index.html');
        const indexDest = resolve(__dirname, 'dist/index.html');
        if (existsSync(indexSrc)) {
          let html = readFileSync(indexSrc, 'utf-8');
          html = html.replace(/src="\/main\.jsx"/, 'src="main.js"');
          // Ensure Tailwind CSS loads in the iframe (extension doesn't get CSS from main.js import)
          if (!html.includes('assets/main.css')) {
            html = html.replace('</head>', '<link rel="stylesheet" href="assets/main.css">\n</head>');
          }
          writeFileSync(indexDest, html);
          console.log('✅ index.html copied');
        }
      },
    },
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/main.jsx'),
        content: resolve(__dirname, 'src/content/content.js'),
        background: resolve(__dirname, 'src/background/background.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'main') {
            return 'main.js';
          }
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'content.css') {
            return 'content.css';
          }
          return 'assets/[name].[ext]';
        },
      },
    },
    copyPublicDir: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
