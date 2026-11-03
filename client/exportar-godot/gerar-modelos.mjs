// Gera godot-prototipo/modelos/ (pasta fora do git) sem abrir navegador na mão: vila, personagens, armas,
// monstros do Bestiário, máscara do chão, texturas e céu. Usado pelo build do APK (.github/workflows/apk.yml).
// Uso: com `npx vite --port 5173` rodando em client/, `node client/exportar-godot/gerar-modelos.mjs`
// (precisa do pacote playwright com o Chromium instalado).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(AQUI, '..', 'public');
const SAIDA = path.join(AQUI, '..', '..', 'godot-prototipo', 'modelos');
const URL_BASE = process.env.VITE_URL || 'http://localhost:5173';
fs.mkdirSync(SAIDA, { recursive: true });

const navegador = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function pagina() {
  const p = await navegador.newPage();
  p.on('console', (m) => { const t = m.text(); if (!t.startsWith('[vite]')) console.log('  ', t.slice(0, 160)); });
  p.on('pageerror', (e) => console.log('  erro:', e.message));
  // o vite manda o .json.gz com Content-Encoding: gzip e o navegador descompacta antes da hora; aqui vai cru
  await p.route(/\.json\.gz$/, async (r) => {
    const f = path.join(PUB, decodeURIComponent(new URL(r.request().url()).pathname));
    await r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': 'application/octet-stream' } });
  });
  return p;
}
const gravar = (nome, b64) => { fs.writeFileSync(path.join(SAIDA, nome), Buffer.from(b64, 'base64')); console.log('gravou', nome); };

// monstros (Puglin e Imp)
{
  const p = await pagina();
  await p.goto(`${URL_BASE}/exportar-bestiario-godot.html`);
  await p.waitForFunction(() => window.resultado && Object.keys(window.resultado).length >= 3, null, { timeout: 600000, polling: 2000 });
  const r = await p.evaluate(() => window.resultado);
  for (const [k, v] of Object.entries(r)) if (typeof v === 'string' && v.length > 100) gravar(k.toLowerCase().replace(/\.glb$/, '') + '.glb', v);
  await p.close();
}
// vila, personagens e armas
{
  const p = await pagina();
  await p.goto(`${URL_BASE}/exportar-godot/index.html`);
  await p.waitForFunction(() => window.__saida && (window.__saida.fim || window.__saida.erro), null, { timeout: 1800000, polling: 3000 });
  const s = await p.evaluate(() => window.__saida);
  if (s.erro) throw new Error(s.erro);
  for (const [k, v] of Object.entries(s)) {
    if (k === 'fim') continue;
    if (k === 'armas_json') gravar('armas.json', v); else gravar(k + '.glb', v);
  }
  // máscara do chão (trilhas de terra e praça), a mesma que o site pinta num canvas
  const png = await p.evaluate(async () => {
    const { mascaraVila } = await import('/src/vila.js');
    const { MAPA_CLAREIRA } = await import('/@id/@rpg/shared');
    const criar = document.createElement.bind(document); let cv;
    document.createElement = (t) => { const e = criar(t); if (t === 'canvas' && !cv) cv = e; return e; };
    mascaraVila(MAPA_CLAREIRA.vila, MAPA_CLAREIRA.mascara); document.createElement = criar;
    return cv.toDataURL('image/png').split(',')[1];
  });
  gravar('mascara_vila.png', png);
  // minimapa: o mapa todo pintado de cima (client/src/minimapa.js); nomes e o herói o app põe por cima
  const mini = await p.evaluate(async () => {
    const { desenharMinimapa } = await import('/src/minimapa.js');
    const { MAPA_CLAREIRA } = await import('/@id/@rpg/shared');
    return desenharMinimapa(MAPA_CLAREIRA).toDataURL('image/png').split(',')[1];
  });
  gravar('minimapa.png', mini);
  await p.close();
}
await navegador.close();
// texturas do chão (versão pintada) e céu
for (const n of ['forrest_ground_01', 'stony_dirt_path', 'cobblestone_floor_01']) fs.copyFileSync(path.join(PUB, 'assets/cenario/pintado', n + '.jpg'), path.join(SAIDA, n + '.jpg'));
fs.copyFileSync(path.join(PUB, 'assets/ceu/kloofendal_48d_partly_cloudy_puresky_1k.hdr'), path.join(SAIDA, 'ceu.hdr'));
console.log('modelos prontos em', SAIDA);
