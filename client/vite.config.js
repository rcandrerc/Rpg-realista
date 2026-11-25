import { defineConfig } from 'vite';
// base relativa: o mesmo build funciona no servidor próprio e no GitHub Pages (que fica numa subpasta)
// painel.html: o painel leve do clã (André 2026-11-24), página à parte, sem 3D
export default defineConfig({ base: './', server: { port: 5173 }, build: { chunkSizeWarningLimit: 1500, rollupOptions: { input: { main: 'index.html', painel: 'painel.html' } } } });
