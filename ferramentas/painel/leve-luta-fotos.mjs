// Fotos do combate e do time no modo leve (André 2026-11-25) num celular pequeno com a CPU 6x mais lenta (o
// "celular batata"). Liga o servidor com um banco temporário e o client/dist já construído (npm run build).
// Uso: node ferramentas/painel/leve-luta-fotos.mjs <pasta das fotos>
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
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'leve-luta-fotos-'));
const PORTA = 3300 + Math.floor(Math.random() * 200);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const contas = new Contas({ pasta, verificar: async () => ({ sub: 'leve-luta-foto', email: 'f@leve.invalid', given_name: 'André' }) });
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
const doca = async (t) => { await pg.locator('.doca button', { hasText: t }).click(); await esperar(900); };
const foto = async (n) => { await esperar(900); await pg.screenshot({ path: path.join(saida, n) }); console.log('foto', n); };
await pg.click('[data-aba=jogar]'); await esperar(800);
await pg.click('text=Entrar no mundo'); await esperar(4000);
await pg.locator('.janelaLeve button', { hasText: 'Entendi' }).click(); await esperar(800);
// vai até a caçada mais fraca (Ir para > Caçada) e espera chegar
await pg.locator('.doca button', { hasText: 'Ir para' }).click(); await esperar(800);
await pg.locator('.sanfona>button.sec', { hasText: 'Caçada' }).click(); await esperar(800);
await pg.locator('.sanfona .linha').first().click();
for (let i = 0; i < 150; i++) { await esperar(500); if (await pg.locator('#jogarHab').count()) break; }
await foto('0-cacada.png');
// procura um monstro: toca em pontos do mapa até abrir o quadrinho do alvo (o caminho andado não importa no teste)
const cv = await pg.locator('#mapa').boundingBox();
let achou = false;
for (let tent = 0; tent < 6 && !achou; tent++) {
  for (let yy = 0.3; yy < 0.7 && !achou; yy += 0.025) for (let xx = 0.3; xx < 0.75 && !achou; xx += 0.03) {
    await pg.mouse.click(cv.x + cv.width * xx, cv.y + cv.height * yy); await esperar(60);
    if (await pg.locator('#jogarAlvo').count()) achou = true;
  }
  if (!achou) await esperar(3000);
}
console.log('achou monstro', achou);
await foto('1-alvo.png');
if (achou) {
  await pg.locator('#jogarAlvo button', { hasText: 'Atacar' }).click();
  await esperar(1500); for (let i = 0; i < 40; i++) { if (!(await pg.locator('#jogarStatus button', { hasText: 'Parar' }).count()) && !(await pg.locator('#jogarAlvo button.acao').count())) break; await esperar(1000); }
  await foto('2-chegou.png');
  for (let i = 0; i < 6; i++) { await pg.locator('#jogarHab button.grande').click(); await esperar(400); }
  await foto('3-golpes.png');
  await pg.locator('#jogarHab button').nth(1).click(); await esperar(1200); await foto('4-habilidade.png');
  await pg.locator('#jogarHab button[data-po="pocao"]').click(); await esperar(1200); await foto('4b-pocao.png');
}
await pg.locator('.redondos button', { hasText: 'Time' }).click(); await esperar(900); await foto('5-time.png');
await nav.close(); fim(); process.exit();
