// Fotos do pack e do carrinho no modo leve (PR 2, André 2026-11-25) num celular pequeno com a CPU 6x mais lenta (o
// "celular batata"). Liga o servidor com um banco temporário e o client/dist já construído (npm run build).
// Uso: node ferramentas/painel/leve-pack-fotos.mjs <pasta das fotos>
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
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'leve-pack-fotos-'));
const PORTA = 3300 + Math.floor(Math.random() * 200);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const contas = new Contas({ pasta, verificar: async () => ({ sub: 'leve-pack-foto', email: 'f@leve.invalid', given_name: 'André' }) });
const a = await contas.entrar('x', 'criar'); contas.salvarPersonagem(a.conta.id, { nome: 'André', visual: 'ruiva', aparencia: null });
const mochila = Array(40).fill(null);
Object.assign(mochila, { 0: { k: 'carrinho', n: 1 }, 1: { k: 'galao', n: 4 }, 2: { k: 'lenha', n: 26 }, 3: { k: 'pocao', n: 5 } });
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
await pg.click('[data-aba=jogar]'); await esperar(800);
await pg.click('text=Entrar no mundo'); await esperar(4000);
const foto = async (n) => { await esperar(900); await pg.screenshot({ path: path.join(saida, n), fullPage: true }); console.log('foto', n); };
const tocar = async (t) => { await pg.locator(`#jogar button:has-text("${t}")`).first().click(); await esperar(1500); };
await foto('1-pack-nas-costas.png');
await tocar('Colocar carrinho');
await tocar('Pôr no carrinho');
await tocar('Pôr 1 galão');
await foto('2-carrinho.png');
await tocar('Dirigir');
await pg.click('.chips button:has-text("Mercador de pack")'); await esperar(2500);
await foto('3-dirigindo.png');
for (let i = 0; i < 90; i++) { if (await pg.locator('text=Material para fazer o pack').count()) break; await esperar(1000); }
await tocar('Descer');
await foto('4-mercador.png');
await tocar('Entregar do carrinho');
await foto('5-entregou.png');
await tocar('Fazer pack');
await foto('6-fazendo.png');
await nav.close(); fim(); process.exit();
