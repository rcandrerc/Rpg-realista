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
import { xpProximo, reforcoOk, reforcoMax, reforcoPrecisa, atributoDoReforco, custoReforco, materialReforco, contar } from '../../shared/progresso.js';
import { noLago } from '../../shared/relevo.js';
import { planejarRota } from '../../shared/rota.js';
import { listaVenda as listaVendaDe, POCOES, campoPerigoso, listaMudou } from './robo-escolhas.mjs';
import { terraDoCampo, terraEm, totemDaTerra, outraTerraParaCacar } from './robo-escolhas.mjs'; // viajar de terra (ronda 2026-11-25)
import { pecasParaConsertar } from './robo-escolhas.mjs'; // consertar o equipamento (ronda 2026-11-26)
import { VOLTA_VILA } from '../../shared/index.js'; // casinha (ronda 2026-11-25)
import { liberado, zonaFechadaEm, motivoLibera } from '../../shared/historia.js';
import { CATALISADOR, RECEITA_ESTACAO } from '../../shared/dados.js'; // evoluir na bigorna/bancada (combate de teste)

// ---------- opções ----------
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SERVIDOR = arg('servidor', process.env.ROBO_SERVIDOR || 'wss://163-176-80-126.sslip.io');
const HTTP = SERVIDOR.replace(/^ws/, 'http');
const MINUTOS = Number(arg('minutos', 350));
const TESTE = arg('teste', '');
const TURNO = arg('turno', (process.argv.includes('--combate') ? 'combate-' : '') + (process.env.GITHUB_RUN_ID ? `gh-${process.env.GITHUB_RUN_ID}` : `local-${Date.now()}`));
const ARQ = arg('relatorio', 'robo-relatorio.json');
const FIM = Date.now() + MINUTOS * 60e3;
const TICK = 50; // ms: 20 posições por segundo, como o app
// --cacar (André 2026-11-17: "velocidade e dificuldade"): só caça no campo do nível, sem missão; mede XP por minuto
const SO_CACAR = process.argv.includes('--cacar');
// --combate (André 2026-11-27): o robô de testes zerado (Nv 1 ao 100) no combate de teste (COMBATE_TESTE em shared/dados.js:
// arma multiplica o dano, armadura x2, golpe de monstro gasta o equipamento; o servidor liga só na conta dele). Reforça
// sozinho e anota por nível: tempo, mortes, ouro, equipamento (R.combate). Segue achando travamentos.
const COMBATE = process.argv.includes('--combate');
// --upgrade: ele mesmo evolui e reforça. André 2026-11-27: DESLIGADO ("deixa ele sem evoluir e sem fazer reforço... quando
// começar a morrer com frequência ou ficar muito lento, me passa no relatório e a gente faz o upgrade manualmente"):
// o upgrade manual entra pelo servidor (COMBATE_TESTE.upgrade). O robô só avisa (R.combate.alerta).
const UPGRADE = COMBATE && process.argv.includes('--upgrade');
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
// combate de teste: uma linha por nível que subiu neste turno ({ nv, min do turno, mortes e ouro até ali, equipamento
// 'lugar raridade+reforço durabilidade') e os reforços (tentativas, deu certo, ouro)
if (COMBATE) R.combate = { niveis: [], reforco: { tentativas: 0, ok: 0, ouro: 0 }, drops: {}, vestiu: [] };
// alerta para o relatório (André: "quando começar a morrer com frequência ou ficar muito lento"): 6+ mortes na última
// hora, ou o último nível levou mais que o dobro da média dos 3 de antes. Fica a última hora em que valeu.
const mortesT = [];
function alertaCombate() {
  const L = R.combate.niveis, agora = Date.now(), min = Math.round((agora - R.inicio) / 60e3), mh = mortesT.filter((t) => agora - t < 3600e3).length;
  const ult = L.length ? min - L[L.length - 1].min : null, ant = L.slice(-4).map((x, i, a) => (i ? x.min - a[i - 1].min : null)).filter((x) => x != null);
  const media = ant.length ? ant.reduce((a, b) => a + b, 0) / ant.length : null;
  const motivo = mh >= 6 ? `${mh} mortes na última hora` : ult != null && media && ult > 2 * media && ult > 20 ? `nível ${prog.nivel} levou ${ult} min (média ${Math.round(media)})` : '';
  if (motivo) { R.combate.alerta = { nv: prog.nivel, min, motivo, eq: fotoEquip(prog.equip) }; problema(`Combate de teste: precisa de upgrade? ${motivo}`); }
}
// por nível (thread do robô, André: "qual o mob que ele grindou e o nível do mob... quantos minutos ele parou, quantos
// grindou real"): cur junta o nível de agora; t = minutos por estado { caca, anda, morto, para, fora } (a soma fecha com o
// tempo do nível); R.combate.t = o mesmo somado no turno
const tNovo = () => ({ caca: 0, anda: 0, morto: 0, para: 0, fora: 0 });
let cur = { mobs: {}, xp: 0, abates: 0, t: tNovo(), campos: {}, drops: {} }, estadoT = Date.now();
if (COMBATE) R.combate.t = tNovo();
function contarEstado(estado, campo) {
  const agora = Date.now(), m = Math.min(5, (agora - estadoT) / 60e3); estadoT = agora;
  if (!COMBATE || !(m > 0)) return;
  cur.t[estado] += m; R.combate.t[estado] += m;
  if (estado === 'caca' && campo) cur.campos[campo] = (cur.campos[campo] || 0) + m;
}
const r1 = (t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v * 10) / 10]));
const fotoEquip = (eq) => Object.entries(eq || {}).filter(([, o]) => o).map(([l, o]) => `${l} ${'CREÉLM'[o.r | 0] || '?'}+${o.e | 0} ${o.d ?? 100}%`).join(' · ');
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
  if (COMBATE) { // o nível em andamento (o turno pode acabar no meio): a ronda junta com o começo do turno seguinte
    const cp = Object.entries(cur.campos).sort((a, b) => b[1] - a[1])[0]?.[0] || '', [cn, cv] = cp.split(' Nv ');
    R.combate.atual = { nv: prog?.nivel | 0, campo: { nome: cn || '', nv: Number(cv) || 0 }, mobs: cur.mobs, xp: cur.xp, abates: cur.abates, t: r1(cur.t), drops: cur.drops };
    R.combate.t = r1(R.combate.t);
  }
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
    if (morreu) { R.mortes++; rota = null; if (COMBATE) { mortesT.push(Date.now()); if (mortesT.length > 50) mortesT.shift(); alertaCombate(); } if (campoCaca) { mortesCampo.push({ t: Date.now(), campo: campoCaca.nome }); if (mortesCampo.length > 20) mortesCampo.shift(); } }
    if (j.vidaMax > 0 && !j.morto) R.luta.menorVida = Math.min(R.luta.menorVida, Math.round(j.vida / j.vidaMax * 100) / 100);
  }
  const vistos = new Set();
  for (const e of F.inimigos || []) {
    vistos.add(e.id);
    const a = inimigos.get(e.id);
    if (a && !a.morto && e.morto && atacados.has(e.id)) { R.abates++; atacados.delete(e.id); if (COMBATE) { const km = `${a.nome || e.nome || a.tipo || '?'} Nv ${a.nivel || e.nivel || 0}`; cur.mobs[km] = (cur.mobs[km] || 0) + 1; cur.abates++; } (R.luta.nvMobs ||= {})[a.nivel || e.nivel || 0] = (R.luta.nvMobs[a.nivel || e.nivel || 0] || 0) + 1; const t0 = atacouT.get(e.id); if (t0) { matar.push(performance.now() - t0); atacouT.delete(e.id); if (matar.length > 5000) matar.shift(); } }
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
    if (prog && e.prog) { let g = 0; for (let n = prog.nivel; n < e.prog.nivel; n++) g += xpProximo(n); g += (e.prog.xp | 0) - (prog.xp | 0); if (g > 0) { R.luta.xp += g; cur.xp += g; } }
    prog = e.prog; hi = e.hi || null; if ('di' in e) di = e.di || null;
    if (R.nivel.de == null) R.nivel.de = prog.nivel;
    if (COMBATE && R.nivel.ate != null && prog.nivel > R.nivel.ate) alertaCombate();
    if (COMBATE && R.nivel.ate != null && prog.nivel > R.nivel.ate) {
      const cp = Object.entries(cur.campos).sort((a, b) => b[1] - a[1])[0]?.[0] || '', [cn, cv] = cp.split(' Nv ');
      R.combate.niveis.push({ nv: prog.nivel, min: Math.round((Date.now() - R.inicio) / 60e3), mortes: R.mortes, ouro: prog.ouro | 0, atr: prog.atr, eq: fotoEquip(prog.equip),
        campo: { nome: cn || '', nv: Number(cv) || 0 }, mobs: cur.mobs, xp: cur.xp, abates: cur.abates, t: r1(cur.t), drops: cur.drops });
      if (R.combate.niveis.length > 120) R.combate.niveis.shift();
      cur = { mobs: {}, xp: 0, abates: 0, t: tNovo(), campos: {}, drops: {} };
    }
    R.nivel.ate = prog.nivel;
    const h = prog.hist;
    // ronda 2026-11-24: lista de missões do servidor diferente da do robô (merge no meio do turno; robo-escolhas.mjs
    // listaMudou): não conta missão feita, não usa o nome errado e só caça até as listas baterem de novo
    const mudou = listaMudou(HISTORIA, h);
    if (mudou && !listaAvisada) { listaAvisada = true; log('a lista de missões do servidor mudou no meio do turno (merge): só caça; última entregue', h.u); }
    if (antes && h && h.p > antes.p && !puladaAgora && !mudou && !listaMudou(HISTORIA, antes)) { R.missoes.feitas++; R.missoes.lista.push(HISTORIA[antes.p]?.id); if (R.missoes.lista.length > 80) R.missoes.lista.shift(); log('missão feita:', HISTORIA[antes.p]?.nome); }
    puladaAgora = false;
    R.missoes.agora = mudou ? `lista de missões do servidor mudou no meio do turno (merge), só caça; última entregue ${h.u}` : HISTORIA[h?.p] ? `${HISTORIA[h.p].id} ${HISTORIA[h.p].nome}${h.ac ? ` · etapa ${h.e + 1}` : ''}` : 'todas feitas';
  } else if (e.t === 'corrigir') {
    if (process.env.ROBO_DEPURAR && R.correcoes % 50 === 0) log('corrigido de', eu.x.toFixed(1), eu.z.toFixed(1), eu.y.toFixed(1), 'para', e.x, e.z, e.y, 'rota', JSON.stringify(rota?.slice(0, 2)));
    eu.x = e.x; eu.y = e.y; eu.z = e.z; corrSeq = e.c; R.correcoes++; correcoesSeguidas++;
  } else if (e.t === 'aviso') {
    const k = String(e.texto || '').replace(/\d+/g, '#').slice(0, 70);
    R.avisos[k] = (R.avisos[k] || 0) + 1;
    ultimoAviso = e.texto;
    if (/^Mochila cheia/.test(String(e.texto || ''))) cheioT = Date.now();
    const cs = /consertou (\d+) peças? por (\d+) de ouro/.exec(String(e.texto || '')); // ronda 2026-11-26
    if (cs) { const C = (R.consertos ||= { vezes: 0, pecas: 0, ouro: 0 }); C.vezes++; C.pecas += +cs[1]; C.ouro += +cs[2]; log('consertou', cs[1], 'peças por', cs[2], 'de ouro'); }
    else if (/^O conserto custa|^Conserte com/.test(String(e.texto || ''))) consertoPausa = Date.now() + 10 * 60e3;
  } else if (e.t === 'drop' && COMBATE) { // peças que caem por raridade (André: "em 20 30 minutos já temos set completo raro")
    for (const it of e.itens || []) if (it.r >= 0) { const k = 'CREÉLM'[it.r] || '?'; R.combate.drops[k] = (R.combate.drops[k] || 0) + 1; cur.drops[k] = (cur.drops[k] || 0) + 1; }
  } else if (e.t === 'fabricando' && COMBATE) { fabricandoAte = Date.now() + ((e.dur || 2) * (e.n || 1) + 1) * 1000;
  } else if (e.t === 'evoluiu' && COMBATE) { (R.combate.evolucoes ||= []).push({ nv: prog?.nivel | 0, min: Math.round((Date.now() - R.inicio) / 60e3), nome: e.nome, ok: !!e.ok }); log('evoluir:', e.ok ? 'evoluiu' : 'falhou', e.nome); evoPlano = null; vestirT = 0;
  } else if (e.t === 'reforco' && COMBATE) { const C = R.combate.reforco; if (e.erro) reforcoPausa = Date.now() + 10 * 60e3; else { C.tentativas++; if (e.ok) C.ok++; C.ouro += e.custo | 0; log('reforço', e.nome, e.de, '->', e.e, e.ok ? 'subiu' : 'falhou', e.custo, 'de ouro'); }
  } else if (e.t === 'coletou') { R.coletas++; if (!e.cargas) coletando = 0; }
  else if (e.t === 'vila' && e.id === sala?.sessionId) { // totem ou casinha: o servidor leva o herói para outro lugar
    if (e.fase === 'chegou') { eu.x = e.x; eu.y = e.y; eu.z = e.z; parar(); viajandoAte = 0; correcoesSeguidas = 0; R.viagens = (R.viagens || 0) + 1; } // lugar novo: as correções de antes (na névoa) não contam
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

// ---------- viajar de terra (ronda 2026-11-25: 10 h no Nv 74 caçando bicho Nv 48 em Vael com a Aurora aberta) ----------
// O mar separa Vael, a Ilha do Meio e a Aurora, e a pé a rota não atravessa. Com o totem de lá já visitado (como o
// jogador), vai ao totem mais perto aqui, pede a viagem e espera o canal (TOTENS.canal s parado). true = está viajando.
// Viagem que não dá certo em 6 min (ouro, névoa, totem longe) vira achado e essa terra fica de fora por 30 min.
let viagem = null; const terraFalhou = new Map(); // terra -> até quando não tenta de novo
function totemAqui() { // o totem aberto mais perto na terra em que ele está (para sair; não precisa ser visitado)
  const minha = terraEm(CACA, eu.x, eu.z);
  return TOTENS.lista.filter((t) => terraEm(CACA, t.x, t.z) === minha && !(prog && zonaFechadaEm(prog, t.x, t.z))).sort((a, b) => d2(eu, a) - d2(eu, b))[0] || null;
}
// Ronda 2026-11-25: o "zerar" do fim da história (missaoTeste) deixa o robô onde está, e lá (Aurora, Ilha, fundo de Vael)
// tudo volta para a névoa: o servidor recusa todo passo dele, nem até o totem. Como o jogador, usa a casinha (volta para a
// vila: VOLTA_VILA.canal s parado, recarga de VOLTA_VILA.cd s). true = está voltando.
let casinhaT = 0;
function presoNaNevoa() { return !!(prog && zonaFechadaEm(prog, eu.x, eu.z)); }
function casinha(agora, motivo) {
  if ((prog?.vilaAte || 0) > Date.now()) return false; // recarga
  if (agora < viajandoAte) return true; // canalizando
  const bicho = alvoPerto(5); if (bicho) { lutar(bicho, agora); return true; } // apanhando: o canal cancela com dano
  parar();
  if (agora - casinhaT < 4000) return true;
  if (!casinhaT || agora - casinhaT > 60e3) log(`volta para a vila pela casinha (${motivo})`);
  casinhaT = agora; viajandoAte = agora + (VOLTA_VILA.canal + 3) * 1000;
  acao('vila');
  return true;
}
function viajarParaTerra(terra, agora, motivo, perto) {
  const aqui = terraEm(CACA, eu.x, eu.z);
  if (terra === aqui) { if (viagem) { log('chegou na terra', terra, `(${viagem.motivo})`); viagem = null; } return false; }
  if ((terraFalhou.get(terra) || 0) > agora || !prog) return false;
  const para = totemDaTerra(TOTENS.lista, CACA, terra, prog.totens || [], (t) => !!zonaFechadaEm(prog, t.x, t.z), perto?.x ?? eu.x, perto?.z ?? eu.z);
  const de = totemAqui();
  if (!para || !de) return false;
  // viagem largada no meio (foi vender, vestir) e retomada depois de 30 s: conta os 6 min de novo
  if (!viagem || viagem.terra !== terra || agora - viagem.ultT > 30e3) { viagem = { terra, motivo, t0: agora, pediuT: 0 }; log(`vai de totem para a terra ${terra} (${motivo}): ${de.nome} -> ${para.nome}`); }
  viagem.ultT = agora;
  if (agora - viagem.t0 > 6 * 60e3) {
    terraFalhou.set(terra, agora + 30 * 60e3);
    problema(`Viagem de totem para a terra ${terra} (${motivo}) não deu certo em 6 min${ultimoAviso ? `, último aviso: ${ultimoAviso}` : ''}`);
    viagem = null; return false;
  }
  if (agora < viajandoAte) return true; // canalizando no totem
  const bicho = alvoPerto(5); if (bicho) { lutar(bicho, agora); return true; } // apanhando no caminho: o canal cancela com dano
  if (!irPara(de.x, de.z, 3)) return true;
  parar();
  if (agora - viagem.pediuT < 4000) return true;
  viagem.pediuT = agora; viajandoAte = agora + (TOTENS.canal + 3) * 1000;
  acao('totem', { para: para.id });
  return true;
}

// ---------- caçar (sem missão para o nível dele, ou esperando) ----------
let campoCaca = null, campoT = 0;
const camposRuins = new Set(); let campoXp = -2, campoXpT = 0; // campos onde não ganhou XP neste turno
const mortesCampo = []; // onde e quando morreu caçando (campoPerigoso: 3 mortes em 10 min no mesmo campo, troca)
// ronda 2026-11-26: o campo trocado por morte volta a valer depois de 30 min. Antes ficava de fora o turno todo: na noite de
// 25/11 ele saiu da Aurora e da Ilha em 1 h e passou as 4 h e meia seguintes no Nv 47 de Vael, sem tentar de novo
const perigosoAte = new Map(); const PERIGOSO_MIN = 30;
let cacaViagem = null; const faltaAvisada = new Set(); // a terra para onde vai caçar; terras sem totem já anotadas no turno
let cacaPonto = null; // o ponto sorteado no campo (fixo até chegar ou trocar de campo)
// podeViajar: só quando ele caça para subir de nível (sem missão do nível, --cacar); caçando no meio de uma etapa ele
// fica na terra dele (senão ia e voltava entre a terra da etapa e a do campo)
function cacar(agora, podeViajar = false) {
  if (cacaViagem) {
    if (!podeViajar) cacaViagem = null;
    else if (viajarParaTerra(cacaViagem.terra, agora, `caçar no ${cacaViagem.campo.nome}`, cacaViagem.campo)) return;
    else { if (terraEm(CACA, eu.x, eu.z) === cacaViagem.terra) { campoCaca = null; campoT = 0; } cacaViagem = null; }
  }
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
  if (campoCaca && !CAMPO && !COMBATE && campoPerigoso(mortesCampo, campoCaca.nome, agora)) { perigosoAte.set(campoCaca.nome, agora + PERIGOSO_MIN * 60e3); log(`morreu 3 vezes em 10 min no campo, troca por ${PERIGOSO_MIN} min:`, campoCaca.nome); campoCaca = null; mortesCampo.length = 0; }
  if (CAMPO) { /* fixo */ }
  else if (!campoCaca || agora - campoT > 20 * 60e3) {
    const nv = prog?.nivel || 1;
    if (camposRuins.size >= 6) camposRuins.clear(); // nenhum serviu: tenta todos de novo
    // ronda 2026-11-17: no Nv 47 (h11) o robô passou 2 turnos sem XP indo para o campo Nv 42, que está na névoa, e para o
    // covil da gruta. Só campo aberto e fora das grutas
    // ronda 2026-11-23 (André: "tá nível 60, 70, fica lá matando o bicho nível 1"): só campo da MESMA terra em que ele
    // está (Clareira/Vael, Ilha do Meio, Aurora: sem barco ele não atravessa o mar) e nunca mais o CACA[0] (Nv 1) de
    // reserva: sem campo na faixa, vai ao mais forte que alcança na terra dele
    const terra = terraDoCampo, minha = terraEm(CACA, eu.x, eu.z);
    // combate de teste (André 2026-11-27: "ele sempre grinde no nível do mob que ele é... peguei ele nível 50 grindando
    // em mob nível 1"): o campo de nível mais alto que não passa do dele, em qualquer terra (vai de totem), e sem fugir do campo onde
    // morre: as mortes são o que a gente mede. Só o campo sem XP há 10 min (caminho travado) fica de fora.
    if (COMBATE && !CAMPO) {
      const livre = (c) => !c.boss && !/^Covil/.test(c.nome || '') && !camposRuins.has(c.nome) && !(prog && zonaFechadaEm(prog, c.x, c.z));
      const cand = CACA.filter(livre), ate = cand.filter((c) => (c.nivel || 1) <= nv);
      const melhor = (ate.length ? ate : cand).sort((a, b) => (ate.length ? (b.nivel || 1) - (a.nivel || 1) : (a.nivel || 1) - (b.nivel || 1)) || d2(eu, a) - d2(eu, b))[0]; // o de nível mais alto que não passa do dele
      if (melhor) {
        if (terra(melhor) !== minha && podeViajar && !((terraFalhou.get(terra(melhor)) || 0) > agora)) { cacaViagem = { terra: terra(melhor), campo: melhor }; log(`campo do nível (Nv ${melhor.nivel}) em outra terra: vai de totem`, melhor.nome); return; }
        if (terra(melhor) === minha) {
          campoCaca = melhor; campoT = agora; perigosoAte.clear();
          R.caca = { terra: minha, campo: melhor.nome, nivel: melhor.nivel || 1, totens: prog?.totens || [] };
          return;
        }
      }
    }
    const aberto = (c) => !c.boss && (c.nivel || 1) <= nv && !/^Covil/.test(c.nome || '') && !camposRuins.has(c.nome) && !((perigosoAte.get(c.nome) || 0) > agora) && !(prog && zonaFechadaEm(prog, c.x, c.z));
    const ok = (c) => aberto(c) && terra(c) === minha;
    const bons = CACA.filter((c) => ok(c) && (c.nivel || 1) >= nv - 6).sort((a, b) => d2(eu, a) - d2(eu, b));
    // ronda 2026-11-25: sem campo do nível aqui, vai de totem para a terra que tem (visitada e aberta); sem totem de lá,
    // anota o que falta (Ilha só de barquinho, Aurora só de navio: o robô ainda não sabe) e caça no mais forte daqui
    if (!bons.length && podeViajar && prog) {
      const o = outraTerraParaCacar({ minha, campos: CACA, totens: TOTENS.lista, visitados: prog.totens || [], ok: aberto, fechado: (t) => !!zonaFechadaEm(prog, t.x, t.z) });
      if (o && !o.semTotem && !((terraFalhou.get(o.terra) || 0) > agora)) {
        cacaViagem = o; R.caca = { terra: minha, vai: o.terra, campo: o.campo.nome, nivel: o.campo.nivel, totem: o.totem.id, totens: prog.totens || [] };
        log(`sem campo do nível em ${minha}: vai caçar no ${o.campo.nome} (Nv ${o.campo.nivel}), de totem até ${o.totem.nome}`);
        return;
      }
      if (o?.semTotem) {
        const falta = `${o.terra === 'ilha' ? 'barquinho para a Ilha do Meio' : 'navio para a Aurora'} (campo Nv ${o.campo.nivel}, totem de lá não visitado)`;
        R.caca = { terra: minha, falta, totens: prog.totens || [] };
        if (!faltaAvisada.has(o.terra)) { faltaAvisada.add(o.terra); problema(`Sem campo do nível em ${minha} (Nv ${nv}): falta ${falta}`); }
      }
    }
    const alcanca = CACA.filter(ok).sort((a, b) => (b.nivel || 1) - (a.nivel || 1));
    campoCaca = bons[Math.floor(Math.random() * Math.min(3, bons.length))] || alcanca[Math.floor(Math.random() * Math.min(2, alcanca.length))]
      || CACA.filter((c) => !c.boss && !/^Covil/.test(c.nome || '') && terra(c) === minha && (c.nivel || 1) <= nv).sort((a, b) => (b.nivel || 1) - (a.nivel || 1))[0] || CACA[0];
    if ((campoCaca.nivel || 1) < nv - 15) log('sem campo do nível na terra dele, caça no mais forte que alcança:', campoCaca.nome, 'Nv', campoCaca.nivel);
    R.caca = { ...(R.caca?.falta && R.caca.terra === minha ? { falta: R.caca.falta } : {}), terra: minha, campo: campoCaca.nome, nivel: campoCaca.nivel || 1, totens: prog?.totens || [] };
    campoT = agora;
  }
  // ronda 2026-11-25: o ponto no campo é sorteado uma vez (até chegar ou trocar de campo). Sorteado a cada passo, a rota
  // era refeita 20 vezes por segundo e, na Aurora, um ponto repetido da estrada puxava o robô de volta: 5 min parado
  if (!cacaPonto || cacaPonto.campo !== campoCaca) cacaPonto = { campo: campoCaca, x: campoCaca.x + (Math.random() - 0.5) * 6, z: campoCaca.z + (Math.random() - 0.5) * 6 };
  if (irPara(cacaPonto.x, cacaPonto.z, 4)) { parar(); cacaPonto = null; }
}

// ---------- mochila cheia: vende com o vendedor aberto mais perto (André 2026-11-16: o robô passava o turno com a
// mochila cheia, 10 mil avisos "Mochila cheia"). Fica com poções, ferramentas, veículos, itens trancados e o que a
// etapa pede; vende as peças de equipamento e as pilhas repetidas; se ainda faltar lugar, as pilhas mais baratas.
let cheioT = 0, vendaAte = 0, vendaT = 0, vendaPausa = 0;
const tem = (k) => (prog?.mochila || []).some((o) => o && o.k === k);
// ronda 2026-11-19: poção fica só a pilha maior de cada uma (ferramentas/robo/robo-escolhas.mjs listaVenda)
function protegido(o) {
  if (!o || o.cad) return true;
  if (UPGRADE && (ehEquip(o.k) || ITENS[o.k]?.catalisador || MATS_EVO.has(o.k))) return true; // combate de teste: peça vira catalisador, material fica para evoluir
  if (FERRAMENTAS_FAZENDA[o.k] || ITENS[o.k]?.usar?.veiculo) return true;
  return !!hi?.k && o.k === hi.k;
}
const listaVenda = (m) => listaVendaDe(m, protegido);
function vendedorPerto() {
  let b = null, md = Infinity; const minha = terraEm(CACA, eu.x, eu.z);
  for (const n of MAPA_CLAREIRA.npcs) {
    if (n.funcao !== 'loja' && !(n.acoes || []).includes('vender')) continue;
    if (prog && zonaFechadaEm(prog, n.x, n.z)) continue;
    if (terraEm(CACA, n.x, n.z) !== minha) continue; // ronda 2026-11-25: o mais perto em linha reta pode estar do outro lado do mar
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
    if (notaPeca(o) > notaPeca(prog.equip[l])) { vestirT = agora; R.vestiu = (R.vestiu || 0) + 1; if (COMBATE && R.combate.vestiu.length < 200) R.combate.vestiu.push({ min: Math.round((agora - R.inicio) / 60e3), nv: prog.nivel | 0, lugar: l, r: o.r | 0 }); acao('item', { acao: 'equipar', i }); return true; }
  }
  return false;
}
// pontos de atributo no modo só caça (--cacar não passa pela missão, que é onde ele distribuía): metade Força, metade Vitalidade
let pontosT = 0;
function pontosLivres(agora) {
  if (!prog || !(prog.pontos > 0) || agora - pontosT < 3000) return false;
  pontosT = agora; const n = prog.pontos | 0, f = Math.ceil(n / 2);
  acao('atributos', { for: f, ...(n - f ? { vit: n - f } : {}) }); prog.pontos = 0; return true;
}
// ---------- evoluir (robô do combate de teste, André 2026-11-27: "a cada quantos níveis precisa evoluir"): como um
// jogador faria. 1) Peça sobrando na mochila (pior que a do corpo) é destruída: vira catalisador (Comum dá barra de cobre).
// 2) Para a peça do corpo de menor raridade: catalisador + material (CATALISADOR.usa). Falta catalisador: 10 do de baixo
// na alquimista (sintese). Falta material: compra no leilão do Otávio o anúncio mais barato (casa, jogador ou bot), sem
// mexer na reserva do conserto. 3) Tudo na mochila: vai à bigorna/bancada mais perto, tira a peça, evolui e veste de novo.
// Anota cada evolução (R.combate.evolucoes) e o que faltou (R.combate.falta) ----------
const MATS_EVO = new Set(Object.values(CATALISADOR.usa).flat().flatMap((u) => Object.keys(u)));
let evoT = 0, evoPlano = null, destruirT = 0, fabricandoAte = 0; // fabricandoAte: a barrinha de destruir/evoluir do servidor
const temQtd = (k) => (prog?.mochila || []).reduce((s, o) => s + (o && o.k === k && !o.h ? o.n || 1 : 0), 0);
const reservaOuro = () => 1500 + 30 * (prog?.nivel | 0);
function destruirSobra(agora) {
  if (agora - destruirT < 4000 || agora < fabricandoAte) return false;
  const m = prog.mochila, i = m.findIndex((o) => o && !o.cad && ehEquip(o.k) && !(ITENS[o.k].lugar in prog.equip && notaPeca(o) > notaPeca(prog.equip[ITENS[o.k].lugar])));
  if (i < 0) return false;
  destruirT = agora; R.combate.destruidas = (R.combate.destruidas || 0) + 1; acao('item', { acao: 'destruir', i }); return true;
}
function faltaEvo(k, n) { const F = (R.combate.falta ||= {}); F[k] = Math.max(F[k] || 0, n); }
function planoEvoluir() {
  for (const [l, it] of Object.entries(prog.equip).filter(([, o]) => o && ehEquip(o.k)).sort((a, b) => a[1].r - b[1].r)) {
    const Rc = geo.receitaEvoluir(it); if (!Rc) continue;
    if (motivoLibera(prog, 'evoluir', Rc.r) || motivoLibera(prog, 'forja')) continue;
    const faltam = Object.entries(Rc.usa).filter(([k, n]) => temQtd(k) < n).map(([k, n]) => [k, n - temQtd(k)]);
    return { l, k: it.k, r: it.r, Rc, faltam };
  }
  return null;
}
function evoluirEquip(agora) {
  if (!UPGRADE || !prog?.equip || eu.vida < eu.vidaMax * 0.9) return false;
  if (destruirSobra(agora)) return true;
  if (!evoPlano) {
    if (agora - evoT < 60e3) return false;
    evoT = agora;
    const P = planoEvoluir(); if (!P) return false;
    const cat = P.faltam.find(([k]) => ITENS[k]?.catalisador);
    if (cat) { // catalisador: alquimista junta 10 do de baixo
      const D = ITENS[cat[0]], C = CATALISADOR.sintese.custo[D.cr], de = C && CATALISADOR[D.catalisador][D.cr - 2];
      if (C && de && temQtd(de) >= C.n && (prog.ouro | 0) - C.ouro >= reservaOuro()) evoPlano = { fase: 'sintese', k: cat[0], ate: agora + 6 * 60e3 };
      else { faltaEvo(cat[0], cat[1]); return false; }
    } else if (P.faltam.length) {
      const [k, n] = P.faltam[0]; evoPlano = { fase: 'leilao', k, n, ate: agora + 6 * 60e3, P };
    } else evoPlano = { fase: 'estacao', P, ate: agora + 6 * 60e3 };
    log('evoluir:', evoPlano.fase, evoPlano.k || `${evoPlano.P.k} ${evoPlano.P.r} -> ${evoPlano.P.r + 1}`);
  }
  const E = evoPlano;
  if (agora > E.ate) { problema(`Evoluir: não terminou a fase ${E.fase} em 6 min`); evoPlano = null; return false; }
  if (E.fase === 'sintese') {
    const npc = npcDe(CATALISADOR.sintese.npc); if (!npc) { evoPlano = null; return false; }
    if (!irPara(npc.x, npc.z, 3)) return true;
    parar(); if (agora - falarT < 3000) return true; falarT = agora;
    acao('item', { acao: 'sintetizar', k: E.k, n: 1 }); evoPlano = null; evoT = agora - 50e3; return true;
  }
  if (E.fase === 'leilao') {
    const npc = MAPA_CLAREIRA.npcs.find((n) => n.funcao === 'leilao'); if (!npc) { evoPlano = null; return false; }
    if (!irPara(npc.x, npc.z, 2.5)) return true;
    parar(); if (agora - falarT < 3000) return true; falarT = agora;
    if (!E.visto) { leilaoInfo = null; E.visto = true; acao('leilao', { acao: 'ver', busca: { ks: [E.k], ordem: 'barato' } }); return true; }
    if (!leilaoInfo) return true;
    const sobra = (prog.ouro | 0) - reservaOuro();
    const a = (leilaoInfo.lista || []).filter((x) => x.item?.k === E.k && x.preco <= sobra).sort((x, y) => x.preco / (x.item.n || 1) - y.preco / (y.item.n || 1))[0];
    leilaoInfo = null;
    if (!a) { faltaEvo(E.k, E.n); evoPlano = null; return false; }
    acao('leilao', { acao: 'comprar', id: a.id }); R.combate.leilao = R.combate.leilao || { compras: 0, ouro: 0 }; R.combate.leilao.compras++; R.combate.leilao.ouro += a.preco;
    log('evoluir: comprou', a.item.n || 1, E.k, 'por', a.preco); evoPlano = null; evoT = agora - 55e3; return true;
  }
  // estação: bigorna (arma) ou bancada (armadura), a aberta mais perto
  const k = RECEITA_ESTACAO(E.P.Rc);
  if (!E.est) E.est = (MAPA_CLAREIRA.estacoes || []).filter((o) => o.k === k && !zonaFechadaEm(prog, o.x, o.z)).sort((a, b) => d2(eu, a) - d2(eu, b))[0];
  if (!E.est) { problema(`Evoluir: nenhuma ${k} aberta`); evoPlano = null; return false; }
  if (!irPara(E.est.x, E.est.z, 2)) return true;
  parar(); if (agora - falarT < 3000 || agora < fabricandoAte) return true; falarT = agora;
  const it = prog.equip[E.P.l];
  if (it && it.k === E.P.k && it.r === E.P.r) { acao('item', { acao: 'tirar', lugar: E.P.l }); return true; } // vai para a mochila
  const i = prog.mochila.findIndex((o) => o && o.k === E.P.k && o.r === E.P.r);
  if (i < 0 || E.mandou) { evoPlano = null; return false; }
  E.mandou = true; E.ate = agora + 30e3;
  acao('item', { acao: 'evoluir', i }); return true;
}
// ---------- reforçar (robô do combate de teste): com ouro sobrando, reforça a peça do corpo de menor +, como o bot faz
// (amiga.js reforcoAmiga): guarda 1.500 + o conserto, só tenta o + que o atributo deixa usar e se tem o Tecido ----------
let reforcoT = 0, reforcoPausa = 0;
function reforcarEquip(agora) {
  if (!UPGRADE || !prog?.equip || agora - reforcoT < 3000 || agora < reforcoPausa || eu.vida < eu.vidaMax * 0.9) return false;
  const pecas = Object.entries(prog.equip).filter(([, o]) => o && ehEquip(o.k) && (o.e | 0) < reforcoMax(o) && (o.d ?? 100) > 0)
    .filter(([, o]) => { const pr = reforcoPrecisa(o, (o.e | 0) + 1); if (atributoDoReforco(prog.atr, pr.k) < pr.n) return false; const m = materialReforco(o); return !m || contar(prog.mochila, m.k) >= m.n; })
    .sort((a, b) => (a[1].e | 0) - (b[1].e | 0));
  if (!pecas.length) return false;
  const [lugar, o] = pecas[0];
  if ((prog.ouro | 0) - custoReforco(o) < 1500 + 30 * (prog.nivel | 0)) return false;
  reforcoT = agora; acao('item', { acao: 'reforcar', lugar }); return true;
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

// ---------- consertar (ronda 2026-11-26): cada morte gasta 10% da peça e peça quebrada não dá bônus. O robô nunca
// consertava, então morria até no campo Nv 56 com a armadura quebrada. Com peça do corpo abaixo de 40%, vai ao ferreiro
// mais perto da terra dele e conserta o que o ouro paga (pecasParaConsertar, ferramentas/robo/robo-escolhas.mjs) ----------
let consertoAte = 0, consertoT = 0, consertoPausa = 0, semOuroAvisado = false;
function ferreiroPerto() {
  let b = null, md = Infinity; const minha = terraEm(CACA, eu.x, eu.z);
  for (const n of MAPA_CLAREIRA.npcs) {
    if (!(n.acoes || []).includes('consertar')) continue;
    if (prog && zonaFechadaEm(prog, n.x, n.z)) continue;
    if (terraEm(CACA, n.x, n.z) !== minha) continue;
    const d = d2(eu, n); if (d < md) { md = d; b = n; }
  }
  return b;
}
function consertar(agora) {
  if (!prog?.equip) return false;
  const P = pecasParaConsertar(prog.equip, prog.ouro);
  R.equip = P ? { quebradas: P.quebradas, menor: P.menor, ouro: prog.ouro | 0, custo: P.custo, ficam: P.ficam } : { inteiro: true, ouro: prog.ouro | 0 };
  if (!consertoAte) {
    if (agora < consertoPausa || !P) return false;
    if (!P.lista.length) { if (!semOuroAvisado) { semOuroAvisado = true; problema(`Equipamento gasto (${P.quebradas} peças quebradas) e sem ouro para consertar (${prog.ouro | 0} de ouro)`); } consertoPausa = agora + 10 * 60e3; return false; }
    const f = ferreiroPerto(); if (!f) { consertoPausa = agora + 10 * 60e3; return false; }
    consertoAte = agora + 6 * 60e3; consertoT = 0; log(`equipamento gasto (menor ${P.menor}%, ${P.quebradas} quebradas): vai consertar ${P.lista.length} peças com ${f.nome || f.id}`);
  }
  if (agora > consertoAte) { consertoAte = 0; consertoPausa = agora + 10 * 60e3; problema('Equipamento gasto: não conseguiu chegar num ferreiro em 6 min'); return false; }
  const f = ferreiroPerto(); if (!f || !P?.lista.length) { consertoAte = 0; return false; }
  if (!irPara(f.x, f.z, 2.5)) return true;
  parar();
  if (agora - consertoT < 3000) return true;
  consertoT = agora; acao('item', { acao: 'consertar', lista: P.lista });
  consertoAte = 0; consertoPausa = agora + 60e3; // espera o servidor mandar o equipamento novo
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
let xpGrind = -2, etapaK = '', etapaDesde = 0, falarT = 0, puladaAgora = false, listaAvisada = false, naoSabeT = 0, viajandoAte = 0;
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
  const h = prog?.hist; if (!h) return cacar(agora, true);
  if (listaMudou(HISTORIA, h)) return cacar(agora, true); // lista do servidor mudou no meio do turno: nem missão errada nem zerar
  if (h.p >= HISTORIA.length) { log('fez a história toda: começa de novo'); mandar('missaoTeste', { acao: 'zerar' }); return; }
  // travou: a mesma etapa, o mesmo andamento e o mesmo texto há TRAVA_MIN minutos
  const k = `${h.p}:${h.ac}:${h.e}:${h.n}:${h.m}:${hi?.txt}`;
  if (k !== etapaK) { etapaK = k; etapaDesde = agora; correcoesSeguidas = 0; bloqueio = ''; reto = false; coletando = 0; }
  const M = HISTORIA[h.p];
  if (presoNaNevoa() && casinha(agora, `dentro da névoa, missão ${M.id}`)) return; // ronda 2026-11-25: depois do "zerar"
  if (!h.ac && (prog.nivel || 1) < M.nv) { // ainda não tem o nível: caça até chegar
    if (agora - etapaDesde > 3 * TRAVA_MIN * 60e3 && (prog.xp ?? -1) === xpGrind) { etapaDesde = agora; problema(`Caçando há ${3 * TRAVA_MIN} min sem ganhar XP para chegar ao Nv ${M.nv} (${M.id})`); campoCaca = null; }
    if ((prog.xp ?? -1) !== xpGrind) { xpGrind = prog.xp ?? -1; etapaDesde = agora; }
    return cacar(agora, true); // subindo de nível: pode ir de totem para a terra que tem campo do nível
  }
  if (agora - etapaDesde > TRAVA_MIN * 60e3) return pular(`ficou ${TRAVA_MIN} min sem andar ("${hi?.txt || ''}"${ultimoAviso ? `, último aviso: ${ultimoAviso}` : ''})`);
  if (correcoesSeguidas > 20 && destino && !reto) { reto = true; rota = [{ x: destino.x, z: destino.z }]; } // a estrada passa na névoa: tenta reto
  if (correcoesSeguidas > 40) { correcoesSeguidas = 0; problema(`Posição recusada sem parar indo para ${hi?.alvo?.nome || '?'} (${M.id})${bloqueio ? `, caminho com ${bloqueio}` : ''}`); }
  const a = hi?.alvo;
  // ronda 2026-11-25: caçando ele pode ter ido de totem para outra terra; a etapa (ou o NPC dela) do outro lado do mar:
  // volta de totem antes de andar (a pé a rota não atravessa e a etapa travava em 15 min)
  { const lugar = hi?.npc ? (a?.npc === hi.npc ? a : npcDe(hi.npc)) : a;
    if (lugar && viajarParaTerra(terraEm(CACA, lugar.x, lugar.z), agora, `missão ${M.id}`, lugar)) return; }
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
    if (!sala || !eu.pronto) { contarEstado('fora'); continue; }
    if (agora - pingT > 2000) { pingT = agora; mandar('ping', Math.round(performance.now())); } // número pequeno, como o app (Date.now() vira inteiro de 64 bits)
    let estado = eu.morto ? 'morto' : 'para';
    try { if (!eu.morto) { passoPesca(agora); if (!pescaSt && !vestir(agora) && !vender(agora) && !consertar(agora) && !pontosLivres(agora) && !evoluirEquip(agora) && !reforcarEquip(agora) && !receberDiarias(agora)) { if (SO_CACAR) cacar(agora, true); else missao(agora); estado = campoCaca && !cacaViagem && d2(eu, campoCaca) < 40 && eu.vida > eu.vidaMax * 0.5 ? 'caca' : 'anda'; } } } catch (e) { R.erros++; problema(`Erro no robô: ${e.message}`); }
    contarEstado(estado, campoCaca ? `${campoCaca.nome} Nv ${campoCaca.nivel || 1}` : '');
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
