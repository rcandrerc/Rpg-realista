// Ordens de pack pela barra do time (André 2026-11-23, PACK_TIME): De → Pra, o bot anda cada trecho, um pack por vez.
// Uso: node ferramentas/testes/pack-ordem.mjs
import { Simulacao, MAPA_CLAREIRA, PACK_TIME } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar?.('andre', true); s.passo(0.05);
const ev = [], orig = s.evento.bind(s); s.evento = (e) => { ev.push(e); orig(e); };
const dario = s.amigosIa.find((x) => x.AMIGA.id === 'dario'), d = dario.amiga;
d.amigosDe = { [j.conta]: 1 };
const npc = (id) => MAPA_CLAREIRA.npcs.find((n) => n.id === id), joca = npc('m_lenha'), pedrao = npc('m_pedra');
// André e o carrinho perto do Pedrão; packs de lenha (feitos no Joca) no chão a 9 m do carrinho
const cx = pedrao.x + 6, cz = pedrao.z + 2;
Object.assign(j, { x: cx + 2, z: cz, y: 0, criando: false, morto: false });
Object.assign(d, { x: cx + 3, z: cz + 1 });
ok(dario.entrarTimeAmiga(d, j), 'Dario entra no time');
j.prog.carrinho = { lv: 2, comb: 50, vida: 2500, quebrado: false, packs: [], chao: { x: cx, z: cz, ry: 0 } };
for (let i = 0; i < 3; i++) s.packNoChao({ k: 'lenha', ox: Math.round(joca.x), oz: Math.round(joca.z), mo: 'm_lenha', ra: 'chama' }, cx + 9, cz + i * 0.8);
// passo a passo: guarda onde o Dario estava cada vez que o carrinho ganhou um pack e o maior salto por passo
let maxSalto = 0, andou = 0, longeCarrinho = 0;
const esp = (t, cada) => { for (let i = 0; i < t * 20; i++) { const x0 = d.x, z0 = d.z, n0 = j.prog.carrinho.packs.length; s.passo(0.05);
  const sl = Math.hypot(d.x - x0, d.z - z0); maxSalto = Math.max(maxSalto, sl); andou += sl;
  if (j.prog.carrinho.packs.length > n0) longeCarrinho = Math.max(longeCarrinho, Math.hypot(d.x - cx, d.z - cz)); cada?.(); } };
s.ordemPackTime('andre', { de: 'palete', pra: 'palete', para: '*' }); ok(!d.ia.packOrdem, 'De e Pra iguais: não vale');
s.ordemPackTime('andre', { de: 'palete', pra: 'carrinho', para: '*' });
ok(d.ia.packOrdem?.de === 'palete' && d.ia.packOrdem.pra === 'carrinho', 'Time todo: Palete/chão → Carrinho');
esp(60);
ok(j.prog.carrinho.packs.length === 3 && !s.packsChao.length, `os 3 packs do chão foram pro carrinho (${j.prog.carrinho.packs.length})`);
ok(longeCarrinho <= PACK_TIME.perto.carrinho + 0.3, `pôs no carrinho de perto (${longeCarrinho.toFixed(1)} m)`);
ok(andou > 3 * 2 * 4, `andou de verdade: ${andou.toFixed(0)} m (3 idas e voltas de ~4,5 m entre o alcance do pack e o do carrinho)`);
ok(maxSalto < 0.5, `sem teleporte (maior passo ${maxSalto.toFixed(2)} m em 0,05 s)`);
ok(!d.ia.packOrdem && /Pronto/.test(d.ia.funcaoSt?.txt || ''), 'acabou a origem: para sozinho');
// Carrinho → Mercador: ouro no cofre do clã
j.prog.cla = { n: 'Brasa', c: Date.now(), cofre: 100, sem: Date.now() + 1e9, m: [], log: [], nv: 1 };
const ouro0 = j.prog.ouro | 0;
s.tempo += 5; s.ordemPackTime('andre', { de: 'carrinho', pra: 'mercador', para: d.id });
let longeMerc = 0, nev = ev.length; esp(90, () => { for (; nev < ev.length; nev++) if (ev[nev].t === 'aviso' && /entregou um pack/.test(ev[nev].texto)) longeMerc = Math.max(longeMerc, Math.hypot(d.x - pedrao.x, d.z - pedrao.z)); });
ok(!j.prog.carrinho.packs.length && j.prog.cla.cofre > 100, `Carrinho → Mercador: entregou os 3, cofre ${j.prog.cla.cofre}`);
ok((j.prog.ouro | 0) === ouro0, 'o ouro foi pro cofre do clã, não pra bolsa');
ok(longeMerc > 0 && longeMerc <= PACK_TIME.perto.mercador + 0.3, `entregou do lado do mercador (${longeMerc.toFixed(1)} m)`);
ok(j.prog.cla.log.some((l) => /Pack entregue por Dario/.test(l.txt)), 'aparece no registro do clã');
// Parar
j.prog.carrinho.packs.push({ k: 'lenha', ox: Math.round(joca.x), oz: Math.round(joca.z), ra: 'chama' });
s.ordemPackTime('andre', { de: 'carrinho', pra: 'palete', para: '*' }); ok(!!d.ia.packOrdem, 'nova ordem');
s.ordemPackTime('andre', { de: 'parar', pra: '', para: '*' }); ok(!d.ia.packOrdem, 'Parar desfaz');
s.ordemPackTime('andre', { de: 'carrinho', pra: 'palete', para: '*' }); s.tempo += 2; s.comandoTime('andre', { c: 'segue', para: d.id });
ok(!d.ia.packOrdem, 'Me segue também desfaz a ordem de pack');
// Carrinho → Palete/chão sem palete do clã por perto: larga no chão do lado do dono
s.tempo += 2; s.packsChao = [];
s.ordemPackTime('andre', { de: 'carrinho', pra: 'palete', para: d.id }); esp(40);
ok(!j.prog.carrinho.packs.length && s.packsChao.length === 1 && Math.hypot(s.packsChao[0].x - j.x, s.packsChao[0].z - j.z) < 3, 'sem palete: largou no chão do lado do André');
