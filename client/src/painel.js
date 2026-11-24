// Painel do clã (André 2026-11-24: "um app só para administrar o clã... bem mais leve... no máximo um mapinha... quando eu
// deixasse ele aberto, os meus bots contariam como se eu estivesse online"). Página à parte, sem 3D: entra na sala do
// servidor como painel (sem corpo, server/index.js entrarPainel), pede a lista a cada 30 s e manda as ordens. Quem
// decide tudo é o servidor; a página só mostra e pede.
import { Client } from 'colyseus.js';
import { GOOGLE_CLIENT_ID } from '../../shared/conta.js';

const SERVIDOR_PARA_PAGES = 'wss://163-176-80-126.sslip.io'; // o mesmo do jogo (client/src/rede.js)
const SALA = 'clareira';
const A_CADA = 30000; // pede a lista a cada 30 s (com a página visível)

const $ = (id) => document.getElementById(id);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const ler = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

function endereco() {
  if (location.hostname.endsWith('github.io')) return SERVIDOR_PARA_PAGES;
  const ws = location.protocol === 'https:' ? 'wss' : 'ws', porta = location.port === '5173' ? '2567' : location.port;
  return `${ws}://${location.hostname}${porta ? ':' + porta : ''}`;
}
const http = () => endereco().replace(/^ws/, 'http');

function estado(txt, tipo = '') { const e = $('estado'); e.className = 'estado ' + tipo; e.lastElementChild.textContent = txt; }
let avisoT = 0;
function aviso(txt) { const a = $('aviso'); a.textContent = txt; a.hidden = false; clearTimeout(avisoT); avisoT = setTimeout(() => { a.hidden = true; }, 4000); }

// ---------- login (o mesmo do site do jogo: sessão guardada no aparelho, login com Google) ----------
async function sessaoValida() {
  const s = ler('sessao'); if (!s) return null;
  try {
    const r = await fetch(http() + '/conta/eu', { headers: { Authorization: 'Bearer ' + s }, signal: AbortSignal.timeout(8000) });
    if (r.ok) return s;
    if (r.status === 401) gravar('sessao', null);
  } catch { return s; } // sem internet agora: tenta entrar na sala com ela mesmo
  return null;
}
function login() {
  $('entrar').hidden = false; $('cla').hidden = true;
  estado('Fora');
  return new Promise((pronto) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client?hl=pt-BR'; s.async = true;
    s.onerror = () => { $('entrarErro').textContent = 'Não abriu o login do Google. Confira a internet e recarregue.'; };
    s.onload = () => {
      const g = window.google.accounts.id;
      g.initialize({ client_id: GOOGLE_CLIENT_ID, ux_mode: 'popup', callback: async ({ credential }) => {
        $('entrarErro').textContent = 'Entrando…';
        try {
          const r = await fetch(http() + '/conta/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credencial: credential, modo: 'entrar' }), signal: AbortSignal.timeout(8000) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.semConta ? 'Essa conta Google ainda não tem personagem. Crie no jogo primeiro.' : d.erro || 'O servidor recusou o login.');
          gravar('sessao', d.sessao);
          $('entrar').hidden = true; $('cla').hidden = false;
          pronto(d.sessao);
        } catch (e) { $('entrarErro').textContent = e.message === 'Failed to fetch' ? 'Servidor fora do ar. Tente de novo daqui a pouco.' : e.message; }
      } });
      g.renderButton($('botaoEntrar'), { theme: 'filled_black', size: 'large', shape: 'pill', locale: 'pt-BR', text: 'signin_with' });
      g.prompt();
    };
    document.head.appendChild(s);
  });
}

// ---------- ligação com o servidor ----------
const cliente = new Client(endereco());
let sala = null, info = null, sessao = null, timer = 0, tentativas = 0, parado = false;

function ligar(s) {
  sala = s; tentativas = 0;
  estado('Online', 'on');
  s.onMessage('painel', (d) => { info = d; desenhar(); if (d.aviso) aviso(d.aviso); });
  s.onLeave((codigo) => {
    sala = null;
    if (codigo === 4001) { parado = true; estado('Aberto em outro lugar', 'caiu'); aviso('O painel foi aberto em outro aparelho ou aba.'); return; }
    if (codigo === 4003) { parado = true; estado('Fora'); return; }
    estado('Religando…', 'caiu');
    religar(s.reconnectionToken);
  });
}
async function entrar() {
  try { ligar(await cliente.joinOrCreate(SALA, { sessao, painel: true })); }
  catch (e) {
    if (e.code === 401) { gravar('sessao', null); sessao = await login(); return entrar(); }
    estado('Sem servidor', 'caiu');
    setTimeout(entrar, Math.min(60000, 3000 * 2 ** tentativas++));
  }
}
async function religar(token) {
  if (parado) return;
  try { ligar(await cliente.reconnect(token)); return; } catch { /* a sala fechou ou passou dos 20 s */ }
  entrar();
}
const pedir = (m) => { if (sala) sala.send('painel', m); };
function ciclo() { clearInterval(timer); timer = setInterval(() => { if (!document.hidden) pedir({ acao: 'ver' }); }, A_CADA); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) { pedir({ acao: 'ver' }); tela(); } });

// manter a tela ligada (opcional): com a tela apagada o navegador pode pausar a página e o servidor deixa de contar online
let trava = null;
async function tela() {
  const quer = ler('painelTela') === '1';
  try {
    if (quer && !trava && !document.hidden && navigator.wakeLock) { trava = await navigator.wakeLock.request('screen'); trava.addEventListener('release', () => { trava = null; }); }
    if (!quer && trava) { await trava.release(); trava = null; }
  } catch { trava = null; }
}

// ---------- desenho ----------
let aba = 'cla';
$('mapaBots').onchange = (e) => { gravar('painelBots', e.target.checked ? '1' : null); desenhar(); };
for (const b of $('abas').querySelectorAll('button')) b.onclick = () => {
  aba = b.dataset.aba;
  for (const o of $('abas').querySelectorAll('button')) o.classList.toggle('ativo', o === b);
  $('cla').hidden = aba !== 'cla'; $('mapaAba').hidden = aba !== 'mapa'; $('bots').hidden = aba !== 'bots'; $('log').hidden = aba !== 'log';
  desenhar();
};

function barra(rot, v, max, cor) {
  const d = el('div'); d.append(el('div', 'rot', `${rot} ${v}/${max}`));
  const b = el('div', 'barra'), i = el('b'); i.style.width = `${Math.max(0, Math.min(100, (v / (max || 1)) * 100))}%`; i.style.background = cor; b.append(i); d.append(b);
  return d;
}
const opcao = (v, t, sel) => { const o = el('option', null, t); o.value = v; if (sel) o.selected = true; return o; };

function cartaoMembro(m) {
  const c = el('div', 'card' + (m.on ? '' : ' fora'));
  const l = el('div', 'linha'), n = el('div', 'nome', m.nome);
  n.append(el('span', 'tag', m.tier)); if (m.dev) n.append(el('span', 'tag', 'devendo'));
  l.append(n, el('div', 'nv', `Nv ${m.nv}`)); c.append(l);
  c.append(el('div', 'faz', m.on ? (m.morto ? 'Caído' : m.fz || '') : 'Fora do mundo'));
  if (m.on) { const b = el('div', 'barras'); b.append(barra('Vida', m.hp, m.hpM, 'var(--hp)'), barra('Vigor', m.vg, m.vgM, 'var(--vg)')); c.append(b); }
  // ordem: as mesmas do painel do clã no jogo
  const o = el('div', 'ordem'), fn = el('select'), extra = el('select');
  for (const F of info.funcoes) fn.append(opcao(F.id, F.nome, (m.fn?.k || 'livre') === F.id));
  const montarExtra = () => {
    extra.replaceChildren(); extra.hidden = true;
    if (fn.value === 'recurso') { for (const R of info.recursos) extra.append(opcao(R.k, R.nome, m.fn?.r === R.k)); extra.hidden = false; }
    if (fn.value === 'fazenda') { extra.append(opcao('', 'Só colher e regar', !m.fn?.s)); for (const P of info.plantas) extra.append(opcao(P.k, `Plantar ${P.nome.toLowerCase()}`, m.fn?.s === P.k)); extra.hidden = false; }
    if (fn.value === 'proteger') {
      if (info.jogo) extra.append(opcao('lider', 'Você', m.fn?.p === 'lider'));
      for (const x of info.m) if (x.id !== m.id) extra.append(opcao(x.id, x.nome, m.fn?.p === x.id));
      extra.hidden = false;
    }
  };
  fn.onchange = montarExtra; montarExtra();
  const ok = el('button', 'acao', 'Dar ordem');
  ok.onclick = () => {
    const f = { k: fn.value };
    if (f.k === 'recurso') f.r = extra.value; if (f.k === 'fazenda' && extra.value) f.s = extra.value; if (f.k === 'proteger') f.p = extra.value;
    if (f.k === 'proteger' && !f.p) return aviso('Escolha quem proteger');
    ok.disabled = true; setTimeout(() => { ok.disabled = false; }, 1000);
    pedir({ acao: 'funcao', id: m.id, fn: f });
  };
  o.append(fn, extra, ok); c.append(o);
  return c;
}

function desenharCla() {
  const raiz = $('cla'); raiz.replaceChildren();
  if (info.sem) { raiz.append(el('div', 'vazio', 'Você ainda não tem clã. Funde um no jogo, no painel do Clã.')); return; }
  const t = el('div', 'card');
  t.append(el('div', 'sub', info.jogo ? 'Você está no jogo agora: as ordens vão direto para o seu herói.' : 'Com esta página aberta, seus recrutas contam como se você estivesse online.'));
  const op = el('label', 'opc'), cx = el('input'); cx.type = 'checkbox'; cx.checked = ler('painelTela') === '1';
  cx.onchange = () => { gravar('painelTela', cx.checked ? '1' : null); tela(); };
  op.append(cx, document.createTextNode('Manter a tela ligada (gasta mais bateria)')); t.append(op);
  raiz.append(t);
  if (!info.m.length) raiz.append(el('div', 'vazio', 'Nenhum recruta ainda. Contrate no Recrutador, no jogo.'));
  for (const m of info.m) raiz.append(cartaoMembro(m));
}

function desenharBots() {
  const raiz = $('bots'); raiz.replaceChildren();
  for (const C of info.clas || []) {
    const c = el('div', 'card'), l = el('div', 'linha'), n = el('div', 'nome', C.n);
    n.append(el('span', 'tag', C.raca)); if (C.inimigo) n.append(el('span', 'tag', 'inimigo'));
    l.append(n, el('div', 'nv', `Clã Nv ${C.nv}`)); c.append(l);
    c.append(el('div', 'faz', `Líder: ${C.lider}${C.fz ? ' · ' + C.fz : ''}`));
    for (const m of C.membros || []) c.append(el('div', 'faz', '• ' + m));
    raiz.append(c);
  }
}

function desenharLog() {
  const raiz = $('log'); raiz.replaceChildren();
  const c = el('div', 'card log');
  if (!info.log?.length) c.append(el('div', 'vazio', 'Nada anotado ainda.'));
  for (const g of info.log || []) { const d = el('div'); d.append(el('small', null, new Date(g.t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })), document.createTextNode(g.txt)); c.append(d); }
  raiz.append(c);
}

// mapinha: só os pontos (sem desenho do terreno, para ficar leve). O quadro se ajusta a quem está no mundo
function desenharMapa() {
  const cv = $('mapa'), lado = Math.round(cv.clientWidth * Math.min(2, devicePixelRatio || 1)) || 600;
  if (cv.width !== lado) cv.width = cv.height = lado;
  const g = cv.getContext('2d'), W = cv.width;
  g.fillStyle = '#0c120d'; g.fillRect(0, 0, W, W);
  const pts = [];
  for (const m of info.m || []) if (m.on && Number.isFinite(m.x)) pts.push({ x: m.x, z: m.z, cor: '#d9a54a', nome: m.nome, r: 6 });
  if (info.eu) pts.push({ x: info.eu.x, z: info.eu.z, cor: '#ffffff', nome: 'Você', r: 6 });
  const bots = ler('painelBots') === '1';
  if (bots) for (const C of info.clas || []) if (Number.isFinite(C.x)) pts.push({ x: C.x, z: C.z, cor: C.raca === 'Geada' ? '#6fb3e6' : '#e0663a', nome: C.lider, r: 5, losango: true });
  const base = pts.length ? pts : [{ x: 0, z: 0 }];
  $('mapaBots').checked = bots;
  let x0 = Math.min(...base.map((p) => p.x)), x1 = Math.max(...base.map((p) => p.x)), z0 = Math.min(...base.map((p) => p.z)), z1 = Math.max(...base.map((p) => p.z));
  const span = Math.max(150, x1 - x0, z1 - z0) * 1.25, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  x0 = cx - span / 2; z0 = cz - span / 2;
  const P = (x, z) => [((x - x0) / span) * W, ((z - z0) / span) * W];
  // grade de 50 m
  g.strokeStyle = 'rgba(239,231,214,.06)'; g.lineWidth = 1;
  for (let v = Math.ceil(x0 / 50) * 50; v < x0 + span; v += 50) { const [a] = P(v, 0); g.beginPath(); g.moveTo(a, 0); g.lineTo(a, W); g.stroke(); }
  for (let v = Math.ceil(z0 / 50) * 50; v < z0 + span; v += 50) { const [, b] = P(0, v); g.beginPath(); g.moveTo(0, b); g.lineTo(W, b); g.stroke(); }
  const fonte = Math.round(W / 42);
  g.font = `${fonte}px system-ui,sans-serif`; g.textAlign = 'center';
  for (const L of info.lugares || []) {
    const [a, b] = P(L.x, L.z); if (a < 0 || b < 0 || a > W || b > W) continue;
    g.fillStyle = 'rgba(239,231,214,.25)'; g.fillRect(a - 4, b - 4, 8, 8);
    g.fillStyle = 'rgba(239,231,214,.45)'; g.fillText(L.nome, a, b - 8);
  }
  const nomes = []; // um nome por cima do outro fica ilegível: o que bate em outro já escrito não aparece
  for (const p of pts) {
    const [a, b] = P(p.x, p.z), r = p.r * (W / 600);
    g.fillStyle = p.cor; g.beginPath();
    if (p.losango) { g.moveTo(a, b - r * 1.3); g.lineTo(a + r * 1.3, b); g.lineTo(a, b + r * 1.3); g.lineTo(a - r * 1.3, b); } else g.arc(a, b, r, 0, 6.283);
    g.fill();
    const lg = g.measureText(p.nome).width, y = b - r - 4;
    if (nomes.some((o) => Math.abs(o.a - a) < (o.lg + lg) / 2 && Math.abs(o.y - y) < fonte)) continue;
    nomes.push({ a, y, lg }); g.fillStyle = '#efe7d6'; g.fillText(p.nome, a, y);
  }
}

function desenhar() {
  if (!info) return;
  $('abas').hidden = false;
  $('titulo').textContent = info.sem ? 'Painel do Clã' : `${info.n} · Nv ${info.nv}`;
  $('subtitulo').textContent = info.sem ? info.nome || '' : `Líder ${info.nome} · Cofre ${info.cofre} de ouro`;
  const foco = document.activeElement?.tagName === 'SELECT'; // escolhendo uma ordem: não refaz a lista por baixo do dedo
  if (aba === 'cla' && !foco) desenharCla();
  if (aba === 'bots') desenharBots();
  if (aba === 'log') desenharLog();
  if (aba === 'mapa') desenharMapa();
}

(async () => {
  sessao = await sessaoValida() || await login();
  await entrar();
  ciclo(); tela();
})();
