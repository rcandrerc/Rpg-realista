// Teste dos gêmeos (André 2026-11-27: "um robô que jogue pela interface do jogo leve... avaliar todas as diferenças, os
// bugs que encontrar. Eu preciso que essas duas versões estejam idênticas na questão do funcionamento. Uma não dê vantagem
// nenhuma ou prejudique"). Liga um servidor de teste local (banco temporário, o client/dist já construído) com dois heróis
// IGUAIS (mesmo nível, itens e lugar):
//   - Gêmeo Leve: joga pelo modo leve, num Chrome sem tela, tocando nos botões de verdade da aba Jogar do painel;
//   - Gêmeo Jogo: faz a mesma coisa pelo caminho do jogo completo (as mesmas mensagens que o app Godot manda).
// No fim compara os números dos dois (o servidor de teste mostra o estado e os eventos de cada um em /teste/gemeos, que só
// existe com ROBO_TESTE) e escreve o relatório: cada diferença vira uma linha. Nunca usa o servidor de verdade nem a conta
// do robô do teste 1-50. Não muda o modo leve: só anota.
// Uso: npm run build && node ferramentas/robo-leve/gemeos.mjs [--saida pasta] [--so nome1,nome2] [--fotos]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Client } from 'colyseus.js';
import { Contas } from '../../server/contas.js';
import { MAPA_CLAREIRA, HISTORIA, HEROI, MONTARIAS, HABS, TOTENS, CACA, VEICULOS, VOLTA_VILA } from '../../shared/index.js';
import { histNova } from '../../shared/historia.js';
import { planejarRota } from '../../shared/rota.js';
import { fundoAgua } from '../../shared/transporte.js';
import { Simulacao } from '../../shared/simulacao.js';
import { comparar, relatorioMd } from './comparar.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SAIDA = path.resolve(arg('saida', 'gemeos-relatorio')); fs.mkdirSync(SAIDA, { recursive: true });
const SO = arg('so', '') ? new Set(arg('so', '').split(',')) : null;
const FOTOS = process.argv.includes('--fotos');
const NIVEL = Number(arg('nivel', 30));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------- o servidor de teste e as duas contas iguais ----------
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'gemeos-'));
const PORTA = 3600 + Math.floor(Math.random() * 300), SEGREDO = 'gemeos-' + Math.random().toString(36).slice(2);
const HTTP = `http://127.0.0.1:${PORTA}`;
let n = 0;
const contas = new Contas({ pasta, verificar: async () => ({ sub: 'gemeo-' + ++n, email: `g${n}@gemeos.invalid`, given_name: 'Gemeo' + n }) });
const mochila = Array(40).fill(null);
Object.assign(mochila, { 0: { k: 'pocao', n: 10 }, 1: { k: 'pocao_mana', n: 10 }, 2: { k: 'barquinho', n: 1 }, 3: { k: 'carne', n: 5 } });
// pontos todos em vitalidade (2 por nível): os dois aguentam a caçada fraca sem morrer no meio dos testes
const progresso = () => ({ nivel: NIVEL, xp: 0, pontos: 0, atr: { for: 3, des: 3, int: 3, vit: 3 + (NIVEL - 1) * 2 }, ouro: 20000, mochila: structuredClone(mochila), hist: { ...histNova(), p: HISTORIA.length }, totens: TOTENS.lista.map((t) => t.id) });
const ca = await contas.entrar('a', 'criar'); contas.salvarPersonagem(ca.conta.id, { nome: 'Gemeo Leve', visual: 'ruiva', aparencia: null }); contas.salvarProgresso(ca.conta.id, progresso());
const cb = await contas.entrar('b', 'criar'); contas.salvarPersonagem(cb.conta.id, { nome: 'Gemeo Jogo', visual: 'ruiva', aparencia: null }); contas.salvarProgresso(cb.conta.id, progresso());
contas.db.close();
const NOME = { A: 'Gemeo Leve', B: 'Gemeo Jogo' };
const srv = spawn(process.execPath, ['index.js'], { cwd: path.join(raiz, 'server'), env: { ...process.env, DADOS: pasta, PORT: String(PORTA), ROBO_TESTE: SEGREDO }, stdio: ['ignore', 'pipe', 'pipe'] });
let srvLog = ''; srv.stdout.on('data', (d) => { srvLog += d; }); srv.stderr.on('data', (d) => { srvLog += d; });
const fim = () => { try { srv.kill(); } catch { /* já saiu */ } try { fs.rmSync(pasta, { recursive: true, force: true }); } catch { /* sem pasta */ } };
process.on('exit', fim);
log('ligando o servidor de teste');
for (let i = 0; i < 480; i++) { try { if ((await fetch(`${HTTP}/saude`)).ok) break; } catch { /* ligando */ } await esperar(250); }

// ---------- o estado dos dois, pelo servidor de teste ----------
let seq = 0; const eventos = [];
async function estado() {
  const r = await (await fetch(`${HTTP}/teste/gemeos?teste=${SEGREDO}&desde=${seq}`)).json();
  for (const e of r.eventos) { eventos.push(e); seq = Math.max(seq, e.s); }
  const por = Object.fromEntries(r.jogadores.map((j) => [j.nome, j]));
  return { tempo: r.tempo, A: por[NOME.A], B: por[NOME.B], inimigos: r.inimigos };
}
const eu = async (q) => (await estado())[q];
async function esperarAte(fn, ms, passo = 200) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await esperar(passo); } return null; }
const evDe = (id, desde, t) => eventos.filter((e) => e.s > desde && (e.de === id || e.para === id || e.id === id || e.alvo === id) && (!t || t.includes(e.t)));

// ---------- Gêmeo Jogo: o caminho do jogo completo (as mensagens do app, como ferramentas/robo/robo.mjs) ----------
const geo = new Simulacao(MAPA_CLAREIRA); const T = geo.terreno;
const B = { x: 0, y: 0, z: 0, ry: 0, pronto: false, rota: null, sala: null, corr: 0, montado: null, correcoes: 0, veiculo: null };
{
  const cli = new Client(`ws://127.0.0.1:${PORTA}`);
  B.sala = await cli.joinOrCreate('clareira', { sessao: cb.sessao, json: true, aoi: true });
  B.sala.onMessage('mundoJ', (txt) => {
    let m; try { m = JSON.parse(txt); } catch { return; }
    for (const j of m.foto?.jogadores || []) if (j.id === B.sala.sessionId) {
      B.montado = j.montado || null; B.morto = !!j.morto;
      if (!B.pronto || j.morto) { B.x = j.x; B.y = j.y; B.z = j.z; B.pronto = true; }
    }
    for (const e of m.eventos || []) {
      if (e.t === 'corrigir' && (!e.para || e.para === B.sala.sessionId)) { B.x = e.x; B.y = e.y; B.z = e.z; B.corr = e.c; B.correcoes++; }
      if (e.t === 'vila' && e.id === B.sala.sessionId && e.fase === 'chegou') { B.x = e.x; B.y = e.y; B.z = e.z; B.rota = null; }
    }
  });
  B.sala.onMessage('*', () => {});
  B.sala.send('idioma', { codigo: 'pt' });
}
const mandarB = (t, m) => B.sala.send(t, m);
const velB = () => (B.veiculo ? null : B.montado ? MONTARIAS[B.montado]?.correr || HEROI.correr : HEROI.correr);
let antes = performance.now();
const laçoB = setInterval(() => { // 20 posições por segundo, como o app; anda pela estrada na corrida (o joystick no fim)
  const agora = performance.now(), dt = Math.min(0.25, (agora - antes) / 1000); antes = agora;
  if (!B.pronto) return;
  let andou = false;
  if (B.rota?.length && !B.morto && !B.veiculo) {
    let resta = velB() * dt;
    while (resta > 0 && B.rota.length) {
      const p = B.rota[0], d = d2(B, p);
      if (d <= resta) { B.x = p.x; B.z = p.z; resta -= d; B.rota.shift(); continue; }
      B.ry = Math.atan2(p.x - B.x, p.z - B.z); B.x += (p.x - B.x) / d * resta; B.z += (p.z - B.z) / d * resta; resta = 0;
    }
    B.y = T.altura(B.x, B.z, B.y + 0.6); andou = true;
  }
  if (B.pausa > Date.now()) return; // rolada/flash: o servidor move o corpo; o app segue o movimento dele
  if (!B.veiculo) mandarB('pos', { x: +B.x.toFixed(3), y: +B.y.toFixed(3), z: +B.z.toFixed(3), ry: +B.ry.toFixed(3), anim: andou ? 'correr' : 'parado', c: B.corr });
}, 50);
// "Ir para" do mapa do jogo (rota.gd): estrada do planejarRota; viagem longa sobe no lobo (como o leve, LEVE.montaDe)
function irB(x, z) {
  const r = planejarRota(MAPA_CLAREIRA, B, { x, z });
  B.rota = r.pontos ? [...r.pontos] : [{ x, z }];
  let tam = 0, q = B; for (const p of B.rota) { tam += d2(q, p); q = p; }
  if (tam > 25 && !B.montado) mandarB('montar');
  return tam;
}
const virarB = (alvo) => { B.ry = Math.atan2(alvo.x - B.x, alvo.z - B.z); };

// ---------- Gêmeo Leve: a aba Jogar do painel, num Chrome sem tela, tocando nos botões ----------
const nav = await chromium.launch();
const pg = await nav.newPage({ viewport: { width: 400, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const errosPagina = [];
pg.on('pageerror', (e) => { errosPagina.push(e.message); log('ERRO NA PÁGINA', e.message); });
pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errosPagina.push('console: ' + m.text().slice(0, 200)); });
await pg.goto(`${HTTP}/painel.html`);
await pg.evaluate((s) => localStorage.setItem('sessao', s), ca.sessao);
await pg.reload(); await esperar(2500);
const foto = async (nome) => { if (FOTOS) await pg.screenshot({ path: path.join(SAIDA, nome + '.png') }).catch(() => {}); };
const tem = async (sel) => (await pg.locator(sel).count()) > 0;
async function clicar(sel, ms = 3000) { try { await pg.locator(sel).first().click({ timeout: ms }); return true; } catch { return false; } }
await clicar('[data-aba=jogar]'); await esperar(800);
await clicar('text=Entrar no mundo', 8000); await esperar(3500);
await clicar('.janelaLeve button:has-text("Entendi")', 2000); await esperar(500);
await foto('0-entrou');
log('entrou no leve');
if (process.argv.includes('--explorar')) { // lista os botões da tela (para ajustar o robô quando a tela do leve muda)
  const dump = async (t) => console.log(t, JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => [b.id, b.className, b.title, b.textContent.trim().slice(0, 30)]))));
  await dump('TELA');
  for (const t of (arg('explorar', '') || '').split(',').filter((x) => x && !x.startsWith('-'))) { await pg.locator(`button[title="${t}"], button:has-text("${t}")`).first().click({ timeout: 2000 }).catch((e) => console.log('não clicou', t)); await esperar(900); await dump('DEPOIS ' + t); await pg.screenshot({ path: path.join(SAIDA, 'explorar-' + t + '.png') }); }
  await nav.close(); fim(); process.exit(0);
}

// tocar num ponto do mundo pelo mapa: o mapa segue o herói (centro = herói) e span metros cabem na largura; o span é
// medido tocando uma vez ao lado e lendo o destino que o servidor recebeu
let span = null;
async function caixaMapa() { return pg.locator('#mapa').boundingBox(); }
async function calibrar() {
  const cv = await caixaMapa(), a = await eu('A');
  if (process.env.GEMEOS_DEPURAR) console.log('CAL', JSON.stringify(cv), await pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '#' + e.id + '.' + e.className + ' pe=' + getComputedStyle(e).pointerEvents + ' z=' + getComputedStyle(e).zIndex + ' pai=' + (e.parentElement?.id || e.parentElement?.className) : 'nada'; }, [cv.x + cv.width / 2 + 60, cv.y + cv.height / 2]));
  await pg.touchscreen.tap(cv.x + cv.width / 2 + 60, cv.y + cv.height / 2);
  const r = await esperarAte(async () => (await eu('A'))?.leveRota?.fim, 3000);
  await clicarParar();
  if (!r) return null;
  const d = Math.hypot(r.x - a.x, r.z - a.z); span = d * cv.width / 60;
  return span;
}
async function clicarParar() { await pg.locator('button:has-text("Parar")').first().click({ timeout: 800 }).catch(() => {}); await esperar(300); }
async function tocarMundo(x, z) {
  if (!span) await calibrar();
  if (!span) return false;
  const cv = await caixaMapa(), a = await eu('A');
  const k = cv.width / span, px = cv.x + cv.width / 2 + (x - a.x) * k, py = cv.y + cv.height / 2 + (z - a.z) * k;
  if (px < cv.x + 5 || px > cv.x + cv.width - 5 || py < cv.y + 60 || py > cv.y + cv.height - 160) return false; // fora do que se vê (HUD em cima, golpes embaixo)
  await pg.touchscreen.tap(px, py); return true;
}
// "Ir para" do mapa geral (como o do jogo): toca no minimapa, busca o nome na lista Lugares, toca na linha (marca) e no
// "Ir para ›". A tela do leve muda muito (o irmão do André mexe nela): sem a busca, tenta a sanfona antiga
async function irPara(sec, txt) {
  await clicar('#miniJogo', 2000); await esperar(700);
  const busca = pg.locator('.listaMapa input.busca');
  if (!(await busca.count())) await clicar('button.botaoLista', 1000);
  if (await busca.count()) {
    await busca.first().fill(txt); await esperar(500);
    const linha = pg.locator('.listaMapa .linha', { hasText: txt });
    if (await linha.count()) {
      await linha.first().click(); await esperar(400);
      if (!(await clicar('button.irMarcado', 1500))) await linha.first().click().catch(() => {});
      await esperar(400); return true;
    }
  }
  if (!(await tem('.sanfona>button.sec'))) { await clicar('.doca button:has-text("Ir para")', 800) || await clicar('.doca button:has-text("Lugares")', 800); await esperar(700); }
  const linha = pg.locator('.sanfona .linha', { hasText: txt });
  if (!(await linha.count())) { await clicar(`.sanfona>button.sec:has-text("${sec}")`, 800); await esperar(700); }
  if (!(await linha.count())) { await pg.keyboard.press('Escape').catch(() => {}); return false; }
  await linha.first().click(); await esperar(400); return true;
}

// o joystick do leve (canto de baixo à esquerda): segura e arrasta na direção do ponto (no mapa, x vai para a direita e z
// para baixo), até chegar ou o tempo acabar
async function andarJoy(x, z, ms = 60e3) {
  const t0 = Date.now(), j0 = { x: 75, y: (await pg.viewportSize()).height - 120 };
  await pg.mouse.move(j0.x, j0.y); await pg.mouse.down();
  let ok = false;
  while (Date.now() - t0 < ms) {
    const a = await eu('A'), d = Math.hypot(x - a.x, z - a.z);
    if (d < 2) { ok = true; break; }
    const k = Math.min(1, d / 6) * 45; await pg.mouse.move(j0.x + (x - a.x) / d * k, j0.y + (z - a.z) / d * k);
    await esperar(250);
  }
  await pg.mouse.up(); return ok;
}
// o que fica embaixo do dedo em cada ponto da tela (o jogo: o mapa em volta do herói e o joystick respondem ao toque)
async function testeToque() {
  const vp = pg.viewportSize(), pontos = [['herói (centro do mapa)', vp.width / 2, vp.height / 2, 'mapa'], ['mapa, acima do herói', vp.width / 2, vp.height * 0.3, 'mapa'], ['mapa, abaixo do herói', vp.width / 2 - 40, vp.height * 0.62, 'mapa'], ['joystick (canto de baixo à esquerda)', 75, vp.height - 120, 'joystick']];
  const A = {}, Bv = {};
  for (const [nome, x, y, quer] of pontos) {
    const o = await pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id === 'mapa' ? 'mapa' : e.closest('.joyZona') ? 'joystick' : e.closest('button') ? 'botão ' + (e.closest('button').title || e.closest('button').textContent.trim().slice(0, 20)) : (e.className || e.tagName) + '') : 'nada'; }, [x, y]);
    A[nome] = o; Bv[nome] = quer;
  }
  anotar('Toque na tela (o que pega o dedo)', { A, B: Bv, nota: 'no leve, um toque que cai numa camada por cima do mapa não anda nem mira' });
}

// ---------- os testes ----------
const resultados = [];
function anotar(nome, o) { resultados.push({ nome, ...o }); log('TESTE', nome, JSON.stringify(o).slice(0, 400)); }
const vale = (nome) => !SO || SO.has(nome);
const nasc = MAPA_CLAREIRA.nascimento;

// juntar os dois no mesmo ponto antes de cada teste (o leve pelo mapa, o jogo pela estrada)
async function juntar(x, z, ms = 90e3) {
  irB(x, z);
  if (d2(await eu('A'), { x, z }) < 150) { await andarJoy(x, z, ms); return esperarAte(async () => { const s = await estado(); return d2(s.A, { x, z }) < 4 && d2(s.B, { x, z }) < 4 && !B.rota?.length; }, 60e3, 400); }
  let ok = await tocarMundo(x, z);
  if (!ok) { // longe para o mapa: aproxima por partes (o mapa segue o herói)
    for (let i = 0; i < 12 && !ok; i++) { const a = await eu('A'), d = Math.hypot(x - a.x, z - a.z), k = Math.min(1, (span * 0.3) / d); await tocarMundo(a.x + (x - a.x) * k, a.z + (z - a.z) * k); await esperarAte(async () => !(await eu('A')).leveRota, 30e3); ok = await tocarMundo(x, z); }
  }
  if (!(await esperarAte(async () => d2(await eu('A'), { x, z }) < 4 && !(await eu('A')).leveRota, 20e3, 500))) await andarJoy(x, z, ms);
  return esperarAte(async () => { const s = await estado(); return s.A && s.B && d2(s.A, { x, z }) < 4 && d2(s.B, { x, z }) < 4 && !s.A.leveRota && !B.rota?.length; }, ms, 400);
}

async function testeEntrada() {
  const s = await estado();
  const campos = ['vidaMax', 'manaMax', 'vida', 'mana'], st = ['danoFisico', 'danoMagico', 'defesa', 'critico', 'recarga', 'reducao', 'vidaMax', 'manaMax', 'estaminaMax'];
  const f = (j) => ({ ...Object.fromEntries(campos.map((k) => [k, Math.round(j[k])])), ...Object.fromEntries(st.map((k) => ['st.' + k, Math.round((j.st?.[k] ?? 0) * 1000) / 1000])), modo: j.modo, distNascimento: Math.round(d2(j, nasc)) });
  anotar('Entrar no mundo', { A: f(s.A), B: f(s.B), tol: { distNascimento: 3 } });
}

async function testeViagem(nome, sec, txt, alvo) {
  const s0 = await estado();
  // o tempo conta do começo da caminhada de cada um (o leve: quando o servidor recebeu o destino; os toques no menu não contam)
  const tocou = await irPara(sec, txt);
  const tA0 = (await esperarAte(async () => (await eu('A'))?.leveRota && Date.now(), 4000, 100)) || Date.now();
  const t0 = Date.now(); irB(alvo.x, alvo.z);
  let tA = null, tB = null, montA = false, montB = false;
  await esperarAte(async () => {
    const s = await estado();
    if (s.A?.montado) montA = true; if (B.montado) montB = true;
    if (tA == null && s.A && !s.A.leveRota && d2(s.A, alvo) < 5) tA = (Date.now() - tA0) / 1000;
    if (tB == null && s.B && !B.rota?.length && d2(s.B, alvo) < 5) tB = (Date.now() - t0) / 1000;
    return tA != null && tB != null;
  }, 240e3, 250);
  const s = await estado();
  anotar(nome, {
    A: { achouNaLista: tocou, segundos: tA, subiuNoLobo: montA, chegou: tA != null, distFim: s.A && Math.round(d2(s.A, alvo)) },
    B: { achouNaLista: true, segundos: tB, subiuNoLobo: montB, chegou: tB != null, distFim: s.B && Math.round(d2(s.B, alvo)), correcoes: B.correcoes },
    tol: { segundos: 0.2, distFim: 3 }, ignora: ['correcoes'],
    nota: `de ${Math.round(d2(s0.A || nasc, alvo))} m`,
  });
}

// acha um monstro de verdade perto de cada um (o campo mais fraco) e luta: golpe básico, segurando o botão
function maisPerto(s, j, raio = 25, fora = null) {
  let b = null, md = raio;
  for (const e of s.inimigos) { if (e.treino || e.id === fora) continue; const d = d2(j, e); if (d < md) { md = d; b = e; } }
  return b;
}
async function mirarA(e) { // toca no monstro no mapa (o mapa muda o zoom na luta: mede de novo) até abrir o quadrinho do alvo
  await calibrar();
  const achou = async () => { if (!(await tem('#jogarAlvo'))) return null; const s = await estado(); return maisPerto(s, s.A, 30); };
  if (await achou()) return achou();
  const offs = [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]];
  for (let i = 0; i < 2; i++) for (const [ox, oz] of offs) {
    const s = await estado(), m = s.inimigos.find((o) => o.id === e.id) || maisPerto(s, s.A, 15); if (!m) return null;
    await tocarMundo(m.x + ox, m.z + oz); await esperar(250);
    if (process.env.GEMEOS_DEPURAR && i === 0 && ox === 0 && oz === 0) { const a = (await estado()).A, cv = await caixaMapa(); console.log('MIRA', JSON.stringify({ span, heroi: [a.x, a.z], monstro: [m.x, m.z], px: [(m.x - a.x) * cv.width / span, (m.z - a.z) * cv.width / span] })); await pg.screenshot({ path: path.join(SAIDA, 'mira.png') }); }
    if (await tem('#jogarAlvo')) return m;
  }
  // a conta do zoom não bateu: varre a área em volta do herói tocando de 25 em 25 px (como um dedo procurando o ponto laranja)
  const cv = await caixaMapa();
  for (let r = 25; r <= 150; r += 25) for (let a = 0; a < 360; a += 30) {
    await pg.touchscreen.tap(cv.x + cv.width / 2 + Math.cos(a * Math.PI / 180) * r, cv.y + cv.height / 2 + Math.sin(a * Math.PI / 180) * r); await esperar(120);
    if (await tem('#jogarAlvo')) { log('mirar: achou varrendo (a conta do zoom do mapa errou)'); return achou(); }
  }
  return null;
}
// o Gêmeo Jogo luta sozinho como o dedo no botão do jogo: anda até o monstro mais perto e manda o básico a cada 0,2 s
let lutaB = null, lutaAnda = false; // lutaAnda: vai até o monstro (o Atacar do leve anda; segurar o básico não)
function lutarB(on) {
  if (!on) { clearInterval(lutaB); lutaB = null; B.rota = null; return; }
  lutaB = setInterval(async () => {
    const s = await estado().catch(() => null); if (!s?.B || s.B.morto) return;
    const b = maisPerto(s, s.B, 20); if (!b) return;
    virarB(b);
    if (lutaAnda && d2(s.B, b) > 2.2) { B.rota = [{ x: b.x - Math.sin(B.ry) * 1.6, z: b.z - Math.cos(B.ry) * 1.6 }]; return; }
    B.rota = null; mandarB('habQ', { id: 'espada_basico', v: b.v, b: true });
  }, 200);
}
async function lutaBasica(segundos = 12) {
  const s0 = await estado();
  const eA = maisPerto(s0, s0.A, 30);
  if (!eA) return anotar('Golpe básico (segurando)', { erro: 'sem monstro perto', A: {}, B: {} });
  // os dois ficam onde chegaram (os monstros vêm) e seguram o básico: o servidor mira no mais perto, nos dois
  lutaAnda = false; lutarB(true);
  // Leve: segura o botão grande (o básico), como o dedo no jogo. Jogo: o laço acima (um 'habQ' do básico a cada 0,2 s)
  const desde = seq, t0 = Date.now(), sA = await estado();
  const bt = pg.locator('.habLeve button.grande').first();
  const temBotao = (await bt.count()) > 0, caixa = temBotao ? await bt.boundingBox() : null;
  if (caixa) { await pg.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2); await pg.mouse.down(); }
  await esperar(segundos * 1000);
  if (caixa) await pg.mouse.up();
  const s = await estado();
  lutarB(false);
  const resumo = (j) => {
    const ev = evDe(j.id, desde, ['dano']).filter((e) => e.de === j.id && e.alvo !== j.id);
    const ns = ev.map((e) => e.n);
    return { golpes: ns.length, porSeg: Math.round(ns.length / segundos * 10) / 10, danoMedio: ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : 0, criticos: ev.filter((e) => e.crit).length, morreu: !!evDe(j.id, desde, ['aviso']).find((e) => /levanta de novo|caiu/i.test(e.texto || '')) };
  };
  anotar('Golpe básico (segurando)', {
    A: { botaoNaTela: temBotao, ...resumo(s.A) },
    B: { botaoNaTela: true, ...resumo(s.B) },
    tol: { porSeg: 0.25, golpes: 0.25, danoMedio: 0.3, criticos: 99 }, ignora: ['morreu'], nota: `${segundos} s segurando; monstro ${eA.nome} Nv ${eA.nivel}`,
  });
  await foto('2-luta');
}

// os dois de volta no campo de caça (morreram, ou o teste anterior levou para longe)
async function garantirCampo() {
  const s = await estado(); if (!campo || (d2(s.A, campo) < 15 && d2(s.B, campo) < 15 && !s.A.morto && !s.B.morto)) return;
  await esperarAte(async () => { const q = await estado(); return !q.A.morto && !q.B.morto; }, 30e3);
  if (d2((await estado()).A, campo) >= 15) await irPara('Caçada', campo.nome);
  if (d2((await estado()).B, campo) >= 15) irB(campo.x, campo.z);
  await esperarAte(async () => { const q = await estado(); return d2(q.A, campo) < 6 && d2(q.B, campo) < 6 && !q.A.leveRota && !B.rota?.length; }, 120e3, 400);
}
// os dois com a vida abaixo do máximo (cura e poção não saem de vida cheia): espera os bichos baterem, sem revidar
async function feridos() { lutarB(false); await garantirCampo(); await esperar(4000); /* a recarga da tentativa anterior */ await esperarAte(async () => { const q = await estado(); return q.A.vida < q.A.vidaMax * 0.95 && q.B.vida < q.B.vidaMax * 0.95; }, 25e3, 400); }
// Cura (o botão de baixo do golpe): os dois tomam dano na luta; quanto cada um curou e se entrou em recarga
async function testeCura() {
  await feridos();
  const s0 = await estado(), desde = seq;
  const naTela = await tem('.habLeve button.cura');
  if (naTela) await clicar('.habLeve button.cura', 1500);
  mandarB('habilidade', 9);
  await esperar(1500);
  const s = await estado();
  const r = (j0, j) => ({ curou: Math.round(j.vida - j0.vida), gastouMana: Math.round(j0.mana - j.mana) > 0, recarga: Object.keys(j.cds).some((k) => /cura/.test(k) && j.cds[k] > s.tempo) });
  anotar('Cura', { A: { botaoNaTela: naTela, ...r(s0.A, s.A) }, B: { botaoNaTela: true, ...r(s0.B, s.B) }, ignora: ['curou'], nota: `vida antes: leve ${Math.round(s0.A.vida)}/${Math.round(s0.A.vidaMax)}, jogo ${Math.round(s0.B.vida)}/${Math.round(s0.B.vidaMax)}` });
}

// tocar no monstro no mapa e no Atacar (o leve anda até ele) x andar até o monstro pelo joystick do jogo
async function testeAtacar() {
  await garantirCampo();
  const s0 = await estado(), eA = maisPerto(s0, s0.A, 30);
  if (!eA) return anotar('Tocar no monstro e Atacar', { erro: 'sem monstro perto', A: {}, B: {} });
  const mirou = await mirarA(eA), quadro = await tem('#jogarAlvo'), botao = quadro && await tem('#jogarAlvo button:has-text("Atacar")');
  if (botao) await clicar('#jogarAlvo button:has-text("Atacar")', 1000);
  const chegou = mirou && await esperarAte(async () => { const q = await estado(), m = q.inimigos.find((o) => o.id === mirou.id); return !m || d2(q.A, m) < 2.6; }, 10000, 150);
  await foto('1b-atacar');
  anotar('Tocar no monstro e Atacar', { A: { quadroDoAlvo: !!quadro, botaoAtacar: !!botao, chegouNoMonstro: !!chegou }, B: { quadroDoAlvo: true, botaoAtacar: true, chegouNoMonstro: true }, nota: 'no jogo: tocar no monstro mira e o golpe anda até ele' });
}

// cada skill da barra da espada: toca no botão (leve) / manda o habQ do botão (jogo); confere se saiu (recarga, mana)
async function skills() {
  const s0 = await estado(), barra = (s0.B.prog.barras?.espada || []).filter((k) => k && HABS[k] && (HABS[k].libera || 0) <= NIVEL);
  for (const k0 of barra) {
    const k = k0.replace('#2', '');
    await garantirCampo();
    let s = await estado();
    const eA = maisPerto(s, s.A, 14), eB = maisPerto(s, s.B, 14);
    if (eA && d2(s.A, eA) > 2.5 && await mirarA(eA)) { await clicar('#jogarAlvo button:has-text("Atacar")', 1000); await esperarAte(async () => { const q = await estado(), m = q.inimigos.find((o) => o.id === eA.id); return !m || d2(q.A, m) < 2.5; }, 15e3); }
    if (eB) { virarB(eB); if (d2(s.B, eB) > 2.4) { irB(eB.x, eB.z); await esperarAte(async () => d2(await eu('B'), eB) < 2.4, 10e3); B.rota = null; } }
    // espera as duas recargas e a mana voltarem (a skill anterior)
    await esperarAte(async () => { const q = await estado(); return ['A', 'B'].every((w) => (q[w].cds[k] || 0) <= q.tempo && q[w].mana >= (HABS[k].mana || 0)); }, 30e3, 300);
    s = await estado();
    const desde = seq, mA = s.A.mana, mB = s.B.mana;
    const bt = pg.locator(`.habLeve button[data-i="${k}"]`), naTela = (await bt.count()) > 0, emEspera = naTela && await bt.first().evaluate((b) => b.classList.contains('espera'));
    if (naTela) await bt.first().click({ timeout: 1500 }).catch(() => {});
    const alvoB = maisPerto(s, s.B, 14); if (alvoB) virarB(alvoB);
    mandarB('habQ', { id: k, ...(alvoB ? { v: alvoB.v } : {}), b: true });
    await esperar(1800);
    const q = await estado();
    const r = (j, m0) => { const ev = evDe(j.id, desde, ['dano']).filter((e) => e.de === j.id && e.alvo !== j.id); return { saiu: (j.cds[k] || 0) > q.tempo, gastouMana: Math.round(m0 - j.mana) > 0, acertos: ev.length, danoTotal: ev.reduce((a, e) => a + e.n, 0) }; };
    const av = (j) => evDe(j.id, desde, ['aviso']).map((e) => e.texto).slice(0, 2).join(' | ');
    if (r(q.A, mA).saiu !== r(q.B, mB).saiu && !k0.endsWith('#2')) { log(`skill ${k}: saiu só num dos dois (${av(q.A)} / ${av(q.B)}), tenta de novo`); barra.splice(barra.indexOf(k0) + 1, 0, k + '#2'); continue; }
    anotar(`Skill ${HABS[k].nome || k}`, { A: { botaoNaTela: naTela, botaoApagado: emEspera, ...r(q.A, mA) }, B: { botaoNaTela: true, botaoApagado: false, ...r(q.B, mB) }, nota: [av(q.A) && 'leve: ' + av(q.A), av(q.B) && 'jogo: ' + av(q.B)].filter(Boolean).join(' · '), ignora: ['acertos', 'danoTotal'] }); // acertos e dano dependem de quantos bichos estão em volta de cada um
  }
}

async function pocao() {
  await feridos();
  const s0 = await estado(), desde = seq;
  const conta = (j, k) => (j.prog.mochila || []).reduce((a, o) => a + (o && o.k === k ? o.n : 0), 0);
  const naTela = await tem('.habLeve button[data-po="pocao"]');
  if (naTela) await clicar('.habLeve button[data-po="pocao"]', 1500);
  const i = s0.B.prog.mochila.findIndex((o) => o && o.k === 'pocao'); if (i >= 0) mandarB('item', { acao: 'usar', i });
  await esperar(1500);
  const s = await estado();
  const r = (j0, j) => ({ botaoNaTela: j === s.A ? naTela : true, gastou: conta(j0, 'pocao') - conta(j, 'pocao'), curou: evDe(j.id, desde, ['cura']).length > 0 || j.vida > j0.vida });
  anotar('Poção de vida', { A: r(s0.A, s.A), B: r(s0.B, s.B), ignora: ['curou'] });
}

async function movimentos() {
  for (const [k, nome] of [['rolar', 'Rolada'], ['dash', 'Flash']]) {
    await esperar(2500);
    const s0 = await estado();
    const naTela = await tem(`.habLeve button[data-mv="${k}"]`);
    if (naTela) await clicar(`.habLeve button[data-mv="${k}"]`, 1500);
    B.pausa = Date.now() + 1500; mandarB(k);
    await esperar(250);
    const sc = await estado(); // a recarga logo depois do toque (ela é curta)
    await esperar(1350);
    const s = await estado(); B.x = s.B.x; B.y = s.B.y; B.z = s.B.z;
    const saiu = (q) => (sc[q].cds[k] || 0) > sc.tempo; // entrou na recarga = o servidor aceitou (no jogo o app anda o corpo; o servidor só confere)
    anotar(nome, { A: { botaoNaTela: naTela, saiu: saiu('A'), andou: Math.round(d2(s0.A, s.A) * 10) / 10 }, B: { botaoNaTela: true, saiu: saiu('B'), andou: Math.round(d2(s0.B, s.B) * 10) / 10 }, ignora: ['andou'] });
  }
}

async function lobo() {
  lutarB(false); await clicarParar(); B.rota = null; await esperar(3000);
  const s0 = await estado(), desde = seq;
  if (s0.A.montado) { await clicar('.habLeve button.lobo', 1500); await esperar(1000); }
  if (s0.B.montado) { mandarB('montar'); await esperar(1000); }
  const naTela = await tem('.habLeve button.lobo');
  if (naTela) await clicar('.habLeve button.lobo', 1500);
  mandarB('montar');
  const seqA = [];
  for (let i = 0; i < 6; i++) { await esperar(300); seqA.push((await eu('A')).montado || '-'); }
  const s = await estado();
  const av = (j) => evDe(j.id, desde, ['aviso']).map((e) => e.texto).join(' | ');
  anotar('Montar no lobo', { A: { botaoNaTela: naTela, montado: s.A.montado || '', avisos: av(s.A) }, B: { botaoNaTela: true, montado: s.B.montado || '', avisos: av(s.B) }, ignora: ['avisos'], nota: `leve a cada 0,3 s: ${seqA.join(',')}` });
  if (s.A.montado) await clicar('.habLeve button.lobo', 1500);
  if (s.B.montado) mandarB('montar');
  await esperar(800);
}

// a beira de água funda mais perto da vila que a estrada alcança (onde o jogo mostra "Usar barquinho")
// a regra do botão do jogo (godot-prototipo/transporte.gd _agua_perto): água funda a 1, 2,5 ou 4 m, em 8 direções
const aguaPerto = (x, z) => { for (const r of [1, 2.5, 4]) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; if (fundoAgua(x + Math.sin(a) * r, z + Math.cos(a) * r) >= VEICULOS.barquinho.fundo) return true; } return false; };
function beiraAgua() {

  let melhor = null, md = 1e9;
  for (let r = 10; r < 400 && !melhor; r += 4) for (let i = 0; i < 48; i++) {
    const a = i * Math.PI / 24, x = nasc.x + Math.sin(a) * r, z = nasc.z + Math.cos(a) * r;
    if (fundoAgua(x, z) > 0.02 || !aguaPerto(x, z)) continue;
    const rr = planejarRota(MAPA_CLAREIRA, nasc, { x, z }); if (rr.bloqueio) continue;
    if (r < md) { md = r; melhor = { x, z }; }
  }
  return melhor;
}
async function barquinho() {
  const p = beiraAgua(); if (!p) return anotar('Barquinho', { erro: 'não achei beira de água perto da vila', A: {}, B: {} });
  const chegou = await juntar(p.x, p.z, 150e3);
  await esperar(1500);
  const naTela = await tem('#balaoLeve2'), sb = await estado(), jogoA = aguaPerto(sb.A.x, sb.A.z), jogoB = aguaPerto(sb.B.x, sb.B.z);
  await foto('3-beira');
  if (naTela) await clicar('#balaoLeve2', 1500);
  mandarB('veiculo', { acao: 'colocar', k: 'barquinho' });
  await esperar(2000);
  let s = await estado();
  const subiuA = s.A.veiculo, subiuB = s.B.veiculo;
  await foto('4-barquinho');
  // remar 4 s para longe da beira pelo joystick (no leve, tocar no mapa dentro do barco é recusado de propósito)
  const sA0 = await estado(), fora = { x: p.x + (p.x - nasc.x) / d2(p, nasc) * 30, z: p.z + (p.z - nasc.z) / d2(p, nasc) * 30 };
  if (subiuA) await andarJoy(fora.x, fora.z, 4000);
  const sA1 = await estado();
  anotar('Barquinho', {
    A: { chegouNaBeira: !!chegou, botaoUsarBarquinho: naTela, entrouNoBarco: subiuA || '', remouComJoystick: subiuA ? d2(sA0.A, sA1.A) > 2 : false },
    B: { chegouNaBeira: !!chegou, botaoUsarBarquinho: jogoB, entrouNoBarco: subiuB || '', remouComJoystick: !!subiuB },
    nota: `beira em ${Math.round(p.x)},${Math.round(p.z)}; no lugar exato do leve o botão do jogo ${jogoA ? 'APARECERIA' : 'também não apareceria'}; o leve remou ${Math.round(d2(sA0.A, sA1.A))} m em 4 s`,
  });
  mandarB('veiculo', { acao: 'descer' });
  if (await tem('#balaoLeve:has-text("Descer")')) await clicar('#balaoLeve', 1500);
  await esperar(1500);
}

async function recall() {
  // fora da vila (a casinha não vale dentro dela, VOLTA_VILA.vila m): no caminho da caçada, a uns 40 m da vila
  let ponto = null;
  if (campo) for (const k of [0.5, -0.5, 0.6, -0.6]) { const q = { x: nasc.x + (campo.x - nasc.x) * k, z: nasc.z + (campo.z - nasc.z) * k }; if (fundoAgua(q.x, q.z) < 0.01 && d2(q, nasc) > VOLTA_VILA.vila + 5 && !(k > 0 && d2(q, campo) < 35)) { ponto = q; break; } }
  lutarB(false);
  if (ponto) await juntar(ponto.x, ponto.z, 90e3);
  await clicarParar(); B.rota = null; await esperar(VOLTA_VILA.combate ? 1000 : 4000);
  const s0 = await estado(), desde = seq, t0 = Date.now();
  const naTela = await clicar('button[title="Voltar para a base"]', 2000) || await clicar('button:has-text("Recall")', 1000) || await clicar('button:has-text("Voltar pra base")', 1000);
  mandarB('vila');
  let tA = null, tB = null;
  await esperarAte(async () => {
    const s = await estado();
    if (tA == null && d2(s.A, s0.A) > 20) tA = (Date.now() - t0) / 1000;
    if (tB == null && d2(s.B, s0.B) > 20) tB = (Date.now() - t0) / 1000;
    return tA != null && tB != null;
  }, (VOLTA_VILA.canal + 25) * 1000, 300);
  const s = await estado();
  anotar('Recall (casinha)', { A: { botaoNaTela: naTela, segundos: tA, distNascimento: Math.round(d2(s.A, nasc)), avisos: evDe(s.A.id, desde, ['aviso']).map((e) => e.texto).slice(0, 3).join(' | ') }, B: { botaoNaTela: true, segundos: tB, distNascimento: Math.round(d2(s.B, nasc)), avisos: evDe(s.B.id, desde, ['aviso']).map((e) => e.texto).slice(0, 3).join(' | ') }, tol: { segundos: 0.25, distNascimento: 8 }, ignora: ['avisos'] });
}

// ---------- roda ----------
const inicio = Date.now();
const campo = [...CACA].filter((c) => !c.boss && (c.nivel || 1) <= NIVEL).sort((a, b) => d2(nasc, a) - d2(nasc, b))[0];
const passos = [
  ['entrada', testeEntrada],
  ['toque', testeToque],
  ['viagem', async () => { const npc = MAPA_CLAREIRA.npcs.find((o) => /Rosa/.test(o.nome)); if (npc) await testeViagem('Andar até a Rosa (perto)', 'NPCs', 'Rosa', npc); }],
  ['caca', async () => { if (campo) await testeViagem(`Ir até a caçada ${campo.nome}`, 'Caçada', campo.nome, campo); }],
  ['luta', () => lutaBasica(12)],
  ['cura', testeCura],
  ['atacar', testeAtacar],
  ['skills', skills],
  ['pocao', pocao],
  ['movimentos', movimentos],
  ['recall', recall],
  ['lobo', lobo],
  ['barquinho', barquinho],
];
// diferença só vale se repetir: o teste que deu diferença roda de novo; fica a 2ª tentativa (e a nota da 1ª)
for (const [k, fn] of passos) {
  if (!vale(k)) continue;
  for (let tent = 1; tent <= 2; tent++) {
    const ini = resultados.length;
    try { await fn(); } catch (e) { anotar(`(erro no robô: ${k})`, { erro: e.message, A: {}, B: {} }); }
    const novos = resultados.slice(ini), dif = comparar(novos);
    if (!dif.length || tent === 2 || ['entrada', 'toque', 'viagem', 'caca'].includes(k)) { if (tent === 2) for (const r of novos) r.nota = `${r.nota ? r.nota + '; ' : ''}repetido (a 1ª tentativa deu diferença)`; break; }
    log(`diferença em ${k}: repete para confirmar`);
    resultados.splice(ini);
  }
}
clearInterval(laçoB);
const achados = comparar(resultados);
const rel = { quando: new Date().toISOString(), minutos: Math.round((Date.now() - inicio) / 6e4), nivel: NIVEL, resultados, achados, errosPagina: [...new Set(errosPagina)].slice(0, 30), errosServidor: (srvLog.match(/^.*(Error|erro).*$/gm) || []).slice(0, 20) };
fs.writeFileSync(path.join(SAIDA, 'gemeos.json'), JSON.stringify(rel, null, 1));
fs.writeFileSync(path.join(SAIDA, 'gemeos.md'), relatorioMd(rel));
log(`fim: ${achados.length} diferença(s); relatório em ${SAIDA}`);
try { B.sala.leave(true); } catch { /* já saiu */ }
await nav.close(); fim(); process.exit(0);
