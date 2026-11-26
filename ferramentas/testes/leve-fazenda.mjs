// Jogo leve, etapa 6 (André 2026-11-26): pescar no spot à vista e a aba Fazenda (grade do terreno/base) com as mesmas
// mensagens e regras do jogo. Uso: node ferramentas/testes/leve-fazenda.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { acharLugarBase } from '../../shared/base.js';
import { PESCA } from '../../shared/dados.js';
import { noLago } from '../../shared/relevo.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.prog.ouro = 90000; a.prog.nivel = 40; a.leve = true;
// ---- pesca: um spot ativo de lago; o herói longe dele (dentro de 40 m) anda até a beira e lança sozinho ao chegar
for (let i = 0; i < 400 && !s.spots.some((v) => v.ativo && v.agua !== 'mar'); i++) s.passo(0.5);
const sp = s.spots.find((v) => v.ativo && v.agua !== 'mar');
ok(!!sp, 'tem spot de pesca ativo');
a.prog.mochila[0] = { k: 'vara', n: 1 };
s.inimigos.length = 0; // sem monstros: o teste é da pesca, não da luta
// um ponto seco a uns 25 m do spot
let ini = null; for (let k = 0; k < 64 && !ini; k++) { const g = k / 64 * Math.PI * 2, x = sp.x + Math.cos(g) * 25, z = sp.z + Math.sin(g) * 25; if (!noLago(x, z)) ini = { x, z }; }
a.x = ini.x; a.z = ini.z;
ok(s.fotoLeve(a).sp != null, `foto mostra o spot (${s.fotoLeve(a).sp} m)`);
const avisos = []; { const o = s.evento.bind(s); s.evento = (e) => { if (e.para === 'A' && e.t === 'aviso') avisos.push(e.texto); return o(e); }; }
s.levePescar('A');
ok(a.leveRota?.spot === sp.id, 'Pescar longe: anda até a beira');
for (let i = 0; i < 4000 && !a.pesca; i++) s.passo(1 / 20);
ok(a.pesca && Math.hypot(a.pesca.x - sp.x, a.pesca.z - sp.z) <= PESCA.raioSpot + 0.4, `chegou e lançou no spot (${a.pesca?.st || avisos.join(' | ')} em ${a.x.toFixed(1)},${a.z.toFixed(1)} spot ${sp.x.toFixed(1)},${sp.z.toFixed(1)})`);
ok(s.fotoLeve(a).pe?.[0], `foto mostra a pesca (${s.fotoLeve(a).pe?.[0]})`);
s.pescar('A', { acao: 'parar' });
// longe de tudo, sem radar: nada à vista
a.x = 0; a.z = -400; a.leveRota = null;
const vis = s.spotsLeve(a); ok(vis.every(([, d]) => d <= 40), 'sem Radar só vê spots a 40 m');
// ---- fazenda: base do clã
const pc = acharLugarBase(-6, 1, 'chama', Object.values(s.basesCla)); a.morto = false; a.vida = a.vidaMax;
a.x = pc.x; a.z = pc.z;
s.cla('A', { acao: 'fundar', nome: 'Ruivas' }); a.prog.cla.nv = 3; s.cla('A', { acao: 'base' });
const L = s.loteDe(a);
ok(!!L, `tem lote (base) ${avisos.slice(-3).join(' | ')}`);
let Z = s.fazendaLeve(a);
ok(Z.ret && Z.ret[2] > Z.ret[0] && Array.isArray(Z.pc) && Array.isArray(Z.cons) && Z.cons.length > 5, `grade ${Z.ret[2] - Z.ret[0]} x ${Z.ret[3] - Z.ret[1]} m, ${Z.pc.length} peças`);
a.prog.mochila[1] = { k: 'enxada', n: 1 }; a.prog.mochila[2] = { k: 'semente_rabanete', n: 3 };
a.x = (L.def.x0 + L.def.x1) / 2; a.z = (L.def.z0 + L.def.z1) / 2;
Z = s.fazendaLeve(a);
ok(Z.perto === 1 && Z.en === 1 && Z.se.length === 1, 'perto, com enxada e semente');
let arou = null;
for (let i = Math.floor(L.def.x0) + 1; i < L.def.x1 - 1 && !arou; i++) for (let k = Math.floor(L.def.z0) + 1; k < L.def.z1 - 1 && !arou; k++) { s.horta('A', { acao: 'arar', c: `${i},${k}` }); if (L.horta[`${i},${k}`]) arou = `${i},${k}`; }
ok(!!arou, `arou ${arou}`);
s.horta('A', { acao: 'plantar', c: arou, s: 'rabanete' });
Z = s.fazendaLeve(a);
const h = Z.h.find((o) => o[0] === arou);
ok(h && h[1] === 'rabanete' && h[2] === 0, 'a grade mostra o rabanete plantado');
