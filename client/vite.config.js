import { defineConfig } from 'vite';
// base relativa: o mesmo build funciona no servidor próprio e no GitHub Pages (que fica numa subpasta)
export default defineConfig({ base: './', server: { port: 5173 }, build: { chunkSizeWarningLimit: 1500 } });
