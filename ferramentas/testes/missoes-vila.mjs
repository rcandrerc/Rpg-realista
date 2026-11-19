// Missões das vilas (plano v3 do Presidente, 19/11/2026; shared/missoes-vila.js e MISSOES_VILA em shared/dados.js):
// 3 por vila, uma por vez além da história; nascem desligadas e ligam no lançamento (19/12 20h de Brasília); a conta
// de teste e o robô veem antes; a 3ª do Rio Claro espera as Bandeiras da guerra; a região da vila precisa estar aberta;
// feitas as 3 de uma vila, título "Amigo do/da ..." (+2% na venda, nada de combate); a conta guarda tudo; Kira, Rufo e
// Lis fazem sozinhos as da faixa deles (menos as do Rio Claro). Textos curtos (#661) e com inglês. Os pontos de cada
// etapa ficam em terra firme, fora de casa e pedra, e na região que a história já abriu para quem pega a missão.
// Uso: node ferramentas/testes/missoes-vila.mjs
import { readFileSync } from 'node:fs';
import { Simulacao, MAPA_CLAREIRA, HISTORIA, MISSOES_VILA, VILAS_MISSAO, MISSOES_VILA_LIGA, TITULOS, ITENS, CHEFES_HISTORIA, HISTORIA_PREMIO, progressoValido, bonusTitulo, xpProximo } from '../../shared/index.js';
import { etapasDe, histNova, zonaFechadaEm, QUEM_LIBERA } from '../../shared/historia.js';
import { vilaValida, MISSOES_DA_VILA, missoesVilaParaApp } from '../../shared/missoes-vila.js';
import { guardar, contar } from '../../shared/progresso.js';
import { noLago, marNadavel } from '../../shared/relevo.js';
import * as G from '../../shared/guerra.js';
import './_relogio-fixo.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const EN = JSON.parse(readFileSync(new URL('../../godot-prototipo/dados/idioma_en.json', import.meta.url), 'utf8'));
const npcDe = (id) => MAPA_CLAREIRA.npcs.find((n) => n.id === id);
const LIGA = Date.parse(MISSOES_VILA_LIGA.desde);

// ---------- dados ----------
ok(MISSOES_VILA.length === 12 && new Set(MISSOES_VILA.map((M) => M.id)).size === 12, 'lote 1: 12 missões, ids sem repetir');
ok(Object.entries(MISSOES_DA_VILA).every(([, L]) => L.length === 3), `3 por vila (${Object.keys(MISSOES_DA_VILA).join(', ')})`);
ok(LIGA === Date.UTC(2026, 11, 19, 23, 0), 'liga no lançamento: 19/12 às 20h de Brasília');
{ const c = {}; for (const n of MAPA_CLAREIRA.npcs) c[n.id] = (c[n.id] || 0) + 1; ok(!Object.values(c).some((q) => q > 1), 'nenhum NPC com id repetido (a Lia da Pousada virou v_lia_pousada)'); }
ok(npcDe('v_lia')?.nome.startsWith('Lia, a ferreira') && npcDe('v_lia_pousada')?.nome.includes('Pousada'), 'v_lia é a ferreira do Juncal; a da Pousada de Aurora tem código próprio');
for (const M of MISSOES_VILA) {
  const V = VILAS_MISSAO[M.vila], L = etapasDe(M);
  ok(!!V && QUEM_LIBERA[V.zona] != null, `${M.id}: vila ${M.vila} com região (${V?.zona})`);
  ok(!!npcDe(M.npc), `${M.id}: quem dá existe (${M.npc})`);
  ok(M.pedido.length <= 240 && M.lembra.length <= 120 && M.lembra.length > 10, `${M.id}: texto curto (pedido ${M.pedido.length}, lembra ${M.lembra.length})`);
  ok(L.at(-1).ev === 'falar', `${M.id}: termina falando com alguém`);
  for (const t of [M.nome, M.pedido, M.lembra, M.pronto]) ok(typeof EN[t] === 'string' && EN[t].length > 2, `${M.id}: inglês de "${t.slice(0, 40)}"`);
  for (const [k] of Object.entries(M.presente || {})) ok(!!ITENS[k], `${M.id}: presente ${k} existe`);
  for (const E of L) {
    ok(typeof EN[E.txt] === 'string', `${M.id}: inglês da etapa "${E.txt}"`);
    for (const t of [E.fala, E.diz].filter(Boolean)) ok(typeof EN[t] === 'string', `${M.id}: inglês de "${t.slice(0, 40)}"`);
    if (E.ev === 'falar') ok(!!npcDe(E.npc), `${M.id}: ${E.npc} existe`);
    if (E.ev === 'pistas') for (const q of E.pontos) ok(typeof EN[q[2]] === 'string', `${M.id}: inglês da pista "${q[2]}"`);
    if (E.hc) ok(!!CHEFES_HISTORIA[E.hc], `${M.id}: chefe ${E.hc} existe`);
    for (const k of Object.keys({ ...E.itens, ...E.entregar, ...E.gasta })) ok(!!ITENS[k], `${M.id}: item ${k} existe`);
  }
}
for (const [id, V] of Object.entries(VILAS_MISSAO)) if (MISSOES_DA_VILA[id]) {
  const T = TITULOS[V.titulo];
  ok(T && T.cond.vila === id && T.b.venda === 0.02 && Object.keys(T.b).length === 1, `título ${T?.nome}: só +2% na venda`);
  ok(typeof EN[T.nome] === 'string' && typeof EN[T.como] === 'string', `título ${T.nome}: inglês`);
}
{ const A = missoesVilaParaApp(); ok(A.vilas.length === 4 && A.missoes.length === 12 && A.missoes.every((o) => o.etapas.length === o.total), 'o app recebe as vilas e as etapas (habilidades.json "vilas")'); }

// ---------- os pontos de cada etapa (terra firme, fora de casa e pedra, região aberta para quem pega a missão) ----------
{
  const s = new Simulacao(MAPA_CLAREIRA), T = s.terreno;
  // no chão (a praça e o chão da vila contam) ou num deque que leva ao chão andando (a ponte); telhado não
  const chao = (x, z) => T.altura(x, z, 200) - T.altura(x, z, -50) < 1.5;
  const anda = (x, z) => chao(x, z) || [0, 1, 2, 3, 4, 5, 6, 7].some((k) => {
    const a = (k / 8) * Math.PI * 2; let h = T.altura(x, z, 200);
    for (let r = 1; r <= 25; r++) { const nx = x + Math.sin(a) * r, nz = z + Math.cos(a) * r, nh = T.altura(nx, nz, 200); if (Math.abs(nh - h) > 0.7) return false; if (chao(nx, nz)) return true; h = nh; }
    return false;
  });
  for (const M of MISSOES_VILA) {
    const i = QUEM_LIBERA[VILAS_MISSAO[M.vila].zona], p = { nivel: M.nv, hist: { ...histNova(), p: i + 1 } };
    const pts = etapasDe(M).flatMap((E) => (E.ev === 'pos' ? [[E.pos[0], E.pos[1], E.txt]] : E.ev === 'pistas' ? E.pontos : []));
    for (const [x, z, nome] of pts) {
      const a = T.altura(x, z, 200), decl = Math.max(...[[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dz]) => Math.abs(T.altura(x + dx, z + dz, 200) - a)));
      ok(!zonaFechadaEm(p, x, z) && !noLago(x, z) && !marNadavel(x, z) && decl < 1.6 && anda(x, z), `${M.id}: "${nome}" em (${x}, ${z}) aberto, seco, plano (${decl.toFixed(2)}) e dá para chegar andando`);
    }
    for (const id of [M.npc, ...etapasDe(M).filter((E) => E.ev === 'falar').map((E) => E.npc)]) { const n = npcDe(id); ok(!zonaFechadaEm(p, n.x, n.z), `${M.id}: ${id} fica na região aberta`); }
  }
}

// ---------- uma conta normal: desligado antes do lançamento, depois liga ----------
let relogio = Date.UTC(2026, 10, 20, 15, 0);
const s = new Simulacao(MAPA_CLAREIRA); s.relogioMs = () => relogio;
const j = s.adicionarJogador('A', 'Ana', undefined, { conta: 7 }); j.criando = false; j.ciente = true;
const p = j.prog; p.nivel = 60; p.hist = { ...histNova(), p: HISTORIA.length };
const avisos = () => s.eventos.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto);
const falas = () => s.eventos.filter((e) => e.t === 'fala' && e.para === 'A');
const ir = (x, z) => Object.assign(j, { x, z, y: s.terreno.altura(x, z, (j.y || 0) + 50) });
const irNpc = (id) => { const n = npcDe(id); ir(n.x + 1.2, n.z); };
const falar = (id) => { irNpc(id); s.eventos.length = 0; s.falar('A', { npc: id, vila: true }); return falas(); };
const estado = (id) => s.vilaInfo(j)?.s[MISSOES_VILA.findIndex((M) => M.id === id)];

ok(s.vilaInfo(j) === null, 'antes de 19/12 20h: nada de missão de vila (prog.vi vazio)');
let f = falar('v_heitor');
ok(!f.length && !p.vila?.at && avisos().some((t) => t.startsWith('Nada de missão de vila')), 'antes do lançamento o Heitor não dá missão de vila');
s.eventos.length = 0; s.avisarProg(j);
ok(s.eventos.find((e) => e.t === 'prog' && e.para === 'A').vi === null, 'o progresso vai com vi = null');
relogio = LIGA - 1000; ok(s.vilaInfo(j) === null, 'um segundo antes: ainda desligado');
relogio = LIGA; ok(s.vilaInfo(j) !== null, 'no lançamento: liga sozinho, sem reiniciar o servidor');

// a região e o nível
p.hist.p = QUEM_LIBERA.B1; ok(estado('rc1') === 'z', 'Rio Claro na névoa: rc1 fechada');
p.hist.p = HISTORIA.length; p.nivel = 29; ok(estado('rc1') === 'n', 'Nv 29: rc1 espera o nível 30');
p.nivel = 60;
ok(estado('rc1') === 'p' && estado('rc2') === 'o' && estado('ps1') === 'p', 'Nv 60: a 1ª de cada vila pode; a 2ª espera a 1ª');
ok(JSON.stringify(Object.keys(s.vilaInfo(j).dar).sort()) === JSON.stringify(['v_bruno', 'v_heitor', 'v_ruy', 'v_tiao']), 'o botão "Vila:" aparece em quem dá as missões que podem sair');

// rc1 inteira, com a regra de uma por vez
f = falar('v_heitor');
const rc1 = MISSOES_VILA.find((M) => M.id === 'rc1');
ok(p.vila.at === 'rc1' && f.some((e) => e.texto === rc1.pedido && e.missao === 'vila:rc1'), 'aceitou rc1: o Heitor pede (janela da missão, vila:rc1)');
ok(avisos().includes('Missão de vila: O Pacto da Ponte'), 'aviso "Missão de vila: ..."');
f = falar('v_bruno');
ok(!f.length && p.vila.at === 'rc1' && avisos().some((t) => t.startsWith('Nada de missão de vila com Bruno')), 'uma por vez: o Bruno não dá a dele com a rc1 aceita');
f = falar('v_heitor');
ok(f.some((e) => e.texto.startsWith(rc1.lembra + '\nFalta: Leia a placa')), 'voltar ao Heitor: o porquê e o que falta');
ok(s.vilaInfo(j).a.alvo?.x === -289, 'o Ir leva à placa');
ir(-289, 32.6); s.eventos.length = 0; s.passoVila(1);
ok(p.vila.e === 1 && avisos().some((t) => t.startsWith('PACTO DA PONTE')), 'leu a placa (o texto dela aparece)');
for (const [x, z] of etapasDe(rc1)[1].pontos) { ir(x, z); s.passoVila(1); }
ok(p.vila.e === 2, 'as 3 pistas da Geada');
const ouro0 = p.ouro, xp0 = p.xp, nv0 = p.nivel, pocao0 = contar(p.mochila, 'pocao');
f = falar('v_heitor');
const fim = etapasDe(rc1)[2].fala + '\n' + rc1.pronto;
ok(f.some((e) => e.texto === fim && e.missao === 'vila:rc1'), 'entregou: a fala do Heitor e o "pronto" numa janela só');
ok(p.vila.f.includes('rc1') && !p.vila.at, 'rc1 feita');
ok(p.ouro === ouro0 + HISTORIA_PREMIO.ouroEtapa * 30 && contar(p.mochila, 'pocao') === pocao0 + 5 && (p.xp > xp0 || p.nivel > nv0), `prêmio: ${HISTORIA_PREMIO.ouroEtapa * 30} de ouro, 5 poções e XP`);
ok(avisos().some((t) => t === 'Missão de vila cumprida: O Pacto da Ponte (+300 de ouro)'), 'aviso de missão cumprida com o ouro');
ok(avisos().some((t) => t.startsWith('Próxima missão de vila: fale com')), 'diz quem tem a próxima');

// a 3ª do Rio Claro espera as Bandeiras (bandeirasLigadas, frente 4)
const bandeiras = typeof G.bandeirasLigadas === 'function' && !!G.bandeirasLigadas(relogio);
p.vila.f.push('rc2');
ok(estado('rc3') === (bandeiras ? 'p' : 'e'), `rc3 ${bandeiras ? 'liberada pelas Bandeiras' : 'espera as Bandeiras (desligadas)'}`);
p.vila.f = p.vila.f.filter((id) => id !== 'rc2');

// deixar no meio e pegar de novo (volta da etapa onde parou)
falar('v_marisa');
ok(p.vila.at === 'rc2', 'pegou a rc2');
for (const [x, z] of etapasDe(MISSOES_VILA[1]).find((E) => E.ev === 'pistas').pontos) { ir(x, z); s.passoVila(1); }
ok(p.vila.e === 1, 'achou a rede');
s.eventos.length = 0; s.missaoVila('A', { acao: 'desistir' });
ok(!p.vila.at && p.vila.s?.rc2 === 1 && avisos().some((t) => t.startsWith('Missão de vila deixada: A rede cortada')), 'deixou no meio: guarda a etapa');
falar('v_marisa');
ok(p.vila.at === 'rc2' && p.vila.e === 1 && !p.vila.s, 'pegou de novo: volta para a pesca');
for (let k = 0; k < 40; k++) s.passo(0.25); // os spots de pesca nascem nos primeiros segundos
s.eventos.length = 0; s.missaoVila('A', { acao: 'ir' });
const ev = s.eventos.find((e) => e.t === 'vila_ir');
ok(ev && Number.isFinite(ev.alvo?.x), `Ir da pesca leva a um spot (${ev?.alvo?.nome})`);
for (let i = 0; i < 3; i++) s.historia(j, 'pesca', { k: 'tilapia', n: 1 });
ok(p.vila.e === 2, '3 peixes pescados');
f = falar('v_marisa');
ok(p.vila.f.includes('rc2') && f.some((e) => e.missao === 'vila:rc2'), 'rc2 feita');

// guardar na conta (no meio de uma missão)
falar('v_bruno');
ok(p.vila.at === 'ps1', 'pegou a ps1');
const v = progressoValido(JSON.parse(JSON.stringify(p))).vila;
ok(JSON.stringify(v.f) === JSON.stringify(['rc1', 'rc2']) && v.at === 'ps1' && v.e === 0, 'a conta guarda as feitas e a da vez');
ok(vilaValida({ f: ['rc1', 'xx', 'rc1'], at: 'rc1', e: 99 }).f.join() === 'rc1' && !vilaValida({ f: ['rc1'], at: 'rc1' }).at, 'save estranho: id que não existe e repetido saem; a feita não fica aceita');
ok(vilaValida({ f: [], at: 'pv3', e: 99, n: 999 }).e === etapasDe(MISSOES_VILA.find((M) => M.id === 'pv3')).length - 1, 'etapa fora da lista volta para a última');
ok(vilaValida(null) === null && vilaValida({ f: [] }) === null, 'sem missão de vila: nada na conta');

// ps1: o imp ladrão aparece no campo e conta ao cair
const C = CHEFES_HISTORIA.imp_ladrao, campo = s.cacaDef(C.campo);
ok(campo && campo.nivel >= 30 && campo.nivel <= 45, `o imp ladrão mora no ${C.campo} (Nv ${campo?.nivel})`);
ir(campo.x + 3, campo.z); s.eventos.length = 0;
for (let k = 0; k < 40 && !s.inimigos.some((e) => e.hc === 'imp_ladrao' && !e.morto); k++) { s.passo(0.25); ir(campo.x + 3, campo.z); }
ok(s.inimigos.some((e) => e.hc === 'imp_ladrao' && !e.morto), 'chegou no campo: o Imp Ladrão apareceu');
s.historia(j, 'matar', { hc: 'imp_ladrao', campo: C.campo, tipo: 'imp', nivel: 38 });
ok(p.vila.e === 1, 'venceu o imp: o martelo');
falar('v_bruno');
ok(p.vila.f.includes('ps1'), 'ps1 feita');

// o resto do lote 1 até o fim (um robô simples faz cada etapa)
const garantir = (k, n) => { const q = contar(p.mochila, k); if (q < n) guardar(p.mochila, { k, n: n - q }); };
function fazer(M) {
  falar(M.npc);
  ok(p.vila.at === M.id, `pegou ${M.id} (${M.nome})`);
  for (let volta = 0; volta < 12 && p.vila.at === M.id; volta++) {
    const E = etapasDe(M)[p.vila.e];
    if (E.ev === 'falar') { for (const [k, n] of Object.entries(E.entregar || {})) garantir(k, n); falar(E.npc); }
    else if (E.ev === 'pos') { for (const [k, n] of Object.entries(E.gasta || {})) garantir(k, n); ir(E.pos[0], E.pos[1]); s.passoVila(1); }
    else if (E.ev === 'pistas') for (const [x, z] of E.pontos) { ir(x, z); s.passoVila(1); }
    else if (E.ev === 'ter') { for (const [k, n] of Object.entries(E.itens)) garantir(k, n); s.passoVila(1); }
    else if (E.ev === 'noite') { p.dia = { h: 22, t: Date.now() }; s.passoVila(1); }
    else if (E.ev === 'pesca') for (let i = 0; i < E.n; i++) s.historia(j, 'pesca', { k: 'tilapia', n: 1 });
    else if (E.ev === 'matar') s.historia(j, 'matar', { hc: E.hc });
    else if (E.ev === 'vender') { irNpc('v_zeca'); s.historia(j, 'vender', { k: 'tilapia' }); }
  }
  ok(p.vila.f.includes(M.id), `${M.id} feita`);
  p.dia = { h: 12, t: Date.now() };
}
for (const id of ['ps2', 'ps3', 'ju1', 'ju2', 'ju3', 'pv1', 'pv2', 'pv3']) fazer(MISSOES_VILA.find((M) => M.id === id));
ok(['amigo_pouso_serra', 'amigo_juncal', 'amigo_porto'].every((t) => p.tit.tem.includes(t)) && !p.tit.tem.includes('amigo_rio_claro'), 'as 3 da vila dão "Amigo do/da ..." (o Rio Claro ainda falta a rc3)');
p.tit.uso = 'amigo_juncal';
ok(bonusTitulo(p).venda === 0.02 && !bonusTitulo(p).dano, 'em uso: +2% na venda e nada de combate');

// ju3: a venda só conta perto do Zeca
{
  const s2 = new Simulacao(MAPA_CLAREIRA); s2.relogioMs = () => LIGA;
  const k = s2.adicionarJogador('B', 'Bia', undefined, { conta: 8 }); k.criando = false;
  Object.assign(k.prog, { nivel: 60, hist: { ...histNova(), p: HISTORIA.length }, vila: { f: ['ju1', 'ju2'], at: 'ju3', e: 2, n: 0, m: 0 }, dia: { h: 22, t: Date.now() } });
  const r = npcDe('v_rosa') || MAPA_CLAREIRA.npcs.find((n) => n.funcao === 'loja' && n.id !== 'v_zeca');
  Object.assign(k, { x: r.x + 1, z: r.z }); s2.historia(k, 'vender', { k: 'tilapia' });
  ok(k.prog.vila.e === 2, `vender o peixe para ${r.nome.split(',')[0]} não conta`);
  const z = npcDe('v_zeca'); Object.assign(k, { x: z.x + 1, z: z.z }); s2.historia(k, 'vender', { ks: ['pocao', 'tilapia'] });
  ok(k.prog.vila.e === 3, 'vender vários perto do Zeca, com peixe no meio: conta');
}

// a conta de teste do André e o robô veem antes do lançamento (e a 3ª do Rio Claro)
{
  const s3 = new Simulacao(MAPA_CLAREIRA); s3.relogioMs = () => Date.UTC(2026, 10, 20, 15, 0);
  const t = s3.adicionarJogador('T', 'Teste', undefined, { conta: 1, testador: true }); t.criando = false;
  const r = s3.adicionarJogador('R', 'Robo', undefined, { conta: 2, robo: true }); r.criando = false;
  const n = s3.adicionarJogador('N', 'Normal', undefined, { conta: 3 }); n.criando = false;
  for (const q of [t, r, n]) Object.assign(q.prog, { nivel: 60, hist: { ...histNova(), p: HISTORIA.length }, vila: { f: ['rc1', 'rc2'] } });
  ok(s3.vilaInfo(t)?.s[2] === 'p' && s3.vilaInfo(r)?.s[2] === 'p' && s3.vilaInfo(n) === null, 'antes do lançamento: teste e robô veem (até a rc3); conta normal não');
  s3.missaoVila('N', { acao: 'zerar' }); ok(n.prog.vila.f.length === 2, 'conta normal não zera');
  s3.missaoVila('T', { acao: 'zerar' }); ok(t.prog.vila.f.length === 0, 'conta de teste zera as missões de vila');
}

// Kira, Rufo e Lis (Geada): fazem as da faixa deles sozinhos, menos as do Rio Claro; Chama (Cecília, Dario) não
{
  const s4 = new Simulacao(MAPA_CLAREIRA); let agora = LIGA - 3600e3; s4.relogioMs = () => agora;
  const g = s4.adicionarJogador('K', 'Kira', undefined, {}); Object.assign(g, { bot: true, raca: 'geada', criando: false });
  const c = s4.adicionarJogador('C', 'Cecília', undefined, {}); Object.assign(c, { bot: true, raca: 'chama', criando: false });
  for (const q of [g, c]) q.prog.nivel = 44;
  ok(s4.vilaNpc(g) === 0, 'antes do lançamento a Geada também espera');
  agora = LIGA;
  const feitas = s4.vilaNpc(g);
  ok(feitas === 5 && ['ps1', 'ps2', 'ps3', 'ju1', 'ju2'].every((id) => g.prog.vila.f.includes(id)) && !g.prog.vila.f.some((id) => id.startsWith('rc')), `Kira Nv 44: fez as 5 da faixa (Pouso e Juncal), nenhuma do Rio Claro (${g.prog.vila.f.join(', ')})`);
  ok(g.prog.tit.tem.includes('amigo_pouso_serra') && !g.prog.tit.tem.includes('amigo_rio_claro'), 'ganhou "Amigo do Pouso da Serra" quieta');
  ok(s4.vilaNpc(c) === 0 && !c.prog.vila?.f?.length, 'Cecília (Chama) não faz sozinha');
  const nv = g.prog.nivel; g.prog.xp = 0; s4.ganharXP(g, xpProximo(g.prog.nivel) * 3);
  ok(g.prog.nivel > nv && g.prog.vila.f.includes('ju3'), `subiu para o Nv ${g.prog.nivel}: fez a ju3 na hora`);
}
