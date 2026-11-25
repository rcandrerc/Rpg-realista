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
// navegador antigo (tablet do André, 2026-11-24) não tem AbortSignal.timeout: o mesmo com AbortController
const prazo = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
// replaceChildren também é novo (Chrome 86): limpa do jeito antigo
const limpar = (e) => { while (e.firstChild) e.removeChild(e.firstChild); };
const http = () => endereco().replace(/^ws/, 'http');

function estado(txt, tipo = '') { const e = $('estado'); e.className = 'estado ' + tipo; e.lastElementChild.textContent = txt; }
let avisoT = 0;
function aviso(txt) { const a = $('aviso'); a.textContent = txt; a.hidden = false; clearTimeout(avisoT); avisoT = setTimeout(() => { a.hidden = true; }, 4000); }

// ---------- login (o mesmo do site do jogo: sessão guardada no aparelho, login com Google) ----------
async function sessaoValida() {
  const s = ler('sessao'); if (!s) return null;
  try {
    const r = await fetch(http() + '/conta/eu', { headers: { Authorization: 'Bearer ' + s }, signal: prazo(8000) });
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
          const r = await fetch(http() + '/conta/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credencial: credential, modo: 'entrar' }), signal: prazo(8000) });
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
let leilaoInfo = null;
let sala = null, info = null, sessao = null, timer = 0, tentativas = 0, parado = false;

function ligar(s) {
  sala = s; tentativas = 0;
  estado('Online', 'on');
  s.onMessage('painel', (d) => { info = d; desenhar(); if (d.aviso) aviso(d.aviso); });
  s.onMessage('painelLeilao', (d) => { leilaoInfo = d; if (aba === 'leilao') desenharLeilao(!!leilaoTopo && leilaoTopo.isConnected); }); // a resposta só troca a lista (o campo da busca fica)
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
  $('leilaoAba').hidden = aba !== 'leilao'; if (aba === 'leilao') pedirLeilao();
  desenhar();
};

function barra(rot, v, max, cor) {
  const d = el('div'); d.append(el('div', 'rot', `${rot} ${v}/${max}`));
  const b = el('div', 'barra'), i = el('b'); i.style.width = `${Math.max(0, Math.min(100, (v / (max || 1)) * 100))}%`; i.style.background = cor; b.append(i); d.append(b);
  return d;
}
const opcao = (v, t, sel) => { const o = el('option', null, t); o.value = v; if (sel) o.selected = true; return o; };

function cartaoMembro(m) {
  const c = el('div', 'card' + (m.on ? '' : ' fora') + (m.cheia ? ' cheio' : ''));
  const l = el('div', 'linha'), n = el('div', 'nome', m.nome);
  n.append(el('span', 'tag', m.tier)); if (m.dev) n.append(el('span', 'tag', 'devendo')); if (m.cheia) n.append(el('span', 'tag cheio', 'Mochila cheia')); else if (m.mo) n.append(lugaresTag('Mochila', m.mo));
  l.append(n, el('div', 'nv', `Nv ${m.nv}`)); c.append(l);
  c.append(el('div', 'faz', m.on ? (m.morto ? 'Caído' : m.fz || '') : 'Fora do mundo'));
  if (m.on) { const b = el('div', 'barras'); b.append(barra('Vida', m.hp, m.hpM, 'var(--hp)'), barra('Vigor', m.vg, m.vgM, 'var(--vg)')); c.append(b); }
  // ordem: as mesmas do painel do clã no jogo
  const o = el('div', 'ordem'), fn = el('select'), extra = el('select');
  for (const F of info.funcoes) fn.append(opcao(F.id, F.nome, (m.fn?.k || 'livre') === F.id));
  const montarExtra = () => {
    limpar(extra); extra.hidden = true;
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

// próximo nível do clã (André 2026-11-24: "o que precisa para o próximo nível e o que a gente tem... os símbolozinhos dos
// itens, nada de lista"): igual ao Melhorar clã do jogo, cada coisa é um ícone com tenho/preciso (verde quando já tem)
// o desenho de cada item (client/public/painel-icones, feitos por ferramentas/painel/icones-painel.py com os pintados do
// jogo); o que não tem pintura cai no parecido, como no jogo (progresso.gd icone_item), ou numa bolinha com a inicial
const parecido = (k) => (k.startsWith('barra_') ? 'barra_ferro' : k.startsWith('minerio_') ? 'minerio_ferro' : k.startsWith('semente_') ? 'semente' : null);
function desenhoItem(k, nome, cor) {
  if (k === 'lider') return el('span', 'nvb', 'Nv');
  const i = el('img'); i.alt = nome; i.loading = 'lazy'; i.src = `painel-icones/${k}.png`;
  i.onerror = () => { const p = parecido(k); if (p && !i.src.endsWith(`/${p}.png`)) { i.src = `painel-icones/${p}.png`; return; }
    const b = el('span', 'nvb', nome.slice(0, 2)); if (cor) b.style.color = cor; i.replaceWith(b); };
  return i;
}
const num = (v) => (v >= 10000 ? `${Math.floor(v / 1000)}k` : String(v));
function icone(k, nome, tem, precisa, cor) { // com tenho/preciso: borda verde quando já tem
  const d = el('div', 'ico' + (tem >= precisa ? ' ok' : '')), q = el('div', 'q');
  q.append(desenhoItem(k, nome, cor));
  d.title = nome; d.onclick = () => aviso(`${nome}: tem ${tem}, precisa ${precisa}`);
  d.append(q, el('small', null, `${num(Math.min(tem, precisa))}/${num(precisa)}`));
  return d;
}
function iconeQtd(it) { // só a quantidade (o Baú do Clã)
  const d = el('div', 'ico qtd'), q = el('div', 'q');
  q.append(desenhoItem(it.k, it.nome, it.cor));
  d.title = it.nome; d.onclick = () => aviso(`${it.nome}: ${it.n}`);
  d.append(q, el('small', null, num(it.n)));
  return d;
}
// "Mochila 40/60": perto de encher (80%+) fica laranja; cheio continua vermelho (tag cheio)
function lugaresTag(rot, [u, t]) { return el('span', 'tag' + (u >= t ? ' cheio' : u >= t * 0.8 ? ' quase' : ''), `${rot} ${u}/${t}`); }
function cartaoBau(itens, cheio, lug) {
  const c = el('div', 'card' + (cheio ? ' cheio' : '')), l = el('div', 'linha'), n = el('div', 'nome', 'Baú do Clã');
  if (cheio) n.append(el('span', 'tag cheio', 'Cheio'));
  l.append(n, el('div', 'nv', itens ? `${itens.length} tipos` : '')); c.append(l);
  if (lug) { const q = el('div', 'faz'); q.append(lugaresTag('Lugares', lug)); c.append(q); }
  if (!itens) { c.append(el('div', 'faz', 'Sem Baú do Clã: funde a base do clã ou crie um baú na construção.')); return c; }
  if (!itens.length) { c.append(el('div', 'faz', 'Vazio.')); return c; }
  const f = el('div', 'icones'); for (const it of itens) f.append(iconeQtd(it)); c.append(f);
  return c;
}
function cartaoSobe(S) {
  const c = el('div', 'card'), l = el('div', 'linha');
  const pronto = S.nvLider >= S.lider && S.cofre >= S.ouro && S.itens.every((it) => it.tem >= it.n);
  l.append(el('div', 'nome', `Próximo nível: clã Nv ${S.nv}`), el('div', 'nv', pronto ? 'Pronto!' : '')); c.append(l);
  const f = el('div', 'icones');
  f.append(icone('lider', 'Nível do líder', S.nvLider, S.lider), icone('ouro', 'Ouro no cofre', S.cofre, S.ouro));
  for (const it of S.itens) f.append(icone(it.k, it.nome, it.tem, it.n));
  c.append(f);
  c.append(el('div', 'faz', pronto ? 'Tudo pronto: suba o clã no jogo, no painel do Clã.' : 'Conta o Baú do Clã e a sua mochila. Toque num ícone para ver o nome.'));
  return c;
}

// ---------- Leilão (André 2026-11-24: "ver o leilão pelo próprio negócio"): só olhar. Comprar e anunciar continuam
// com o Otávio, no jogo (a regra de ir até a Casa do Comércio não muda). Cada anúncio é o ícone com o preço embaixo.
let leilaoTipo = '', leilaoOrdem = 'barato', leilaoTexto = '', leilaoT = 0;
const pedirLeilao = () => pedir({ acao: 'leilao', tipo: leilaoTipo || undefined, ordem: leilaoOrdem, texto: leilaoTexto.trim() || undefined });
// busca por parte do nome (André 2026-11-24): sem diferenciar maiúscula nem acento ("minerio" acha "Minério")
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const buscaUi = el('input'); buscaUi.type = 'search'; buscaUi.placeholder = 'Buscar item pelo nome'; buscaUi.className = 'busca';
buscaUi.oninput = () => { leilaoTexto = buscaUi.value; desenharLeilao(true); clearTimeout(leilaoT); leilaoT = setTimeout(pedirLeilao, 500); }; // filtra na hora, pede ao servidor depois de parar de digitar
const resta = (ms) => { const h = Math.max(0, Math.round(ms / 3600e3)); return h >= 1 ? `${h} h` : 'menos de 1 h'; };
function iconeAnuncio(a, agora) {
  const d = el('div', 'ico qtd preco'), q = el('div', 'q');
  if (a.cor) q.style.borderColor = a.cor;
  q.append(desenhoItem(a.item.k, a.nome || a.item.k, a.cor));
  if ((a.item.n | 0) > 1) q.append(el('b', null, num(a.item.n)));
  d.title = a.nome;
  d.onclick = () => aviso(`${a.item.n > 1 ? a.item.n + ' ' : ''}${a.nome}${a.rar ? ` (${a.rar})` : ''}${a.tomo != null ? ` (${['não precisa mais', 'dá para usar agora', 'vai precisar'][a.tomo]})` : ''} · ${a.preco} de ouro · ${a.casa ? 'da Casa' : a.vendedor}${a.casa ? '' : ` · acaba em ${resta(a.ate - agora)}`}`);
  d.append(q, el('small', null, num(a.preco)));
  return d;
}
let leilaoTopo = null;
function desenharLeilao(soLista = false) { // soLista: digitando na busca (o campo não sai da tela e o teclado não fecha)
  const raiz = $('leilaoAba');
  if (soLista && leilaoTopo) { while (raiz.lastChild !== leilaoTopo) raiz.removeChild(raiz.lastChild); return listaLeilao(raiz); }
  limpar(raiz);
  const top = leilaoTopo = el('div', 'card'), ch = el('div', 'chips');
  for (const [k, nome] of [['', 'Tudo'], ...Object.entries(leilaoInfo?.tipos || {})]) {
    const b = el('button', leilaoTipo === k ? 'ativo' : '', nome); b.onclick = () => { leilaoTipo = k; desenharLeilao(); pedirLeilao(); }; ch.append(b);
  }
  const ord = el('select'); for (const [v, t] of [['barato', 'Mais barato'], ['caro', 'Mais caro'], ['novo', 'Mais novo']]) ord.append(opcao(v, t, leilaoOrdem === v));
  ord.onchange = () => { leilaoOrdem = ord.value; pedirLeilao(); };
  const linha = el('div', 'ordem'); linha.append(ord);
  top.append(buscaUi, ch, linha, el('div', 'faz', 'Só para olhar: comprar e anunciar é com o Otávio, na Casa do Comércio. Toque num item para ver quem vende.'));
  raiz.append(top);
  listaLeilao(raiz);
}
function listaLeilao(raiz) {
  if (!leilaoInfo) { raiz.append(el('div', 'vazio', 'Carregando o leilão…')); return; }
  const agora = leilaoInfo.agora || Date.now();
  const meus = el('div', 'card'); meus.append(el('div', 'nome', 'Seus anúncios'));
  if (!leilaoInfo.meus.length) meus.append(el('div', 'faz', 'Nenhum agora.'));
  else { const f = el('div', 'icones'); for (const a of leilaoInfo.meus) f.append(iconeAnuncio(a, agora)); meus.append(f); }
  raiz.append(meus);
  const c = el('div', 'card'); c.append(el('div', 'nome', 'À venda'));
  const t = semAcento(leilaoTexto), lista = t ? leilaoInfo.lista.filter((a) => semAcento(a.nome).includes(t)) : leilaoInfo.lista;
  if (!lista.length) c.append(el('div', 'faz', 'Nada nessa busca.'));
  else { const f = el('div', 'icones'); for (const a of lista) f.append(iconeAnuncio(a, agora)); c.append(f); }
  raiz.append(c);
}

// ---------- avisos no celular (Web Push: server/push.js e public/painel-sw.js). Chrome do Android: funciona com a
// página fechada. iPhone: só com o painel posto na tela de início (Compartilhar > Adicionar à Tela de Início).
const podeAvisar = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const chaveBytes = (b64) => { const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
async function registroAvisos() { return navigator.serviceWorker.register('painel-sw.js', { scope: './painel-sw/' }); }
async function ligarAvisos(ligar) {
  try {
    const reg = await registroAvisos(); await navigator.serviceWorker.ready.catch(() => null);
    let sub = await reg.pushManager.getSubscription();
    if (!ligar) { if (sub) { pedir({ acao: 'push', sair: sub.endpoint }); await sub.unsubscribe(); } return; }
    if ((await Notification.requestPermission()) !== 'granted') return aviso('O navegador bloqueou os avisos. Libere em Configurações do site > Notificações.');
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(info.push.pub) });
    pedir({ acao: 'push', sub: sub.toJSON() });
  } catch (e) { aviso('Não deu para ligar os avisos neste navegador'); }
}
function opcaoAvisos() {
  const op = el('label', 'opc'), cx = el('input'); cx.type = 'checkbox';
  if (!podeAvisar() || !info.push) { op.append(document.createTextNode('Avisos no celular: este navegador não tem (no iPhone, ponha o painel na tela de início)')); return op; }
  cx.checked = !!info.push.on && Notification.permission === 'granted';
  cx.onchange = () => { cx.disabled = true; ligarAvisos(cx.checked).finally(() => { cx.disabled = false; }); };
  op.append(cx, document.createTextNode('Avisar no celular (recruta caiu, mochila ou baú cheio, venda no leilão)'));
  return op;
}

function desenharCla() {
  const raiz = $('cla'); limpar(raiz);
  if (info.sem) { raiz.append(el('div', 'vazio', 'Você ainda não tem clã. Funde um no jogo, no painel do Clã.')); return; }
  const t = el('div', 'card');
  if (info.vencida) t.append(el('div', 'nome', 'A semana dos recrutas venceu. Entre no jogo para pagar; até lá eles não trabalham pelo painel.'));
  t.append(el('div', 'sub', info.jogo ? 'Você está no jogo agora: as ordens vão direto para o seu herói.' : 'Com esta página aberta, seus recrutas contam como se você estivesse online.'));
  const op = el('label', 'opc'), cx = el('input'); cx.type = 'checkbox'; cx.checked = ler('painelTela') === '1';
  cx.onchange = () => { gravar('painelTela', cx.checked ? '1' : null); tela(); };
  op.append(cx, document.createTextNode('Manter a tela ligada (gasta mais bateria)')); t.append(op);
  t.append(opcaoAvisos());
  raiz.append(t);
  if (info.sobe) raiz.append(cartaoSobe(info.sobe));
  if ('bau' in info) raiz.append(cartaoBau(info.bau, info.bauCheio, info.bauLug));
  if (!info.m.length) raiz.append(el('div', 'vazio', 'Nenhum recruta ainda. Contrate no Recrutador, no jogo.'));
  for (const m of info.m) raiz.append(cartaoMembro(m));
}

function desenharBots() {
  const raiz = $('bots'); limpar(raiz);
  for (const C of info.clas || []) {
    const c = el('div', 'card'), l = el('div', 'linha'), n = el('div', 'nome', C.n);
    n.append(el('span', 'tag', C.raca)); if (C.inimigo) n.append(el('span', 'tag', 'inimigo'));
    l.append(n, el('div', 'nv', `Clã Nv ${C.nv}`)); c.append(l);
    c.append(el('div', 'faz', `Líder: ${C.lider}${C.nvLider ? ` (Nv ${C.nvLider})` : ''}${C.fz ? ' · ' + C.fz : ''}`));
    for (const m of C.membros || []) c.append(el('div', 'faz', '• ' + m));
    raiz.append(c);
  }
}

function desenharLog() {
  const raiz = $('log'); limpar(raiz);
  const c = el('div', 'card log');
  if (!info.log?.length) c.append(el('div', 'vazio', 'Nada anotado ainda.'));
  for (const g of info.log || []) { const d = el('div'); d.append(el('small', null, new Date(g.t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })), document.createTextNode(g.txt)); c.append(d); }
  raiz.append(c);
}

// mapinha (André 2026-11-24: "um 2Dzão bem leve, só para ter uma noção" e "mais e menos, pra aproximar"): o mundo de cima
// num JPEG só (painel-mapa.jpg, ~85 KB, feito por ferramentas/painel/mapa-painel.py com as cores do mapa do jogo) e os
// pontos por cima. Zoom no + e −, arrastar com o dedo e pinça. Sem mexer, o quadro se ajusta a quem está no mundo.
const MUNDO = { x0: -560, z0: -540, w: 1524, h: 2044 }; // a grade do mundo (godot-prototipo/dados/mundo_grade.json): nx·passo, nz·passo
const ZOOM = { min: 40, max: 2200 }; // metros que cabem no lado do quadro
const fundoMapa = new Image(); fundoMapa.onload = () => { if (aba === 'mapa') desenharMapa(); }; fundoMapa.src = 'painel-mapa.jpg';
// a Vila de hoje nítida por cima (o mesmo desenho do minimapa do jogo: ferramentas/painel/vila-painel.mjs), com a borda
// esfumada para casar com o fundo
const VILA = { x0: -64, z0: -146, tam: 412 }; // MAPA_CLAREIRA.minimapa (shared/dados.js)
let vilaMapa = null;
{ const im = new Image(); im.onload = () => {
  const c = document.createElement('canvas'), T = c.width = c.height = im.naturalWidth, g = c.getContext('2d'), b = T * 0.06;
  g.drawImage(im, 0, 0); g.globalCompositeOperation = 'destination-in';
  for (const [x0, y0, x1, y1] of [[0, 0, b, 0], [T, 0, T - b, 0], [0, 0, 0, b], [0, T, 0, T - b]]) {
    const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gr; g.fillRect(0, 0, T, T);
  }
  vilaMapa = c; if (aba === 'mapa') desenharMapa();
}; im.src = 'painel-vila.png'; }
let vista = null; // { cx, cz, span } quando a pessoa mexeu no mapa; null = ajusta sozinho
const limitar = (v) => { v.span = Math.max(ZOOM.min, Math.min(ZOOM.max, v.span)); v.cx = Math.max(MUNDO.x0, Math.min(MUNDO.x0 + MUNDO.w, v.cx)); v.cz = Math.max(MUNDO.z0, Math.min(MUNDO.z0 + MUNDO.h, v.cz)); return v; };
let quadro = null; // a vista do último desenho (para o zoom e o arrasto partirem dela)
const zoom = (f) => { if (!quadro) return; vista = limitar({ ...quadro, span: quadro.span * f }); desenharMapa(); };
$('mapaMais').onclick = () => zoom(1 / 1.6);
$('mapaMenos').onclick = () => zoom(1.6);
$('mapaCentro').onclick = () => { vista = null; desenharMapa(); };
{ // arrastar (um dedo ou o mouse) e pinça (dois dedos)
  const cv = $('mapa'), dedos = new Map(); let ini = null;
  const estado = () => { const p = [...dedos.values()]; return { p, d: p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0, mx: p.reduce((s, o) => s + o.x, 0) / p.length, my: p.reduce((s, o) => s + o.y, 0) / p.length }; };
  const comecar = () => { ini = dedos.size && quadro ? { ...estado(), v: { ...quadro } } : null; };
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture?.(e.pointerId); dedos.set(e.pointerId, { x: e.clientX, y: e.clientY }); comecar(); });
  cv.addEventListener('pointermove', (e) => {
    if (!dedos.has(e.pointerId) || !ini) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const a = estado(), m = ini.v.span / cv.clientWidth; // metros por pixel da tela
    const span = a.p.length > 1 && ini.d > 0 && a.d > 0 ? ini.v.span * (ini.d / a.d) : ini.v.span;
    vista = limitar({ cx: ini.v.cx - (a.mx - ini.mx) * m, cz: ini.v.cz - (a.my - ini.my) * m, span });
    desenharMapa();
  });
  const soltar = (e) => { dedos.delete(e.pointerId); comecar(); };
  cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.25 : 0.8); }, { passive: false });
}

function desenharMapa() {
  const cv = $('mapa'), lado = Math.round(cv.clientWidth * Math.min(2, devicePixelRatio || 1)) || 600;
  if (cv.width !== lado) cv.width = cv.height = lado;
  const g = cv.getContext('2d'), W = cv.width;
  const pts = [];
  for (const m of info.m || []) if (m.on && Number.isFinite(m.x)) pts.push({ x: m.x, z: m.z, cor: '#f2b84b', nome: m.nome, r: 6 });
  if (info.eu) pts.push({ x: info.eu.x, z: info.eu.z, cor: '#ffffff', nome: 'Você', r: 6 });
  const bots = ler('painelBots') === '1';
  if (bots) for (const C of info.clas || []) if (Number.isFinite(C.x)) pts.push({ x: C.x, z: C.z, cor: C.inimigo ? '#ff3b30' : C.raca === 'Geada' ? '#6fb3e6' : '#e0663a', nome: C.lider, r: 5, losango: true });
  $('mapaBots').checked = bots;
  if (!vista) { // ajusta sozinho a quem está no mundo
    const base = pts.length ? pts : [{ x: 0, z: 0 }];
    const x0 = Math.min(...base.map((p) => p.x)), x1 = Math.max(...base.map((p) => p.x)), z0 = Math.min(...base.map((p) => p.z)), z1 = Math.max(...base.map((p) => p.z));
    quadro = limitar({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, span: Math.max(320, (Math.max(x1 - x0, z1 - z0)) * 1.25) }); // de 320 m para cima: dá para ver onde fica
  } else quadro = vista;
  const { span } = quadro, x0 = quadro.cx - span / 2, z0 = quadro.cz - span / 2;
  const P = (x, z) => [((x - x0) / span) * W, ((z - z0) / span) * W];
  g.fillStyle = '#1a3e66'; g.fillRect(0, 0, W, W); // fora do mundo: mar fundo
  if (fundoMapa.complete && fundoMapa.naturalWidth) {
    const [a, b] = P(MUNDO.x0, MUNDO.z0), k = W / span;
    g.imageSmoothingEnabled = true; g.drawImage(fundoMapa, a, b, MUNDO.w * k, MUNDO.h * k);
  }
  if (vilaMapa) { const [a, b] = P(VILA.x0, VILA.z0); g.drawImage(vilaMapa, a, b, (VILA.tam / span) * W, (VILA.tam / span) * W); }
  const fonte = Math.round(W / 40);
  g.font = `600 ${fonte}px system-ui,sans-serif`; g.textAlign = 'center'; g.lineJoin = 'round';
  const escrever = (txt, a, b, cor) => { g.lineWidth = Math.max(3, fonte / 4); g.strokeStyle = 'rgba(12,10,8,.85)'; g.strokeText(txt, a, b); g.fillStyle = cor; g.fillText(txt, a, b); };
  const nomes = []; // um nome por cima do outro fica ilegível: o que bate em outro já escrito não aparece
  const cabe = (txt, a, y) => { const lg = g.measureText(txt).width; if (nomes.some((o) => Math.abs(o.a - a) < (o.lg + lg) / 2 && Math.abs(o.y - y) < fonte)) return false; nomes.push({ a, y, lg }); return true; };
  const marcas = [];
  for (const bs of [info.base, ...(info.bases || [])]) if (bs && Number.isFinite(bs.x)) { // a base do clã (e as aliadas, da mesma facção): escudo dourado com chama, maior que tudo, com o nome (nunca some atrás de recruta)
    const [a, b] = P(bs.x, bs.z), r = Math.max(11, W / 38), cor = bs.raca === 'Geada' ? '#6fd8ff' : '#ff9a2e';
    g.fillStyle = 'rgba(233,196,106,.22)'; g.beginPath(); g.arc(a, b, r * 1.8, 0, 6.283); g.fill();
    const escudo = (k) => { g.beginPath(); g.moveTo(a - r * k, b - r * 0.9 * k); g.lineTo(a + r * k, b - r * 0.9 * k); g.lineTo(a + r * k, b + r * 0.1 * k); g.lineTo(a + r * 0.55 * k, b + r * 0.75 * k); g.lineTo(a, b + r * 1.15 * k); g.lineTo(a - r * 0.55 * k, b + r * 0.75 * k); g.lineTo(a - r * k, b + r * 0.1 * k); g.closePath(); };
    escudo(1.2); g.fillStyle = 'rgba(12,10,8,.95)'; g.fill();
    escudo(1); g.fillStyle = '#c9a35a'; g.fill();
    escudo(0.78); g.fillStyle = '#21170f'; g.fill();
    g.fillStyle = cor; g.beginPath(); g.moveTo(a, b - r * 0.7); g.lineTo(a + r * 0.38, b - r * 0.12); g.lineTo(a + r * 0.3, b + r * 0.4); g.lineTo(a, b + r * 0.62); g.lineTo(a - r * 0.3, b + r * 0.4); g.lineTo(a - r * 0.38, b - r * 0.12); g.closePath(); g.fill();
    g.fillStyle = '#fff3c0'; g.beginPath(); g.moveTo(a, b - r * 0.15); g.lineTo(a + r * 0.16, b + r * 0.2); g.lineTo(a, b + r * 0.45); g.lineTo(a - r * 0.16, b + r * 0.2); g.closePath(); g.fill();
    escudo(1); g.strokeStyle = '#e9c46a'; g.lineWidth = Math.max(1.5, W / 400); g.stroke();
    const f2 = Math.round(fonte * 1.1); g.font = `700 ${f2}px system-ui,sans-serif`;
    escrever('Base do Clã', a, b + r * 1.15 + f2 + 2, '#e9c46a'); nomes.push({ a, y: b + r * 1.15 + f2 + 2, lg: g.measureText('Base do Clã').width });
    g.font = `600 ${fonte}px system-ui,sans-serif`;
    if (bs.n) { escrever(bs.n, a, b + r * 1.15 + f2 + fonte + 4, '#fff3dc'); nomes.push({ a, y: b + r * 1.15 + f2 + fonte + 4, lg: g.measureText(bs.n).width }); }
  }
  for (const p of pts) { // primeiro os pontos (os nomes deles ganham dos lugares)
    const [a, b] = P(p.x, p.z), r = p.r * (W / 600);
    g.fillStyle = p.cor; g.strokeStyle = 'rgba(12,10,8,.9)'; g.lineWidth = Math.max(1.5, W / 400); g.beginPath();
    if (p.losango) { g.moveTo(a, b - r * 1.3); g.lineTo(a + r * 1.3, b); g.lineTo(a, b + r * 1.3); g.lineTo(a - r * 1.3, b); g.closePath(); } else g.arc(a, b, r, 0, 6.283);
    g.fill(); g.stroke();
    marcas.push([p.nome, a, b - r - 5]);
  }
  for (const [t, a, y] of marcas) if (cabe(t, a, y)) escrever(t, a, y, '#fff3dc');
  for (const L of info.lugares || []) {
    const [a, b] = P(L.x, L.z); if (a < 0 || b < 0 || a > W || b > W) continue;
    g.fillStyle = 'rgba(30,24,16,.8)'; g.beginPath(); g.arc(a, b, Math.max(3, W / 200), 0, 6.283); g.fill();
    if (cabe(L.nome, a, b - 8)) escrever(L.nome, a, b - 8, '#e8dcc0');
  }
  // escala: quantos metros vale o traço
  const m = [10, 20, 50, 100, 200, 500].find((v) => (v / span) * W > W / 6) || 500, px = (m / span) * W, y = W - fonte;
  g.fillStyle = 'rgba(12,10,8,.7)'; g.fillRect(fonte * 0.6, y - fonte * 1.4, px + fonte * 1.2, fonte * 2);
  g.fillStyle = '#efe7d6'; g.fillRect(fonte * 1.2, y, px, Math.max(2, W / 300));
  g.font = `${Math.round(fonte * 0.8)}px system-ui,sans-serif`; g.textAlign = 'left'; g.fillText(`${m} m`, fonte * 1.2, y - fonte * 0.3);
}

function desenhar() {
  if (!info) return;
  $('abas').hidden = false;
  $('abas').querySelector('[data-aba=cla]').classList.toggle('alerta', !!(info.bauCheio || info.m?.some((m) => m.cheia))); // algo cheio: bolinha vermelha na aba
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
