// O pedaço de hoje (a Vila da Clareira e a mata em volta) nítido por cima do fundo do Mapa do painel do clã: o mesmo
// desenho do minimapa do jogo (client/src/minimapa.js), gravado em client/public/painel-vila.jpg.
// Uso: com `npx vite --port 5173` rodando em client/, `node ferramentas/painel/vila-painel.mjs`
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../server/', import.meta.url));
const { chromium } = require('playwright');
const URL_BASE = process.env.URL_BASE || 'http://localhost:5173';
const b = await chromium.launch(), p = await b.newPage();
await p.goto(`${URL_BASE}/painel.html`);
const jpg = await p.evaluate(async () => {
  const { desenharMinimapa } = await import('/src/minimapa.js');
  const { MAPA_CLAREIRA } = await import('/@id/@rpg/shared');
  const cv = desenharMinimapa(MAPA_CLAREIRA), m = document.createElement('canvas'); m.width = m.height = 768;
  m.getContext('2d').drawImage(cv, 0, 0, 768, 768);
  return [m.toDataURL('image/jpeg', 0.78).split(',')[1], JSON.stringify(MAPA_CLAREIRA.minimapa)];
});
await b.close();
const saida = new URL('../../client/public/painel-vila.jpg', import.meta.url);
fs.writeFileSync(saida, Buffer.from(jpg[0], 'base64'));
console.log('painel-vila.jpg', fs.statSync(saida).size >> 10, 'KB', jpg[1]);
