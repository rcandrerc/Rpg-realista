// Robô de testes (André 2026-11-14: "quero que ele entre dentro do servidor mesmo e teste real... faça as missões,
// jogue, teste a latência, ping"). Entra no servidor de verdade (a Oracle) como o app entra: mesma sala, mesmo
// formato (JSON com área de interesse), posição 20 vezes por segundo, botões pelas mesmas mensagens. Segue o guia das
// missões (o "hi" que o app recebe), anda pela estrada, monta no lobo, luta, coleta, cria e compra. A etapa que ele
// ainda não sabe fazer (terreno, horta, barco, fornalha...) ele pula e anota; a que ele sabe e não anda vira "travou".
// Mede ping, quedas, fotos atrasadas, correções de posição, tempo de resposta das ações e o passo do servidor (/saude),
// e manda o relatório do turno para o servidor a cada 10 min (página /robo).
//
// Conta: a do robô (server/contas.js entrarRobo). No GitHub (.github/workflows/robo.yml) o crachá é o OIDC do próprio
// GitHub, sem senha nenhuma. Na sua máquina, com um servidor local: ROBO_TESTE=abc no servidor e --teste abc aqui.
// Uso: node ferramentas/robo/robo.mjs [--servidor wss://...] [--minutos 350] [--teste SEGREDO] [--turno nome]
// Ele nunca negocia, não compra terreno, não conversa (o servidor também barra: ROBO_NAO em server/index.js).
import fs from 'node:fs';
import { Client } from 'colyseus.js';
// shared/index.js PRIMEIRO: os módulos do shared se importam em círculo (cla.js -> amiga.js -> simulacao.js); entrando
// por progresso.js o robô caía em 9 s com "Cannot access 'Amiga' before initialization" (desde 2026-11-22)
import { Simulacao, MAPA_CLAREIRA, HISTORIA, CACA, BOSSES_MUNDO, LOJA, RECEITAS, FERRAMENTAS_FAZENDA, MONTARIAS, HEROI, CURA, COLETA_DISTANCIA, HABS, TIPOS_INIMIGO, ITENS, ehEquip, TOTENS, LEILAO } from '../../shared/index.js';
import { xpProximo, reforcoOk } from '../../shared/progresso.js';
import { noLago } from '../../shared/relevo.js';
import { planejarRota } from '../../shared/rota.js';
import { listaVenda as listaVendaDe, POCOES, campoPerigoso } from './robo-escolhas.mjs';
import { liberado, zonaFechadaEm } from '../../shared/historia.js';

// ---------- opções ----------
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SERVIDOR = arg('servidor', process.env.ROBO_SERVIDOR || 'wss://163-176-80-126.sslip.io');
const HTTP = SERVIDOR.replace(/^ws/, 'http');
const MINUTOS = Number(arg('minutos', 350));
const TESTE = arg('teste', '');
const TURNO = arg('turno', process.env.GITHUB_RUN_ID ? `gh-${process.env.GITHUB_RUN_ID}` : `local-${Date.now()}`);
const ARQ = arg('relatorio', 'robo-relatorio.json');
const FIM = Date.now() + MINUTOS * 60e3;
const TICK = 50; // ms: 20 posições por segundo, como o app
// --cacar (André 2026-11-17: "velocidade e dificuldade"): só caça no campo do nível, sem missão; mede XP por minuto
const SO_CACAR = process.argv.includes('--cacar');
const CAMPO = arg('campo', '') ? (([x, z]) => ({ x: Number(x), z: Number(z), nome: 'campo fixo' }))(arg('campo', '').split(',')) : null; // --campo x,z: caça só ali
const TRAVA_MIN = Number(arg('trava', 15)); // min na mesma etapa (sem andar nada) = travou
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- o mundo de referência (só geometria: chão, NPCs, veios, estradas; quem manda é o servidor) ----------
const geo = new Simulacao(MAPA_CLAREIRA);
const T = geo.terreno;
const npcDe = (id) => MAPA_CLAREIRA.npcs.find((n) => n.id === id);
const NOMES_BOSS = new Set(Object.values(BOSSES_MUNDO).map((b) => b.nome));
// o espantalho de treino não dá XP: só serve para a missão de treino (André 2026-11-14 viu o robô 1 h batendo nele)
const NOMES_TREINO = new Set(Object.values(TIPOS_INIMIGO).filter((t) => t.treino).map((t) => t.nome));
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------- relatório ----------
const R = {
  turno: TURNO, servidor: SERVIDOR, inicio: Date.now(), ultimo: Date.now(), ativo: true,
  nivel: { de: null, ate: null }, missoes: { feitas: 0, puladas: 0, agora: '', lista: [] },
  ping: {}, quedas: 0, reinicios: 0, entradas: 0, correcoes: 0, mortes: 0, abates: 0, coletas: 0, criados: 0,
  fotos: { recebidas: 0, atrasadas: 0, pior: 0 },
  // dificuldade (André 2026-11-17): quanto leva para matar, poções e curas, a menor vida e o XP ganho por minuto
  luta: { matarMs: {}, pocoes: 0, curas: 0, menorVida: 1, xp: 0, xpMin: 0 }, resposta: {}, servidor: {}, avisos: {}, problemas: [], erros: 0,
};
const pings = [], respostas = [], matar = [], atacouT = new Map();
const problema = (txt) => { if (!R.problemas.includes(txt)) { R.problemas.push(txt); log('ACHADO', txt); } if (R.problemas.length > 60) R.problemas.shift(); };
const pct = (l, q) => { if (!l.length) return null; const s = [...l].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))]); };
function fecharNumeros() {
  R.ultimo = Date.now();
  R.ping = { p50: pct(pings, 0.5), p95: pct(pings, 0.95), max: pings.length ? Math.round(Math.max(...pings)) : null, n: pings.length };
  R.resposta = { p50: pct(respostas, 0.5), p95: pct(respostas, 0.95), max: respostas.length ? Math.round(Math.max(...respostas)) : null, n: respostas.length };
  R.luta.matarMs = { p50: pct(matar, 0.5), p95: pct(matar, 0.95), n: matar.length };
  R.luta.xpMin = Math.round(R.luta.xp / Math.max(1, (Date.now() - R.inicio) / 60000));
  R.avisos = Object.fromEntries(Object.entries(R.avisos).sort((a, b) => b[1] - a[1]).slice(0, 12));
}
async function mandarRelatorio() {
  fecharNumeros();
  try { fs.writeFileSync(ARQ, JSON.stringify(R, null, 1)); } catch { /* sem disco: segue */ }
  if (!sessao) return;
  try {
    const r = await fetch(`${HTTP}/robo/relatorio`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessao}` }, body: JSON.stringify(R), signal: AbortSignal.timeout(15000) });
    if (!r.ok) log('relatório recusado', r.status);
  } catch (e) { log('relatório não foi:', e.message); }
}
async function lerSaude() {
  try {
    const r = await fetch(`${HTTP}/saude`, { signal: AbortSignal.timeout(10000) }); const s = await r.json();
    const S = R.servidor;
    S.tickMs = s.tickMs; S.memMb = s.memMb; S.jogadores = s.jogadores; S.salas = s.salas;
    S.tickPicoMs = Math.max(S.tickPicoMs || 0, s.tickPicoMs || 0);
    S.silencioMaxMs = Math.max(S.silencioMaxMs || 0, s.silencioMaxMs || 0);
    if (s.tickPicoMs > 200) problema(`Servidor engasgou: um passo levou ${Math.round(s.tickPicoMs)} ms (o normal é ~5)`);
    if (s.relogio > 0 && s.relogio < 0.9 && s.salas === R.servidor.salas) problema(`Servidor andando devagar: ${s.relogio} s de jogo por segundo`);
  } catch (e) { R.servidor.falhasSaude = (R.servidor.falhasSaude || 0) + 1; }
}

// ---------- crachá e sessão ----------
let sessao = null;
async function entrarConta() {
  let corpo;
  if (TESTE) corpo = { teste: TESTE };
  else if (process.env.ACTIONS_ID_TOKEN_REQUEST_URL) { // OIDC do GitHub Actions (permissions: id-token: write)
    const u = `${process.env.ACTIONS_ID_TOKEN_REQUEST_URL}&audience=age-of-embers-robo`;
    const r = await fetch(u, { headers: { Authorization: `bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` } });
    corpo = { cracha: (await r.json()).value };
  } else throw new Error('sem crachá: rode no GitHub Actions ou passe --teste');
  const r = await fetch(`${HTTP}/conta/robo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`servidor recusou o robô (${r.status}): ${await r.text()}`);
  sessao = (await r.json()).sessao;
}

// ---------- o que o app sabe ----------
const eu = { x: 0, y: 0, z: 0, ry: 0, vida: 1, vidaMax: 1, mana: 0, morto: false, montado: null, pronto: false };
let di = null, diariaIr = null, diariaT = 0, sementesAntes = -1; // missões diárias (André 2026-11-16): o resumo do servidor e o Ir da diária de plantar
let prog = null, hi = null, corrSeq = 0, ultimaFoto = 0, sala = null, reinicioT = 0;
const inimigos = new Map(); // id -> corpo (a foto com área de interesse manda só o que mudou: junta, como online.gd _juntar)
const atacados = new Set();
let esperaResposta = 0, pendenteColeta = null, coletando = 0;

function lerFoto(txt) {
  const agora = performance.now();
  if (ultimaFoto) { const g = agora - ultimaFoto; if (g > 300) R.fotos.atrasadas++; if (g > R.fotos.pior) R.fotos.pior = Math.round(g); if (g > 3000) problema(`Foto do mundo ficou ${Math.round(g / 1000)} s sem chegar (sem queda)`); }
  ultimaFoto = agora; R.fotos.recebidas++;
  let m; try { m = JSON.parse(txt); } catch { R.erros++; return; }
  const F = m.foto;
  for (const j of F.jogadores || []) if (j.id === sala?.sessionId) {
    const morreu = !eu.morto && j.morto;
    Object.assign(eu, { vida: j.vida, vidaMax: j.vidaMax, mana: j.mana, morto: !!j.morto, montado: j.montado || null });
    if (!eu.pronto || j.morto) { eu.x = j.x; eu.y = j.y; eu.z = j.z; eu.pronto = true; } // morto: o servidor leva para a vila
    if (morreu) { R.mortes++; rota = null; if (campoCaca) { mortesCampo.push({ t: Date.now(), campo: campoCaca.nome }); if (mortesCampo.length > 20) mortesCampo.shift(); } }
    if (j.vidaMax > 0 && !j.morto) R.luta.menorVida = Math.min(R.luta.menorVida, Math.round(j.vida / j.vidaMax * 100) / 100);
  }
  const vistos = new Set();
  for (const e of F.inimigos || []) {
    vistos.add(e.id);
    const a = inimigos.get(e.id);
    if (a && !a.morto && e.morto && atacados.has(e.id)) { R.abates++; atacados.delete(e.id); (R.luta.nvMobs ||= {})[a.nivel || e.nivel || 0] = (R.luta.nvMobs[a.nivel || e.nivel || 0] || 0) + 1; const t0 = atacouT.get(e.id); if (t0) { matar.push(performance.now() - t0); atacouT.delete(e.id); if (matar.length > 5000) matar.shift(); } }
    inimigos.set(e.id, a ? Object.assign(a, e) : e);
  }
  for (const k of inimigos.keys()) if (!vistos.has(k)) inimigos.delete(k);
  for (const ev of m.eventos || []) lerEvento(ev);
}
function lerEvento(e) {
  if (e.para && e.para !== sala?.sessionId) return;
  if (e.para && esperaResposta && ['fala', 'aviso', 'prog', 'coletou', 'fabricando', 'compra'].includes(e.t)) { const ms = performance.now() - esperaResposta; if (ms < 5000) respostas.push(ms); if (respostas.length > 5000) respostas.shift(); esperaResposta = 0; }
  if (e.t === 'prog') {
    const antes = prog?.hist;
    if (prog && e.prog) { let g = 0; for (let n = prog.nivel; n < e.prog.nivel; n++) g += xpProximo(n); g += (e.prog.xp | 0) - (prog.xp | 0); if (g > 0) R.luta.xp += g; }
    prog = e.prog; hi = e.hi || null; if ('di' in e) di = e.di || null;
    if (R.nivel.de == null) R.nivel.de = prog.nivel;
    R.nivel.ate = prog.nivel;
    const h = prog.hist;
    if (antes && h && h.p > antes.p && !puladaAgora) { R.missoes.feitas++; R.missoes.lista.push(HISTORIA[antes.p]?.id); if (R.missoes.lista.length > 80) R.missoes.lista.shift(); log('missão feita:', HISTORIA[antes.p]?.nome); }
    puladaAgora = false;
    R.missoes.agora = HISTORIA[h?.p] ? `${HISTORIA[h.p].id} ${HISTORIA[h.p].nome}${h.ac ? ` · etapa ${h.e + 1}` : ''}` : 'todas feitas';
  } else if (e.t === 'corrigir') {
    if (process.env.ROBO_DEPURAR && R.correcoes % 50 === 0) log('corrigido de', eu.x.toFixed(1), eu.z.toFixed(1), eu.y.toFixed(1), 'para', e.x, e.z, e.y, 'rota', JSON.stringify(rota?.slice(0, 2)));
    eu.x = e.x; eu.y = e.y; eu.z = e.z; corrSeq = e.c; R.correcoes++; correcoesSeguidas++;
  } else if (e.t === 'aviso') {
    const k = String(e.texto || '').replace(/\d+/g, '#').slice(0, 70);
    R.avisos[k] = (R.avisos[k] || 0) + 1;
    ultimoAviso = e.texto;
    if (/^Mochila cheia/.test(String(e.texto || ''))) cheioT = Date.now();
  } else if (e.t === 'coletou') { R.coletas++; if (!e.cargas) coletando = 0; }
  else if (e.t === 'vila' && e.id === sala?.sessionId) { // totem ou casinha: o servidor leva o herói para outro lugar
    if (e.fase === 'chegou') { eu.x = e.x; eu.y = e.y; eu.z = e.z; parar(); viajandoAte = 0; R.viagens = (R.viagens || 0) + 1; }
    else if (e.fase === 'cancela') viajandoAte = 0;
  } else if (e.t === 'leilao') leilaoInfo = e;
  else if (e.t === 'pesca') { pescaT = Date.now(); pescaSt = e.st === 'fim' || e.st === 'pegou' ? '' : e.st; if (e.st === 'pegou') { R.peixes = (R.peixes || 0) + 1; falarT = Date.now(); } if (e.st === 'fim') falarT = Date.now(); }
  else if (e.t === 'reinicio') reinicioT = Date.now();
  else if (e.t === 'diaria_ir') diariaIr = e.alvo || null;
  else if (e.t === 'diaria') { R.diarias ||= { feitas: 0, recebidas: 0 }; if (e.feita) R.diarias.feitas++; if (e.recebeu) R.diarias.recebidas++; }
}
// ---------- diárias (André 2026-11-16) ----------
// Recebe toda diária pronta (o botão Receber da aba). A de monstros anda sozinha com a caça; na missão da Rosa
// ("Tarefas do dia") ele abre a aba e planta as 4 sementes que ela dá numa área de plantio (o Ir da diária).
const qtd = (k) => (prog?.mochila || []).reduce((n, o) => n + (o && o.k === k ? o.n : 0), 0);
function receberDiarias(agora) {
  if (SO_CACAR) return false; // medindo XP da caça: o prêmio da diária não entra na conta
  const D = di?.l?.find((d) => d.n >= d.t && !d.r); if (!D || agora - diariaT < 3000) return false;
  diariaT = agora; acao('diaria', { acao: 'receber', id: D.id }); return true;
}
function plantarDiaria(agora) {
  if (!diariaIr) { if (agora - diariaT > 4000) { diariaT = agora; acao('diaria', { acao: 'ir', id: 'arvores' }); } return; }
  if (!irPara(diariaIr.x, diariaIr.z, 1)) return;
  parar();
  if (agora - diariaT < 3000) return;
  const n = qtd('semente_betula');
  // a última tentativa não plantou (quadrado ocupado, árvore perto): anda 4 m pela área e tenta de novo
  if (sementesAntes === n) diariaIr = { ...diariaIr, x: diariaIr.x + 4 };
  sementesAntes = n; diariaT = agora;
  acao('plantarArvore', { s: 'betula', x: +eu.x.toFixed(2), z: +eu.z.toFixed(2) });
}

// ---------- andar ----------
let rota = null, destino = null, correcoesSeguidas = 0, ultimoAviso = '';
const velocidade = () => (eu.montado ? MONTARIAS[eu.montado]?.correr || HEROI.correr : HEROI.correr) * 0.9;
function irPara(x, z, perto = 1.5) {
  if (destino && Math.hypot(destino.x - x, destino.z - z) < 0.5 && destino.perto === perto && rota) return d2(eu, destino) <= perto;
  destino = { x, z, perto };
  const r = planejarRota(MAPA_CLAREIRA, eu, destino);
  rota = r.pontos ? [...r.pontos] : [{ x, z }]; // outra terra ou mar no meio: tenta reto (o servidor corrige se não der)
  // a estrada passa por região ainda na névoa (o app desliga esses pontos: rota.gd _desligar_nevoa): vai reto
  if (prog && rota.some((q) => zonaFechadaEm(prog, q.x, q.z))) rota = [{ x, z }];
  if (r.bloqueio) bloqueio = r.bloqueio;
  if (r.metros > 45 && !eu.montado && prog && liberado(prog, 'lobo')) mandar('montar');
  return d2(eu, destino) <= perto;
}
let bloqueio = '', reto = false;
function andar(dt) {
  if (coletando && Date.now() - coletando > 25000) coletando = 0; // a coleta acabou sem aviso (etapa pulada, veio esgotado): volta a andar
  if (!rota?.length || eu.morto || coletando) return false;
  let resta = velocidade() * dt;
  while (resta > 0 && rota.length) {
    const p = rota[0], d = d2(eu, p);
    const final = rota.length === 1, para = final ? Math.max(0, destino.perto * 0.6) : 0;
    if (d - para <= resta) { if (!final) { eu.x = p.x; eu.z = p.z; resta -= d; rota.shift(); continue; } const k = Math.max(0, d - para) / (d || 1); eu.x += (p.x - eu.x) * k; eu.z += (p.z - eu.z) * k; rota = []; break; }
    eu.ry = Math.atan2(p.x - eu.x, p.z - eu.z);
    eu.x += (p.x - eu.x) / d * resta; eu.z += (p.z - eu.z) / d * resta; resta = 0;
  }
  eu.y = T.altura(eu.x, eu.z, eu.y + 0.6);
  return true;
}
function parar() { rota = null; destino = null; }

// ---------- mensagens ----------
function mandar(tipo, dados) { try { sala?.send(tipo, dados); } catch { /* caiu: a volta cuida */ } }
function acao(tipo, dados) { esperaResposta = performance.now(); mandar(tipo, dados); }

// ---------- lutar ----------
let golpeT = 0, skillT = 0, curaT = 0, pocaoT = 0;
function alvoPerto(raio = 30, treino = false) {
  let b = null, md = raio;
  for (const e of inimigos.values()) {
    if (e.morto || NOMES_BOSS.has(e.nome)) continue; // boss de mundo é dos jogadores de verdade
    if (NOMES_TREINO.has(e.nome) !== treino) continue; // espantalho só na missão de treino; na de treino, só ele
    const d = d2(eu, e); if (d < md) { md = d; b = e; }
  }
  return b;
}
function lutar(e, agora) {
  if (d2(eu, e) > 1.8) { irPara(e.x, e.z, 1.4); return; }
  parar();
  eu.ry = Math.atan2(e.x - eu.x, e.z - eu.z);
  atacados.add(e.id); if (!atacouT.has(e.id)) atacouT.set(e.id, performance.now());
  if (eu.vida < eu.vidaMax * 0.4 && eu.mana >= CURA.mana && agora - curaT > CURA.cd * 1000) { curaT = agora; R.luta.curas++; mandar('habilidade', 9); return; }
  // 2026-11-16: morreu 40 vezes num turno (perdeu milhares de ouro no Pedra-Viva) sem tomar poção nenhuma
  if (eu.vida < eu.vidaMax * 0.35 && agora - pocaoT > 6000) { const i = (prog?.mochila || []).findIndex((o) => o && o.k === 'pocao'); if (i >= 0) { pocaoT = agora; R.luta.pocoes++; acao('item', { acao: 'usar', i }); return; } }
  if (agora - skillT > 1500 && prog?.barras?.espada) {
    const l = prog.barras.espada.filter((k) => k && (HABS[k]?.libera || 0) <= (prog.nivel || 1) && !(eu.mana < (HABS[k]?.mana || 0))); if (l.length) { skillT = agora; mandar('habQ', l[Math.floor(Math.random() * l.length)]); return; }
  }
  if (agora - golpeT > 450) { golpeT = agora; mandar('habQ', 'espada_basico'); }
}

// ---------- caçar (sem missão para o nível dele, ou esperando) ----------
let campoCaca = null, campoT = 0;
const camposRuins = new Set(); let campoXp = -2, campoXpT = 0; // campos onde não ganhou XP neste turno
const mortesCampo = []; // onde e quando morreu caçando (campoPerigoso: 3 mortes em 10 min no mesmo campo, troca)
function cacar(agora) {
  // ronda 2026-11-17: com raio de 40 m em volta dele, o robô ficava na vila matando Puglin Nv 1 (renasce sempre) e nunca
  // chegava ao campo do nível. Agora: só o que está no campo, ou o que encosta nele (até 5 m) no caminho
  let e = alvoPerto(campoCaca ? 40 : 18);
  if (e && campoCaca && d2(e, campoCaca) > 40 && d2(eu, e) > 5) e = null;
  if (e) return lutar(e, agora);
  if (CAMPO) campoCaca = CAMPO;
  // ronda 2026-11-18: no Nv 53 (c14) passou 45 min sem XP; o campo Nv 52 fica na Ilha do Meio (sem barco não chega).
  // Campo onde ficou 10 min sem ganhar XP (no caminho ou lá) fica de fora neste turno e ele escolhe outro
  if (campoCaca && !CAMPO) {
    if ((prog?.xp ?? -1) !== campoXp) { campoXp = prog?.xp ?? -1; campoXpT = agora; }
    else if (agora - campoXpT > 10 * 60e3) { camposRuins.add(campoCaca.nome); log('campo sem XP há 10 min, troca:', campoCaca.nome); campoCaca = null; campoXpT = agora; }
  }
  // ronda 2026-11-24: 175 mortes na guerra numa noite voltando sempre ao mesmo campo. Morreu 3 vezes em 10 min nele: troca
  if (campoCaca && !CAMPO && campoPerigoso(mortesCampo, campoCaca.nome, agora)) { camposRuins.add(campoCaca.nome); log('morreu 3 vezes em 10 min no campo, troca:', campoCaca.nome); campoCaca = null; mortesCampo.length = 0; }
  if (CAMPO) { /* fixo */ }
  else if (!campoCaca || agora - campoT > 20 * 60e3) {
    const nv = prog?.nivel || 1;
    if (camposRuins.size >= 6) camposRuins.clear(); // nenhum serviu: tenta todos de novo
    // ronda 2026-11-17: no Nv 47 (h11) o robô passou 2 turnos sem XP indo para o campo Nv 42, que está na névoa, e para o
    // covil da gruta. Só campo aberto e fora das grutas
    // ronda 2026-11-23 (André: "tá nível 60, 70, fica lá matando o bicho nível 1"): só campo da MESMA terra em que ele
    // está (Clareira/Vael, Ilha do Meio, Aurora: sem barco ele não atravessa o mar) e nunca mais o CACA[0] (Nv 1) de
    // reserva: sem campo na faixa, vai ao mais forte que alcança na terra dele
    const terra = (c) => (/\(Ilha/.test(c.nome || '') ? 'ilha' : /\(Aurora/.test(c.nome || '') ? 'aurora' : 'vael');
    let perto = null; for (const c of CACA) if (!c.boss && (!perto || d2(eu, c) < d2(eu, perto))) perto = c;
    const minha = perto ? terra(perto) : 'vael';
    const ok = (c) => !c.boss && (c.nivel || 1) <= nv && !/^Covil/.test(c.nome || '') && !camposRuins.has(c.nome) && terra(c) === minha && !(prog && zonaFechadaEm(prog, c.x, c.z));
    const bons = CACA.filter((c) => ok(c) && (c.nivel || 1) >= nv - 6).sort((a, b) => d2(eu, a) - d2(eu, b));
    const alcanca = CACA.filter(ok).sort((a, b) => (b.nivel || 1) - (a.nivel || 1));
    campoCaca = bons[Math.floor(Math.random() * Math.min(3, bons.length))] || alcanca[Math.floor(Math.random() * Math.min(2, alcanca.length))]
      || CACA.filter((c) => !c.boss && !/^Covil/.test(c.nome || '') && terra(c) === minha && (c.nivel || 1) <= nv).sort((a, b) => (b.nivel || 1) - (a.nivel || 1))[0] || CACA[0];
    if ((campoCaca.nivel || 1) < nv - 15) log('sem campo do nível na terra dele, caça no mais forte que alcança:', campoCaca.nome, 'Nv', campoCaca.nivel);
    campoT = agora;
  }
  if (irPara(campoCaca.x + (Math.random() - 0.5) * 6, campoCaca.z + (Math.random() - 0.5) * 6, 4)) parar();
}

// ---------- mochila cheia: vende com o vendedor aberto mais perto (André 2026-11-16: o robô passava o turno com a
// mochila cheia, 10 mil avisos "Mochila cheia"). Fica com poções, ferramentas, veículos, itens trancados e o que a
// etapa pede; vende as peças de equipamento e as pilhas repetidas; se ainda faltar lugar, as pilhas mais baratas.
let cheioT = 0, vendaAte = 0, vendaT = 0, vendaPausa = 0;
const tem = (k) => (prog?.mochila || []).some((o) => o && o.k === k);
// ronda 2026-11-19: poção fica só a pilha maior de cada uma (ferramentas/robo/robo-escolhas.mjs listaVenda)
function protegido(o) {
  if (!o || o.cad) return true;
  if (FERRAMENTAS_FAZENDA[o.k] || ITENS[o.k]?.usar?.veiculo) return true;
  return !!hi?.k && o.k === hi.k;
}
const listaVenda = (m) => listaVendaDe(m, protegido);
function vendedorPerto() {
  let b = null, md = Infinity;
  for (const n of MAPA_CLAREIRA.npcs) {
    if (n.funcao !== 'loja' && !(n.acoes || []).includes('vender')) continue;
    if (prog && zonaFechadaEm(prog, n.x, n.z)) continue;
    const d = d2(eu, n); if (d < md) { md = d; b = n; }
  }
  return b;
}
// ---------- vestir (ronda 2026-11-17: o robô jogava sem nada no corpo e vendia toda peça que caía) ----------
// a peça da mochila melhor que a do corpo no mesmo lugar (raridade, depois reforço) e que o atributo deixa usar
let vestirT = 0;
const notaPeca = (o) => (o ? (o.r | 0) * 100 + (o.e | 0) : -1);
function vestir(agora) {
  if (!prog?.mochila || !prog.equip || agora - vestirT < 4000) return false;
  for (let i = 0; i < prog.mochila.length; i++) {
    const o = prog.mochila[i]; if (!o || !ehEquip(o.k) || !reforcoOk(o, prog.atr)) continue;
    const l = ITENS[o.k]?.lugar; if (!l || !(l in prog.equip)) continue;
    if (notaPeca(o) > notaPeca(prog.equip[l])) { vestirT = agora; R.vestiu = (R.vestiu || 0) + 1; acao('item', { acao: 'equipar', i }); return true; }
  }
  return false;
}
function vender(agora) {
  const m = prog?.mochila; if (!m) return false;
  if (!vendaAte) {
    if (agora < vendaPausa) return false; // acabou de vender: espera o servidor mandar a mochila nova
    if (m.some((o) => !o) && m.filter((o) => !o).length >= 2 && agora - cheioT > 60e3) return false;
    if (!listaVenda(m).length) return false;
    vendaAte = agora + 6 * 60e3; vendaT = 0; log('mochila cheia: vai vender');
  }
  if (agora > vendaAte) { vendaAte = 0; cheioT = 0; problema('Mochila cheia: não conseguiu chegar num vendedor em 6 min'); return false; }
  const v = vendedorPerto(); if (!v) { vendaAte = 0; return false; }
  if (!irPara(v.x, v.z, 2.5)) return true;
  parar();
  if (agora - vendaT < 3000) return true;
  vendaT = agora;
  const l = listaVenda(m);
  if (l.length) { acao('item', { acao: 'vender_varios', lista: l }); R.vendas = (R.vendas || 0) + 1; for (const i of l) m[i] = null; }
  vendaAte = 0; cheioT = 0; vendaPausa = agora + 30e3; // 2026-11-16: vendia os mesmos lugares de novo ("Nada para vender", 127 vezes)
  return true;
}

// ---------- pesca: fica na beira seca, a uns 4 m do spot, lança no meio dele, puxa quando fisga ----------
let pescaSt = '', pescaT = 0, beira = null, puxarT = 0;
function acharBeira(sx, sz) {
  let b = null, md = Infinity;
  for (const r of [3.4, 4, 4.6]) for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2, x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r;
    if ((noLago(x, z)?.fundo || 0) > 0.05) continue;
    const d = Math.hypot(x - eu.x, z - eu.z); if (d < md) { md = d; b = { x, z, sx, sz }; }
  }
  return b;
}
function passoPesca(agora) { // a cada tick: o peixe fisgado tem menos de 1 s de janela
  if (pescaSt && agora - pescaT > 30e3) { pescaSt = ''; beira = null; } // o servidor recusou o lançamento (aviso) ou a linha sumiu
  if (pescaSt === 'fisgou') { pescaSt = 'puxou'; mandar('pescar', { acao: 'puxar' }); }
  else if (pescaSt === 'briga' && agora - puxarT > 95) { puxarT = agora; mandar('pescar', { acao: 'puxar' }); }
}

// ---------- leilão (Casa do Comércio): o robô não mexe na economia de ninguém. Anuncia pelo preço máximo e cancela
// logo em seguida (ninguém compra), compra só dos anúncios da casa e retira o ouro que o Otávio deixa na caixa ----------
let leilaoInfo = null;
function leilao(agora) {
  const a = hi?.alvo;
  if (a && !irPara(a.x, a.z, 2.5)) return;
  parar();
  if (agora - falarT < 3500) return;
  falarT = agora;
  const meu = leilaoInfo?.meus?.[0];
  if (meu) { acao('leilao', { acao: 'cancelar', id: meu.id }); return; }
  if (hi.de === 'anunciar') {
    const m = prog.mochila || [];
    const anuncia = (o) => o && !protegido(o) && !POCOES.includes(o.k); // poção não vai ao leilão (como antes)
    let i = m.findIndex((o) => anuncia(o) && !ehEquip(o.k)); if (i < 0) i = m.findIndex(anuncia);
    if (i < 0) return pular('nada na mochila para anunciar no leilão');
    acao('leilao', { acao: 'anunciar', i, preco: LEILAO.precoMax, horas: LEILAO.horas[0] }); return;
  }
  if (hi.de === 'comprar') {
    if (!leilaoInfo) { acao('leilao', { acao: 'ver' }); return; }
    const l = (leilaoInfo.lista || []).filter((x) => x.casa && x.preco <= (prog.ouro || 0)).sort((x, y) => x.preco - y.preco);
    if (!l.length) { leilaoInfo = null; return pular(`sem ouro para comprar da casa no leilão (${prog.ouro || 0} de ouro)`); }
    acao('leilao', { acao: 'comprar', id: l[0].id }); leilaoInfo = null; return;
  }
  acao('leilao', { acao: 'retirar' });
}

// ---------- missões ----------
let xpGrind = -2, etapaK = '', etapaDesde = 0, falarT = 0, puladaAgora = false, naoSabeT = 0, viajandoAte = 0;
const NAO_SABE = new Set(['dormir', 'plantar', 'regar', 'colher', 'construir', 'terreno', 'pack', 'pack_fez', 'veiculo', 'sintetizar', 'destruir', 'evoluir', 'reforcar', 'passe', 'resetar', 'arma', 'ter', 'lote']);
function pular(motivo) {
  if (!prog?.hist) return;
  const M = HISTORIA[prog.hist.p];
  puladaAgora = true; R.missoes.puladas++;
  log('pulou', M?.id, motivo);
  if (M) problema(`Pulou ${M.id} "${M.nome}" etapa ${prog.hist.e + 1}: ${motivo}`);
  mandar('missaoTeste', { acao: 'pular' });
  etapaK = ''; parar();
}
function receitaDe(k) { if (RECEITAS[k]) return k; return Object.keys(RECEITAS).find((r) => RECEITAS[r].faz === k) || null; }
function missao(agora) {
  const h = prog?.hist; if (!h) return cacar(agora);
  if (h.p >= HISTORIA.length) { log('fez a história toda: começa de novo'); mandar('missaoTeste', { acao: 'zerar' }); return; }
  // travou: a mesma etapa, o mesmo andamento e o mesmo texto há TRAVA_MIN minutos
  const k = `${h.p}:${h.ac}:${h.e}:${h.n}:${h.m}:${hi?.txt}`;
  if (k !== etapaK) { etapaK = k; etapaDesde = agora; correcoesSeguidas = 0; bloqueio = ''; reto = false; coletando = 0; }
  const M = HISTORIA[h.p];
  if (!h.ac && (prog.nivel || 1) < M.nv) { // ainda não tem o nível: caça até chegar
    if (agora - etapaDesde > 3 * TRAVA_MIN * 60e3 && (prog.xp ?? -1) === xpGrind) { etapaDesde = agora; problema(`Caçando há ${3 * TRAVA_MIN} min sem ganhar XP para chegar ao Nv ${M.nv} (${M.id})`); campoCaca = null; }
    if ((prog.xp ?? -1) !== xpGrind) { xpGrind = prog.xp ?? -1; etapaDesde = agora; }
    return cacar(agora);
  }
  if (agora - etapaDesde > TRAVA_MIN * 60e3) return pular(`ficou ${TRAVA_MIN} min sem andar ("${hi?.txt || ''}"${ultimoAviso ? `, último aviso: ${ultimoAviso}` : ''})`);
  if (correcoesSeguidas > 20 && destino && !reto) { reto = true; rota = [{ x: destino.x, z: destino.z }]; } // a estrada passa na névoa: tenta reto
  if (correcoesSeguidas > 40) { correcoesSeguidas = 0; problema(`Posição recusada sem parar indo para ${hi?.alvo?.nome || '?'} (${M.id})${bloqueio ? `, caminho com ${bloqueio}` : ''}`); }
  const a = hi?.alvo;
  if (hi?.npc) { // botão Missão no NPC
    const n = a?.npc === hi.npc ? a : npcDe(hi.npc); if (!n) return pular(`NPC ${hi.npc} não existe no mapa`); // o Ir diz onde o NPC está agora
    if (!irPara(n.x, n.z, 2.5)) return;
    parar();
    if (agora - falarT > 2500) { falarT = agora; acao('falar', { npc: hi.npc, missao: true }); }
    return;
  }
  const ev = hi?.ev || '';
  if (NAO_SABE.has(ev)) { if (!naoSabeT) naoSabeT = agora; if (agora - naoSabeT > 8000) { naoSabeT = 0; pular(`o robô ainda não sabe fazer "${ev}"`); } return; }
  naoSabeT = 0;
  // etapa "chame alguém para o time" (André 2026-11-16): o robô não tem amigo; faz como o jogador sem ninguém, fecha a tela e vai sozinho
  if (ev === 'time') { if (agora - falarT > 2500) { falarT = agora; acao('time', { acao: 'sozinho' }); } return; }
  if (ev === 'diaria_vista') { if (agora - diariaT > 3000) { diariaT = agora; acao('diaria', { acao: 'ver' }); } return; }
  if (ev === 'diaria') { if (qtd('semente_betula') > 0 && !(di?.l?.find((d) => d.id === 'arvores')?.n >= 4)) return plantarDiaria(agora); return cacar(agora); }
  if (ev === 'atributo' || prog.pontos > 0) { const n = prog.pontos | 0; if (n > 0) { const f = Math.ceil(n / 2); acao('atributos', { for: f, ...(n - f ? { vit: n - f } : {}) }); prog.pontos = 0; } if (ev === 'atributo') return; }
  if (ev === 'viajar' && a) { // "use o totem para ir a...": chega perto do totem e pede a viagem (canaliza parado)
    // sem destino ("vá a outro e volte ao Juncal", 2026-11-16 travou 15 min): do totem da etapa vai ao aberto mais
    // perto; de outro totem, volta ao da etapa
    let para = hi.k, ir = a;
    if (!para) {
      const casa = TOTENS.lista.find((t) => Math.hypot(t.x - a.x, t.z - a.z) < 1);
      const aqui = TOTENS.lista.map((t) => [t, Math.hypot(t.x - eu.x, t.z - eu.z)]).sort((x, y) => x[1] - y[1])[0];
      if (aqui && aqui[1] < 8 && casa && aqui[0].id !== casa.id) { para = casa.id; ir = aqui[0]; }
      else para = (prog.totens || []).map((id) => TOTENS.lista.find((t) => t.id === id)).filter((t) => t && t.id !== casa?.id && !zonaFechadaEm(prog, t.x, t.z)).sort((x, y) => d2(a, x) - d2(a, y))[0]?.id;
      if (!para) return pular('nenhum outro totem aberto para a viagem');
    }
    if (!irPara(ir.x, ir.z, 3)) return;
    parar();
    if (agora < viajandoAte || agora - falarT < 3000) return;
    falarT = agora; viajandoAte = agora + (TOTENS.canal + 3) * 1000;
    acao('totem', { para }); return;
  }
  if (ev === 'leilao') return leilao(agora);
  if (ev === 'pesca') {
    if (!tem('vara')) { if (agora - falarT > 5000) { falarT = agora; acao('fabricar', { k: 'vara', n: 1 }); } return; }
    if (!a) return cacar(agora); // spot do mar sem radar: o servidor ainda não diz onde
    if (pescaSt) return; // linha na água
    if (!beira || beira.sx !== a.x || beira.sz !== a.z) beira = acharBeira(a.x, a.z);
    if (!beira) return pular('não achou beira seca perto do spot de pesca');
    if (!irPara(beira.x, beira.z, 0.5)) return;
    parar();
    if (agora - falarT < 2500) return;
    falarT = agora; pescaSt = 'lancou'; pescaT = agora;
    acao('pescar', { acao: 'lancar', x: a.x, z: a.z }); return;
  }
  if (ev === 'montar') { if (!eu.montado && agora - falarT > 3000) { falarT = agora; acao('montar'); } return; }
  if (ev === 'barra') { if (agora - falarT > 3000) { falarT = agora; acao('barra', { barra: 'espada', lista: prog.barras?.espada || [] }); } return; }
  if (ev === 'item' && a) { // coletar: o veio, a árvore ou a pedrinha mais perto do Ir
    const bicho = alvoPerto(6); // 2026-11-16: "Atacado! A coleta parou" 75 vezes e a etapa travou: luta antes de coletar
    if (bicho) { coletando = 0; return lutar(bicho, agora); }
    if (coletando && agora - coletando < 25000) return;
    if (!irPara(a.x, a.z, 1.6)) return;
    parar();
    let no = null, md = 4; for (const c of geo.coletaveis.values()) { const d = Math.hypot(c.x - a.x, c.z - a.z); if (d < md) { md = d; no = c; } }
    if (!no) return pular(`não achou o que coletar perto de ${a.nome}`);
    if (d2(eu, no) - no.r > COLETA_DISTANCIA - 0.3) { irPara(no.x, no.z, no.r + 1.2); return; }
    coletando = agora; acao('coletar', { no: no.id }); return;
  }
  if (ev === 'criar') {
    if (a && !irPara(a.x, a.z, 2.2)) return;
    parar();
    if (agora - falarT < 4000) return; falarT = agora;
    if (FERRAMENTAS_FAZENDA[hi.k]) { acao('fabricar', { k: hi.k, n: 1 }); R.criados++; return; }
    const r = receitaDe(hi.k); if (!r) return pular(`não achou a receita de ${hi.k}`);
    acao('criar', { r }); R.criados++; return;
  }
  if (ev === 'comprar') {
    if (a && !irPara(a.x, a.z, 2.5)) return;
    parar();
    if (agora - falarT < 4000) return; falarT = agora;
    const i = LOJA.findIndex((o) => o.k === hi.k); if (i < 0) return pular(`a Rosa não vende ${hi.k}`);
    acao('item', { acao: 'comprar', i, n: 1 }); return;
  }
  if (ev === 'vender') { // "venda qualquer coisa": a pilha maior da mochila (material comum), uma unidade
    if (a && !irPara(a.x, a.z, 2.5)) return;
    parar();
    if (agora - falarT < 4000) return; falarT = agora;
    let i = -1, n = 0; (prog.mochila || []).forEach((o, k) => { if (o && (o.n || 1) > n) { n = o.n || 1; i = k; } });
    if (i < 0) return pular('mochila vazia, nada para vender');
    acao('item', { acao: 'vender', i, n: 1 }); return;
  }
  if (ev === 'matar' || ev === 'treino') {
    const e = alvoPerto(a ? 35 : 25, ev === 'treino');
    if (e && (!a || d2(e, a) < 45)) return lutar(e, agora);
    if (a && !irPara(a.x, a.z, 3)) return;
    return cacar(agora);
  }
  if (a) { if (irPara(a.x, a.z, 1.2)) { parar(); const e = alvoPerto(8); if (e) lutar(e, agora); } return; } // pos, pistas, totem, viajar, noite...
  // sem lugar e sem saber o que fazer: caça (noite e outras de esperar andam sozinhas)
  return cacar(agora);
}

// ---------- entrar, cair, voltar ----------
const cliente = new Client(SERVIDOR);
let token = null, saiu = false, tchauT = 0;
async function juntar(volta = false) {
  sala = await cliente.joinOrCreate('clareira', { sessao, json: true, aoi: true, ...(volta ? { volta: true } : {}) });
  ligar(sala);
}
function ligar(s) {
  R.entradas++; eu.pronto = false; ultimaFoto = 0; token = s.reconnectionToken; inimigos.clear(); corrSeq = 0;
  s.onMessage('mundoJ', lerFoto);
  s.onMessage('pong', (t) => { const ms = Math.round(performance.now() - t); pings.push(ms); if (pings.length > 20000) pings.shift(); if (ms > 1500) problema(`Ping de ${ms} ms às ${new Date().toISOString().slice(11, 16)} UTC`); });
  s.onMessage('*', () => {});
  s.onLeave((code) => { if (!saiu) cair(code); });
  s.onError((code, msg) => { R.erros++; log('erro da sala', code, msg); });
  mandar('idioma', { codigo: 'pt' });
  log('entrou na sala', s.roomId, 'como', s.sessionId);
}
let caindo = false;
async function cair(code) {
  if (caindo) return; caindo = true; sala = null;
  if (code === 4001 || code === 4002) { log('saiu: a conta entrou em outro lugar (outro turno do robô)'); saiu = true; caindo = false; return; }
  let reinicio = Date.now() - reinicioT < 180e3;
  const quando = new Date().toISOString().slice(11, 16);
  log('caiu', code, reinicio ? '(reinício do servidor)' : '');
  const t0 = Date.now();
  for (let i = 0; !saiu && Date.now() < FIM; i++) {
    await new Promise((r) => setTimeout(r, Math.min(60e3, 2000 * 2 ** Math.min(i, 5))));
    try {
      if (i < 3 && token) { sala = await cliente.reconnect(token); ligar(sala); }
      else await juntar(true);
      const s = Math.round((Date.now() - t0) / 1000);
      // o servidor se atualiza sozinho depois de cada merge (e derruba todo mundo): ligado há poucos minutos = reinício
      if (!reinicio) { try { reinicio = (await (await fetch(`${SERVIDOR.replace(/^ws/, 'http')}/saude`, { signal: AbortSignal.timeout(8000) })).json()).ligadoMin <= 3; } catch { /* sem saúde: conta como queda */ } }
      if (reinicio) { R.reinicios++; log(`reinício do servidor: voltou em ${s} s`); }
      else { R.quedas++; problema(`Caiu da sala (código ${code}) às ${quando} UTC`); if (s > 30) problema(`Levou ${s} s para voltar depois de cair`); }
      break;
    } catch (e) {
      if (String(e.message).includes('outro_aparelho')) { log('outro turno do robô está jogando: este sai'); saiu = true; break; }
      if (/login/.test(e.message) && i > 4) { try { await entrarConta(); } catch { /* tenta de novo */ } }
      log('voltar falhou:', e.message);
    }
  }
  caindo = false;
}

// ---------- laço ----------
async function main() {
  log(`robô de testes: ${SERVIDOR}, ${MINUTOS} min, turno ${TURNO}`);
  await entrarConta();
  await juntar();
  let antes = performance.now(), relT = Date.now(), saudeT = 0, pingT = 0;
  await mandarRelatorio();
  while (!saiu && Date.now() < FIM) {
    await new Promise((r) => setTimeout(r, TICK));
    const agoraP = performance.now(), dt = Math.min(0.25, (agoraP - antes) / 1000); antes = agoraP;
    const agora = Date.now();
    if (agora - saudeT > 60e3) { saudeT = agora; lerSaude(); }
    if (agora - relT > 10 * 60e3) { relT = agora; mandarRelatorio(); }
    if (!sala || !eu.pronto) continue;
    if (agora - pingT > 2000) { pingT = agora; mandar('ping', Math.round(performance.now())); } // número pequeno, como o app (Date.now() vira inteiro de 64 bits)
    try { if (!eu.morto) { passoPesca(agora); if (!pescaSt && !vestir(agora) && !vender(agora) && !receberDiarias(agora)) { if (SO_CACAR) cacar(agora); else missao(agora); } } } catch (e) { R.erros++; problema(`Erro no robô: ${e.message}`); }
    const andou = andar(dt);
    mandar('pos', { x: +eu.x.toFixed(3), y: +eu.y.toFixed(3), z: +eu.z.toFixed(3), ry: +eu.ry.toFixed(3), anim: andou ? 'correr' : 'parado', c: corrSeq });
    if (andou) correcoesSeguidas = Math.max(0, correcoesSeguidas - 0.02);
    if (tchauT) break;
  }
  saiu = true; R.ativo = false;
  try { await sala?.leave(true); } catch { /* já saiu */ }
  await mandarRelatorio();
  fecharNumeros();
  resumoNoGithub();
  log('fim do turno', JSON.stringify({ nivel: R.nivel, missoes: R.missoes.feitas, puladas: R.missoes.puladas, ping: R.ping, quedas: R.quedas, problemas: R.problemas.length }));
  process.exit(0);
}
function resumoNoGithub() {
  const f = process.env.GITHUB_STEP_SUMMARY; if (!f) return;
  const l = [`## Robô de testes · turno ${TURNO}`, '', `- Nível ${R.nivel.de} → ${R.nivel.ate}; missões feitas ${R.missoes.feitas}, puladas ${R.missoes.puladas}; agora: ${R.missoes.agora}`, `- Diárias feitas ${R.diarias?.feitas || 0}, recebidas ${R.diarias?.recebidas || 0}`,
    `- Ping médio ${R.ping.p50} ms, pior 5% ${R.ping.p95} ms, pior ${R.ping.max} ms`, `- Quedas ${R.quedas}, reinícios do servidor ${R.reinicios}, correções de posição ${R.correcoes}`,
    `- Fotos atrasadas ${R.fotos.atrasadas} (pior ${R.fotos.pior} ms); passo do servidor ${R.servidor.tickMs} ms (pico ${R.servidor.tickPicoMs} ms)`, '', '### Achados', ...(R.problemas.length ? R.problemas.map((p) => `- ${p}`) : ['- nenhum'])];
  try { fs.appendFileSync(f, l.join('\n') + '\n'); } catch { /* sem resumo */ }
}
process.on('SIGTERM', () => { tchauT = Date.now(); });
process.on('SIGINT', () => { tchauT = Date.now(); });
main().catch(async (e) => { console.error('robô parou:', e); problema(`Robô parou: ${e.message}`); R.ativo = false; await mandarRelatorio(); resumoNoGithub(); process.exit(1); });
