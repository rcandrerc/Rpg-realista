// Base do clã no mapa (André 2026-11-22, shared/base.js): fundar onde o líder está, onde não pode (totem, território
// da outra raça, perto de outra base), o lote 1 do líder, os lotes dos recrutas, a taxa do cofre, a trava, o Baú do
// Clã do salão, a forja (Nv 4) e as bases dos clãs bot.
// Uso: node ferramentas/testes/base-cla.mjs
import { Simulacao, MAPA_CLAREIRA, CLA, TOTENS, contar } from '../../shared/index.js';
import { motivoBase, acharLugarBase, montarBase, territorioDe } from '../../shared/base.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const ev = () => { const e = s.eventos; s.eventos = []; return e; };
const avisos = () => ev().filter((e) => e.t === 'aviso').map((e) => e.texto).join(' | ');

// lugares (os mesmos que o clã bot acharia)
const pc = acharLugarBase(-6, 1, 'chama', []), pg = acharLugarBase(546, 43, 'geada', [{ ...pc, n: 'x' }]);
ok(pc && territorioDe(pc.x, pc.z) === 'chama' && pg && territorioDe(pg.x, pg.z) === 'geada', 'acha lugar no território de cada raça');
const T = TOTENS.lista[0];
ok(/totem/.test(motivoBase(T.x + 20, T.z, 'chama', [])), 'perto de totem não pode');
ok(/território/.test(motivoBase(pg.x, pg.z, 'chama', [])), 'chama não funda no território da Geada');
ok(/Muito perto da base/.test(motivoBase(pc.x + 60, pc.z, 'chama', [{ x: pc.x, z: pc.z, n: 'Lobos' }])), 'perto de outra base não pode (qualquer clã)');

const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.prog.ouro = 90000; a.prog.nivel = 40;
a.x = pc.x; a.z = pc.z;
s.cla('A', { acao: 'base' });
ok(/Funde o seu clã/.test(avisos()), 'sem clã não funda base');
s.cla('A', { acao: 'fundar', nome: 'Ruivas' });
const p = a.prog, c = p.cla;
// dois recrutas antes da base (sorteio dos lotes)
const r = s.mapa.npcs.find((n) => n.funcao === 'recrutador');
c.nv = 3; a.x = r.x + 1; a.z = r.z;
s.cla('A', { acao: 'recrutar', tier: 'recruta' }); s.cla('A', { acao: 'recrutar', tier: 'recruta' }); ev();
a.x = T.x + 10; a.z = T.z;
s.cla('A', { acao: 'base' });
ok(/totem/.test(avisos()) && !s.baseDe(a), 'fundar perto do totem: recusa e diz por quê');
a.x = pc.x; a.z = pc.z;
s.cla('A', { acao: 'base' });
const B = s.baseDe(a);
ok(B && B.x === pc.x && B.nv === 3, 'base fundada onde o líder está, no nível do clã');
const L1 = s.loteDe(a);
ok(L1?.def.baseK === B.k && L1.def.x1 - L1.def.x0 === CLA.base.lote, 'o lote 1 (10 x 10) é do líder');
ok(new Set(Object.values(B.donos).map((o) => o.id)).size === 2 && Object.keys(B.donos).every((i) => +i >= 2 && +i <= 3), 'os 2 recrutas sorteados nos lotes 2 e 3');
const e1 = ev(), eb = e1.find((e) => e.t === 'bases' && e.para === 'A');
ok(eb?.meu === B.k && eb.lista.some((o) => o.k === B.k && o.pecas.length && o.sol.length && o.lotes.length === 3), 'o app recebe a base desenhada (peças, sólidos, 3 lotes)');
ok(eb.lista.find((o) => o.k === B.k).lotes.find((l) => l[0] === 1)[5] === 'Ana', 'o lote 1 mostra o nome do líder');
ok(s.terreno.solidos.some((o) => o.casa && Math.hypot(o.x - B.x, o.z - B.z) < 20), 'o salão é sólido no servidor');
// construir no lote da base: o chão é o relevo (não 0)
p.mochila.fill(null); p.mochila[0] = { k: 'obra_bau', n: 1 };
a.x = (L1.def.x0 + L1.def.x1) / 2; a.z = (L1.def.z0 + L1.def.z1) / 2;
s.construir('A', { k: 'bau', x: L1.def.x0 + 2, z: L1.def.z0 + 2, r: 0 });
ok(L1.pecas.some((o) => o.k === 'bau'), 'constrói no lote da base');
// segunda base: não
s.cla('A', { acao: 'base' });
ok(/já fica/.test(avisos()), 'uma base por clã');
// comprar terreno nas vilas: com o servidor, só na base
s.soBaseCla = true;
const b2 = s.adicionarJogador('B', 'Bia', undefined, { conta: 2 }); b2.criando = false; b2.prog.ouro = 9000; b2.x = -24; b2.z = 59;
s.comprarLote('B', { x0: -28, z0: 55, x1: -20, z1: 63 });
ok(!s.loteDe(b2) && /base do seu clã/.test(avisos()), 'terreno novo só na base do clã');
s.soBaseCla = false;

// novo recruta pega o próximo lote; dispensado, o lote fica livre
c.nv = 4; s.baseDoClaMudou(a);
a.x = r.x + 1; a.z = r.z;
s.cla('A', { acao: 'recrutar', tier: 'recruta' });
const novo = c.m[2];
ok(B.nv === 4 && B.donos[4]?.id === novo.id, 'recruta novo pega o lote 4 (o próximo que abriu)');
s.cla('A', { acao: 'dispensar', id: novo.id });
ok(!B.donos[4], 'dispensado: o lote dele fica livre');

// taxa: sai do cofre; sem ouro, trava o lote e o Baú do Clã
c.cofre = 10000; B.taxa = Date.now() - 2.5 * CLA.semana;
s.cobrarCla(a);
ok(s.semanasBase(B) === 0 && c.cofre === 10000 - 2 * CLA.base.niveis[4].taxa, 'a taxa de 2 semanas saiu do cofre');
c.cofre = 0; B.taxa = Date.now() - 2.5 * CLA.semana; s.cobrarCla(a); ev();
p.mochila[1] = { k: 'obra_bau', n: 1 };
a.x = (L1.def.x0 + L1.def.x1) / 2; a.z = (L1.def.z0 + L1.def.z1) / 2;
s.construir('A', { k: 'bau', x: L1.def.x0 + 6, z: L1.def.z0 + 6, r: 0 });
ok(L1.pecas.filter((o) => o.k === 'bau').length === 1 && /Taxa do clã atrasada/.test(avisos()), 'taxa atrasada 2 semanas: não constrói');
const D = s.basesDesenho[B.k];
a.x = D.bau.x; a.z = D.bau.z + 1;
s.bau('A', { acao: 'abrir', cla: true });
ok(/Taxa do clã atrasada/.test(avisos()), 'taxa atrasada: o Baú do Clã trava');
s.cla('A', { acao: 'depositar', ouro: 10000 });
s.bau('A', { acao: 'abrir', cla: true });
ok(s.semanasBase(B) === 0 && ev().some((e) => e.t === 'bau' && e.cla === 1), 'depositou: pagou a taxa e o Baú do Clã do salão abre');
ok(s.claInfo(a).base?.nv === 4 && s.claInfo(a).baseNiveis.length === 6, 'o painel mostra a base e a tabela dos níveis');

// forja (Nv 4): serve de bigorna para o clã
a.x = D.forja.x; a.z = D.forja.z;
ok(s.forjaBasePerto(a)?.k === 'bigorna', 'a forja da base serve de bigorna');

// Nv 6: castelo, 4 torres, portão; o desenho cabe no centro
const D6 = montarBase({ x: B.x, z: B.z, nv: 6 });
ok(D6.pecas.some((o) => o.m === 'aurora_paco') && D6.pecas.filter((o) => o.m === 'aurora_torre').length === 3 && D6.pecas.some((o) => o.m === 'aurora_portao') && D6.lotes.length === 6, 'Nv 6: castelo, 3 torres, forja, portão e 6 lotes');
ok(D6.pecas.every((o) => Math.abs(o.x - B.x) <= 18 && Math.abs(o.z - B.z) <= 18), 'tudo do centro cabe no quadrado de 34 m');

// salvar e carregar
const salvo = JSON.parse(JSON.stringify(s.basesCla));
const s2 = new Simulacao(MAPA_CLAREIRA); s2.carregarBases(salvo);
ok(s2.basesCla[B.k]?.x === B.x && Object.keys(s2.basesCla[B.k].donos).length === Object.keys(B.donos).length, 'a base volta do banco com os donos dos lotes');
const ls = s.lotesParaSalvar().find((o) => o.id === L1.def.id);
s2.carregarLotes([ls]);
ok(s2.lotes.get(L1.def.id)?.def.baseK === B.k && s2.lotes.get(L1.def.id).taxa == null, 'o lote da base volta do banco sem aluguel');

// clãs bot: fundam a base sozinhos, no território deles, longe das outras
s.passoClasNpc(); s.passoBasesNpc();
const bg = s.basesCla.ngeada, bc = s.basesCla.nchama;
ok(bg && territorioDe(bg.x, bg.z) === 'geada' && bc && territorioDe(bc.x, bc.z) === 'chama', 'clãs bot fundam a base no território da raça');
ok(Object.values(s.basesCla).every((o) => Object.values(s.basesCla).every((q) => q === o || Math.hypot(o.x - q.x, o.z - q.z) >= CLA.base.distMin)), 'todas as bases a pelo menos a distância mínima umas das outras');
ok(Object.values(bg.donos).length >= Math.min(bg.nv - 1, 3), 'os membros do clã bot ganham os lotes');

// casa antiga devolvida (André 2026-11-22: "Tudo pode remover as casas")
{
  const s3 = new Simulacao(MAPA_CLAREIRA), e3 = () => { const e = s3.eventos; s3.eventos = []; return e; };
  const c3 = s3.adicionarJogador('C', 'Cris', undefined, { conta: 3 });
  c3.criando = false; c3.ciente = true; c3.prog.ouro = 5000; c3.prog.nivel = 40; c3.x = -24; c3.z = 59;
  s3.comprarLote('C', { x0: -28, z0: 55, x1: -20, z1: 63 });
  const Lv = s3.loteDe(c3), ouro0 = c3.prog.ouro;
  c3.prog.mochila.fill(null); c3.prog.mochila[0] = { k: 'obra_bau', n: 1 };
  s3.construir('C', { k: 'bau', x: -26.5, z: 57, r: 0 });
  Lv.bau = Array(40).fill(null); Lv.bau[0] = { k: 'lenha', n: 25 };
  e3();
  const n = s3.resetTerrenos();
  ok(n === 1 && !s3.loteDe(c3), 'a casa antiga sai do mapa');
  ok(c3.prog.ouro === ouro0 + 64 * 4 && contar(c3.prog.mochila, 'obra_bau') === 1, 'o dono recebe o preço do terreno e as peças na mochila');
  ok(s3.devolucoes[c3.conta]?.bau?.some((o) => o.k === 'lenha'), 'o baú espera o lote da base');
  s3.cla('C', { acao: 'fundar', nome: 'Volta' });
  const p3 = acharLugarBase(-6, 1, 'chama', []); c3.x = p3.x; c3.z = p3.z;
  s3.cla('C', { acao: 'base' });
  ok(contar(s3.loteDe(c3)?.bau || [], 'lenha') === 25 && !s3.devolucoes[c3.conta], 'fundou a base: o baú antigo está no lote 1');
}

// os prédios do centro não se cruzam (tamanho de cada modelo, com beiral) em nenhum nível
{
  const larg = { pedra_6x6: [8.3, 8.1], sobrado_6x6: [8.3, 8.1], aurora_pousada: [10, 14.2], aurora_paco: [10, 15.8], aurora_torre: [5.7, 5.5], forja: [5.6, 5.7] };
  let bate = '';
  for (let nv = 1; nv <= 6; nv++) {
    const P = montarBase({ x: 0, z: 0, nv }).pecas.filter((o) => larg[o.m]);
    for (let i = 0; i < P.length; i++) for (let k = i + 1; k < P.length; k++) {
      const [a, b] = [P[i], P[k]], [wa, da] = larg[a.m], [wb, db] = larg[b.m];
      if (Math.abs(a.x - b.x) < (wa + wb) / 2 && Math.abs(a.z - b.z) < (da + db) / 2) bate += ` Nv${nv}:${a.m}x${b.m}`;
    }
  }
  ok(!bate, 'os prédios do centro não se cruzam' + bate);
}

// as árvores da mata de dentro da base saem da coleta e da batida
{
  const s4 = new Simulacao(MAPA_CLAREIRA);
  let alvo = null;
  for (const t of MAPA_CLAREIRA.mata) { if (Math.abs(t.x) < 300 && !motivoBase(Math.round(t.x - 26), Math.round(t.z), 'chama', [])) { alvo = { x: Math.round(t.x - 26), z: Math.round(t.z) }; break; } }
  ok(!!alvo, 'achou um lugar com árvore dentro');
  s4.carregarBases({ jteste: { x: alvo.x, z: alvo.z, raca: 'chama', n: 'T', dono: 't', nv: 1 } });
  const arv = s4.basesDesenho.jteste.arvores;
  ok(arv.length > 0 && arv.every(([id]) => !s4.coletaveis.has(id)), 'as árvores de dentro saem da coleta');
  ok(arv.every(([, x, z]) => !s4.pertoNaMata(x, z).some((a) => a.x === x && a.z === z)), 'e da batida');
  ok(s4.dadosBase(s4.basesCla.jteste).arvores.length === arv.length, 'o app recebe quais árvores saíram');
}

// as casas dos bots também saem (André 2026-11-22: "Não vai existir mais casa de bot nenhum"): o progresso fica e a casa
// nasce no lote dele na base do clã bot
{
  const s5 = new Simulacao(MAPA_CLAREIRA);
  const dario = s5.amigosIa.find((a) => a.AMIGA.id === 'dario'), ce = s5.amigosIa.find((a) => a.AMIGA.id === 'cecilia');
  s5.lotes.set('tdario', { def: { id: 'tdario', nome: 'Terreno', x0: -30, z0: 60, x1: -20, z1: 70 }, dono: dario.AMIGA.conta, nomeDono: 'Dario', pecas: [], horta: {}, prox: 1, taxa: Date.now(), amiga: { prog: { nivel: 33 }, t: 1 } });
  const n = s5.resetTerrenos();
  ok(n === 1 && !s5.lotes.has('tdario') && s5.npcSalvos.get('dario')?.prog.nivel === 33, 'a casa do Dario na vila sai e o progresso dele fica');
  s5.passoClasNpc(); s5.passoBasesNpc();
  const Ld = dario.loteDaAmiga(), Lc = ce.loteDaAmiga(), bc5 = s5.basesCla.nchama;
  ok(Ld?.def.baseK === bc5?.k && Ld.def.id.endsWith('_1'), 'o Dario (líder) ganha o lote 1 da base da Guarda da Chama');
  ok(!Lc || Lc.def.baseK === bc5.k, 'a Cecília só tem casa no lote dela da base');
  ok([...s5.lotes.values()].every((L) => !L.dono || L.def.baseK), 'nenhuma casa fora das bases');
}

// a prévia de escolher o lugar (André 2026-11-22: "pode escolher exatamente onde a gente quer posicionar")
{
  const s6 = new Simulacao(MAPA_CLAREIRA);
  const d = s6.adicionarJogador('D', 'Davi', undefined, { conta: 6 }); d.criando = false; d.ciente = true;
  s6.cla('D', { acao: 'fundar', nome: 'Previa' });
  const T = TOTENS.lista[0]; d.x = T.x + 3; d.z = T.z; s6.eventos = [];
  s6.cla('D', { acao: 'baseVer' });
  let v = s6.eventos.find((e) => e.t === 'baseVer');
  ok(v && !v.ok && /totem/.test(v.motivo) && !s6.baseDe(d), 'a prévia diz que perto do totem não pode e não funda');
  const p = acharLugarBase(-6, 1, 'chama', []); d.x = p.x; d.z = p.z; s6.eventos = [];
  s6.cla('D', { acao: 'baseVer' });
  v = s6.eventos.find((e) => e.t === 'baseVer');
  ok(v?.ok && v.x === p.x && !s6.baseDe(d), 'a prévia mostra verde onde pode, sem fundar');
}

// escolher no mapa: funda longe do herói, no ponto marcado
{
  const s7 = new Simulacao(MAPA_CLAREIRA);
  const e = s7.adicionarJogador('E', 'Eva', undefined, { conta: 7 }); e.criando = false; e.ciente = true;
  s7.cla('E', { acao: 'fundar', nome: 'Longe' });
  const p = acharLugarBase(-6, 1, 'chama', []); e.x = p.x + 300; e.z = p.z + 300; s7.eventos = [];
  s7.cla('E', { acao: 'baseVer', x: p.x, z: p.z });
  ok(s7.eventos.find((o) => o.t === 'baseVer')?.ok, 'a prévia confere o ponto marcado no mapa');
  s7.cla('E', { acao: 'base', x: p.x, z: p.z });
  ok(s7.baseDe(e)?.x === p.x && s7.baseDe(e)?.z === p.z, 'funda no ponto marcado no mapa, longe do herói');
}

// realocar a base (André 2026-11-22): a 1ª grátis e leva o lote com as peças; a 2ª paga e espera
{
  const s8 = new Simulacao(MAPA_CLAREIRA), av = () => s8.eventos.filter((o) => o.t === 'aviso').map((o) => o.texto).join(' | ');
  const f = s8.adicionarJogador('F', 'Fabi', undefined, { conta: 8 }); f.criando = false; f.ciente = true; f.prog.nivel = 40; f.prog.ouro = 1000;
  s8.cla('F', { acao: 'fundar', nome: 'Muda' });
  const p = acharLugarBase(-6, 1, 'chama', []);
  s8.cla('F', { acao: 'base', x: p.x, z: p.z });
  const L = s8.loteDe(f); f.x = (L.def.x0 + L.def.x1) / 2; f.z = (L.def.z0 + L.def.z1) / 2;
  f.prog.mochila.fill(null); f.prog.mochila[0] = { k: 'obra_bau', n: 1 };
  s8.construir('F', { k: 'bau', x: L.def.x0 + 2, z: L.def.z0 + 2, r: 0 });
  const peca = L.pecas.find((o) => o.k === 'bau'), x0 = peca?.x;
  const q = acharLugarBase(p.x + 160, p.z, 'chama', Object.values(s8.basesCla));
  s8.eventos = []; s8.cla('F', { acao: 'mudarBase', x: q.x, z: q.z });
  const B = s8.baseDe(f);
  ok(B.x === q.x && B.z === q.z && peca && peca.x === x0 + (q.x - p.x), 'a 1ª mudança é grátis e o lote vai junto com as peças');
  s8.eventos = []; s8.cla('F', { acao: 'mudarBase', x: p.x, z: p.z });
  ok(/só pode mudar de novo/.test(av()) && B.x === q.x, 'a 2ª espera os dias');
  B.mudouEm -= 8 * 86400000; f.prog.cla.cofre = 500; s8.eventos = []; s8.cla('F', { acao: 'mudarBase', x: p.x, z: p.z });
  ok(/custa 10000/.test(av()) && B.x === q.x, 'depois dos dias: paga do cofre');
  f.prog.cla.cofre = 12000; s8.cla('F', { acao: 'mudarBase', x: p.x, z: p.z });
  ok(B.x === p.x && f.prog.cla.cofre === 2000, 'pagou e mudou');
}

// o servidor de verdade (server/index.js) passa x, z e mudar do mapa (até 2026-11-22 cortava e ficava "Conferindo...")
{
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../server/index.js', import.meta.url), 'utf8');
  ok(/this\.ouvir\('cla'[^\n]*x: \+m\.x, z: \+m\.z[^\n]*mudar: m\.mudar === true/.test(src), 'o servidor repassa o ponto do mapa (x, z) e o mudar');
}

// chão nivelado e estrada (André 2026-11-23: "nivelar-se um pouco o terreno"; "uma estrada criada automaticamente para
// a estrada mais próxima"; "caso mude o lugar da base, o terreno volta a ser como era")
{
  const { alturaMontanha, alturaMontanhaOrig } = await import('../../shared/relevo.js');
  const s9 = new Simulacao(MAPA_CLAREIRA);
  const g = s9.adicionarJogador('G', 'Gabi', undefined, { conta: 9 }); g.criando = false; g.ciente = true; g.prog.nivel = 40;
  s9.cla('G', { acao: 'fundar', nome: 'Plano' });
  const p = acharLugarBase(-420, -330, 'chama', []); // nas terras do mundo grande (o mapa de hoje não nivela)
  const antes = alturaMontanha(p.x + 20, p.z - 20);
  s9.cla('G', { acao: 'base', x: p.x, z: p.z });
  const C = s9.chaoBases[s9.baseDe(g).k];
  let mx = 0; for (let dx = -30; dx <= 30; dx += 5) for (let dz = -30; dz <= 30; dz += 5) mx = Math.max(mx, Math.abs(alturaMontanha(p.x + dx, p.z + dz) - C.y));
  ok(C.y != null && mx < 0.6, `o chão da base fica nivelado (desvio ${mx.toFixed(2)} m, com a ondinha)`);
  ok(C.estrada.length > 3, `a base ganha estrada até a estrada mais perto (${C.estrada.length} pontos)`);
  let sl = 0; for (let i = 1; i < C.estrada.length; i++) { const a = C.estrada[i - 1], b = C.estrada[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d > 0.5) sl = Math.max(sl, Math.abs(b[2] - a[2]) / d); }
  ok(sl < 0.3, `a estrada não tem rampa de penhasco (${(sl * 100).toFixed(0)}% no pior trecho)`);
  const d = s9.dadosBase(s9.baseDe(g));
  ok(d.chao?.y === C.y && d.chao.estrada.length === C.estrada.length * 3, 'o app recebe o platô e a estrada');
  // 6 mudanças grátis (André 2026-11-23, só para testes)
  s9.baseDe(g).livres = 6; s9.baseDe(g).mudou = 1; s9.baseDe(g).mudouEm = Date.now(); g.prog.cla.cofre = 0;
  const q = acharLugarBase(p.x + 160, p.z, 'chama', Object.values(s9.basesCla));
  s9.cla('G', { acao: 'mudarBase', x: q.x, z: q.z });
  ok(s9.baseDe(g).x === q.x && s9.baseDe(g).livres === 5, 'mudança grátis dada à mão: sem custo e sem espera');
  ok(Math.abs(alturaMontanha(p.x + 20, p.z - 20) - antes) < 0.01 && Math.abs(alturaMontanhaOrig(p.x, p.z) - alturaMontanha(p.x, p.z)) < 0.01, 'a base saiu: o chão velho voltou como era');
  // a fornalha da forja (Nv 4+)
  s9.baseDe(g).nv = 4; s9.refazerBases(); const D = s9.basesDesenho[s9.baseDe(g).k];
  g.x = D.forja.fx; g.z = D.forja.fz + 1; s9.eventos = []; s9.forno('G', { acao: 'abrir', p: 'base_fornalha' });
  ok(s9.eventos.some((e) => e.t === 'forno' && e.p === 'base_fornalha'), 'a fornalha da forja do clã abre');
  ok(D.forja.z - D.forja.fz > 3, 'a bigorna fica na frente do galpão, fora dele');
  s9.basesCla = {}; s9.refazerBases(); // devolve o chão para os outros testes
}

// a casinha do topo leva para a base (André 2026-11-23: "O botão casa agora vai pra a base")
{
  const s10 = new Simulacao(MAPA_CLAREIRA);
  const h = s10.adicionarJogador('H', 'Hugo', undefined, { conta: 10 }); h.criando = false; h.ciente = true; h.chao = true;
  s10.cla('H', { acao: 'fundar', nome: 'Casa' });
  const p = acharLugarBase(-420, -330, 'chama', []);
  s10.cla('H', { acao: 'base', x: p.x, z: p.z });
  h.x = p.x + 200; h.z = p.z + 200;
  s10.chegarNaVila(h);
  const D = s10.basesDesenho[s10.baseDe(h).k];
  ok(Math.hypot(h.x - D.bau.x, h.z - D.bau.z - 2.5) < 3, 'a casinha leva para a porta do salão da base');
  s10.basesCla = {}; s10.refazerBases();
}
