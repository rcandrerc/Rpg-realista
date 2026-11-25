// Arena PvP 3x3 Geada x Chama (André 2026-11-21), shared/arena.js. Uso: node ferramentas/testes/arena-pvp.mjs
import { Simulacao, MAPA_CLAREIRA, PVP, LOJA_PVP } from '../../shared/index.js';
import { alturaMundo } from '../../shared/mundo.js';
import { gradeDoMundo } from '../../shared/relevo.js';
import { progressoValido } from '../../shared/progresso.js';
import './_relogio-fixo.mjs'; // relógio e sorte fixos: o mesmo resultado em máquina rápida ou lenta (CI)
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('a', 'Yukmei', 'ruiva', { conta: 1 });
for (const x of s.amigosIa) x.amigaEntrar('a', true);
s.passo(0.05);
let vistos = [];
const correr = (seg) => { for (let t = 0; t < seg; t += 0.05) vistos.push(...s.passo(0.05)); };
const evs = (f) => [...vistos, ...s.eventos].filter(f);
const A = PVP.arena;

// a arena: chão plano, sem árvore
{ const G = gradeDoMundo(); let mx = -1e9, mn = 1e9; for (let g = 0; g < 6.28; g += 0.3) for (const f of [0, 0.5, 1]) { const h = alturaMundo(G, A.x + Math.cos(g) * A.r * f, A.z + Math.sin(g) * A.r * f); mx = Math.max(mx, h); mn = Math.min(mn, h); }
  ok(mx - mn < 0.6, `chão da arena plano (${(mx - mn).toFixed(2)} m)`);
  ok(MAPA_CLAREIRA.mata.filter((t) => Math.hypot(t.x - A.x, t.z - A.z) < A.r + 2).length === 0, 'nenhuma árvore na arena'); }

a.x = 0; a.z = 4; a.y = s.terreno.altura(0, 4); a.combateAte = 0;
const antes = { x: a.x, z: a.z, vida: a.vida = Math.round(a.vidaMax * 0.7) };
s.arenaPvp('a', { acao: 'fila' });
ok(s.filaPvp.length === 1, 'entrou na fila');
correr(PVP.espera + 0.2);
const M = s.partidaPvp;
ok(!!M && a.pvp?.M === M, 'depois da espera a partida começa');
const vidaAntes = a.pvp.de.vida; a.pvp.de.vida = Math.round(a.vidaMax * 0.6);
const chama = M.ids.filter((id) => s.jogadores.get(id).pvp.time === 'chama'), geada = M.ids.filter((id) => s.jogadores.get(id).pvp.time === 'geada');
ok(chama.length === 4 && geada.length === 4, `NPCs completam 4x4 (${chama.length}x${geada.length})`);
ok(geada.every((id) => ['kira', 'rufo', 'lis', 'gael', 'kael', 'varek'].includes(s.amigoIaDe(s.jogadores.get(id))?.AMIGA.id)), 'Geada sorteada entre Kira, Rufo, Lis, Gael, Kael e Varek');
ok(Math.hypot(a.x - A.x, a.z - A.z) < A.r && a.vida === a.vidaMax, 'foi para a arena com a vida cheia');
ok(evs((e) => e.t === 'corrigir' && e.para === 'a').length > 0, 'o celular recebe o lugar novo');
const k = s.jogadores.get(geada[0]);
const v0 = k.vida; s.ferir(k, 30, a, { q: 1 });
ok(k.vida === v0, 'na contagem ninguém fere');
correr(PVP.contagem + 0.1);
ok(M.fase === 'luta' && s.inimigosDe(a).includes(k), 'na luta o outro time vira alvo');
ok(!s.inimigosDe(a).some((o) => o.pvp?.time === 'chama'), 'o próprio time não é alvo');
const xp0 = a.prog.xp;
// obstáculos sólidos (André 2026-11-21: "não dessem pra passar por dentro"): o muro do meio fica em (x, z - 7)
{ const muro = s.pertoNaMata(A.x, A.z - 7).filter((o) => o.arena && Math.hypot(o.x - A.x, o.z - (A.z - 7)) < 1);
  ok(muro.length > 0 && muro.every((o) => o.alto > s.terreno.altura(o.x, o.z) + 1), `muro da arena sólido e alto (${muro[0]?.alto} m)`);
  const sx = a.x, sz = a.z, sy = a.y;
  a.x = A.x; a.z = A.z - 7; a.y = s.terreno.altura(a.x, a.z); s.colidir(a);
  ok(muro.every((o) => Math.hypot(a.x - o.x, a.z - o.z) >= o.r + 0.3), 'o herói não atravessa o muro');
  a.x = A.x; a.z = A.z - 4; a.y = s.terreno.altura(a.x, a.z);
  const vk = k.vida, kx = k.x, kz = k.z, ky = k.y; k.x = A.x; k.z = A.z - 10; k.y = s.terreno.altura(k.x, k.z);
  const h = { dmg: 40, proj: { vel: 30, vida: 2, largura: 0.6, cor: '#fff' } };
  s.projeteis.push({ id: 999999, x: a.x, y: a.y + 1.2, z: a.z, dx: 0, dy: 0, dz: -1, h, dono: a, vida: 2, acertou: new Set() });
  for (let i = 0; i < 20; i++) s.passoProjeteis(0.05);
  ok(k.vida === vk, 'a flecha para no muro e não acerta quem está atrás');
  ok(bloqueia(), 'o NPC vê o muro entre ele e o alvo e contorna');
  function bloqueia() { const o = { x: A.x, z: A.z - 10 }, eu = { x: A.x, z: A.z - 4, y: a.y }; return !!s.bloqueioArena(eu, o); }
  Object.assign(a, { x: sx, z: sz, y: sy }); Object.assign(k, { x: kx, z: kz, y: ky }); }
k.canal = { hid: 'bola_fogo', h: { mana: 0 }, x: k.x, z: k.z }; // cai no meio da Bola de Fogo (André 2026-11-21: bots parados minutos)
k.vida = 5; s.ferir(k, 50, a, { q: 1 });
ok(k.morto && M.placar.chama === 1 && M.stats.a.k === 1, 'zerou: cai e conta o abate');
ok(evs((e) => e.t === 'pvp' && e.fase === 'abate').length >= 1, 'todos ficam sabendo do abate');
correr(PVP.renascer + 0.2);
ok(!k.morto && k.vida === k.vidaMax && Math.hypot(k.x - A.x, k.z - A.z) < A.r, 'levanta na base');
ok(!k.canal, 'levanta sem a magia presa (senão o NPC fica parado para sempre)');
{ const x0 = k.x, z0 = k.z; correr(3); ok(k.morto || Math.hypot(k.x - x0, k.z - z0) > 1, 'o NPC volta a andar depois de renascer'); }
// fora da arena ninguém acerta quem está nela
const b = s.adicionarJogador('b', 'Luísa', 'ruiva', { conta: 2 }); b.x = A.x; b.z = A.z + 30; b.prog.nivel = 50;
const va = a.vida; s.ferir(a, 30, b, { q: 1 }); ok(a.vida === va, 'quem está fora não fere quem está na arena');
// guarda o lugar de antes
s.guardarPosicao(a); ok(Math.hypot(a.prog.pos.x - antes.x, a.prog.pos.z - antes.z) < 0.1, 'a conta guarda o lugar de antes da arena');
// a borda puxa de volta
if (a.morto) correr(PVP.renascer + 0.2); a.x = A.x + A.r + 5; a.z = A.z; s.passoArena(0.05); ok(Math.hypot(a.x - A.x, a.z - A.z) <= A.r, `saiu pela borda: volta para dentro (${Math.hypot(a.x - A.x, a.z - A.z).toFixed(1)} m, morto ${a.morto})`);
// o fim
vistos = []; for (let t = 0; t < PVP.duracao + 5 && M.fase !== 'fim'; t += 0.05) vistos.push(...s.passo(0.05));
const fim = evs((e) => e.t === 'pvp' && e.para === 'a' && e.fase === 'fim')[0];
ok(fim && fim.stats.length === 8 && fim.placar.chama >= 1, 'no fim a janela traz os abates de cada um e o placar');
ok(fim && fim.ganhou > 0 && a.prog.pvp.pts === fim.ganhou, `ganhou Insígnias (${fim?.ganhou})`);
ok(a.prog.xp === xp0, 'a arena não dá nem tira XP');
let vidaVolta = 0; for (let i = 0; i < 84; i++) { const p = !!a.pvp; vistos.push(...s.passo(0.05)); if (p && !a.pvp) vidaVolta = a.vida; }
ok(!a.pvp && !s.partidaPvp && Math.hypot(a.x - antes.x, a.z - antes.z) < 0.5, 'voltou para onde estava');
ok(a.vida < a.vidaMax && a.vida <= a.vidaMax * 0.6 + 2, `com a vida de antes, a arena não cura (${Math.round(a.vidaMax * 0.6)} -> ${Math.round(vidaVolta)})`);
ok(s.amigosIa.every((c) => !c.amiga?.pvp), 'os NPCs saíram da arena');
// loja
a.prog.pvp.pts = 1000;
const tit = LOJA_PVP.find((o) => o.t);
s.arenaPvp('a', { acao: 'comprar', id: tit.id });
ok(a.prog.tit.tem.includes(tit.t) && a.prog.pvp.pts === 1000 - tit.preco, 'compra título exclusivo');
s.arenaPvp('a', { acao: 'comprar', id: tit.id }); ok(a.prog.pvp.pts === 1000 - tit.preco, 'não compra o mesmo título duas vezes');
s.arenaPvp('a', { acao: 'comprar', id: 'pocao5' }); ok(a.prog.pvp.pts === 1000 - tit.preco - 15, 'compra poções');
ok(progressoValido(JSON.parse(JSON.stringify(a.prog))).pvp?.pts === a.prog.pvp.pts, 'Insígnias ficam na conta');
// sair da fila
s.arenaPvp('a', { acao: 'fila' }); s.arenaPvp('a', { acao: 'sair' }); ok(!s.filaPvp.length, 'sai da fila');
// sair do jogo no meio da partida
a.combateAte = 0; // um bot da Geada no mundo pode ter batido nele depois da volta (5 da Geada desde 2026-11-23)
s.arenaPvp('a', { acao: 'fila' }); correr(PVP.espera + 0.3);
ok(a.pvp, 'segunda partida começou');
s.removerJogador('a'); ok(!a.pvp && Math.hypot(a.x - antes.x, a.z - antes.z) < 0.5, 'saiu do jogo na arena: volta para o lugar de antes');
correr(0.2); ok(s.partidaPvp && !s.partidaPvp.ids.includes('a'), 'a partida segue sem quem saiu');
for (const id of [...s.partidaPvp.ids]) { const o = s.jogadores.get(id); if (o.pvp.time === 'chama') s.sairArena(o, 'saiu'); }
correr(0.2); ok(s.partidaPvp?.fase === 'fim', 'sem ninguém de um time, a partida acaba');

// times (André 2026-11-22: "se eu estiver em time vai meu time, se não vai sorteio entre os bots")
{ const s2 = new Simulacao(MAPA_CLAREIRA);
  const h = s2.adicionarJogador('h', 'Yukmei', 'ruiva', { conta: 9 });
  for (const x of s2.amigosIa) x.amigaEntrar('h', true);
  s2.passo(0.05);
  const bots = (t) => s2.amigosIa.map((c) => c.amiga).filter((o) => o && (s2.racaDe(o) === 'geada') === (t === 'geada'));
  const vistos2 = new Set(); let ok1 = true;
  for (let n = 0; n < 8; n++) {
    h.x = 0; h.z = 4; h.y = s2.terreno.altura(0, 4); h.combateAte = 0;
    s2.arenaPvp('h', { acao: 'fila' }); for (let t = 0; t < PVP.espera + 0.3; t += 0.05) s2.passo(0.05);
    const M2 = s2.partidaPvp; if (!M2) { ok1 = false; break; }
    vistos2.add(M2.ids.filter((id) => s2.jogadores.get(id).pvp.time === 'chama').sort().join(','));
    for (const id of [...M2.ids]) s2.sairArena(s2.jogadores.get(id), 'saiu'); for (let t = 0; t < 5; t += 0.05) s2.passo(0.05);
  }
  ok(ok1 && (bots('chama').length <= PVP.time || vistos2.size > 1), `sem time: os bots da Chama são sorteados (${vistos2.size} times diferentes em 8 partidas)`);
  // no time: quem está no time do herói vai junto, do lado dele (bot da Geada não fica em time da Chama: guerra)
  const amigo = bots('chama')[0];
  const T = { lider: 'h', membros: ['h', amigo.id] }; h.time = T; amigo.time = T; (s2.times ||= new Set()).add(T);
  h.x = 0; h.z = 4; h.y = s2.terreno.altura(0, 4); h.combateAte = 0;
  s2.arenaPvp('h', { acao: 'fila' }); for (let t = 0; t < PVP.espera + 0.3; t += 0.05) s2.passo(0.05);
  ok(s2.partidaPvp && amigo.pvp?.time === h.pvp?.time, `no time: ${amigo.nome} vai para o lado do herói`);
  ok(s2.partidaPvp?.ids.length === PVP.time * 2 || bots('chama').length < PVP.time, `o resto é sorteado (${s2.partidaPvp?.ids.length} na arena)`); }
