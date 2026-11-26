// Foto da Patente de Guerra no painel do clã (André 2026-11-26): a parte "Guerra do mês" (placar Chama x Geada e o
// escudo com anel de cada um), igual à do jogo. Liga o servidor com um banco temporário e o client/dist já construído.
// Uso: node ferramentas/painel/patente-fotos.mjs <pasta das fotos>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Contas } from '../../server/contas.js';
import { mesGuerra } from '../../shared/dados.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const saida = path.resolve(process.argv[2] || 'fotos-patente'); fs.mkdirSync(saida, { recursive: true });
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'patente-fotos-'));
const PORTA = 3300 + Math.floor(Math.random() * 200);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const contas = new Contas({ pasta, verificar: async () => ({ sub: 'patente-foto', email: 'f@patente.invalid', given_name: 'André' }) });
const a = await contas.entrar('x', 'criar'); contas.salvarPersonagem(a.conta.id, { nome: 'André', visual: 'ruiva', aparencia: null });
const mes = mesGuerra();
const rec = (id, nome, g) => ({ id, nome, g, tier: 'recruta', nv: 30, nv0: 30, desde: Date.now() });
contas.salvarProgresso(a.conta.id, { nivel: 42, ouro: 2300, gu: { m: mes, a: 41, x: 3, l: 0, u: {} },
  cla: { n: 'Brasa Viva', cofre: 2400, sem: Date.now() + 5 * 864e5, m: [rec('rcflora01', 'Flora', 'f'), rec('rcbento01', 'Bento', 'm'), rec('rclia0001', 'Lia', 'f')] } });
contas.gravarMundo('guerra_mes', { m: mes, c: { ['jc' + a.conta.id]: 74 }, r: { chama: 137, geada: 118 } });
contas.db.close();
const srv = spawn(process.execPath, ['index.js'], { cwd: path.join(raiz, 'server'), env: { ...process.env, DADOS: pasta, PORT: String(PORTA) }, stdio: 'ignore' });
const fim = () => { try { srv.kill(); } catch { /* já saiu */ } fs.rmSync(pasta, { recursive: true, force: true }); };
process.on('exit', fim);
for (let i = 0; i < 360; i++) { try { if ((await fetch(`http://127.0.0.1:${PORTA}/saude`)).ok) break; } catch { /* ligando */ } await esperar(250); }
const nav = await chromium.launch();
const pg = await nav.newPage({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
pg.on('pageerror', (e) => console.log('ERRO NA PÁGINA', e.message));
await pg.goto(`http://127.0.0.1:${PORTA}/painel.html`);
await pg.evaluate((s) => localStorage.setItem('sessao', s), a.sessao);
await pg.reload(); await esperar(5000);
const card = pg.locator('.card', { hasText: 'Guerra do mês' });
console.log('cartão:', await card.count());
if (await card.count()) { await card.scrollIntoViewIfNeeded(); await esperar(600); await pg.screenshot({ path: path.join(saida, '4-painel-guerra.png') });
  await card.locator('.ico.pat').first().click(); await esperar(500); await pg.screenshot({ path: path.join(saida, '5-painel-toque.png') }); }
await nav.close();
process.exit(0);
