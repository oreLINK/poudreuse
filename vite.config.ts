import { defineConfig } from 'vite';

export default defineConfig({
  // chemins relatifs : le site fonctionne dans un sous-dossier (https://<compte>.github.io/<depot>/)
  base: './',
  worker: { format: 'es' },
  build: { target: 'es2020', chunkSizeWarningLimit: 800 },
});
