// Fotos de minerar no modo leve (André 2026-11-25: "cliquei nos minérios de ferro... não aconteceu nada") num celular pequeno com a CPU 6x mais lenta (o
// "celular batata"). Liga o servidor com um banco temporário e o client/dist já construído (npm run build).
// Uso: node ferramentas/painel/leve-coleta-fotos.mjs <pasta das fotos>
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
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'leve-coleta-fotos-'));
const PORTA = 3300 + Math.floor(Math.random() * 200);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const contas = new Contas({ pasta, verificar: async () => ({ sub: 'leve-coleta-foto', email: 'f@leve.invalid', given_name: 'André' }) });
const a = await contas.entrar('x', 'criar'); contas.salvarPersonagem(a.conta.id, { nome: 'André', visual: 'ruiva', aparencia: null });
const mochila = Array(40).fill(null);
Object.assign(mochila, { 0: { k: 'carrinho', n: 1 }, 1: { k: 'galao', n: 4 }, 2: { k: 'lenha', n: 26 }, 3: { k: 'pocao', n: 5 }, 4: { k: 'picareta', n: 1 }, 5: { k: 'machado', n: 1 } });
// um pack de metal (feito no Malaquias) nas costas: o Seu Joca compra
contas.salvarProgresso(a.conta.id, { nivel: 31, ouro: 2300, mochila, pack: { k: 'metal', ox: 104, oz: -30, mo: 'm_metal' } });
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
const doca = async (t) => { await pg.locator('.doca button', { hasText: t }).click(); await esperar(900); };
const foto = async (n) => { await esperar(900); await pg.screenshot({ path: path.join(saida, n) }); console.log('foto', n); };
await pg.click('[data-aba=jogar]'); await esperar(800);
await pg.click('text=Entrar no mundo'); await esperar(4000);
await pg.locator('.janelaLeve button', { hasText: 'Entendi' }).click(); await esperar(800);
await pg.locator('.doca button', { hasText: 'Mochila' }).click(); await esperar(900); await foto('0-mochila-icones.png');
await pg.locator('.doca button', { hasText: 'Ir para' }).click(); await esperar(800);
await pg.locator('.sanfona>button.sec', { hasText: 'Recursos' }).click(); await esperar(800);
await pg.locator('.sanfona .linha', { hasText: 'Veio de pedra' }).first().click();
for (let i = 0; i < 200; i++) { await esperar(500); if (await pg.locator('text=Recursos aqui').count() && !(await pg.locator('#jogarStatus button', { hasText: 'Parar' }).count())) break; }
await foto('1-chegou-veio.png');
await pg.locator('#jogar .card button', { hasText: 'Minerar' }).first().click(); await esperar(2500); await foto('2-minerando.png'); await esperar(4000); await foto('2b-minerando-depois.png');
await esperar(8000); await foto('3-coletou.png');
await nav.close(); fim(); process.exit();
