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
function aviso(txt) { const a = $('aviso'); a.textContent = txt; a.hidden = false; const hud = document.body.classList.contains('leveTela') && $('jogarStatus'); a.style.top = hud ? Math.round(hud.getBoundingClientRect().bottom + 8) + 'px' : ''; clearTimeout(avisoT); avisoT = setTimeout(() => { a.hidden = true; }, 4000); } // jogo leve: o aviso fica logo abaixo do quadro de cima, em cima do mapa (André 2026-11-26)

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
  $('entrar').hidden = false; $('cla').hidden = true; $('jogarAba').hidden = true;
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
          $('entrar').hidden = true; irAba(aba);
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
// versão leve completa (André 2026-11-26: "uma versão inteira do jogo... botar o painel do clã dentro do jogo"): a página
// abre no Jogo; 5 abas fixas embaixo (Jogo, Mochila, Clã, Missões, Mais). Leilão (só olhar), Clãs bot e Registro saíram
// da barra de cima e ficam no Mais (a barra de baixo acende o Mais enquanto estão abertas).
let aba = 'jogar';
$('mapaBots').onchange = (e) => { gravar('painelBots', e.target.checked ? '1' : null); desenhar(); };
const DO_MAIS = new Set(['leilao', 'bots', 'log', 'personagem']);
function irAba(a) {
  aba = a;
  for (const o of $('abas').querySelectorAll('button')) o.classList.toggle('ativo', o.dataset.aba === a || (o.dataset.aba === 'mais' && DO_MAIS.has(a)));
  document.body.classList.toggle('abaCla', a === 'cla');
  $('cla').hidden = aba !== 'cla'; $('bots').hidden = aba !== 'bots'; $('log').hidden = aba !== 'log';
  $('leilaoAba').hidden = aba !== 'leilao'; if (aba === 'leilao') pedirLeilao();
  $('mochilaAba').hidden = aba !== 'mochila'; $('missoesAba').hidden = aba !== 'missoes'; $('maisAba').hidden = aba !== 'mais'; $('personagemAba').hidden = aba !== 'personagem';
  $('jogarAba').hidden = aba !== 'jogar';
  if (aba !== 'jogar') document.body.classList.remove('leveTela');
  // a aba Mapa saiu (André 2026-11-25: "no jogar já tem o mapa... pode remover"): o mapa, os líderes bot e a legenda ficam no Jogar
  if (aba === 'jogar') { vista = null; leve.sujo = true; desenharJogar(); if (leve.sala) desenharMapa(); }
  if (aba === 'mochila') { leve.sujo = true; desenharMochila(); }
  const querMs = a === 'missoes' || a === 'personagem';
  if (querMs !== !!leve.msVer) { leve.msVer = querMs; mandar('leveMissoes', { ver: querMs }); } // a lista só vem com a aba aberta (Missões ou Personagem)
  if (aba === 'missoes') desenharMissoes();
  if (aba === 'personagem') desenharPersonagem();
  if (aba === 'mais') desenharMais();
  scrollTo(0, 0);
  desenhar();
}
for (const b of $('abas').querySelectorAll('button')) b.onclick = () => irAba(b.dataset.aba);

function barra(rot, v, max, cor) {
  const d = el('div'); d.append(el('div', 'rot', `${rot} ${v}/${max}`));
  const b = el('div', 'barra'), i = el('b'); i.style.width = `${Math.max(0, Math.min(100, (v / (max || 1)) * 100))}%`; i.style.background = cor; b.append(i); d.append(b);
  return d;
}
const opcao = (v, t, sel) => { const o = el('option', null, t); o.value = v; if (sel) o.selected = true; return o; };

// moral (MORAL, André 2026-11-25), igual ao menu do clã do jogo: ícone da ordem ~N/h, seta (verde pra cima, amarela de
// lado, vermelha pra baixo) e o % que rende. Tocar explica.
const SETA = { cima: 'M8 1 15 9 10.5 9 10.5 15 5.5 15 5.5 9 1 9Z', baixo: 'M8 15 1 7 5.5 7 5.5 1 10.5 1 10.5 7 15 7Z', lado: 'M15 8 7 1 7 5.5 1 5.5 1 10.5 7 10.5 7 15Z' };
function moralTag(m) {
  const t = el('span', 'moral');
  // ícone da ordem com quanto pegou de verdade (pt.t) e, entre parênteses, quanto veio a mais/menos pelo rende (pt.x)
  // (André 2026-11-26: "coletou tantos e entre parênteses quanto a mais porque estava com 120 de moral"); ~N/h no toque
  const P = m.pt || (m.ph && { i: m.ph.i });
  if (P) { const i = el('img'); i.src = `painel-icones/${P.i}.png`; i.alt = ''; i.onerror = () => { i.remove(); }; t.append(i, el('span', 'ph', m.pt ? `${m.pt.t}${m.pt.x ? ` (${m.pt.x > 0 ? '+' : ''}${m.pt.x})` : ''}` : `~${m.ph.n}/h`)); }
  const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('viewBox', '0 0 16 16'); sv.setAttribute('class', 'seta');
  const pa = document.createElementNS('http://www.w3.org/2000/svg', 'path'); pa.setAttribute('d', SETA[m.seta] || SETA.cima); pa.setAttribute('fill', m.cor || '#9ad86a'); sv.append(pa);
  const pc = el('b', null, `${m.re}%`); pc.style.color = m.cor || '';
  t.append(sv, pc);
  if (m.fm) { const f = el('img'); f.src = 'painel-icones/peixe_assado.png'; f.alt = ''; f.className = m.fm < 0 ? 'fome' : 'bem'; t.append(f); } // a comida mexe no %
  t.onclick = () => aviso(`${m.pt ? `Pegou ${m.pt.t} ${m.pt.m >= 60 ? `nas últimas ${Math.round(m.pt.m / 60)} h` : `em ${m.pt.m} min`}${m.ph ? ` (~${m.ph.n} por hora${m.re && m.re !== 100 ? `; com rende 100% seria ~${Math.round(m.ph.n * 100 / m.re)}: o rende muda quanto vem por batida, com o mesmo vigor` : ''})` : ' (o por hora aparece com 15 min)'} · ` : ''}Moral ${m.ml} (${m.tr > 0 ? '+' : ''}${m.tr | 0} por hora)${m.fm ? ` · ${m.fn2}: ${m.fm > 0 ? '+' : ''}${m.fm}% (comida no Baú do Clã)` : ''} · rende ${m.re}%. Sobe: perto de você ou no seu time, Livre, Elogiar (no jogo). Desce: 3 h seguidas trabalhando, 12 h sem você no jogo.`);
  return t;
}
function cartaoMembro(m) {
  const c = el('div', 'card' + (m.on ? '' : ' fora') + (m.cheia ? ' cheio' : ''));
  const l = el('div', 'linha'), n = el('div', 'nome', m.nome);
  n.append(el('span', 'tag', m.tier)); if (m.dev) n.append(el('span', 'tag', 'devendo')); if (m.cheia) n.append(el('span', 'tag cheio', 'Mochila cheia')); else if (m.mo) n.append(lugaresTag('Mochila', m.mo));
  l.append(n, ...(m.re ? [moralTag(m)] : []), el('div', 'nv', `Nv ${m.nv}`)); c.append(l);
  c.append(el('div', 'faz', m.on ? (m.morto ? 'Caído' : m.fz || '') : 'Fora do mundo'));
  if (m.pt && m.fn?.k !== 'livre') { // o que rendeu a ordem: "Coletou 120 minério de ferro (+20 pela moral)"
    const nome = m.fn?.k === 'grind' ? 'monstros' : (info.recursos.find((r) => r.k === m.fn?.r)?.nome || '');
    const tempo = m.pt.m >= 60 ? `nas últimas ${Math.round(m.pt.m / 60)} h` : `em ${m.pt.m} min`;
    const x = m.pt.x ? ` (${m.pt.x > 0 ? '+' : ''}${m.pt.x} pela moral${m.fm ? ' e comida' : ''})` : '';
    const d = el('div', 'faz ganho' + (m.pt.x < 0 ? ' menos' : m.pt.x > 0 ? ' mais' : ''), `${m.fn?.k === 'grind' ? 'Derrotou' : 'Coletou'} ${m.pt.t} ${nome}${x} ${tempo}${m.ph ? ` · ~${m.ph.n}/h` : ''}`);
    c.append(d);
  }
  if (m.on) { const b = el('div', 'barras'); b.append(barra('Vida', m.hp, m.hpM, 'var(--hp)'), barra('Vigor', m.vg, m.vgM, 'var(--vg)')); c.append(b); }
  // ordem: as mesmas do painel do clã no jogo
  const o = el('div', 'ordem'), fn = el('select'), extra = el('select');
  for (const F of info.funcoes) fn.append(opcao(F.id, F.nome, (m.fn?.k || 'livre') === F.id));
  const montarExtra = () => {
    limpar(extra); extra.hidden = true;
    if (fn.value === 'recurso') { for (const R of info.recursos) extra.append(opcao(R.k, R.nome, m.fn?.r === R.k)); extra.hidden = false; }
    if (fn.value === 'fazenda') { extra.append(opcao('', 'Só colher e regar', !m.fn?.s)); for (const P of info.plantas) extra.append(opcao(P.k, `Plantar ${P.nome.toLowerCase()}`, m.fn?.s === P.k)); extra.hidden = false; }
    if (fn.value === 'arvores') { for (const T of info.arvores || []) extra.append(opcao(T.k, `${T.nome} (${T.h} h)`, m.fn?.s === T.k)); extra.hidden = false; } // planta até 10 e volta ao Livre
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
    if (f.k === 'recurso') f.r = extra.value; if ((f.k === 'fazenda' || f.k === 'arvores') && extra.value) f.s = extra.value; if (f.k === 'proteger') f.p = extra.value;
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
// Patente de Guerra (André 2026-11-26, shared/patente.js guerraInfo): igual à parte "Guerra do mês" do clã no jogo:
// placar Chama x Geada do mês e o escudo de cada um com o anel até a próxima patente (ícones, sem lista de texto)
const PATENTES = ['Recruta', 'Soldado', 'Cabo', 'Sargento', 'Tenente', 'Capitão', 'Comandante', 'Lenda'];
function escudoGuerra(o, raca, nome) {
  const d = el('div', 'ico pat'), r = 21, C = 2 * Math.PI * r, cor = raca === 'geada' ? '#73c7ff' : '#ff8c2b';
  d.innerHTML = `<svg viewBox="0 0 52 52" width="52" height="52"><circle cx="26" cy="26" r="${r}" fill="#0b0a09" stroke="#3d3326" stroke-width="4"/>`
    + (o.pct > 0 ? `<circle cx="26" cy="26" r="${r}" fill="none" stroke="${cor}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(C * Math.min(1, o.pct)).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 26 26)"/>` : '')
    + `<image href="painel-icones/patente/${raca === 'geada' ? 'geada' : 'chama'}_${o.i | 0}.png" x="11" y="11" width="30" height="30"/></svg>`;
  d.append(el('small', null, nome), el('small', 'apagado', `${o.a | 0} abates`));
  const i = o.i | 0, txt = i >= 7 ? 'Lenda · topo do mês' : `${PATENTES[i]} · ${Math.round((o.pct || 0) * 100)}% para ${PATENTES[i + 1]}`;
  d.onclick = () => aviso(`${nome}: ${txt} · ${o.a | 0} abates no mês`);
  return d;
}
function cartaoGuerra(G) {
  const c = el('div', 'card'), l = el('div', 'linha');
  l.append(el('div', 'nome', 'Guerra do mês'), el('div', 'nv', `Clã: ${G.cla | 0} abates`)); c.append(l);
  const p = el('div', 'placar');
  const lado = (r) => { const i = el('img'); i.src = `painel-icones/patente/${r}_3.png`; i.alt = r; return i; };
  p.append(lado('chama'), el('b', 'chama', String(G.r?.chama | 0)), el('span', null, 'x'), el('b', 'geada', String(G.r?.geada | 0)), lado('geada'));
  c.append(p);
  const f = el('div', 'icones');
  if (G.eu) f.append(escudoGuerra(G.eu, G.raca, 'Você'));
  for (const o of G.m || []) f.append(escudoGuerra(o, G.raca, o.nome));
  c.append(f, el('div', 'faz', 'Anel = quanto falta para a próxima patente. Dia 1º volta a Recruta e cada um ganha o prêmio da patente que pegou; o título da maior fica.'));
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
// o service worker fica num escopo só dele ('./painel-sw/'), então navigator.serviceWorker.ready NUNCA resolve nesta página
// (ela não está no escopo): era isso que travava o "ligar avisos" e nenhum aviso chegava (André 2026-11-25). Espera o
// próprio registro ficar ativo.
async function registroAvisos() {
  const reg = await navigator.serviceWorker.register('painel-sw.js', { scope: './painel-sw/' });
  if (reg.active) return reg;
  const w = reg.installing || reg.waiting;
  if (w) await new Promise((ok) => { const f = () => { if (w.state === 'activated' || w.state === 'redundant') ok(); }; w.addEventListener('statechange', f); f(); setTimeout(ok, 10e3); });
  return reg;
}
// ao abrir o painel: se o celular já tem os avisos ligados (permissão dada e assinatura no navegador) mas o servidor não
// sabe (assinatura perdida ou ligada pela versão que travava), manda de novo, sem perguntar nada
let avisosConferidos = false;
async function conferirAvisos() {
  if (avisosConferidos || !podeAvisar() || !info.push || info.push.on || Notification.permission !== 'granted') return;
  avisosConferidos = true;
  try {
    const reg = await registroAvisos();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(info.push.pub) });
    pedir({ acao: 'push', sub: sub.toJSON() });
  } catch { /* fica como está: o André liga pela caixinha */ }
}
async function ligarAvisos(ligar) {
  try {
    const reg = await registroAvisos();
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
  conferirAvisos();
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
  if (info.gu) raiz.append(cartaoGuerra(info.gu)); // Patente de Guerra (André 2026-11-26)
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
const fundoMapa = new Image(); fundoMapa.onload = () => { if (aba === 'jogar' && info) desenharMapa(); }; fundoMapa.src = 'painel-mapa.jpg';
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
  vilaMapa = c; if (aba === 'jogar' && info) desenharMapa();
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
  let toque = null; // Jogar: toque curto no mapa = ir até lá
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture?.(e.pointerId); dedos.set(e.pointerId, { x: e.clientX, y: e.clientY }); comecar(); toque = dedos.size === 1 ? { x: e.clientX, y: e.clientY, v: vista } : null; });
  cv.addEventListener('pointermove', (e) => {
    if (!dedos.has(e.pointerId) || !ini) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const a = estado(), m = ini.v.span / cv.clientWidth; // metros por pixel da tela
    const span = a.p.length > 1 && ini.d > 0 && a.d > 0 ? ini.v.span * (ini.d / a.d) : ini.v.span;
    vista = limitar({ cx: ini.v.cx - (a.mx - ini.mx) * m, cz: ini.v.cz - (a.my - ini.my) * m, span });
    desenharMapa();
  });
  const soltar = (e) => {
    if (e.type === 'pointerup' && toque && dedos.size === 1 && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) < 10 && aba === 'jogar') { vista = toque.v; tocarMapaLeve(e); }
    toque = null; dedos.delete(e.pointerId); comecar();
  };
  cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.25 : 0.8); }, { passive: false });
}

function desenharMapa() {
  // Jogar (André 2026-11-25: "tem q rolar muito"): o mapa ocupa a tela toda, então pode ser mais alto que largo; span = metros na largura
  const cv = $('mapa'), dpr = Math.min(2, devicePixelRatio || 1), lado = Math.round(cv.clientWidth * dpr) || 600, alto = Math.round(cv.clientHeight * dpr) || lado;
  if (cv.width !== lado || cv.height !== alto) { cv.width = lado; cv.height = alto; }
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const pts = [];
  const jogando = aba === 'jogar' && leve.f;
  // modo leve: cores pela relação com você (André 2026-11-25: "eu com meus bots verdinho... os geadas vermelhos... fica
  // parecendo que os geadas são meus amigos"): você e seus recrutas verdes, Geada vermelho, outros da Chama azuis,
  // monstros laranja. Fora do modo leve o mapa do clã segue como era (recrutas dourados)
  const COR_LEVE = { eu: '#3ddc5a', meu: '#8ee07a', inimigo: '#ff3b30', aliado: '#6fb3e6', bicho: '#f0a030', morto: '#777' };
  const meus = new Set((info?.m || []).map((m) => m.nome)), vistos = new Set(jogando ? leve.f.g.map((o) => o[0]) : []);
  for (const m of info.m || []) if (m.on && Number.isFinite(m.x) && !vistos.has(m.nome)) pts.push({ x: m.x, z: m.z, cor: jogando ? COR_LEVE.meu : '#f2b84b', nome: m.nome, r: 6 });
  if (jogando) {
    for (const [nome, x, z, geada, bot, nv, morto] of leve.f.g) pts.push({ x, z, cor: morto ? COR_LEVE.morto : geada ? COR_LEVE.inimigo : meus.has(nome) ? COR_LEVE.meu : COR_LEVE.aliado, nome: `${nome} ${nv}`, r: geada ? 6 : meus.has(nome) ? 5 : bot ? 4 : 5 });
    for (const [x, z, nv] of leve.f.m) pts.push({ x, z, cor: COR_LEVE.bicho, nome: `Nv ${nv}`, r: 3.5 });
    const car = leve.pk?.car; if (car?.onde === 1) pts.push({ x: car.x, z: car.z, cor: '#b07a46', nome: 'Carrinho', r: 5, losango: true });
    for (const [, , , x, z] of leve.pk?.ch || []) pts.push({ x, z, cor: '#d9a56a', nome: 'Pack', r: 3 });
    pts.push({ x: leve.f.eu[0], z: leve.f.eu[1], cor: COR_LEVE.eu, nome: 'Você', r: 7, eu: true });
  } else if (info.eu) pts.push({ x: info.eu.x, z: info.eu.z, cor: '#ffffff', nome: 'Você', r: 6 });
  const bots = ler('painelBots') === '1';
  if (bots) for (const C of info.clas || []) if (Number.isFinite(C.x)) pts.push({ x: C.x, z: C.z, cor: C.inimigo ? '#ff3b30' : C.raca === 'Geada' ? '#6fb3e6' : '#e0663a', nome: C.lider, r: 5, losango: true });
  $('mapaBots').checked = bots;
  if (!vista && jogando) quadro = limitar({ cx: leve.f.eu[0], cz: leve.f.eu[1], span: 140 }); // Jogar: segue o herói
  else if (!vista) { // ajusta sozinho a quem está no mundo
    const base = pts.length ? pts : [{ x: 0, z: 0 }];
    const x0 = Math.min(...base.map((p) => p.x)), x1 = Math.max(...base.map((p) => p.x)), z0 = Math.min(...base.map((p) => p.z)), z1 = Math.max(...base.map((p) => p.z));
    quadro = limitar({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, span: Math.max(320, (Math.max(x1 - x0, z1 - z0)) * 1.25) }); // de 320 m para cima: dá para ver onde fica
  } else quadro = vista;
  const { span } = quadro, x0 = quadro.cx - span / 2, z0 = quadro.cz - (span * H / W) / 2;
  const P = (x, z) => [((x - x0) / span) * W, ((z - z0) / span) * W];
  g.fillStyle = '#1a3e66'; g.fillRect(0, 0, W, H); // fora do mundo: mar fundo
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
  if (jogando && leve.rota?.length) { // o caminho que falta, tracejado
    g.save(); g.strokeStyle = '#ffd36b'; g.lineWidth = Math.max(2.5, W / 160); g.setLineDash([W / 70, W / 90]); g.beginPath();
    const [a0, b0] = P(leve.f.eu[0], leve.f.eu[1]); g.moveTo(a0, b0);
    for (const [x, z] of leve.rota.slice(leve.rotaI)) { const [a, b] = P(x, z); g.lineTo(a, b); }
    g.stroke(); g.restore();
  }
  if (jogando && leve.mapa && span <= 600) { // os lugares com janela e os totens
    for (const L of [...leve.mapa.npcs, ...leve.mapa.totens.map((t) => ({ ...t, f: 'totem' }))]) {
      const [a, b] = P(L.x, L.z); if (a < -20 || b < -20 || a > W + 20 || b > H + 20) continue;
      const r = Math.max(4, W / 110);
      g.fillStyle = LUGAR_COR[L.f] || '#e9c46a'; g.strokeStyle = 'rgba(12,10,8,.9)'; g.lineWidth = Math.max(1.5, W / 400);
      g.beginPath(); g.rect(a - r, b - r, r * 2, r * 2); g.fill(); g.stroke();
      marcas.push([L.n.split(',')[0], a, b - r - 5]);
    }
  }
  for (const p of pts) { // primeiro os pontos (os nomes deles ganham dos lugares)
    const [a, b] = P(p.x, p.z), r = p.r * (W / 600);
    g.fillStyle = p.cor; g.strokeStyle = 'rgba(12,10,8,.9)'; g.lineWidth = Math.max(1.5, W / 400); g.beginPath();
    if (p.losango) { g.moveTo(a, b - r * 1.3); g.lineTo(a + r * 1.3, b); g.lineTo(a, b + r * 1.3); g.lineTo(a - r * 1.3, b); g.closePath(); } else g.arc(a, b, r, 0, 6.283);
    g.fill(); g.stroke();
    if (p.eu) { g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = r * 0.7; g.beginPath(); g.arc(a, b, r * 1.7, 0, 6.283); g.stroke(); marcas.unshift([p.nome, a, b - r * 2 - 5]); continue; }
    marcas.push([p.nome, a, b - r - 5]);
  }
  for (const [t, a, y] of marcas) if (cabe(t, a, y)) escrever(t, a, y, '#fff3dc');
  for (const L of jogando ? [] : info.lugares || []) {
    const [a, b] = P(L.x, L.z); if (a < 0 || b < 0 || a > W || b > H) continue;
    g.fillStyle = 'rgba(30,24,16,.8)'; g.beginPath(); g.arc(a, b, Math.max(3, W / 200), 0, 6.283); g.fill();
    if (cabe(L.nome, a, b - 8)) escrever(L.nome, a, b - 8, '#e8dcc0');
  }
  // escala: quantos metros vale o traço
  const m = [10, 20, 50, 100, 200, 500].find((v) => (v / span) * W > W / 6) || 500, px = (m / span) * W, y = H - fonte - (jogando ? 64 * dpr : 0); // Jogar: acima da barra de botões
  g.fillStyle = 'rgba(12,10,8,.7)'; g.fillRect(fonte * 0.6, y - fonte * 1.4, px + fonte * 1.2, fonte * 2);
  g.fillStyle = '#efe7d6'; g.fillRect(fonte * 1.2, y, px, Math.max(2, W / 300));
  g.font = `${Math.round(fonte * 0.8)}px system-ui,sans-serif`; g.textAlign = 'left'; g.fillText(`${m} m`, fonte * 1.2, y - fonte * 0.3);
}

// ---------- Jogar: o modo leve (André 2026-11-25: "logar no jogo... só um mapa, eu clico e vai... ir na action house,
// vender itens... rodar num celular muito vagabundo"). Uma segunda ligação, agora COM corpo (shared/leve.js): o herói de
// verdade fica no mundo, os outros veem, a Geada pode atacar. A página manda o destino e o servidor anda o herói pela
// estrada; loja, leilão, baú e totem usam as mesmas mensagens e regras do jogo. A cada 0,5 s chega uma foto pequena.
const leve = { sala: null, f: null, mapa: null, mo: null, pk: null, fab: null, rec: 0, rota: null, rotaI: 0, rotaNome: '', leilao: null, bau: null, sel: null, entrando: false, saindo: false, chave: '', sujo: true, busca: '', anunciar: false };
const LUGAR_COR = { loja: '#f2c14e', compra: '#d9a54a', leilao: '#c58bff', pack: '#b07a46', ferreiro: '#9aa3ad', habilidades: '#9aa3ad', alquimia: '#6fcf8a', totem: '#6fd8ff' };
const LUGAR_NOME = { loja: 'Loja', compra: 'Compra itens', leilao: 'Leilão', pack: 'Pack', ferreiro: 'Ferreiro', habilidades: 'Ferreiro', alquimia: 'Alquimia' };
const PERTO = { npc: 4.2, leilao: 4.3, bau: 2.4, totem: 3.8, pack: 3.8, carrinho: 3.6, chao: 2.6 }; // m (o servidor confere de novo com as regras do jogo)
const mandar = (t, m) => { if (leve.sala) leve.sala.send(t, m); };

async function entrarLeve() {
  if (leve.sala || leve.entrando) return;
  leve.entrando = true; leve.saindo = false; desenharJogar();
  try { ligarLeve(await cliente.joinOrCreate(SALA, { sessao, leve: true })); }
  catch { aviso('Não deu para entrar no mundo agora. Tente de novo.'); }
  leve.entrando = false; leve.sujo = true; desenharJogar();
}
function ligarLeve(s) {
  leve.sala = s; if (criarAberto) s.send('leveReceitas', { ver: true }); // voltou da queda com o Criar aberto
  if (aba === 'missoes' || aba === 'personagem') s.send('leveMissoes', { ver: true });
  s.onMessage('leve', (d) => {
    leve.f = d.f; if (d.mo) { leve.mo = d.mo; leve.sujo = true; } if (d.pk) { leve.pk = d.pk; leve.sujo = true; } if (d.rc) { leve.rc = d.rc; if (criarAberto) leve.sujo = true; } if (d.mapa) leve.mapa = d.mapa; if (d.ms) { leve.ms = d.ms; if (aba === 'missoes') desenharMissoes(); if (aba === 'personagem') desenharPersonagem(); }
    for (const e of d.ev || []) eventoLeve(e);
    // apanhou minerando (André 2026-11-26: "quando chega o combate... tá meio confuso"): o servidor para a coleta (igual ao
    // jogo 3D); a página guarda o veio para o botão "Voltar a minerar" quando a luta acabar
    const coAntes = leve.coAntes; leve.coAntes = d.f?.co ? { no: d.f.co[0], nome: d.f.co[1], prof: leve.col?.no === d.f.co[0] ? leve.col.prof : '' } : null;
    if (d.f?.co) leve.volta = null; else if (coAntes && d.f?.lu) leve.volta = coAntes;
    if (aba === 'jogar') { desenharMapa(); desenharJogar(); } else if (aba === 'mochila' && leve.sujo) desenharMochila();
  });
  s.onMessage('leveMapa', (d) => { leve.mapa = d; leve.sujo = true; });
  s.onMessage('leveErro', (t) => { aviso(t); leve.saindo = true; s.leave(); });
  s.onMessage('*', () => {}); // o resto que o servidor manda a todo jogador: não serve aqui
  s.onLeave(async (codigo) => {
    const token = s.reconnectionToken;
    leve.sala = null; leve.rc = null; leve.f = null; leve.rota = null; leve.leilao = null; leve.bau = null; leve.sel = null; leve.sujo = true;
    if (codigo === 4001) aviso('Seu herói entrou pelo jogo: o modo leve saiu.');
    else if (!leve.saindo && codigo !== 4003) { // queda de internet: tenta voltar no mesmo herói
      try { ligarLeve(await cliente.reconnect(token)); return; } catch { aviso('O modo leve caiu. Toque em Entrar no mundo.'); }
    }
    desenharJogar(); if (aba === 'jogar') desenharMapa(); if (aba === 'mochila') desenharMochila();
  });
}
function sairLeve() { if (!leve.sala) return; leve.saindo = true; leve.sala.leave(); }
function eventoLeve(e) {
  if (e.t === 'aviso') aviso(e.texto);
  else if (e.t === 'leveRota') { leve.rota = e.pontos.length ? e.pontos : null; leve.rotaI = 0; if (e.pontos.length) leve.rotaNome = e.nome || ''; if (e.texto) aviso(e.texto); }
  else if (e.t === 'leilao') { leve.leilao = e; leve.sujo = true; }
  else if (e.t === 'bau') { leve.bau = e; leve.sujo = true; }
  else if (e.t === 'vila') { leve.rec = e.fase === 'comeca' ? Date.now() + (e.dur || 0) * 1000 : 0; leve.sujo = true; }
  else if (e.t === 'coleta') { // começou uma batida: zera a conta se for outro veio ou se parou faz tempo
    const c = leve.col, agora = Date.now();
    if (!c || c.no !== e.no || agora - c.ult > 12000) leve.col = { no: e.no, prof: e.prof, tot: {}, cargas: null, ult: agora };
    Object.assign(leve.col, { ini: agora, dur: (e.dur || 1) * 1000, ult: agora }); leve.sujo = true;
  }
  else if (e.t === 'coletou') {
    if (leve.col && leve.col.no === e.no) { for (const o of e.itens || []) leve.col.tot[o.nome] = (leve.col.tot[o.nome] || 0) + o.n; leve.col.cargas = e.cargas; leve.col.ult = Date.now(); }
    if (e.itens?.length) aviso(e.itens.map((o) => `+${o.n} ${o.nome}`).join(' · ')); leve.sujo = true;
  }
  else if (e.t === 'fabricando') { leve.fab = e.fim ? null : { nome: e.nome, ate: Date.now() + (e.dur || 0) * 1000 }; leve.sujo = true; }
  else if (e.t === 'fala') falaLeve(e); // o NPC respondeu (missão)
  else if (e.t === 'diaria_ir' && e.alvo) irLeve(e.alvo); // Ir da diária ou do contrato: o servidor diz o lugar aberto mais perto
  else if (e.t === 'chat') chatLeve([e]);
  else if (e.t === 'chatHist') { leve.chat = []; chatLeve(e.l); }
}
// chat (André 2026-11-25: "se der, pôr o chat lá também"): só texto, as últimas 30, sem som nem balão
const CANAIS = { geral: 'Geral', local: 'Local', amigos: 'Amigos', time: 'Time', pm: 'Privado' };
function chatLeve(novas) {
  leve.chat = [...(leve.chat || []), ...novas].slice(-30);
  const caixa = $('jogarChat');
  if (!caixa.firstChild) {
    caixa.append(el('div', 'nome', 'Chat'));
    const lista = el('div', 'chatLista'); lista.id = 'chatLista'; caixa.append(lista);
    const f = el('div', 'chatEnvia'), canal = el('select'), txt = el('input'), ok = el('button', 'acao', 'Enviar');
    for (const k of ['geral', 'local', 'amigos', 'time']) canal.append(opcao(k, CANAIS[k]));
    txt.maxLength = 120; txt.placeholder = 'Mensagem';
    const enviar = () => { const t = txt.value.trim(); if (!t) return; mandar('chat', { canal: canal.value, texto: t }); txt.value = ''; };
    ok.onclick = enviar; txt.onkeydown = (e) => { if (e.key === 'Enter') enviar(); };
    f.append(canal, txt, ok); caixa.append(f);
  }
  const lista = $('chatLista'), embaixo = lista.scrollTop + lista.clientHeight >= lista.scrollHeight - 8;
  limpar(lista);
  for (const m of leve.chat) { const d = el('div', m.meu ? 'meu' : ''); d.append(el('i', null, CANAIS[m.k] || m.k), el('b', null, m.n + ': '), document.createTextNode(m.x)); lista.append(d); }
  if (embaixo) lista.scrollTop = lista.scrollHeight;
}
// toque no mapa: vai até lá (perto de um lugar marcado, vai até ele, com o nome)
function tocarMapaLeve(e) {
  if (!leve.sala || !leve.f || !quadro) return;
  const cv = $('mapa'), R = cv.getBoundingClientRect(), k = quadro.span / R.width;
  const x = quadro.cx - quadro.span / 2 + (e.clientX - R.left) * k, z = quadro.cz - (quadro.span * R.height / R.width) / 2 + (e.clientY - R.top) * k;
  let alvo = { x, z, nome: '' }, melhor = 14 * k; // 14 px
  // combate (André 2026-11-25): tocar num monstro (ponto laranja) abre o quadrinho com o nome e o Atacar; não anda sozinho
  let bicho = null, mb = 18 * k;
  for (const [mx, mz, nv, , id, nome] of leve.f.m || []) { const d = Math.hypot(mx - x, mz - z); if (d < mb) { mb = d; bicho = { id, nome: nome || 'Monstro', nv }; } }
  if (bicho) { leve.mira = bicho; leve.sujo = true; desenharJogar(); return; }
  if (leve.mira) { leve.mira = null; leve.sujo = true; }
  for (const L of leve.mapa ? [...leve.mapa.npcs, ...leve.mapa.totens] : []) { const d = Math.hypot(L.x - x, L.z - z); if (d < melhor) { melhor = d; alvo = { x: L.x, z: L.z, nome: L.n.split(',')[0] }; } }
  irLeve(alvo);
}
const irLeve = (a) => { mandar('leveIr', { x: Math.round(a.x * 10) / 10, z: Math.round(a.z * 10) / 10, nome: a.nome || undefined }); if (aba !== 'jogar') irAba('jogar'); }; // de outra aba (ex.: Criar > Ir até a bigorna): volta ao mapa para ver o herói andar

const dEu = (o) => Math.hypot(o.x - leve.f.eu[0], o.z - leve.f.eu[1]);
const maisPerto = (lista) => lista.reduce((m, o) => (!m || dEu(o) < dEu(m) ? o : m), null);
// o que está perto agora: muda o "Perto de você"
function pertoAgora() {
  const M = leve.mapa; if (!M || !leve.f) return {};
  const npc = maisPerto(M.npcs), bau = maisPerto(M.baus), totem = maisPerto(M.totens);
  return {
    npc: npc && dEu(npc) < (npc.f === 'leilao' ? PERTO.leilao : npc.f === 'pack' ? PERTO.pack : PERTO.npc) ? npc : null,
    car: leve.pk?.car?.onde === 2 || (leve.pk?.car?.onde === 1 && dEu(leve.pk.car) < PERTO.carrinho) ? leve.pk.car : null,
    chao: (leve.pk?.ch || []).filter(([, , , x, z]) => dEu({ x, z }) < PERTO.chao),
    bau: bau && dEu(bau) < PERTO.bau ? bau : null,
    totem: totem && dEu(totem) < PERTO.totem ? totem : null,
    // coletar (André 2026-11-25: "cliquei nos minérios de ferro... não aconteceu nada"): veios, árvores e soltos perto
    col: leve.f.c || [], veio: (leve.f.c || []).find((o) => o[3] === 'min' && o[2] <= 4) || null,
  };
}

// um item numa grade: o ícone, a quantidade e (se tem) o preço
function itemLeve(k, nome, cor, n, sub, sel, toque) {
  const d = el('div', 'ico qtd' + (sub != null ? ' preco' : '') + (sel ? ' sel' : '')), q = el('div', 'q');
  if (cor) q.style.borderColor = cor;
  q.append(desenhoItem(k, nome, cor)); if (n > 1) q.append(el('b', null, num(n)));
  d.title = nome; d.onclick = toque;
  d.append(q, el('small', null, sub != null ? num(sub) : n > 1 ? num(n) : ''));
  return d;
}
// grade da mochila: tocar escolhe o item (onde = o que o botão vai fazer)
function gradeMochila(onde, preco) {
  const f = el('div', 'icones');
  for (const [i, k, n, nome, cor, venda, cad] of leve.mo?.it || []) {
    if (onde === 'vender' && cad) continue;
    const sel = leve.sel?.onde === onde && leve.sel.i === i;
    f.append(itemLeve(k, nome, cor, n, preco ? venda : null, sel, () => { leve.sel = sel ? null : { onde, i, k, nome, n, preco: venda }; leve.sujo = true; desenharJogar(); }));
  }
  if (!f.childNodes.length) f.append(el('div', 'faz', 'Mochila vazia.'));
  return f;
}
// a janelinha de quantidade (André 2026-11-25: "mais intuitivo"): tocar num item abre no meio da tela com − / + / Tudo e um
// botão grande; não precisa do teclado (o número ainda aceita digitar). Tocar fora fecha. O número fica guardado em
// leve.sel.q, então a foto do servidor que refaz a tela não volta o valor.
function janelaLeve(corpo) {
  const fundo = el('div', 'janelaLeve'), cx = el('div', 'caixa');
  fundo.onclick = (e) => { if (e.target === fundo) { leve.sel = null; leve.sujo = true; desenharJogar(); } };
  cx.append(...corpo); fundo.append(cx);
  return fundo;
}
function linhaQtd(rot, max, fazer, extra, compra) {
  const S = leve.sel || {}, tudo = (S.k && temMo(S.k)) || max;
  if (!(S.q >= 1)) S.q = compra ? 1 : max;
  const q = el('input'); q.type = 'number'; q.min = 1; q.value = S.q; q.inputMode = 'numeric';
  const b = el('button', 'acao', rot(S.q));
  const por = (n) => { S.q = Math.max(1, n | 0); q.value = S.q; b.textContent = rot(S.q); };
  q.oninput = () => { S.q = Math.max(1, q.value | 0); b.textContent = rot(S.q); };
  const mm = el('div', 'mm'), menos = el('button', null, '−'), mais = el('button', null, '+');
  menos.onclick = () => por(S.q - 1); mais.onclick = () => por(S.q + 1);
  mm.append(menos, q, mais);
  if (compra) { const d = el('button', 'txt', '+10'); d.onclick = () => por(S.q + 10); mm.append(d); }
  else if (tudo > 1) { const t = el('button', 'txt', 'Tudo'); t.onclick = () => por(tudo); mm.append(t); }
  b.onclick = () => { b.disabled = true; setTimeout(() => { b.disabled = false; }, 800); fazer(S.q); leve.sel = null; leve.sujo = true; desenharJogar(); };
  const corpo = [el('div', 'nome', S.nome || ''), el('div', 'faz', S.n > 1 ? `Você tem ${num(tudo)}` : ''), mm];
  if (extra) { const x = el('div', 'extra'); x.append(...extra); corpo.push(x); }
  corpo.push(b);
  return janelaLeve(corpo);
}

function cartaoLoja(npc) {
  const c = el('div', 'card'); c.append(el('div', 'nome', npc.n.split(',')[0]));
  if (npc.f === 'loja') {
    c.append(el('div', 'faz', 'Comprar'));
    const f = el('div', 'icones');
    for (const o of leve.mapa.loja) { const sel = leve.sel?.onde === 'comprar' && leve.sel.i === o.i; f.append(itemLeve(o.k, o.n, null, 1, o.preco, sel, () => { leve.sel = sel ? null : { onde: 'comprar', i: o.i, nome: o.n, preco: o.preco }; leve.sujo = true; desenharJogar(); })); }
    c.append(f);
    if (leve.sel?.onde === 'comprar') { const S = leve.sel; c.append(linhaQtd((n) => `Comprar ${n} por ${n * S.preco} de ouro`, 1, (n) => mandar('item', { acao: 'comprar', i: S.i, n }), null, true)); }
  }
  if (npc.f === 'loja' || npc.v) {
    c.append(el('div', 'faz', 'Vender (toque no item)'));
    c.append(gradeMochila('vender', true));
    if (leve.sel?.onde === 'vender') { const S = leve.sel; c.append(linhaQtd((n) => `Vender ${n} por ~${n * S.preco} de ouro`, S.n, (n) => mandar('item', { acao: 'vender', i: S.i, n }))); }
  }
  return c;
}

function cartaoLeilao() {
  const c = el('div', 'card'), L = leve.leilao;
  c.append(el('div', 'nome', 'Otávio · Leilão'));
  if (!L) { c.append(el('div', 'faz', 'Abrindo o leilão…')); mandar('leilao', { acao: 'ver' }); return c; }
  const bt = el('div', 'bts'), modo = el('button', 'acao' + (leve.anunciar ? '' : ' cinza'), leve.anunciar ? 'Voltar a comprar' : 'Anunciar um item');
  modo.onclick = () => { leve.anunciar = !leve.anunciar; leve.sel = null; leve.sujo = true; desenharJogar(); };
  bt.append(modo);
  if (L.caixa.ouro || L.caixa.n) { const r = el('button', 'acao', `Retirar ${L.caixa.ouro ? L.caixa.ouro + ' de ouro' : ''}${L.caixa.ouro && L.caixa.n ? ' e ' : ''}${L.caixa.n ? L.caixa.n + ' itens' : ''}`); r.onclick = () => mandar('leilao', { acao: 'retirar' }); bt.append(r); }
  c.append(bt);
  if (leve.anunciar) {
    c.append(el('div', 'faz', 'Toque no item da mochila, ponha quantos e o preço (cada um).'));
    c.append(gradeMochila('anunciar', false));
    if (leve.sel?.onde === 'anunciar') {
      const S = leve.sel, preco = el('input'), horas = el('select');
      preco.type = 'number'; preco.min = 1; preco.placeholder = 'Preço de cada'; preco.inputMode = 'numeric';
      for (const h of L.horas || [24]) horas.append(opcao(h, `${h} h`, String(h) === S.hs));
      preco.value = S.pv || ''; preco.oninput = () => { S.pv = preco.value; }; horas.onchange = () => { S.hs = horas.value; };
      const taxa = el('div', 'faz', `Taxa: ${Math.round((L.taxaAnuncio || 0) * 100)}% do preço, paga na hora.`);
      c.append(linhaQtd((n) => `Anunciar ${n}`, S.n, (n) => { const p = preco.value | 0; if (p < 1) return aviso('Ponha o preço'); mandar('leilao', { acao: 'anunciar', i: S.i, n, preco: p, horas: Number(horas.value) }); }, [preco, horas, taxa]));
    }
  } else {
    const b = el('input'); b.type = 'search'; b.placeholder = 'Buscar item pelo nome'; b.className = 'busca'; b.value = leve.busca;
    b.onchange = () => { leve.busca = b.value; mandar('leilao', { acao: 'ver', busca: { texto: b.value.trim() || undefined } }); };
    c.append(b);
    const f = el('div', 'icones');
    for (const a of L.lista) { const sel = leve.sel?.onde === 'leilao' && leve.sel.id === a.id; f.append(itemLeve(a.k, a.nome, a.c, a.n, a.preco, sel, () => { leve.sel = sel ? null : { onde: 'leilao', id: a.id, nome: a.nome, n: a.n, preco: a.preco, v: a.casa ? 'a Casa' : a.v }; leve.sujo = true; desenharJogar(); })); }
    if (!L.lista.length) f.append(el('div', 'faz', 'Nada nessa busca.'));
    c.append(f);
    if (leve.sel?.onde === 'leilao') {
      const S = leve.sel, ok = el('button', 'acao', `Comprar por ${S.preco} de ouro`);
      ok.onclick = () => { ok.disabled = true; mandar('leilao', { acao: 'comprar', id: S.id }); leve.sel = null; leve.sujo = true; desenharJogar(); };
      c.append(janelaLeve([el('div', 'nome', `${S.n > 1 ? S.n + ' ' : ''}${S.nome}`), el('div', 'faz', `Vendido por ${S.v}`), ok]));
    }
  }
  if (L.meus.length) {
    c.append(el('div', 'faz', 'Seus anúncios (toque para cancelar)'));
    const f = el('div', 'icones');
    for (const a of L.meus) f.append(itemLeve(a.k, a.nome, a.c, a.n, a.preco, false, () => { if (confirm(`Cancelar o anúncio de ${a.nome}?`)) mandar('leilao', { acao: 'cancelar', id: a.id }); }));
    c.append(f);
  }
  return c;
}

function cartaoBauLeve(b) {
  const c = el('div', 'card'), B = leve.bau && leve.bau.cla === b.cla ? leve.bau : null;
  c.append(el('div', 'nome', b.cla ? 'Baú do Clã' : 'Seu baú'));
  if (!B) { c.append(el('div', 'faz', 'Abrindo…')); mandar('bau', { acao: 'abrir', cla: !!b.cla }); return c; }
  c.append(el('div', 'faz', `Dentro (${B.it.length}/${B.l}) · toque para tirar`));
  const f = el('div', 'icones');
  for (const [i, k, n, nome, cor] of B.it) { const sel = leve.sel?.onde === 'tirar' && leve.sel.i === i; f.append(itemLeve(k, nome, cor, n, null, sel, () => { leve.sel = sel ? null : { onde: 'tirar', i, nome, n }; leve.sujo = true; desenharJogar(); })); }
  if (!B.it.length) f.append(el('div', 'faz', 'Vazio.'));
  c.append(f);
  if (leve.sel?.onde === 'tirar') { const S = leve.sel; c.append(linhaQtd((n) => `Tirar ${n}`, S.n, (n) => mandar('bau', { acao: 'tirar', i: S.i, n, cla: !!b.cla }))); }
  c.append(el('div', 'faz', 'Mochila · toque para guardar'));
  c.append(gradeMochila('guardar', false));
  if (leve.sel?.onde === 'guardar') { const S = leve.sel; c.append(linhaQtd((n) => `Guardar ${n}`, S.n, (n) => mandar('bau', { acao: 'guardar', i: S.i, n, cla: !!b.cla }))); }
  return c;
}

function cartaoTotem(t) {
  const c = el('div', 'card'); c.append(el('div', 'nome', `Totem ${t.n}`));
  const outros = leve.mapa.totens.filter((o) => o.d && o.id !== t.id);
  if (!outros.length) c.append(el('div', 'faz', 'Nenhum outro totem descoberto ainda. Passe perto deles para descobrir.'));
  const bt = el('div', 'bts');
  for (const o of outros) { const b = el('button', 'acao cinza', `${o.n} · ${o.taxa}`); b.onclick = () => mandar('totem', { para: o.id }); bt.append(b); }
  c.append(bt);
  return c;
}

// ---------- pack e carrinho (PR 2 do modo leve, André 2026-11-25: "mais que combate quero fazer pack"). As mesmas
// mensagens do jogo ('pack', 'veiculo', 'packTime'); o servidor confere distância, material, vigor e tudo de novo.
const metros = (o) => { const d = Math.round(dEu(o)); return d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d} m`; };
const bt = (txt, fazer, cinza) => { const b = el('button', 'acao' + (cinza ? ' cinza' : ''), txt); b.onclick = () => { b.disabled = true; setTimeout(() => { b.disabled = false; }, 800); fazer(); }; return b; };
const temMo = (k) => (leve.mo?.it || []).reduce((s, o) => s + (o[1] === k ? o[2] : 0), 0);
function cartaoPackNpc(npc) {
  const c = el('div', 'card'), K = leve.pk || {}, car = K.car;
  c.append(el('div', 'nome', `${npc.n.split(',')[0]} · ${npc.pk || 'Pack'}`));
  c.append(el('div', 'faz', 'Material para fazer o pack'));
  const f = el('div', 'icones');
  for (const [k, nome, q] of npc.custo || []) f.append(icone(k, nome, temMo(k), q));
  c.append(f);
  const b = el('div', 'bts');
  if (leve.fab) b.append(bt('Parar', () => mandar('fabricar', { parar: true }), true));
  else b.append(bt(K.c && car?.onde ? 'Fazer pack (vai pro carrinho)' : 'Fazer pack', () => mandar('pack', { acao: 'fazer', npc: npc.id })));
  // entregar aqui: o das costas e os do carrinho (o carrinho precisa estar perto)
  const aqui = (K.e || []).find((o) => o[0] === npc.id);
  if (K.c) b.append(aqui?.[4] ? bt(`Entregar ${K.c[1]} · ${aqui[4]} de ouro`, () => mandar('pack', { acao: 'entregar', npc: npc.id, de: 'costas' })) : el('span', 'faz', 'Esse pack foi feito aqui: leve pra outro mercador.'));
  if (car?.n.length && aqui?.[5]) car.n.forEach(([, nome], i) => b.append(bt(`Entregar do carrinho: ${nome}`, () => mandar('pack', { acao: 'entregar', npc: npc.id, de: 'carrinho', i }), true)));
  c.append(b);
  c.append(el('div', 'faz', 'Fazer um pack gasta vigor. Nas costas você anda devagar e não corre; se cair, o pack fica no chão.'));
  return c;
}
// o que você carrega: pack nas costas, carrinho, packs no chão, onde entregar e as ordens de pack do time
function cartaoCarga(P) {
  const K = leve.pk; if (!K) return null;
  const car = K.car, c = el('div', 'card');
  c.append(el('div', 'nome', 'Pack e carrinho'));
  if (K.c) {
    c.append(el('div', 'faz', `Nas costas: ${K.c[1]}${K.c[2] ? ' (roubado: vale mais)' : ''}`));
    const b = el('div', 'bts');
    if (P.car && P.car.onde === 1) b.append(bt('Pôr no carrinho', () => mandar('pack', { acao: 'por_carrinho' })));
    b.append(bt('Largar no chão', () => { if (confirm('Largar o pack no chão? Some em 30 min (só no palete ele fica).')) mandar('pack', { acao: 'largar' }); }, true));
    c.append(b);
  }
  for (const [g, , nome] of P.chao || []) { const b = el('div', 'bts'); b.append(bt(`Pegar ${nome} do chão`, () => mandar('pack', { acao: 'pegar', g }))); c.append(b); }
  if (car) {
    const comb = Math.round(car.comb), tq = car.tq;
    c.append(el('div', 'faz', `Carrinho Nv ${car.lv} · ${car.onde === 2 ? 'dirigindo' : car.onde === 1 ? `no chão a ${metros(car)}` : 'na mochila'} · packs ${car.n.length}/${car.cap} · combustível ${comb} m${car.q ? ' · QUEBRADO' : ''}`));
    const vm = el('div', 'vm'); vm.append(barra('Combustível', comb, tq, '#c58b3a'), barra('Carrinho', car.vida, car.vm, '#8a6a4a')); for (const d of vm.children) d.style.flex = '1'; c.append(vm);
    const b = el('div', 'bts');
    if (car.onde === 0 && K.tem) b.append(bt('Colocar carrinho', () => mandar('veiculo', { acao: 'colocar', k: 'carrinho' })));
    if (P.car && car.onde === 1 && !car.q) b.append(bt('Dirigir', () => mandar('veiculo', { acao: 'subir', k: 'carrinho' })));
    if (car.onde === 2) b.append(bt('Descer', () => mandar('veiculo', { acao: 'descer' })));
    if (P.car && comb < tq - 1) b.append(bt(K.gal ? `Pôr 1 galão (tem ${K.gal})` : 'Sem galão na mochila', () => mandar('veiculo', { acao: 'abastecer' }), !K.gal));
    if (P.car && car.q) b.append(bt('Consertar', () => mandar('veiculo', { acao: 'consertar' })));
    if (car.onde === 1 && !P.car) b.append(bt(`Ir até o carrinho (${metros(car)})`, () => irLeve({ x: car.x, z: car.z, nome: 'Carrinho' }), true));
    if (car.onde === 1) b.append(bt('Guardar na mochila', () => { if (!car.n.length || confirm('Os packs do carrinho ficam no chão. Guardar mesmo?')) mandar('veiculo', { acao: 'recolher' }); }, true));
    c.append(b);
    if (P.car && car.onde === 1 && car.n.length) {
      c.append(el('div', 'faz', 'No carrinho (toque para pôr nas costas)'));
      const f = el('div', 'icones');
      car.n.forEach(([k, nome], i) => f.append(itemLeve('pack', nome, '#b07a46', 1, null, false, () => { if (K.c) return aviso('Suas costas já estão ocupadas'); mandar('pack', { acao: 'tirar_carrinho', i }); })));
      c.append(f);
    }
  } else if (K.tem) { const b = el('div', 'bts'); b.append(bt('Colocar carrinho', () => mandar('veiculo', { acao: 'colocar', k: 'carrinho' }))); c.append(b); }
  // onde entregar: na lista Lugares > Mercadores, com quanto cada um paga (André 2026-11-25: "um milhão de botões isolados")
  if (K.tb) { // as ordens de pack do time (as mesmas da barra do time no jogo)
    c.append(el('div', 'faz', 'Pack do time (seus bots)'));
    const l = el('div', 'qtd-linha'), de = el('select'), pra = el('select');
    for (const [k, t] of [['palete', 'Do palete'], ['carrinho', 'Do carrinho'], ['mercante', 'Do navio']]) de.append(opcao(k, t));
    for (const [k, t] of [['carrinho', 'pro carrinho'], ['mercante', 'pro navio'], ['palete', 'pro palete'], ['mercador', 'pro mercador']]) pra.append(opcao(k, t));
    l.append(de, pra, bt('Mandar', () => mandar('packTime', { de: de.value, pra: pra.value, para: '*' })), bt('Parar', () => mandar('packTime', { de: 'parar', pra: '', para: '*' }), true));
    c.append(l);
  }
  return c.childNodes.length > 1 ? c : null;
}

// coletar pelo modo leve: as mesmas regras do jogo ('coletar': picareta/machado na mochila, vigor, nível da profissão);
// tocar anda até a borda e começa; o herói segue batendo até esgotar ou você tocar em Parar
const COLETA_VERBO = { min: ['⛏️', 'Minerar'], len: ['🪓', 'Cortar'], '': ['✋', 'Pegar'] };
function cartaoColeta(P) {
  if (!P.col?.length) return null;
  const c = el('div', 'card'); c.append(el('div', 'nome', 'Recursos aqui'));
  const b = el('div', 'bts');
  for (const [no, nome, d, pf] of P.col) {
    const [ic, verbo] = COLETA_VERBO[pf] || COLETA_VERBO[''], fazendo = leve.f.co?.[0] === no;
    b.append(bt(fazendo ? `Parar ${nome.toLowerCase()}` : `${ic} ${verbo}: ${nome}${d > 2 ? ` · ${d} m` : ''}`, () => mandar('leveColetar', { no, ...(fazendo ? { parar: true } : {}) }), fazendo));
  }
  c.append(b);
  c.append(el('div', 'faz', 'Precisa de picareta para minerar e machado para cortar (Criar > Ferramentas). Gasta vigor.'));
  return c;
}

// ---------- Lugares (André 2026-11-25: "menu igual do jogo real com todos os NPCs, recursos, mercadores, sanfonado,
// que pudesse clicar e ir para"). As seções do mapa do jogo (minimapa.gd SECOES), todas começam fechadas; tocar no nome
// leva o herói até lá pela estrada. Vilas, caçada e dungeons na ordem do jogo; o resto do mais perto ao mais longe.
const SECOES = [['vilas', 'Vilas e cidades'], ['totens', 'Totens'], ['caca', 'Caçada'], ['boss', 'Bosses'], ['dungeon', 'Dungeons'],
  ['recursos', 'Recursos'], ['pesca', 'Pescaria'], ['oficinas', 'Oficinas'], ['npcs', 'NPCs'], ['mercadores', 'Mercadores (entregas)']];
const PERTO_PRIMEIRO = new Set(['totens', 'recursos', 'oficinas', 'npcs', 'mercadores']);
// Mochila (André 2026-11-25: "pra aparecer nosso inventário"): recolhível como a lista Lugares; só mostra, tocar diz o
// nome e quantos. Vender, guardar e anunciar continuam nos cartões da loja, do baú e do leilão (perto deles)
let mochilaAberta = false;
function cartaoMochila() {
  const c = el('div', 'card sanfona'), cab = el('button', 'cab'), it = leve.mo?.it || [];
  cab.append(el('span', null, `${mochilaAberta ? '▾' : '▸'} Mochila`), el('small', 'faz', `${it.length}/${leve.mo?.l || 0}`));
  cab.onclick = () => { mochilaAberta = !mochilaAberta; leve.sujo = true; desenharJogar(); };
  c.append(cab);
  if (!mochilaAberta) return c;
  // etapa 2 (André 2026-11-26): o que está vestido em cima (tocar = ver e Tirar) e a mochila embaixo (tocar = ver,
  // Vestir, Usar, Trancar). As mesmas mensagens do jogo ('item' equipar/tirar/usar/cadeado).
  if (aba === 'mochila') {
    const eq = new Map((leve.mo?.eq || []).map((o) => [o[0], o])), v = el('div', 'icones');
    for (const [l, ic, nomeL] of VESTE) {
      const o = eq.get(l);
      if (o) v.append(itemLeve(o[1], o[2], o[3], 1, null, false, () => janelaPeca({ eq: o, nomeL })));
      else { const d = el('div', 'ico vazioEq'), q = el('div', 'q'); q.append(el('span', 'nvb', ic)); d.title = nomeL; d.append(q, el('small', null, nomeL)); d.onclick = () => aviso(`${nomeL}: nada vestido. Toque numa peça da mochila e em Vestir.`); v.append(d); }
    }
    c.append(el('div', 'faz', 'Vestindo'), v, el('div', 'faz', 'Mochila · toque num item'));
  }
  const f = el('div', 'icones');
  for (const o of it) { const [, k, n, nome, cor] = o; f.append(itemLeve(k, nome, cor, n, null, false, () => (aba === 'mochila' ? janelaPeca({ it: o }) : aviso(`${nome}: ${n}`)))); }
  if (!it.length) f.append(el('div', 'faz', 'Mochila vazia.'));
  c.append(f);
  return c;
}
const VESTE = [['cabeca', '🪖', 'Cabeça'], ['corpo', '🦺', 'Corpo'], ['pernas', '👖', 'Pernas'], ['pes', '🥾', 'Pés'], ['capa', '🧣', 'Capa'], ['acessorio', '💍', 'Acessório'], ['espada', '🗡️', 'Espada'], ['cajado', '🪄', 'Cajado']];
// a janelinha da peça: nome, o que dá, o que você usa no mesmo lugar (para comparar) e os botões que valem
function janelaPeca({ it, eq, nomeL }) {
  const fechar = () => { const j = document.querySelector('.janelaLeve.peca'); if (j) j.remove(); };
  fechar();
  const corpo = [], bts = el('div', 'bts');
  const acao = (txt, m, cinza) => { const b = el('button', 'acao' + (cinza ? ' cinza' : ''), txt); b.onclick = () => { mandar('item', m); fechar(); }; bts.append(b); };
  if (eq) {
    corpo.push(el('div', 'nome', eq[2]), el('div', 'faz', `${nomeL} · vestido`), el('div', null, eq[4] || ''));
    acao('Tirar', { acao: 'tirar', lugar: eq[0] }, true);
  } else {
    const [i, , n, nome, , preco, cad, tipo, lugar, txt] = it;
    corpo.push(el('div', 'nome', n > 1 ? `${nome} ×${n}` : nome));
    if (txt) corpo.push(el('div', null, txt));
    if (tipo === 'e') {
      const agora = (leve.mo?.eq || []).find((o) => o[0] === lugar);
      corpo.push(el('div', 'faz', agora ? `Você usa: ${agora[2]}${agora[4] ? ' · ' + agora[4] : ''}` : `${VESTE.find((v) => v[0] === lugar)?.[2] || ''}: nada vestido`));
      acao(agora ? 'Trocar' : 'Vestir', { acao: 'equipar', i });
    }
    if (tipo === 'u') acao('Usar', { acao: 'usar', i });
    acao(cad ? '🔓 Destrancar' : '🔒 Trancar', { acao: 'cadeado', i }, true);
    corpo.push(el('div', 'faz', `${cad ? 'Trancado: não vende nem joga fora. ' : ''}Vende por ${num(preco)} de ouro na loja.`));
  }
  const x = el('button', 'acao cinza', 'Fechar'); x.onclick = fechar; bts.append(x);
  corpo.push(bts);
  const j = janelaLeve(corpo); j.classList.add('peca'); j.onclick = (e) => { if (e.target === j) fechar(); };
  document.body.append(j);
}

// Criar (André 2026-11-25): mesmas receitas e regras do jogo; o servidor manda a lista (leveReceitas) e confere tudo de novo
// ao criar. Recolhido por padrão; só pede a lista enquanto está aberto. Precisa estar perto da estação (bigorna, bancada...).
let criarAberto = false, criarSel = '';
function pedirReceitas(ver) { mandar('leveReceitas', { ver }); if (!ver) leve.rc = null; }
function cartaoCriar() {
  const c = el('div', 'card sanfona'), cab = el('button', 'cab'), RC = leve.rc;
  cab.append(el('span', null, `${criarAberto ? '▾' : '▸'} Criar`), el('small', 'faz', criarAberto ? '' : 'ferreiro, alfaiate, cozinha'));
  cab.onclick = () => { criarAberto = !criarAberto; pedirReceitas(criarAberto); leve.sujo = true; desenharJogar(); };
  c.append(cab);
  if (!criarAberto) return c;
  if (!RC) { c.append(el('div', 'faz', 'Abrindo…')); return c; }
  if (leve.fab) c.append(el('div', 'nome', `Fazendo ${leve.fab.nome}…`), bt('Parar', () => mandar('fabricar', { parar: true }), true));
  let est = '';
  for (const [r, nome, usa, , estNome, perto, motivo, seg] of RC.r) {
    if (estNome !== est) {
      est = estNome; const k = RC.r.find((o) => o[4] === est)[3], perto = RC.r.some((o) => o[4] === est && o[5]);
      c.append(el('div', 'faz', `${estNome}${perto ? ' · você está perto' : ''}`));
      // ir até a estação mais perto (pública ou do seu terreno) pela estrada, como no mapa
      const E = RC.est.filter((o) => o[0] === k).sort((a, b) => dEu({ x: a[2], z: a[3] }) - dEu({ x: b[2], z: b[3] }))[0];
      if (E && !perto) c.append(bt(`Ir até ${E[1].split(',')[0]} · ${metros({ x: E[2], z: E[3] })}`, () => irLeve({ x: E[2], z: E[3] + 1.5, nome: E[1].split(',')[0] })));
    }
    const sel = criarSel === r, ruim = motivo || !perto;
    const b = el('button', 'linha' + (sel ? ' ativo' : '')); b.append(el('span', null, nome), el('span', null, ruim ? '✕' : `${seg} s`));
    b.onclick = () => { const fecha = sel && leve.sel?.onde === 'criar'; criarSel = fecha ? '' : r; leve.sel = fecha ? null : { onde: 'criar', r, nome }; leve.sujo = true; desenharJogar(); };
    c.append(b);
    if (!sel) continue;
    const f = el('div', 'icones'); for (const [k, n, q] of usa) f.append(icone(k, n, temMo(k), q)); c.append(f);
    if (motivo) c.append(el('div', 'faz', motivo)); else if (!perto) c.append(el('div', 'faz', `Vá até ${estNome.toLowerCase()} (botão acima)`));
    // a janelinha de quantidade (jogo leve mais simples): o material vai junto; tocar fora fecha e desmarca
    if (!ruim && !leve.fab && leve.sel?.onde === 'criar' && leve.sel.r === r) { const g = el('div', 'icones'); for (const [k, n, q] of usa) g.append(icone(k, n, temMo(k), q)); c.append(linhaQtd((n) => `Criar ${n}`, 1, (n) => { criarSel = ''; mandar('criar', { r, n: Math.min(RC.max, n) }); }, [g], true)); }
  }
  return c;
}

let lugaresAberto = false, secAberta = '', buscaLug = ''; // tudo fechado; uma seção aberta por vez (como no jogo: toca abre, toca de novo fecha)
function cartaoLugares(M) {
  const c = el('div', 'card sanfona'), cab = el('button', 'cab');
  cab.append(el('span', null, `${lugaresAberto ? '▾' : '▸'} Lugares`), el('small', 'faz', 'toque para ir'));
  cab.onclick = () => { lugaresAberto = !lugaresAberto; leve.sujo = true; desenharJogar(); };
  c.append(cab);
  if (!lugaresAberto) return c;
  // 3 (André 2026-11-25): os lugares mais usados em 4 botões grandes (1 toque e o herói vai) e a busca pelo nome; as seções
  // continuam embaixo. Ir fecha o painel para ver o mapa.
  const ir = (a) => { irLeve(a); painelLeve = ''; leve.sujo = true; desenharJogar(); };
  // recurso (veio, árvore, solto): o servidor escolhe o mais perto desse tipo que não está esgotado (André 2026-11-25)
  const irLugar = (a) => { if (a.t) { mandar('leveIrRecurso', { t: a.t }); painelLeve = ''; leve.sujo = true; desenharJogar(); } else ir(a); };
  const base = M.lug.find((o) => o[0] === 'vilas' && o[1] === 'Base do clã'), nPerto = (f) => maisPerto(M.npcs.filter(f));
  const tot = maisPerto(M.totens.filter((t) => t.d)), lei = nPerto((n) => n.f === 'leilao'), loja = nPerto((n) => n.f === 'loja');
  const at = el('div', 'atalhos');
  for (const [txt, o] of [['🏰 Minha base', base && { x: base[2], z: base[3], nome: 'Base do clã' }], ['🗿 Totem mais perto', tot && { x: tot.x, z: tot.z, nome: `Totem ${tot.n}` }],
    ['⚖️ Leilão', lei && { x: lei.x, z: lei.z, nome: lei.n.split(',')[0] }], ['🛒 Loja mais perto', loja && { x: loja.x, z: loja.z, nome: loja.n.split(',')[0] }]]) {
    const b = el('button'); b.append(document.createTextNode(txt), el('small', null, o ? metros(o) : 'nenhum'));
    b.disabled = !o; if (o) b.onclick = () => ir(o); at.append(b);
  }
  c.append(at);
  const busca = el('input'), achados = el('div');
  busca.type = 'search'; busca.className = 'busca'; busca.placeholder = '🔍 Buscar lugar pelo nome'; busca.value = buscaLug;
  const achar = () => {
    buscaLug = busca.value; limpar(achados); const t = semAcento(buscaLug); if (!t) return;
    const r = M.lug.filter((o) => semAcento(o[1]).includes(t)).sort((a, b) => dEu({ x: a[2], z: a[3] }) - dEu({ x: b[2], z: b[3] })).slice(0, 12);
    for (const [, nome, x, z, t] of r) { const b = el('button', 'linha'); b.append(el('span', null, nome), el('span', null, metros({ x, z }))); b.onclick = () => irLugar({ x, z, nome: nome.split(',')[0].replace(/ \(mais perto\)$/, ''), t }); achados.append(b); }
    if (!r.length) achados.append(el('div', 'faz', 'Nada com esse nome.'));
  };
  busca.oninput = achar; c.append(busca, achados); achar();
  const pagaPk = new Map((leve.pk?.e || []).map((o) => [o[1], o[4] + o[5]]));
  for (const [id, titulo] of SECOES) {
    const L = M.lug.filter((o) => o[0] === id); if (!L.length) continue;
    const t = el('button', 'sec'); t.append(el('span', null, `${secAberta === id ? '▾' : '▸'} ${titulo}`), el('small', null, String(L.length)));
    t.onclick = () => { secAberta = secAberta === id ? '' : id; leve.sujo = true; desenharJogar(); };
    c.append(t);
    if (secAberta !== id) continue;
    const lista = PERTO_PRIMEIRO.has(id) ? [...L].sort((a, b) => dEu({ x: a[2], z: a[3] }) - dEu({ x: b[2], z: b[3] })) : L;
    for (const [, nome, x, z, t] of lista) {
      const curto = nome.split(',')[0], pg = id === 'mercadores' ? pagaPk.get(curto) : 0;
      const b = el('button', 'linha'); b.append(el('span', null, id === 'mercadores' ? curto : nome), el('span', null, `${pg ? pg + ' de ouro · ' : ''}${metros({ x, z })}`));
      b.onclick = () => irLugar({ x, z, nome: curto.replace(/ \(mais perto\)$/, ''), t });
      c.append(b);
    }
  }
  return c;
}

let jogarChave = '';
function desenharJogar() {
  if (aba === 'mochila') return desenharMochila(); // os cartões da Mochila e do Criar chamam este redesenho
  const raiz = $('jogar'); if (aba !== 'jogar') return;
  telaLeve(!!leve.sala);
  $('jogarChat').hidden = !leve.sala || painelLeve !== 'chat';
  if (!leve.sala) {
    jogarChave = ''; limpar(raiz); limpar($('jogarChat')); leve.chat = [];
    const c = el('div', 'card');
    c.append(el('div', 'nome', 'Jogar pelo modo leve'));
    c.append(el('div', 'faz', 'Seu herói entra no mundo de verdade: os outros veem você e a Geada pode atacar. Toque no mapa e ele vai a pé pela estrada. Loja, leilão, baú e totem funcionam quando você chega perto. Se o jogo estiver aberto, ele sai (é o mesmo herói).'));
    const b = el('button', 'acao', leve.entrando ? 'Entrando…' : 'Entrar no mundo'); b.disabled = leve.entrando; b.onclick = entrarLeve;
    const bt = el('div', 'bts'); bt.append(b); c.append(bt);
    raiz.append(c);
    return;
  }
  if (!leve.f) return;
  const [x, z, hp, hpM, mn, mnM, morto, ouro, nv, pack, montado, vg, vgM] = leve.f.eu;
  // o caminho já andado sai do tracejado
  if (leve.rota) while (leve.rotaI < leve.rota.length - 1 && Math.hypot(leve.rota[leve.rotaI][0] - x, leve.rota[leve.rotaI][1] - z) < 3) leve.rotaI++;
  // o cartão de status muda a cada foto; o resto só quando muda o que está perto (não refaz a tela embaixo do dedo)
  let st = $('jogarStatus');
  if (!st) { st = el('div', 'card hud'); st.id = 'jogarStatus'; }
  limpar(st);
  const vm = el('div', 'vm'); vm.append(barra('Vida', hp, hpM, 'var(--hp)'), barra('Mana', mn, mnM, '#3d7fd0')); if (vgM) vm.append(barra('Vigor', vg, vgM, '#6fbf5a')); for (const d of vm.children) d.style.flex = '1'; st.append(vm);
  // 1 (André 2026-11-25): o quadro de cima só com a conta num relance e uma frase do que está acontecendo; Montar, Recall,
  // Sair e Ajuda viraram os botões redondos à direita (desenhados junto com a barra de baixo)
  const moIt = leve.mo?.it || [], moL = leve.mo?.l || 0, conta = el('div', 'conta');
  conta.append(document.createTextNode(`Nv ${nv} · 💰 ${num(ouro)} · `), el('span', moL && moIt.length >= moL ? 'cheia' : '', `🎒 ${moIt.length}/${moL}`));
  st.append(conta);
  const extras = [pack && '📦 pack nas costas', montado && '🐺 no lobo', leve.pk?.car?.onde === 2 && '🛒 no carrinho'].filter(Boolean);
  if (extras.length) st.append(el('div', 'faz', extras.join(' · ')));
  const P = pertoAgora();
  cartaoAcao(raiz, P, morto, mn);
  const chave = [P.npc?.n, P.bau && 'b' + P.bau.cla, P.totem?.id, P.car ? 'c' : '', (P.chao || []).map((o) => o[0]).join(','), montado ? 'm' : '', P.veio?.[0] || '', P.col.map((o) => o[0]).join(','), leve.f.co?.[0] || ''].join('|');
  if (chave === jogarChave && !leve.sujo && raiz.contains(st)) return;
  if (document.activeElement?.tagName === 'INPUT' && raiz.contains(document.activeElement) && chave === jogarChave) return; // digitando: não refaz
  if (chave !== jogarChave) { leve.sel = null; if (!P.npc || P.npc.f !== 'leilao') leve.leilao = null; if (!P.bau) leve.bau = null; }
  const algo = !!(P.npc || P.bau || P.totem), chegou = (algo && chave.split('|').slice(0, 3).join('|') !== jogarChave.split('|').slice(0, 3).join('|'))
    || (P.veio && P.veio[0] !== jogarChave.split('|')[6]); // chegou num veio: o Aqui abre com o Minerar
  if (chegou && !emLuta(morto)) painelLeve = 'perto';
  jogarChave = chave; leve.sujo = false;
  // tela do modo leve (André 2026-11-25: "tem q rolar muito... como o menu é sanfonado da pra limpar a tela"): o mapa ocupa
  // a tela; embaixo, uma barra com Perto, Mochila, Lugares e Chat. Cada botão abre um painel por cima do mapa (um por vez;
  // tocar de novo fecha). Chegou perto de uma loja, baú, totem ou mercador: o Perto abre sozinho.
  // André 2026-11-25 (loja do jogo leve "fica subindo sozinha"): tocar num item refaz o painel; guarda a rolagem da folha
  // e devolve se continua o mesmo painel (e o mesmo lugar perto), senão o painel novo começa no topo.
  const folhaAntes = raiz.querySelector('.folha'), rolou = folhaAntes && chave === rolouChave && painelLeve === rolouPainel ? folhaAntes.scrollTop : 0;
  limpar(raiz); raiz.append(st);
  for (const k of ['jogarGeada', 'jogarAlvo']) { const a = $(k); if (a) raiz.append(a); }
  if (painelLeve && painelLeve !== 'chat') {
    const f = el('div', 'folha'), cab = el('div', 'folhaCab'), x = el('button', 'fecha', '✕');
    x.setAttribute('aria-label', 'Fechar'); x.onclick = () => abrirPainelLeve('');
    const it = leve.mo?.it || [];
    cab.append(el('span', 'nome', painelLeve === 'perto' ? '📍 Aqui perto' : painelLeve === 'mochila' ? `🎒 Mochila ${it.length}/${leve.mo?.l || 0}` : painelLeve === 'criar' ? '🔨 Criar' : painelLeve === 'time' ? '👥 Meu time' : '🧭 Ir para'), x);
    f.append(cab);
    if (painelLeve === 'perto') {
      if (P.npc) {
        if (P.npc.f === 'leilao') f.append(cartaoLeilao());
        else if (P.npc.f === 'pack') f.append(cartaoPackNpc(P.npc));
        else if (P.npc.f === 'loja' || P.npc.v) f.append(cartaoLoja(P.npc));
        else { const c = el('div', 'card'); c.append(el('div', 'nome', P.npc.n.split(',')[0]), el('div', 'faz', `${LUGAR_NOME[P.npc.f] || ''}: por enquanto só no jogo.`)); f.append(c); }
      }
      if (P.bau) f.append(cartaoBauLeve(P.bau));
      if (P.totem) f.append(cartaoTotem(P.totem));
      const cg = cartaoCarga(P); if (cg) f.append(cg);
      const cc = cartaoColeta(P); if (cc) f.append(cc);
      if (!P.npc && !P.bau && !P.totem && !cg && !cc) f.append(el('div', 'vazio', 'Chegue perto de uma loja, do leilão, de um baú ou de um totem para usar.'));
      if (!P.bau && leve.mapa?.baus?.length) { // ir até o baú (e o Baú do Clã) para ver o que tem dentro: abre sozinho ao chegar
        const c = el('div', 'card');
        for (const b of leve.mapa.baus) c.append(bt(`Ir ao ${b.cla ? 'Baú do Clã' : 'seu baú'} · ${metros(b)}`, () => irLeve({ x: b.x, z: b.z + 1.5, nome: b.cla ? 'Baú do Clã' : 'Seu baú' }), true));
        f.append(c);
      }
    } else if (painelLeve === 'mochila') { mochilaAberta = true; const c = cartaoMochila(); c.firstChild.remove(); f.append(c); }
    else if (painelLeve === 'criar') { criarAberto = true; const c = cartaoCriar(); c.firstChild.remove(); f.append(c); }
    else if (painelLeve === 'time') f.append(cartaoTime());
    else if (painelLeve === 'lugares' && leve.mapa?.lug) { lugaresAberto = true; const c = cartaoLugares(leve.mapa); c.firstChild.remove(); f.append(c); }
    raiz.append(f);
    if (rolou) f.scrollTop = rolou;
    rolouChave = chave; rolouPainel = painelLeve;
    f.onscroll = () => { rolouChave = chave; rolouPainel = painelLeve; };
  }
  // a barra de baixo (Aqui, Mochila, Criar, Ir para, Chat) virou o cartão único (André 2026-11-26): Aqui e Ir para ficam
  // no cartão; Mochila e Criar na aba Mochila; Chat no botão redondo 💬
  if (cartaoEl) raiz.append(cartaoEl);
  cartaoAcao(raiz, P, morto, mn); // a tela foi refeita: o cartão e os golpes voltam
  // os botões redondos à direita: lobo, base (recall), sair e ajuda
  const rd = el('div', 'redondos'), red = (ic, txt, fazer, ativo) => { const b = el('button', ativo ? 'ativo' : ''); b.append(el('i', null, ic), document.createTextNode(txt)); b.onclick = fazer; rd.append(b); };
  if (!leve.pk?.car || leve.pk.car.onde !== 2) red('🐺', montado ? 'Descer' : 'Lobo', () => mandar('montar'), montado); // a mesma mensagem do jogo ('montar')
  red('🏠', 'Base', () => mandar('vila'), leve.rec > Date.now()); // o mesmo da casinha do jogo (Simulacao.voltarVila): canaliza e aparece no Baú do Clã
  red('👥', 'Time', () => abrirPainelLeve(painelLeve === 'time' ? '' : 'time'), painelLeve === 'time');
  red('💬', 'Chat', () => abrirPainelLeve(painelLeve === 'chat' ? '' : 'chat'), painelLeve === 'chat'); // Sair e Ajuda foram para a aba Mais
  raiz.append(rd);
  // 5: a dica da primeira vez (guardada no aparelho; o ❓ mostra de novo)
  if (dicaAberta === null) { try { dicaAberta = !localStorage.getItem('leveDica1'); } catch { dicaAberta = false; } }
  if (dicaAberta) {
    const ok = el('button', 'acao', 'Entendi');
    ok.onclick = () => { dicaAberta = false; try { localStorage.setItem('leveDica1', '1'); } catch { /* sem armazenamento */ } leve.sujo = true; desenharJogar(); };
    const d = el('div', 'dica');
    for (const t of ['👆 Toque no mapa: seu herói anda até lá sozinho, pela estrada.', '🟫 O cartão embaixo do mapa diz o que você está fazendo: Parado, Andando, Minerando, Em luta ou Caído. Os botões dele são os que valem agora.',
      '🧭 Ir para: base, totem, leilão e loja com 1 toque, ou busque pelo nome.', '📍 Chegou numa loja, baú ou totem: a janela dele abre sozinha.',
      '🎒 Aba Mochila: o que você leva e o Criar. 🛡️ Aba Clã: seus recrutas e ordens. ☰ Mais: chat, leilão, sair.',
      '⛏️ Apanhou minerando: a mineração para e o cartão vira Em luta. Acabou a luta: "Voltar a minerar".',
      '🟢 Verde: você e seus recrutas · 🔴 Vermelho: Geada (inimigo) · 🔵 Azul: outros da Chama · 🟠 Laranja: monstro.', '⚔️ Toque num monstro (laranja) e em Atacar. Em luta, os golpes ficam no cartão: cada toque é um golpe. Para fugir, toque no mapa.',
      '⛏️ Minerar ou cortar: 🧭 Ir para > Recursos. Ao chegar, toque em Minerar ou Cortar no 📍 (precisa de picareta ou machado).', '👥 Time: chame seus recrutas para andar e lutar com você.', '🐺 monta no lobo · 🏠 volta para a base do clã · 💬 chat.']) d.append(el('div', null, t));
    const j = janelaLeve([el('div', 'nome', 'Como jogar o modo leve'), d, ok]); j.onclick = null; raiz.append(j);
  }
}
let dicaAberta = null;
// ---------- combate (André 2026-11-25: "combate e time... da forma mais intuitiva possível, sem automático, sem
// vantagem no modo leve"). Tocar no monstro mostra o quadrinho com Atacar (o servidor só anda até ele: leveIr com alvo);
// com monstro a LUTA_PERTO m aparecem os botões das MESMAS habilidades do jogo (mensagem 'habilidade', o servidor mira no
// mais perto e confere recarga e mana). Nada bate sozinho: cada toque é um golpe.
const LUTA_PERTO = 14;
const ICONE_HAB = { Golpe: '⚔️', Disparo: '🔮', Cura: '💚' };
let habChave = '';
function lutaLeve(raiz, morto, mana) {
  const F = leve.f, M = F.m || [];
  // o quadrinho do alvo (escolhido no mapa): nome, vida e Atacar
  let a = $('jogarAlvo');
  const alvo = leve.mira && M.find((o) => o[4] === leve.mira.id);
  if (leve.mira && !alvo) { if (leve.mira.atacou) aviso(`${leve.mira.nome} caiu ou fugiu`); leve.mira = null; }
  if (leve.mira && !morto) {
    if (!a) { a = el('div', 'card alvoLeve'); a.id = 'jogarAlvo'; }
    if (!raiz.contains(a)) raiz.insertBefore(a, raiz.children[1] || null);
    limpar(a);
    const l = el('div', 'linha'), d = Math.round(Math.hypot(alvo[0] - F.eu[0], alvo[1] - F.eu[1]));
    l.append(el('b', null, `${leve.mira.nome} · Nv ${alvo[2]}`), el('small', null, `${d} m`));
    const x = el('button', 'fecha', '✕'); x.onclick = () => { leve.mira = null; a.remove(); }; l.append(x);
    const b = el('div', 'barra'), i = el('b'); i.style.width = alvo[3] + '%'; i.style.background = '#d9362b'; b.append(i);
    a.append(l, b);
    if (d > 2.5 && !(leve.f.r && leve.rotaNome === leve.mira.nome)) {
      const at = el('button', 'acao', '⚔️ Atacar'); at.onclick = () => { leve.mira.atacou = true; mandar('leveIr', { x: alvo[0], z: alvo[1], nome: leve.mira.nome, alvo: leve.mira.id }); }; a.append(at);
    }
  } else if (a) a.remove();
  // os botões de luta: só com monstro perto (ou alvo escolhido) e sem painel aberto por cima
  let h = cartaoEl?.querySelector('.habLeve') || null; // os golpes moram no cartão (que pode estar fora do DOM agora)
  // Geada perto (André 2026-11-25: "e se um geada aparecer?"): aviso vermelho e os golpes aparecem (o servidor mira no mais perto, como no jogo)
  const geada = (F.g || []).filter((o) => o[3] && !o[6] && Math.hypot(o[1] - F.eu[0], o[2] - F.eu[1]) < LUTA_PERTO * 2);
  let ga = $('jogarGeada');
  if (geada.length && !morto) {
    if (!ga) { ga = el('div', 'card geadaLeve'); ga.id = 'jogarGeada'; }
    ga.textContent = `⚠️ Geada perto: ${geada.slice(0, 2).map((o) => `${o[0]}, Nv ${o[5]}`).join(' · ')}`;
    if (!raiz.contains(ga)) raiz.insertBefore(ga, raiz.children[1] || null);
  } else if (ga) ga.remove();
  const perto = F.hb && emLuta(morto);
  if (!perto) { if (h) h.remove(); habChave = ''; return; }
  const chave = F.hb.l.map((o) => o[0] + o[1]).join('|') + F.hb.mg;
  if (!h || chave !== habChave) {
    if (h) h.remove();
    h = el('div', 'habLeve'); habChave = chave;
    F.hb.l.forEach(([i, nome], n) => {
      const b = el('button', n === 0 ? 'grande' : ''); b.dataset.i = i;
      b.append(el('i', null, ICONE_HAB[nome] || '✨'), el('span', null, nome), el('b', 'cd'));
      b.onclick = () => { if (b.classList.contains('espera')) return; mandar('habilidade', i); };
      h.append(b);
    });
    const tr = el('button'); tr.append(el('i', null, '🔁'), el('span', null, F.hb.mg ? 'Usar espada' : 'Usar magia')); // o Trocar do jogo
    tr.onclick = () => mandar('modo', F.hb.mg ? 'Espada' : 'Magia'); h.append(tr);
    // poções (André 2026-11-26): mesmas da mochila e mesma recarga do jogo (o servidor confere)
    for (const [k, ic, nome] of [['pocao', '❤️', 'Poção vida'], ['pocao_mana', '💙', 'Poção mana']]) {
      const b = el('button'); b.dataset.po = k; b.append(el('i', null, ic), el('span', null, nome), el('b', 'cd'));
      b.onclick = () => { const p = (leve.f?.hb?.po || []).find((o) => o[0] === k); if (!p || p[1] < 0) return aviso(`Sem ${nome.toLowerCase()} na mochila`); if (p[3] > 0) return; mandar('item', { acao: 'usar', i: p[1] }); };
      h.append(b);
    }
    // sem botão Fugir (André 2026-11-25: "pra fugir eu clico no mapa"): tocar no mapa anda, mesmo no meio da luta
  }
  for (const [i, , cd, mn] of F.hb.l) {
    const b = h.querySelector(`[data-i="${i}"]`); if (!b) continue;
    const sem = mn > mana; b.classList.toggle('espera', cd > 0 || sem); b.querySelector('.cd').textContent = cd > 0 ? cd : sem ? '💧' : '';
  }
  for (const [k, i, n, cd] of F.hb.po || []) {
    const b = h.querySelector(`[data-po="${k}"]`); if (!b) continue;
    b.classList.toggle('espera', i < 0 || cd > 0); b.querySelector('.cd').textContent = cd > 0 ? cd : ''; b.querySelector('span').textContent = `${k === 'pocao' ? 'Vida' : 'Mana'} ×${n}`;
  }
  if (cartaoEl && h.parentNode !== cartaoEl) cartaoEl.append(h);
}
// em luta (André 2026-11-26): o servidor diz que bateu ou apanhou agora (lu), ou você escolheu um alvo, ou a Geada está
// perto. Bicho parado perto NÃO vira luta (senão minerar ao lado de um bicho calmo some da tela): toque nele para atacar.
function emLuta(morto) {
  const F = leve.f; if (!F || morto) return false;
  const d = (x, z) => Math.hypot(x - F.eu[0], z - F.eu[1]);
  return !!(F.lu || (leve.mira && (F.m || []).some((o) => o[4] === leve.mira.id)) || (F.g || []).some((o) => o[3] && !o[6] && d(o[1], o[2]) < LUTA_PERTO));
}
// ---------- o cartão único da aba Jogo (André 2026-11-26: "fique bem intuitivo"): um só, embaixo do mapa, com o que o
// herói faz agora, na ordem: Caído > Em luta > Minerando > Criando > Voltando para a base > Andando > Parado. Cada estado
// só tem os botões que valem nele. Refaz só quando o estado muda (não troca o botão embaixo do dedo); o resto atualiza no lugar.
let cartaoChave = '', lutaAntes = false, cartaoEl = null; // o cartão sai do DOM quando a tela é refeita: guardado aqui
function cartaoAcao(raiz, P, morto, mana) {
  const F = leve.f, R = F.r, luta = emLuta(morto);
  if (luta && !lutaAntes && painelLeve && painelLeve !== 'chat') { painelLeve = ''; leve.sujo = true; } // começou a luta: fecha o painel por cima e mostra os golpes
  lutaAntes = luta;
  const estado = morto ? 'morto' : luta ? 'luta' : F.co ? 'coleta' : leve.fab ? 'criar' : leve.rec > Date.now() ? 'base' : R ? 'anda' : 'parado';
  if (!cartaoEl) { cartaoEl = el('div', 'cartaoAcao'); cartaoEl.id = 'jogarCartao'; }
  const c = cartaoEl;
  const temPerto = !!(P.npc || P.bau || P.totem || P.car || P.chao?.length || leve.pk?.c || P.veio || P.col?.length);
  const aqui = P.npc ? P.npc.n.split(',')[0] : P.bau ? (P.bau.cla ? 'Baú do Clã' : 'Baú') : P.totem ? 'Totem' : P.veio ? 'Minério' : P.col?.length ? 'Recursos' : temPerto ? 'Pack' : '';
  const volta = leve.volta && (F.c || []).find((o) => o[0] === leve.volta.no);
  const chave = [estado, estado === 'coleta' ? F.co[0] : '', estado === 'parado' ? aqui + '|' + (volta ? volta[0] : '') : '', estado === 'anda' ? leve.rotaNome : ''].join('/');
  if (chave !== cartaoChave || !c.firstChild) {
    cartaoChave = chave; limpar(c); c.className = 'cartaoAcao' + (estado === 'luta' ? ' luta' : estado === 'morto' ? ' morto' : '');
    const tit = el('div', 'tit'), txt = el('span'); c._txt = txt; c._barra = null; c._sub = null; tit.append(txt); c.append(tit);
    const botao = (t, fazer, cinza) => { const b = bt(t, fazer, cinza); b.style.flex = '0 0 auto'; tit.append(b); };
    if (estado === 'coleta') {
      botao('Parar', () => mandar('leveColetar', { no: F.co[0], parar: true }), true);
      const barra = el('div', 'progColeta'), enche = el('i'); c._barra = enche; c._sub = el('div', 'faz'); barra.append(enche); c.append(barra, c._sub);
    } else if (estado === 'criar') botao('Parar', () => mandar('fabricar', { parar: true }), true);
    else if (estado === 'base') botao('Desistir', () => mandar('vila'), true);
    else if (estado === 'anda') botao('Parar', () => mandar('leveParar'), true);
    else if (estado === 'luta') { const b = el('div', 'barraAlvo'), i = el('b'); c._barra = i; b.append(i); c.append(b); }
    else if (estado === 'parado') {
      const b = el('div', 'bts');
      if (volta) { const [ic, verbo] = COLETA_VERBO[leve.volta.prof] || COLETA_VERBO['']; const v = bt(`${ic} Voltar a ${verbo.toLowerCase()} ${volta[1]}`, () => { leve.volta = null; mandar('leveColetar', { no: volta[0] }); }); v.classList.add('volta'); v.style.flexBasis = '100%'; b.append(v); }
      b.append(bt('🧭 Ir para…', () => abrirPainelLeve(painelLeve === 'lugares' ? '' : 'lugares')));
      if (aqui) b.append(bt(`📍 ${aqui}`, () => abrirPainelLeve(painelLeve === 'perto' ? '' : 'perto'), true));
      c.append(b);
    }
  }
  // o que muda a cada foto, no lugar
  const txt = c._txt, barra = c._barra, sub = c._sub;
  const extra = [F.eu[9] && '📦', F.eu[10] && '🐺', leve.pk?.car?.onde === 2 && '🛒'].filter(Boolean).join(' ');
  if (estado === 'morto') txt.textContent = '💀 Você caiu. Espere renascer no totem mais perto.';
  else if (estado === 'luta') {
    const M = F.m || [], alvo = (leve.mira && M.find((o) => o[4] === leve.mira.id)) || M.reduce((m, o) => (!m || Math.hypot(o[0] - F.eu[0], o[1] - F.eu[1]) < Math.hypot(m[0] - F.eu[0], m[1] - F.eu[1]) ? o : m), null);
    const ge = (F.g || []).find((o) => o[3] && !o[6] && Math.hypot(o[1] - F.eu[0], o[2] - F.eu[1]) < LUTA_PERTO);
    txt.textContent = ge && !leve.mira ? `⚔️ Em luta: ${ge[0]} (Geada, Nv ${ge[5]})` : alvo ? `⚔️ Em luta: ${alvo[5] || 'Monstro'} · Nv ${alvo[2]} · ❤ ${alvo[3]}%` : '⚔️ Em luta';
    if (barra) { barra.style.width = (alvo && !(ge && !leve.mira) ? alvo[3] : 0) + '%'; barra.parentNode.hidden = !alvo || !!(ge && !leve.mira); }
  } else if (estado === 'coleta') {
    const cl = leve.col?.no === F.co[0] ? leve.col : null, [ic] = COLETA_VERBO[cl?.prof] || COLETA_VERBO[''];
    txt.textContent = `${ic} ${{ min: 'Minerando', len: 'Cortando' }[cl?.prof] || 'Coletando'} ${F.co[1]}`;
    if (cl?.ini) { barra.parentNode.classList.remove('vai'); barra.style.width = (Math.min(1, (Date.now() - cl.ini) / cl.dur) * 100).toFixed(0) + '%'; } else barra.parentNode.classList.add('vai');
    const tot = Object.entries(cl?.tot || {}).map(([n, q]) => `${q} ${n}`).join(' · ');
    sub.textContent = `Pegou: ${tot || 'nada ainda'}${cl?.cargas != null ? ` · restam ${cl.cargas}` : ''}`;
  } else if (estado === 'criar') txt.textContent = `🔨 Fazendo ${leve.fab.nome}… ${Math.max(0, Math.ceil((leve.fab.ate - Date.now()) / 1000))} s (fique perto)`;
  else if (estado === 'base') txt.textContent = `🏠 Voltando para a base… ${Math.ceil((leve.rec - Date.now()) / 1000)} s`;
  else if (estado === 'anda') txt.textContent = `🚶 ${leve.rotaNome || 'Andando'} · ${R[0]} m · ${R[1] >= 60 ? Math.floor(R[1] / 60) + ' min' : R[1] + ' s'}${extra ? ' ' + extra : ''}`;
  else txt.textContent = aqui ? `Parado perto de: ${aqui}${extra ? ' ' + extra : ''}` : `Parado. Toque no mapa para andar.${extra ? ' ' + extra : ''}`;
  if (!raiz.contains(c)) raiz.insertBefore(c, raiz.querySelector('.redondos'));
  lutaLeve(raiz, morto, mana);
}

// ---------- time (André 2026-11-25): os recrutas andam e lutam com você. "Chamar" = a função "Me seguir" do jogo (a
// mesma mensagem 'cla' funcao, pela ligação do herói: o servidor confere tudo); tocar de novo devolve a função de antes
// (guardada no aparelho). Os dados vêm do painel (info.m), que atualiza sozinho.
const antesSeguir = () => { try { return JSON.parse(localStorage.getItem('leveAntes') || '{}'); } catch { return {}; } };
function ordemTime(m, seguir) {
  const A = antesSeguir();
  if (seguir) { if (m.fn?.k !== 'seguir') A[m.id] = m.fn || { k: 'livre' }; }
  const fn = seguir ? { k: 'seguir' } : A[m.id] && A[m.id].k !== 'seguir' ? A[m.id] : { k: 'livre' };
  if (!seguir) delete A[m.id];
  try { localStorage.setItem('leveAntes', JSON.stringify(A)); } catch { /* sem armazenamento */ }
  mandar('cla', { acao: 'funcao', id: m.id, fn });
  m.fn = fn; // já mostra; o painel confirma na próxima atualização
}
function cartaoTime() {
  const c = el('div', 'card'), L = (info?.m || []).filter((m) => !m.dev);
  if (!L.length) { c.append(el('div', 'vazio', 'Nenhum recruta no clã. Contrate no Recrutador.')); return c; }
  const fora = L.filter((m) => m.on && m.fn?.k !== 'seguir');
  const todos = el('div', 'atalhos'); const tb = el('button'); tb.append(document.createTextNode(fora.length ? '👥 Todos comigo' : '✓ Todos com você'), el('small', null, fora.length ? `chamar ${fora.length}` : ''));
  tb.disabled = !fora.length; tb.onclick = () => { for (const m of fora) ordemTime(m, true); leve.sujo = true; desenharJogar(); };
  todos.style.gridTemplateColumns = '1fr'; todos.append(tb); c.append(todos);
  for (const m of L) {
    const segue = m.fn?.k === 'seguir', r = el('div', 'recLeve'), n = el('div', 'n');
    const longe = m.on && Number.isFinite(m.x) && leve.f ? metros({ x: m.x, z: m.z }) : '';
    n.append(el('b', null, `${m.nome} · Nv ${m.nv}`), el('small', null, !m.on ? 'fora do mundo' : m.morto ? 'caído' : segue ? `com você${longe ? ' · ' + longe : ''}` : `${m.fz || 'livre'}${longe ? ' · ' + longe : ''}`));
    const b = el('button', segue ? 'on' : '', segue ? 'Comigo ✓' : 'Chamar');
    b.disabled = !m.on; b.onclick = () => { ordemTime(m, !segue); leve.sujo = true; desenharJogar(); };
    r.append(n, b); c.append(r);
  }
  c.append(el('div', 'faz', 'Chamar = vem até você e luta junto (igual Me seguir do jogo). Comigo ✓ de novo = volta ao que fazia.'));
  return c;
}

let rolouChave = '', rolouPainel = ''; // onde a folha do modo leve estava rolada (ver desenharJogar)
let painelLeve = ''; // '' (só o mapa), 'perto', 'mochila', 'lugares' ou 'chat'
function abrirPainelLeve(k) {
  if ((k === 'criar') !== (painelLeve === 'criar')) { criarAberto = k === 'criar'; pedirReceitas(criarAberto); } // a lista de receitas só vem com a aba aberta
  painelLeve = k; leve.sujo = true; desenharJogar();
  if (k === 'chat') { const l = $('chatLista'); if (l) l.scrollTop = l.scrollHeight; }
}
// o modo leve ocupa a altura que sobra embaixo do cabeçalho (sem rolar a página); o mapa se ajusta e redesenha
function telaLeve(liga) {
  const t = $('jogarAba'); t.classList.toggle('tela', liga); document.body.classList.toggle('leveTela', liga); // o aviso sobe para o meio do mapa (André 2026-11-26)
  const h = liga ? Math.max(360, Math.floor(innerHeight - t.getBoundingClientRect().top - ($('abas').offsetHeight || 0) - 4)) + 'px' : ''; // sobra acima das 5 abas
  if (t.style.height !== h) { t.style.height = h; if (aba === 'jogar' && info) requestAnimationFrame(() => desenharMapa()); }
}
addEventListener('resize', () => { if (aba === 'jogar' && leve.sala) { telaLeve(true); desenharMapa(); } });

function desenhar() {
  if (!info) return;
  $('abas').hidden = false;
  $('abas').querySelector('[data-aba=cla]').classList.toggle('alerta', !!(info.bauCheio || info.m?.some((m) => m.cheia))); // algo cheio: bolinha vermelha na aba
  $('titulo').textContent = aba !== 'cla' ? 'Age of Embers' : info.sem ? 'Painel do Clã' : `${info.n} · Nv ${info.nv}`; // o jogo primeiro; o nome do clã na aba Clã
  $('subtitulo').textContent = info.sem ? info.nome || '' : `Líder ${info.nome} · Cofre ${info.cofre} de ouro`;
  const foco = document.activeElement?.tagName === 'SELECT'; // escolhendo uma ordem: não refaz a lista por baixo do dedo
  if (aba === 'cla' && !foco) desenharCla();
  if (aba === 'bots') desenharBots();
  if (aba === 'log') desenharLog();
  if (aba === 'jogar' && !leve.sala) desenharMapa(); // fora do mundo: o mapa do clã (recrutas, líderes bot)
  if (aba === 'jogar' && !leve.sala) desenharJogar();
  if (aba === 'mais') desenharMais();
}

// ---------- aba Mochila (André 2026-11-26): o que você leva e o Criar, numa página só (antes eram 2 botões da barra do
// mapa). Equipar e usar chegam na etapa 2. Fora do mundo: só o botão para entrar.
function foraDoMundo(raiz, oque) {
  const c = el('div', 'card'); c.append(el('div', 'nome', 'Seu herói está fora do mundo'), el('div', 'faz', `Entre no mundo para ver ${oque}.`));
  const b = el('div', 'bts'); b.append(bt(leve.entrando ? 'Entrando…' : 'Entrar no mundo', () => { irAba('jogar'); entrarLeve(); })); c.append(b); raiz.append(c);
}
let mochilaRolou = 0;
function desenharMochila() {
  const raiz = $('mochilaAba'); if (aba !== 'mochila') return;
  if (document.activeElement?.tagName === 'INPUT' && raiz.contains(document.activeElement)) return; // digitando a quantidade: não refaz
  limpar(raiz); leve.sujo = false;
  if (!leve.sala || !leve.f) return foraDoMundo(raiz, 'a mochila e criar');
  mochilaAberta = true; const m = cartaoMochila(); m.firstChild.remove();
  m.prepend(el('div', 'nome', `🎒 Mochila ${(leve.mo?.it || []).length}/${leve.mo?.l || 0}`)); raiz.append(m);
  if (!criarAberto) { criarAberto = true; pedirReceitas(true); }
  const c = cartaoCriar(); c.firstChild.remove(); c.prepend(el('div', 'nome', '🔨 Criar')); raiz.append(c);
  if (mochilaRolou) scrollTo(0, mochilaRolou);
}
addEventListener('scroll', () => { if (aba === 'mochila') mochilaRolou = scrollY; }, { passive: true });

// ---------- aba Missões (etapa 3, André 2026-11-26): História, Diárias, Guilda e Escolta do Clã, cada uma com o botão para
// ir até onde se faz. Mesmas mensagens do jogo ('falar' com missão, 'diaria', 'guilda', 'cla' missao); o servidor confere.
function falaLeve(e) {
  const ok = el('button', 'acao', 'Ok');
  const j = janelaLeve([el('div', 'nome', e.npc || 'NPC'), el('div', 'dica', e.texto || '')]); j.classList.add('fala');
  const fechar = () => j.remove(); ok.onclick = fechar; j.onclick = (ev) => { if (ev.target === j) fechar(); };
  j.firstChild.append(ok); document.querySelectorAll('.janelaLeve.fala').forEach((o) => o.remove()); document.body.append(j);
}
// ---------- Personagem (etapa 4, André 2026-11-26): status, atributos, golpes e títulos, iguais ao menu do jogo
let atrPend = {}, golpeSel = -1;
function desenharPersonagem() {
  const raiz = $('personagemAba'); if (aba !== 'personagem') return;
  limpar(raiz);
  if (!leve.sala || !leve.f) return foraDoMundo(raiz, 'o personagem');
  const P = leve.ms?.pe; if (!P) { raiz.append(el('div', 'vazio', 'Abrindo…')); return; }
  const card = (tit) => { const c = el('div', 'card'); c.append(el('div', 'nome', tit)); raiz.append(c); return c; };
  // status
  { const c = card(`🧍 Nível ${P.nv}`), b = el('div', 'barra'), i = el('b'); i.style.width = Math.min(100, (P.xp / (P.xpM || 1)) * 100) + '%'; i.style.background = 'var(--gold)'; b.append(i);
    c.append(el('div', 'faz', `XP ${num(P.xp)}/${num(P.xpM)}`), b);
    const g = el('div', 'atalhos'); for (const [n, v] of P.st) { const d = el('button'); d.disabled = true; d.style.opacity = 1; d.append(document.createTextNode(String(v)), el('small', null, n)); g.append(d); } c.append(g);
  }
  // atributos: + guarda no aparelho até Confirmar (como o menu do jogo); o servidor confere os pontos
  { const usados = Object.values(atrPend).reduce((s, v) => s + v, 0), livres = P.pts - usados;
    const c = card(`💪 Atributos · ${livres} ponto${livres === 1 ? '' : 's'} livre${livres === 1 ? '' : 's'}`);
    for (const [k, [nome, desc]] of Object.entries(P.an)) {
      const r = el('div', 'recLeve'), n = el('div', 'n'); n.append(el('b', null, `${nome} ${P.atr[k] + (atrPend[k] || 0)}${atrPend[k] ? ` (+${atrPend[k]})` : ''}`), el('small', null, desc)); r.append(n);
      if (atrPend[k]) { const m = el('button', null, '−'); m.style.minWidth = '48px'; m.onclick = () => { atrPend[k]--; if (!atrPend[k]) delete atrPend[k]; desenharPersonagem(); }; r.append(m); }
      const mais = el('button', 'on', '+'); mais.style.minWidth = '48px'; mais.disabled = livres <= 0; mais.onclick = () => { atrPend[k] = (atrPend[k] || 0) + 1; desenharPersonagem(); }; r.append(mais);
      c.append(r);
    }
    if (usados) { const d = el('div', 'bts'); d.append(bt('Confirmar', () => { mandar('atributos', atrPend); atrPend = {}; }), bt('Cancelar', () => { atrPend = {}; desenharPersonagem(); }, true)); c.append(d); }
  }
  // golpes: os 8 da barra (4 de espada, 4 de magia); toque num e escolha outro do mesmo tipo
  { const c = card('⚔️ Golpes'), nome = new Map(P.hs.map((h) => [h[0], h]));
    for (const [tipo, ini, rot] of [[0, 0, 'Espada'], [1, 4, 'Magia']]) {
      c.append(el('div', 'faz', rot)); const g = el('div', 'atalhos');
      for (let i = ini; i < ini + 4; i++) { const h = nome.get(P.bd[i]); const b = el('button'); b.append(document.createTextNode(h ? h[1] : '?'), el('small', null, golpeSel === i ? 'escolha abaixo' : 'trocar')); if (golpeSel === i) b.style.borderColor = '#7fcf7f'; b.onclick = () => { golpeSel = golpeSel === i ? -1 : i; desenharPersonagem(); }; g.append(b); }
      c.append(g);
      if (golpeSel >= ini && golpeSel < ini + 4) for (const [k, n, t, desc] of P.hs.filter((h) => h[2] === tipo && !P.bd.includes(h[0]))) {
        const r = el('div', 'recLeve'), x = el('div', 'n'); x.append(el('b', null, n), el('small', null, desc)); const u = el('button', 'on', 'Usar');
        u.onclick = () => { const bd = [...P.bd]; bd[golpeSel] = k; golpeSel = -1; mandar('build', bd); P.bd = bd; desenharPersonagem(); };
        r.append(x, u); c.append(r);
      }
    }
  }
  // títulos
  { const c = card('🏅 Títulos');
    if (!P.tits.length) c.append(el('div', 'faz', 'Nenhum ainda. Títulos vêm de caçar, profissões, história e guerra.'));
    for (const [k, n, txt] of P.tits) {
      const r = el('div', 'recLeve'), x = el('div', 'n'); x.append(el('b', null, n), el('small', null, txt));
      const u = el('button', P.tit === k ? 'on' : null, P.tit === k ? 'Em uso ✓' : 'Usar'); u.onclick = () => mandar('item', { acao: 'titulo', id: P.tit === k ? '' : k });
      r.append(x, u); c.append(r);
    }
  }
}
function desenharMissoes() {
  const raiz = $('missoesAba'); if (aba !== 'missoes') return;
  limpar(raiz);
  if (!leve.sala || !leve.f) return foraDoMundo(raiz, 'as missões');
  const S = leve.ms; if (!S) { raiz.append(el('div', 'vazio', 'Abrindo…')); return; }
  const card = (tit) => { const c = el('div', 'card'); c.append(el('div', 'nome', tit)); raiz.append(c); return c; };
  const linhaBts = (c, ...b) => { const d = el('div', 'bts'); d.append(...b); c.append(d); };
  // História
  { const c = card('📖 História'), H = S.hi;
    if (!H) c.append(el('div', 'faz', 'Você terminou a história. 🎉'));
    else {
      c.append(el('div', null, H.nome), el('div', 'faz', H.ac ? H.txt : H.nn ? `Missão nova: fale com ${H.nn} para aceitar.` : `Abre no Nv ${H.nv}. Até lá: diárias, caça e coleta.`));
      const b = [];
      if (H.npc && H.np) b.push(bt(`💬 Falar com ${H.nn}`, () => mandar('falar', { npc: H.npc, missao: true })));
      else if (H.npc) b.push(bt(`🧭 Ir até ${H.nn} · ${metros({ x: H.nx, z: H.nz })}`, () => irLeve({ x: H.nx, z: H.nz + 1.5, nome: H.nn })));
      if (H.ax != null && !(H.npc && H.nx === H.ax && H.nz === H.az)) b.push(bt(`🧭 Ir: ${H.an || 'onde se faz'} · ${metros({ x: H.ax, z: H.az })}`, () => irLeve({ x: H.ax, z: H.az, nome: H.an })));
      if (b.length) linhaBts(c, ...b);
      if (H.tit) c.append(el('div', 'faz', `Título: ${H.tit}`));
    }
  }
  // Diárias
  { const c = card('📅 Diárias'), D = S.di;
    if (!D) c.append(el('div', 'faz', 'As diárias abrem mais à frente no nível.'));
    else {
      c.append(el('div', 'faz', `Cada uma: +${D.ouro} ouro${D.xp ? ` e +${D.xp} XP` : ''} · as 4: +${D.bonus} ouro · renova em ${Math.ceil(D.fim / 3600e3)} h`));
      for (const o of D.l) {
        const r = el('div', 'recLeve'), n = el('div', 'n'); n.append(el('b', null, o.txt), el('small', null, o.r ? 'recebida ✓' : `${o.n}/${o.t}`));
        r.append(n);
        if (!o.r && o.n >= o.t) { const b = el('button', 'on', 'Receber'); b.onclick = () => mandar('diaria', { acao: 'receber', id: o.id }); r.append(b); }
        else if (!o.r) { const b = el('button', null, '🧭 Ir'); b.onclick = () => mandar('diaria', { acao: 'ir', id: o.id }); r.append(b); }
        c.append(r);
      }
    }
  }
  // Guilda
  { const c = card('🛡️ Guilda'), G = S.gu;
    if (!G) c.append(el('div', 'faz', 'A Guilda abre mais à frente no nível, no Rio Claro.'));
    else {
      c.append(el('div', 'faz', `Rank ${G.rank} · ${G.pg}/${G.pgMax || '–'} pontos · até ${G.ativos} contratos ao mesmo tempo${G.pv ? ' · Prova aceita: vença o elite vermelho num campo da sua faixa' : ''}`));
      const mural = (leve.mapa?.lug || []).filter((o) => /mural|guilda/i.test(o[1])).sort((a, b) => dEu({ x: a[2], z: a[3] }) - dEu({ x: b[2], z: b[3] }))[0];
      if (!G.perto && mural) linhaBts(c, bt(`🧭 Ir ao mural da Guilda · ${metros({ x: mural[2], z: mural[3] })}`, () => irLeve({ x: mural[2], z: mural[3] + 1.5, nome: 'Mural da Guilda' })));
      if (G.prova && G.perto && !G.pv) linhaBts(c, bt('⚔️ Aceitar a Prova de rank', () => mandar('guilda', { acao: 'prova' })));
      for (const o of G.l) {
        const r = el('div', 'recLeve'), n = el('div', 'n'); n.append(el('b', null, o.txt), el('small', null, o.e === 'recebido' ? 'recebido ✓' : o.e === 'livre' ? (G.perto ? 'no mural' : 'pegue no mural') : `${o.n}/${o.t}`));
        r.append(n);
        const b = (t, m, on) => { const x = el('button', on ? 'on' : null, t); x.onclick = () => mandar('guilda', { ...m, id: o.id }); r.append(x); };
        if (o.e === 'livre' && G.perto) b('Aceitar', { acao: 'aceitar' });
        if (o.e === 'ativo') { b('🧭 Ir', { acao: 'ir' }); b('Desistir', { acao: 'desistir' }); }
        if (o.e === 'feito') b('Receber', { acao: 'receber' }, true);
        c.append(r);
      }
    }
  }
  // Escolta do Clã
  { const c = card('🐎 Escolta do Clã'), M = S.mc;
    if (!M) c.append(el('div', 'faz', 'Precisa de clã com base (funde a base pelo jogo).'));
    else if (M.ativa) {
      c.append(el('div', null, `Levando a carga até ${M.dest}`), el('div', 'faz', `Emboscadas: ${M.emb}/${M.embs} · ${M.rec} recrutas junto · falta ${Math.ceil(M.falta / 60)} min`));
      linhaBts(c, bt(`🧭 Ir ao destino · ${metros({ x: M.x, z: M.z })}`, () => irLeve({ x: M.x, z: M.z, nome: M.dest })));
    } else if (M.espera > 0) c.append(el('div', 'faz', `Próxima escolta em ${Math.ceil(M.espera / 60000)} min.`));
    else {
      c.append(el('div', 'faz', 'Pronta. Começa no Baú do Clã: 4 emboscadas no caminho; quem sobrevive ganha +1 nível.'));
      const b = [bt('▶️ Começar escolta', () => mandar('cla', { acao: 'missao' }))];
      const bau = (leve.mapa?.baus || []).find((o) => o.cla); if (bau) b.unshift(bt(`🧭 Ir ao Baú do Clã · ${metros(bau)}`, () => irLeve({ x: bau.x, z: bau.z + 1.5, nome: 'Baú do Clã' }), true));
      linhaBts(c, ...b);
    }
  }
}

// ---------- aba Mais: o que não cabe nas 4 primeiras. O que ainda não existe no leve aparece apagado, com a etapa.
function desenharMais() {
  const raiz = $('maisAba'); if (aba !== 'mais') return; limpar(raiz);
  const L = el('div', 'lista'), item = (txt, sub, fazer) => { const b = el('button', 'item'); b.append(el('span', null, txt), el('small', null, sub)); if (fazer) b.onclick = fazer; else b.disabled = true; L.append(b); };
  item('💬 Chat', leve.sala ? 'geral, local, amigos, time' : 'entre no mundo primeiro', leve.sala ? () => { irAba('jogar'); abrirPainelLeve('chat'); } : null);
  item('⚖️ Leilão (ver preços)', 'comprar e anunciar: perto do leiloeiro', () => irAba('leilao'));
  item('🏴 Clãs bot', 'Geada e Chama', () => irAba('bots'));
  item('📜 Registro do clã', 'o que aconteceu', () => irAba('log'));
  // Missões ganhou aba própria (etapa 3)
  item('🧍 Personagem', 'atributos, golpes, títulos', () => irAba('personagem'));
  item('⚔️ PvP', 'arena 4x4, duelo, patente · em breve', null);
  item('👥 Amigos, grupo e troca', 'em breve', null);
  item('🌾 Fazenda, base e pesca', 'em breve', null);
  item('❓ Como jogar', 'a dica da primeira vez', () => { dicaAberta = true; irAba('jogar'); });
  const w = el('button', 'item'); w.append(el('span', null, '📖 Wiki'), el('small', null, 'abre em outra aba')); w.onclick = () => open('wiki/', '_blank', 'noopener'); L.append(w);
  if (leve.sala) item('⏻ Sair do mundo', 'seu herói sai do jogo', () => { if (confirm('Sair do mundo? Seu herói sai do jogo.')) { sairLeve(); irAba('jogar'); } });
  raiz.append(L);
}

(async () => {
  sessao = await sessaoValida() || await login();
  await entrar();
  ciclo(); tela();
})();
