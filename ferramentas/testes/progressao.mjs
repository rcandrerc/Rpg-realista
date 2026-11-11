// Teste da progressão até o Nv 100 (André 2026-11-10): missões principais em ordem, zonas fechadas pela névoa, o que
// abre por nível e conta antiga ganhando as missões até o nível dela. Uso: node ferramentas/testes/progressao.mjs
import { Simulacao, MAPA_CLAREIRA, HISTORIA, ZONAS, LIBERA_NIVEL, CACA, TOTENS, xpProximo } from '../../shared/index.js';
import { progressoValido } from '../../shared/progresso.js';
import { ZONAS_GEO, zonaFechadaEm, liberado, histPorNivel, motivoLibera, naZona } from '../../shared/historia.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Ana');
const correr = (seg) => { const ev = []; for (let t = 0; t < seg / 0.05; t++) ev.push(...s.passo(0.05)); return ev; };
const avisos = (ev) => ev.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto).join(' | ');
const npc = (id) => s.mapa.npcs.find((n) => n.id === id);
const ir = (x, z) => Object.assign(j, { x, z, y: s.terreno.altura(x, z), cliente: null, orcT: null });

// dados: toda missão aponta para NPC, campo e zona que existem; cada zona é liberada por uma missão
for (const M of HISTORIA) {
  ok(!!npc(M.npc), `${M.id}: NPC ${M.npc} existe`);
  for (const c of M.matar?.campos || []) ok(CACA.some((k) => k.id === c), `${M.id}: campo ${c} existe`);
  // o NPC da missão fica fora das zonas que ainda estão fechadas quando ele dá a missão
  const p = { nivel: M.nv, hist: { p: HISTORIA.indexOf(M), ac: false, n: 0 } };
  const N = npc(M.npc); ok(!zonaFechadaEm(p, N.x, N.z), `${M.id}: ${N.nome} está fora da névoa na hora da missão`);
  // e os campos da missão já estão liberados
  for (const c of M.matar?.campos || []) { const k = CACA.find((o) => o.id === c); ok(!zonaFechadaEm(p, k.x, k.z), `${M.id}: campo ${c} já aberto`); }
}
for (const Z of ZONAS) ok(HISTORIA.some((M) => M.libera.includes(Z.id)), `zona ${Z.id} tem missão`);
ok(HISTORIA.every((M, i) => !i || M.nv >= HISTORIA[i - 1].nv), 'missões em ordem de nível');

// regiões (André 2026-11-11): a Vila (R0) começa aberta com o campo Nv 1 e o Nv 3; o resto do mapa de hoje fechado
const novo = { nivel: 1, hist: { p: 0, ac: false, n: 0 } };
const campo = (id) => CACA.find((k) => k.id === id);
ok(!zonaFechadaEm(novo, campo('caca1').x, campo('caca1').z) && !zonaFechadaEm(novo, campo('caca2').x, campo('caca2').z), 'campos Nv 1 e Nv 3 abertos no começo');
for (const id of ['caca3', 'caca5', 'caca6', 'caca9', 'caca11']) ok(!!zonaFechadaEm(novo, campo(id).x, campo(id).z), `${id} fechado no começo`);
for (const n of ['lider', 'ferreiro', 'curandeira', 'andarilho', 'comerciante', 'alquimista', 'reset']) ok(!zonaFechadaEm(novo, npc(n).x, npc(n).z), `${n} fora da névoa no começo`);
// toda região cobre um pedaço de terra de verdade e todo campo de caça fora da Vila cai em alguma região
for (const k of CACA) { const Z = ZONAS_GEO.find((z) => naZona(z, k.x, k.z)); ok(['caca1', 'caca2'].includes(k.id) ? !Z : !!Z, `campo ${k.id} na região ${Z?.id || 'Vila'}`); }
for (const t of TOTENS.lista) { const Z = ZONAS_GEO.find((z) => naZona(z, t.x, t.z)); ok(t.id === 'clareira' ? !Z : !!Z, `totem ${t.id} na zona ${Z?.id || '-'}`); }

// conta antiga: as missões até o nível dela contam como feitas
ok(progressoValido({ nivel: 31, mochila: [] }).hist.p === 8 && liberado(progressoValido({ nivel: 31, mochila: [] }), 'B1'), 'conta antiga Nv 31 abre até o Oeste de Vael');
ok(progressoValido({ nivel: 100, mochila: [] }).hist.p === HISTORIA.length, 'conta antiga Nv 100 abre tudo');
ok(j.prog.hist.p === 0, 'personagem novo começa na missão 1');

// névoa: entrar no campo dos lobos (fechado) não deixa e avisa
ir(104, 52); correr(0.1);
let ok1 = s.posicaoCliente('A', { x: 104, y: s.terreno.altura(104, 40), z: 40, ry: 0 });
ok(!ok1, 'não entra nos Campos do Leste fechados');
let ev = correr(0.1); ok(true, 'aviso: ' + avisos(ev));

// missão 1: Aldo dá, matar 4 Puglins no caca1, entregar
const L = npc('lider'); ir(L.x + 1, L.z); s.falar('A'); ev = correr(0.1);
ok(j.prog.hist.ac, 'Aldo deu a missão 1: ' + avisos(ev));
const ci = s.cacas.findIndex((c) => c.def.id === 'caca1');
for (let k = 0; k < 4; k++) s.contarHistoria(j, { tipo: 'puglin', sp: { caca: ci } });
ok(j.prog.hist.n === 4, 'contou 4 Puglins');
const ouro0 = j.prog.ouro; s.falar('A'); ev = correr(0.1);
ok(j.prog.hist.p === 1 && liberado(j.prog, '1b') && j.prog.ouro > ouro0, 'entregou: Arredores liberados | ' + avisos(ev));
ok(s.posicaoCliente('A', { x: j.x, y: j.y, z: j.z, ry: 0 }) !== false, 'segue andando');

// forja: antes da missão do Tomás, não cria; Nv e cobre: libera
ok(/Tomás|forja/.test(motivoLibera(j.prog, 'forja')), 'forja fechada antes da missão 2: ' + motivoLibera(j.prog, 'forja'));
j.prog.nivel = 3; const T = npc('ferreiro'); ir(T.x + 1, T.z); s.falar('A'); correr(0.1);
ok(j.prog.hist.ac, 'Tomás deu a missão 2');
j.prog.mochila[5] = { k: 'minerio_cobre', n: 6 }; s.falar('A'); ev = correr(0.1);
ok(j.prog.hist.p === 2 && liberado(j.prog, 'forja') && !j.prog.mochila.some((o) => o?.k === 'minerio_cobre'), 'entregou o cobre: forja liberada | ' + avisos(ev));

// níveis
ok(motivoLibera({ nivel: 4 }, 'receita', 'peitoral') === 'Libera no nível 8', 'peitoral no Nv 8');
ok(motivoLibera({ nivel: 9 }, 'evoluir', 2) === 'Libera no nível 20' && motivoLibera({ nivel: 20 }, 'evoluir', 2) === '', 'Épico no Nv 20');
ok(motivoLibera({ nivel: 14 }, 'obra', 'carrinho') === 'Libera no nível 15', 'carrinho no Nv 15');
ok(motivoLibera({ nivel: 11 }, 'pack') !== '' && motivoLibera({ nivel: 12 }, 'pack') === '', 'packs no Nv 12');

// lobo: sem a missão do Bento não monta
j.montado = null; s.montar('A'); ev = correr(0.1); ok(!j.montado, 'sem a missão 3 não monta: ' + avisos(ev));
// subir de nível avisa o que abriu
s.ganharXP(j, xpProximo(3) + xpProximo(4) + 1); ev = correr(0.1);
ok(/Liberado: .*Capacete|Liberado: .*Fornalha/.test(avisos(ev)) && /Missão nova: fale com Bento/.test(avisos(ev)), 'Nv 5 avisa o que abriu e a missão nova | ' + avisos(ev));

// totem numa zona fechada: não viaja
j.prog.totens = ['clareira', 'rio_claro']; j.prog.ouro = 5000; const C = TOTENS.lista[0]; ir(C.x + 3, C.z); correr(0.1);
s.irTotem('A', 'rio_claro'); ev = correr(0.2); ok(/Região fechada: .*Conclua a missão/.test(avisos(ev)), 'totem dentro da névoa não leva: ' + avisos(ev));
// ilha e Aurora: a terra inteira (e um pouco de mar) fecham
ok(zonaFechadaEm(j.prog, 200, 662)?.id === 'C' && zonaFechadaEm(j.prog, 200, 1085)?.id === 'D1' && !zonaFechadaEm(j.prog, 200, 520), 'ilha e Aurora fechadas, o mar do meio aberto');

// monstro de região fechada não persegue nem apanha de quem está fora (André 2026-11-11: puxou mob pela névoa)
{ const s2 = new Simulacao(MAPA_CLAREIRA); const k = s2.adicionarJogador('K', 'Kai');
  const ci3 = s2.cacas.findIndex((c) => c.def.id === 'caca3'); const b = s2.inimigos.find((e) => e.sp?.caca === ci3 && !e.morto) || s2.criarInimigo({ tipo: 'lobo', x: 104, z: 30, caca: ci3, nivel: 5 });
  ok(s2.mobFechadoPara(b, k), 'lobo do campo fechado conta como fechado para o herói Nv 1');
  const v0 = b.vida; s2.ferir(b, 50, k); ok(b.vida === v0, 'golpe do herói de fora não tira vida dele');
  k.prog.hist.p = 1; ok(!s2.mobFechadoPara(b, k), 'depois da missão 1 vale de novo'); }
