import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';
import { PAGE_BACKGROUND, seasonOn } from './src/utils/season';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * The installed app's splash screen and task-switcher bar take their colours from the
 * manifest, which can't change at runtime. Each build writes in the dark page background of the
 * season it's built in, and deploy.yml rebuilds on the first day of every season; Android
 * picks the new colours up when it next refreshes the installed app. The manifest can't follow
 * each person's light/dark choice (Chrome never shipped dark manifest colours), and Peter chose
 * dark: no bright flash before a dark vault.
 */
function seasonalManifest(): Plugin {
  let outDir = 'dist';
  return {
    name: 'family-kitchen:seasonal-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    // After the public folder has been copied in.
    closeBundle() {
      const file = path.join(outDir, 'manifest.webmanifest');
      const manifest = JSON.parse(readFileSync(file, 'utf8'));
      const color = PAGE_BACKGROUND[seasonOn(new Date())].dark;
      manifest.theme_color = color;
      manifest.background_color = color;
      writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), seasonalManifest()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: Number(process.env.PORT) || 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          vendor: ['react', 'react-dom', 'lucide-react'],
        },
      },
    },
  },
});
