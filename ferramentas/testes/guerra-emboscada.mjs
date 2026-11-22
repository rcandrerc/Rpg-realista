// Conflito Chama x Geada (André 2026-11-21): zonas seguras novas, alerta e ataque a 25 m, fugir ou terminar com pouca
// vida, proteção de 2 min depois de cair, montaria em combate, emboscada a quem leva pack (carrinho e navio), pack
// roubado (+25%), vida do carrinho (2500) e do navio (6000), tanque de 50 galões e a ronda de cada raça.
// Uso: node ferramentas/testes/guerra-emboscada.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { GUERRA, VEICULOS, TOTENS, RACAS, PACKS } from '../../shared/dados.js';
import { carrinhoValido, navioValido, precoPack, lugarDoVeiculo, fundoAgua } from '../../shared/transporte.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const d = s.adicionarJogador('andre', 'André', 'ruiva', {}); d.conta = 'c1';
for (const x of s.amigosIa) x.amigaEntrar('andre');
const evs = []; { const ev = s.evento.bind(s); s.evento = (e) => { evs.push(e); return ev(e); }; } // s.eventos zera a cada passo
const ctx = (id) => s.amigoIaDe(id), kira = ctx('kira').amiga, rufo = ctx('rufo').amiga, lis = ctx('lis').amiga;
const nivel = (j, n) => { j.prog.nivel = n; s.aplicarStatus(j); j.vida = j.vidaMax; };
const por = (j, x, z) => Object.assign(j, { x, z, y: s.terreno.altura(x, z), vy: 0, chao: true });
const passos = (seg, f) => { for (let i = 0; i < seg * 20; i++) { f?.(); s.passo(0.05); } };
const v5 = s.cacas.find((c) => c.def.id === 'c_v5').def;
const longe = (j) => por(j, RACAS.geada.casa.x, RACAS.geada.casa.z); // no Juncal (seguro), fora do caminho

// ---------- zonas seguras ----------
const merc = s.mapa.npcs.find((n) => n.funcao === 'pack' && n.id === 'm_couro');
ok(s.zonaSeguraGuerra(merc.x + 8, merc.z) && !s.zonaSeguraGuerra(merc.x + 20, merc.z), 'mercador de pack: seguro a 8 m, guerra a 20 m');
const cais = s.mapa.cais[0];
ok(s.zonaSeguraGuerra(cais.x + 20, cais.z) && !s.zonaSeguraGuerra(cais.x + 45, cais.z), 'cais de embarque: seguro a 20 m, guerra a 45 m');
ok(s.zonaSeguraGuerra(-6, -18) && s.zonaSeguraGuerra(TOTENS.lista[2].x + 20, TOTENS.lista[2].z), 'perto do totem da Clareira e de outro totem é seguro');
// André 2026-11-22: vila não é mais zona segura; só o totem (25 m) e o terreno do próprio jogador
{ const T = TOTENS.lista.find((t) => t.id === 'rio_claro');
  ok(!s.zonaSeguraGuerra(T.x + 45, T.z) && !s.zonaSeguraGuerra(-6, -40), 'dentro da vila (Rio Claro a 45 m do totem, Vila da Clareira longe da praça) é guerra');
  s.lotes.set('t_teste', { def: { id: 't_teste', x0: 300, x1: 320, z0: 200, z1: 220 }, dono: 'c1', pecas: [], horta: {} });
  const outro = { conta: 'c9' };
  ok(s.zonaSeguraGuerra(310, 210, d) && !s.zonaSeguraGuerra(310, 210, outro) && !s.zonaSeguraGuerra(310, 210), 'terreno: seguro só para o dono');
  s.lotes.delete('t_teste'); }
ok(!s.zonaSeguraGuerra(v5.x, v5.z), 'campo Nv 45 é guerra');

// ---------- agro a 25 m e alerta ----------
for (const b of [kira, rufo, lis]) { longe(b); b.ia.guerra = null; }
nivel(d, 45); nivel(rufo, 42); por(d, v5.x, v5.z); por(rufo, v5.x + 32, v5.z);
s.guerraT = 0; passos(1.5, () => { d.entrada = { mx: 0, mz: 0 }; });
ok(rufo.ia.guerra?.alvo !== d.id, 'a 32 m o Rufo ainda não ataca');
const ev0 = evs.length;
por(rufo, v5.x + 20, v5.z); rufo.ia.guerra = null; passos(1.5, () => { d.entrada = { mx: 0, mz: 0 }; });
ok(rufo.ia.guerra?.alvo === d.id, 'a 20 m o Rufo parte pro ataque');
ok(evs.slice(ev0).some((e) => e.t === 'aviso' && e.para === d.id && /Rufo \(Geada\) a \d+ m/.test(e.texto)), 'alerta pro André: "Rufo (Geada) a N m"');

// ---------- fugir ou terminar ----------
const cr = ctx('rufo');
rufo.vida = rufo.vidaMax * 0.2; d.vida = d.vidaMax * 0.1;
ok(!cr.fogeOuTerminaAmiga(rufo, d), 'Rufo com 20% e o André com 10%: tenta terminar');
d.vida = d.vidaMax * 0.6;
ok(cr.fogeOuTerminaAmiga(rufo, d), 'Rufo com 20% e o André com 60%: foge');
d.vida = d.vidaMax * 0.3;
ok(!cr.fogeOuTerminaAmiga(rufo, d), 'André com 30% (entre os dois): continua');
rufo.vida = rufo.vidaMax * 0.5; d.vida = d.vidaMax * 0.9;
ok(!cr.fogeOuTerminaAmiga(rufo, d), 'com 50% de vida não pensa em fugir');

// ---------- montaria em combate ----------
d.vida = d.vidaMax; rufo.vida = rufo.vidaMax;
longe(rufo); rufo.ia.guerra = null; if (d.morto) passos(8); d.protGuerraAte = 0; por(d, v5.x, v5.z); por(rufo, v5.x + 2, v5.z); s.guerraT = 0; s.passo(0.05);
d.montado = 'lobo'; s.ferir(d, 10, rufo);
ok(!d.montado, 'apanhou montado: caiu do lobo');
d.trava = 0; s.montar(d.id);
ok(!d.montado && evs.some((e) => e.para === d.id && /Em combate: espere \d+ s/.test(e.texto || '')), 'em combate não monta (espera 10 s)');
passos(GUERRA.montaria + 0.5, () => { por(rufo, RACAS.geada.casa.x, RACAS.geada.casa.z); rufo.ia.guerra = null; d.entrada = { mx: 0, mz: 0 }; });
s.montar(d.id); ok(d.montado === 'lobo', 'depois de 10 s monta de novo'); d.montado = null;

// ---------- proteção depois de cair (desligada: GUERRA.protecao 0; a regra continua testada) ----------
if (d.morto) passos(8);
rufo.ia.guerra = null; nivel(rufo, 42); nivel(d, 45); d.protGuerraAte = 0; por(d, v5.x, v5.z); por(rufo, v5.x + 2, v5.z); s.guerraT = 0; s.passo(0.05);
s.ferir(d, 1e7, rufo); ok(d.morto, 'André caiu');
passos(8, () => { longe(rufo); rufo.ia.guerra = null; });
ok(!d.morto && !s.protegido(d), 'levantou sem proteção (GUERRA.protecao 0, André 2026-11-22)');
d.protGuerraAte = s.tempo + 120; // a regra da proteção continua no código (GUERRA.protecao > 0 liga de novo)
por(d, v5.x, v5.z); por(rufo, v5.x + 2, v5.z); s.guerraT = 0; s.passo(0.05);
const vp = d.vida; s.ferir(d, 50, rufo);
ok(d.vida === vp && !s.inimigosDe(rufo).includes(d), 'protegido: o golpe da Geada não pega e ele não é alvo');
ok(s.inimigosDe(d).includes(rufo), 'mas ele pode atacar');
const vr = rufo.vida; s.ferir(rufo, 30, d);
ok(rufo.vida < vr && !s.protegido(d), 'atacou: o golpe pega e a proteção acaba');
longe(rufo); rufo.ia.guerra = null;

// ---------- vida dos veículos e tanque ----------
ok(VEICULOS.carrinho.vida === 2500 && VEICULOS.navio.vida === 6000 && VEICULOS.carrinho.tanque === 50, 'carrinho 2500, navio 6000, tanque de 50 galões');
const velho = carrinhoValido({ lv: 2, vida: 200, comb: 9000, packs: [] });
ok(velho.vida === 1250 && velho.comb === 8000, `carrinho gravado com 200/400 vira 1250/2500 (${velho.vida}); combustível até 50 galões`);
ok(carrinhoValido({ vida: 2500, vm: 2500 }).vida === 2500, 'o carrinho novo (vm 2500) fica igual');
const nav0 = navioValido({ porao: [], chao: null });
ok(nav0.vida === 6000 && !nav0.quebrado, 'navio sem casco gravado nasce com 6000');

// ---------- emboscada no carrinho ----------
const E = GUERRA.emboscada;
for (const b of [kira, rufo, lis]) { longe(b); b.ia.guerra = null; nivel(b, 44); b.protGuerraAte = 0; }
d.protGuerraAte = 0; nivel(d, 45);
// um ponto de terra em guerra, longe de mercador/totem
let px = v5.x + 40, pz = v5.z; ok(!s.zonaSeguraGuerra(px, pz) && lugarDoVeiculo('carrinho', px, pz), 'lugar da viagem: terra, zona de guerra');
por(d, px, pz); d.prog.carrinho = { ...carrinhoValido({ vida: 2500, vm: 2500 }), lv: 2, comb: 5000, packs: [{ k: 'couro', ox: 0, oz: 0, ra: 'chama' }, { k: 'couro', ox: 0, oz: 0, ra: 'chama' }], chao: null };
d.veiculo = 'carrinho';
s.guerraT = 0; s.passo(0.05);
ok(s.cargaGuerra(d) === 'carrinho', 'dirigindo com packs: carga = carrinho');
const ev1 = evs.length;
ok(s.iniciarEmboscada(d, 'carrinho'), 'emboscada começou');
const vieram = [kira, rufo, lis].filter((b) => b.ia.guerra?.emb?.dono === d.id);
ok(vieram.length >= 2 && vieram.every((b) => Math.hypot(b.x - d.x, b.z - d.z) > 25 && Math.hypot(b.x - d.x, b.z - d.z) < 45), `${vieram.length} bots chegaram de longe (~35 m)`);
ok(evs.slice(ev1).some((e) => e.para === d.id && /Emboscada!/.test(e.texto || '')), 'aviso de emboscada pro André');
ok(s.emboscadaAtiva(d), 'emboscada ativa');
s.veiculo(d.id, { acao: 'recolher' });
ok(d.prog.carrinho.packs.length === 2 && d.veiculo === 'carrinho', 'em emboscada não dá pra guardar o carrinho (os packs não somem)');
// o André desce e fica parado (não defende): eles quebram o carrinho, pegam os packs e fogem
s.veiculo(d.id, { acao: 'descer' }); por(d, px + 30, pz + 30); d.protGuerraAte = s.tempo + 1e6; // longe e protegido: só o carrinho apanha
const c = d.prog.carrinho; c.vida = 300;
for (let i = 0; i < 20 * 40 && !c.quebrado; i++) { d.entrada = { mx: 0, mz: 0 }; d.vida = d.vidaMax; s.passo(0.05); }
passos(6, () => { d.entrada = { mx: 0, mz: 0 }; });
ok(c.quebrado, `quebraram o carrinho (vida ${c.vida})`);
const ladroes = [kira, rufo, lis].filter((b) => b.prog.pack && b.ia.packRoubo);
ok(ladroes.length >= 1 && ladroes.every((b) => b.prog.pack.rb === 1), `${ladroes.length} pegaram pack e é roubado pra eles`);
ok(!s.packsChao.some((o) => Math.hypot(o.x - c.chao.x, o.z - c.chao.z) < 22) || ladroes.length === 2, 'os packs saíram do chão');
// derrubar o ladrão: o pack cai; o André pega o dele de volta (não é roubado)
const L = ladroes[0]; d.protGuerraAte = 0; s.guerraT = 0; s.passo(0.05);
const gx = L.x, gz = L.z;
s.ferir(L, 1e7, d); ok(L.morto, 'derrubou o ladrão');
const caiu = s.packsChao.find((o) => Math.hypot(o.x - gx, o.z - gz) < 3);
ok(caiu && caiu.ra === 'chama', 'o pack caiu no chão (ainda é da Chama)');
d.veiculo = null; por(d, caiu.x, caiu.z + 1); s.pack(d.id, { acao: 'pegar', g: caiu.g });
ok(d.prog.pack && !d.prog.pack.rb, 'pegou o seu de volta: não conta como roubado');
// pack da Geada nas mãos da Chama: roubado, +25%
const pg = { k: 'couro', ox: 0, oz: 0, ra: 'geada' }; d.prog.pack = null; s.packNoChao(pg, d.x, d.z);
s.pack(d.id, { acao: 'pegar', g: s.packsChao[s.packsChao.length - 1].g });
ok(d.prog.pack?.rb === 1, 'pegou pack da Geada: roubado');
const n2 = s.mapa.npcs.find((n) => n.id === 'm_peixe'); por(d, n2.x + 1, n2.z);
const p0 = precoPack(d.prog.pack, n2, d.prog.prof.mer), o0 = d.prog.ouro || 0;
s.pack(d.id, { acao: 'entregar', npc: n2.id, de: 'costas' });
const ganhou = (d.prog.ouro || 0) - o0;
ok(ganhou >= Math.round(p0 * 1.2) && ganhou > 0, `entregou pack roubado com bônus: ${ganhou} (base ${p0})`);
for (const b of [kira, rufo, lis]) { b.ia.guerra = null; b.ia.packRoubo = null; b.prog.pack = null; }
passos(8);

// ---------- emboscada no navio ----------
// um ponto de mar fundo em guerra
let mar = null;
for (let x = 300; x < 700 && !mar; x += 10) for (let z = 420; z < 520 && !mar; z += 10) if (fundoAgua(x, z) >= VEICULOS.navio.fundo && !s.zonaSeguraGuerra(x, z)) mar = { x, z };
ok(mar, 'achou mar aberto (guerra)');
for (const b of [kira, rufo, lis]) { if (b.morto) passos(8); longe(b); b.ia.guerra = null; b.protGuerraAte = 0; b.vida = b.vidaMax; }
d.prog.pack = null; d.prog.navio = { ...navioValido({}), porao: [{ k: 'couro', ox: 0, oz: 0, ra: 'chama' }, { k: 'couro', ox: 0, oz: 0, ra: 'chama' }, { k: 'couro', ox: 0, oz: 0, ra: 'chama' }], chao: null };
Object.assign(d, { x: mar.x, z: mar.z, y: 0, veiculo: 'navio', ry: 0 }); d.protGuerraAte = s.tempo + 1e6;
s.guerraT = 0; s.passo(0.05);
ok(s.cargaGuerra(d) === 'navio' && s.iniciarEmboscada(d, 'navio'), 'emboscada no navio');
const abordo = [kira, rufo, lis].filter((b) => b.ia.guerra?.emb?.dono === d.id);
passos(1, () => { d.entrada = { mx: 0, mz: 0 }; });
ok(abordo.every((b) => s.aBordo(b.x, b.z) && Math.abs(b.y - 0.9) < 1.5), 'subiram no convés');
const n = d.prog.navio; n.vida = 200;
passos(20, () => { d.entrada = { mx: 0, mz: 0 }; });
ok(n.quebrado && !d.veiculo && n.chao, 'navio avariado: parou e o André saiu do leme');
ok(n.porao.length < 3 && abordo.some((b) => b.prog.pack?.rb === 1), `saquearam o porão (sobrou ${n.porao.length})`);
ok(abordo.filter((b) => b.prog.pack).every((b) => !s.aBordo(b.x, b.z) && fundoAgua(b.x, b.z) <= 0.05), 'pularam no mar e fugiram por terra');
s.veiculo(d.id, { acao: 'subir', k: 'navio' }); ok(d.veiculo !== 'navio', 'navio avariado não zarpa');
d.prog.mochila[0] = { k: 'lenha', n: 40 }; d.prog.mochila[1] = { k: 'barra_ferro', n: 10 }; n.danoT = -1e9; d.pvpT = -1e9;
Object.assign(d, { x: n.chao.x, z: n.chao.z });
s.veiculo(d.id, { acao: 'consertar_navio' });
ok(!n.quebrado && n.vida === 6000, 'consertou o navio (30 lenha + 4 barras de ferro)');

// ---------- ronda ----------
for (const b of [kira, rufo, lis]) { if (b.morto) passos(8); b.ia.guerra = null; b.ia.packRoubo = null; b.prog.pack = null; longe(b); }
d.veiculo = null; por(d, 0, 1);
s.rondaT = { geada: s.tempo, chama: s.tempo + 1e6 }; s.passoRondas();
const ronda = [kira, rufo, lis].filter((b) => b.ia.guerra?.ronda);
ok(ronda.length >= 2, `${ronda.length} da Geada saíram de ronda`);
const p00 = ronda.map((b) => [b.x, b.z]);
passos(30);
ok(ronda.some((b, i) => Math.hypot(b.x - p00[i][0], b.z - p00[i][1]) > 20 || b.ia.guerra?.ronda?.i > 0), 'andando pela rota');
ok(s.rondaT.geada > s.tempo + GUERRA.ronda.entre[0] - 40, 'a próxima ronda da Geada fica para daqui a 30-60 min');

// ---------- André 2026-11-22: carrinho pode ser atacado mesmo com o dono no Nv 30 ou menos (o dono e o pack nas costas não) ----------
{
  const s5 = new Simulacao(MAPA_CLAREIRA);
  const b = s5.adicionarJogador('bia', 'Bia', 'ruiva', {}); b.conta = 'c5'; b.prog.nivel = 12; s5.aplicarStatus(b);
  const c5 = s5.cacas.find((c) => c.def.id === 'c_v5').def, bx = c5.x + 40, bz = c5.z;
  Object.assign(b, { x: bx, z: bz, y: s5.terreno.altura(bx, bz) });
  const ch = GUERRA.emboscada.chance; GUERRA.emboscada.chance = 1;
  b.prog.pack = { k: 'couro', ox: 0, oz: 0, ra: 'chama' };
  s5.passoEmboscadas(); ok(!b.embQuando, 'Nv 12 com pack nas costas: sem emboscada');
  b.prog.pack = null; b.embViagem = false;
  b.prog.carrinho = { ...carrinhoValido({ vida: 2500, vm: 2500 }), lv: 2, comb: 5000, packs: [{ k: 'couro', ox: 0, oz: 0, ra: 'chama' }], chao: null }; b.veiculo = 'carrinho';
  s5.passoEmboscadas(); ok(!!b.embQuando, 'Nv 12 dirigindo carrinho fora da zona segura: a emboscada vem');
  ok(!s5.podeGuerra(b) && !s5.emGuerra(s5.amigoIaDe('kira').amiga, b), 'o dono Nv 12 continua na Trégua (ninguém bate nele)');
  b.embViagem = false; b.embQuando = null; const T0 = TOTENS.lista[0]; Object.assign(b, { x: T0.x + 5, z: T0.z });
  s5.passoEmboscadas(); ok(!b.embQuando, 'carrinho perto do totem (zona segura): sem emboscada');
  GUERRA.emboscada.chance = ch;
}
