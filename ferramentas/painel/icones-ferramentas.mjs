// Picareta e machado no painel (André 2026-11-25: "onde tem Ma e Pi coloca o símbolo de uma picareta e de um machado"):
// o mesmo desenho do jogo (progresso.gd icone_item: picareta = pf_min, machado = pf_len), em 64 px.
// Uso: node ferramentas/painel/icones-ferramentas.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const nav = await chromium.launch(), pg = await nav.newPage({ viewport: { width: 64, height: 64 } });
for (const [k, svg] of [['picareta', 'pf_min'], ['machado', 'pf_len']]) {
  const s = fs.readFileSync(path.join(raiz, 'godot-prototipo/icones', svg + '.svg'), 'utf8').replace(/width="\d+" height="\d+"/, 'width="64" height="64"');
  await pg.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
  await pg.screenshot({ path: path.join(raiz, 'client/public/painel-icones', k + '.png'), omitBackground: true, clip: { x: 0, y: 0, width: 64, height: 64 } });
  console.log('ícone', k);
}
await nav.close();
