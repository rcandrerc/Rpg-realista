// Fotos do modo leve (aba Jogar do painel do clã, André 2026-11-25) num celular pequeno com a CPU 6x mais lenta (o
// "celular batata"). Liga o servidor com um banco temporário e o client/dist já construído (npm run build).
// Uso: node ferramentas/painel/leve-fotos.mjs <pasta das fotos>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Contas } from '../../server/contas.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const saida = path.resolve(process.argv[2] || 'fotos-leve'); fs.mkdirSync(saida, { recursive: true });
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'leve-fotos-'));
const PORTA = 3300 + Math.floor(Math.random() * 200);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const contas = new Contas({ pasta, verificar: async () => ({ sub: 'leve-foto', email: 'f@leve.invalid', given_name: 'André' }) });
const a = await contas.entrar('x', 'criar'); contas.salvarPersonagem(a.conta.id, { nome: 'André', visual: 'ruiva', aparencia: null });
const mochila = Array(40).fill(null);
Object.assign(mochila, { 0: { k: 'minerio_ferro', n: 34 }, 1: { k: 'couro', n: 12 }, 2: { k: 'lenha', n: 60 }, 3: { k: 'carne', n: 8 }, 4: { k: 'pocao', n: 5 } });
contas.salvarProgresso(a.conta.id, { nivel: 31, ouro: 2300, mochila });
contas.db.close();
const srv = spawn(process.execPath, ['index.js'], { cwd: path.join(raiz, 'server'), env: { ...process.env, DADOS: pasta, PORT: String(PORTA) }, stdio: 'ignore' });
const fim = () => { try { srv.kill(); } catch { /* já saiu */ } fs.rmSync(pasta, { recursive: true, force: true }); };
process.on('exit', fim);
for (let i = 0; i < 360; i++) { try { if ((await fetch(`http://127.0.0.1:${PORTA}/saude`)).ok) break; } catch { /* ligando */ } await esperar(250); }
const nav = await chromium.launch();
const pg = await nav.newPage({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cdp = await pg.context().newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
pg.on('pageerror', (e) => console.log('ERRO NA PÁGINA', e.message));
await pg.goto(`http://127.0.0.1:${PORTA}/painel.html`);
await pg.evaluate((s) => localStorage.setItem('sessao', s), a.sessao);
await pg.reload(); await esperar(3000);
const irPara = async (sec, txt) => { // a lista Lugares em sanfona: abre a seção e toca no lugar
  const linha = pg.locator('.sanfona .linha', { hasText: txt });
  if (!(await pg.locator('.sanfona>button.sec').count())) { await pg.locator('.doca button', { hasText: 'Lugares' }).click(); await esperar(800); } // a barra embaixo do mapa
  if (!(await linha.count())) { await pg.locator('.sanfona>button.sec', { hasText: sec }).click(); await esperar(800); }
  await linha.first().click();
};
await pg.click('[data-aba=jogar]'); await esperar(800);
await pg.screenshot({ path: path.join(saida, '1-entrar.png') });
await pg.click('text=Entrar no mundo'); await esperar(4000);
await pg.screenshot({ path: path.join(saida, '2-no-mundo.png') });
// tempo de cada foto do servidor na CPU lenta (quanto a página trava a cada 0,5 s)
const ms = await pg.evaluate(() => new Promise((ok) => { const t = []; const o = new PerformanceObserver((l) => { for (const e of l.getEntries()) t.push(e.duration); }); o.observe({ type: 'longtask', buffered: false }); setTimeout(() => { o.disconnect(); ok(t); }, 5000); }));
console.log('tarefas longas (>50 ms) em 5 s com CPU 6x lenta:', ms.length, ms.map(Math.round).join(','));
await irPara('NPCs', 'Otávio'); await esperar(2500);
await pg.screenshot({ path: path.join(saida, '3-andando.png') });
await pg.click('[data-aba=jogar]'); // nada; só para segurar a aba
for (let i = 0; i < 120; i++) { if (await pg.locator('text=Otávio · Leilão').count()) break; await esperar(1000); }
await esperar(1500);
await pg.screenshot({ path: path.join(saida, '4-leilao.png'), fullPage: false });
await irPara('NPCs', 'Rosa');
for (let i = 0; i < 120; i++) { if (await pg.locator('text=Vender (toque no item)').count()) break; await esperar(1000); }
await esperar(800);
await pg.locator('#jogar .card .icones').last().locator('.ico').first().click(); await esperar(800);
await pg.screenshot({ path: path.join(saida, '5-loja.png'), fullPage: false });
await pg.click('.qtd-linha button.acao'); await esperar(2000);
await pg.screenshot({ path: path.join(saida, '6-vendeu.png'), fullPage: false });
await pg.fill('.chatEnvia input', 'Bom dia, clã!'); await pg.click('.chatEnvia button'); await esperar(2000);
await pg.locator('#jogarChat').scrollIntoViewIfNeeded(); await esperar(300);
await pg.screenshot({ path: path.join(saida, '7-chat.png') });
await nav.close(); fim(); process.exit();
