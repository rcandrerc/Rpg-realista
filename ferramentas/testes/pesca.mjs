// Pescaria igual à do Quimera (André 2026-11-08): vara, lançar na beira do lago, beliscada, "!", briga e peixe na mochila.
// Uso: node ferramentas/testes/pesca.mjs
import { Simulacao, MAPA_CLAREIRA, LAGOS, PESCA, ITENS, RECEITAS } from '../../shared/index.js';
import { noLago } from '../../shared/relevo.js';
import { progressoValido } from '../../shared/progresso.js';
import './_tudo-aberto.mjs'; // progressão (2026-11-10): este teste não é sobre a névoa nem a trava de nível
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('P', 'Pia');
j.criando = false; j.morto = false;
const avisos = () => s.eventos.filter((e) => e.t === 'aviso' && e.para === 'P').map((e) => e.texto);
const pesca = () => s.eventos.filter((e) => e.t === 'pesca' && e.para === 'P').map((e) => e.st);
// spots nascem nos lagos; pega um do Lago Grande e fica na beira, de frente para ele
for (let i = 0; i < 40; i++) { s.tempo += 0.1; s.passoSpots(); }
const L = LAGOS.find((l) => l.id === 'lago_grande');
const comuns = s.spots.filter((v) => v.ativo);
ok(comuns.length === s.spots.length && comuns.every((v) => v.tipo === 'comum'), `spots comuns em todos os lagos (${comuns.length}), sem raro/épico sem mar`);
ok(s.foto().spots.length === comuns.length, 'os spots vão na foto para o celular');
const sp = comuns.find((v) => v.lago === L);
const ux = (sp.x - L.x) / Math.hypot(sp.x - L.x, sp.z - L.z), uz = (sp.z - L.z) / Math.hypot(sp.x - L.x, sp.z - L.z);
let r = 0; while ((noLago(sp.x + ux * r, sp.z + uz * r)?.fundo || 0) > 0.05) r += 0.2;
const px = sp.x + ux * (r + 0.3), pz = sp.z + uz * (r + 0.3);
console.log('  spot a', r.toFixed(1), 'm da beira');
j.x = px; j.z = pz; j.y = 0;
const boia = { x: sp.x, z: sp.z };
ok(ITENS.vara && RECEITAS.peixe_assado && PESCA.spots.comum && ITENS.radar_pesca, 'vara, radar, peixe assado e os spots existem');
s.eventos = []; s.pescar('P', { acao: 'lancar', ...boia });
ok(avisos().some((t) => /vara de pescar/.test(t)), 'sem vara avisa');
j.prog.mochila[j.prog.mochila.indexOf(null)] = { k: 'vara', n: 1 };
s.eventos = []; s.pescar('P', { acao: 'lancar', x: px + 40, z: pz });
ok(avisos().some((t) => /perto da água/.test(t)), 'boia fora da água avisa');
const fora = [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].map(([a, b]) => ({ x: px + (ux * 0 + a) * 6, z: pz + b * 6 })).find((q) => (noLago(q.x, q.z)?.fundo || 0) > 0.1 && s.spots.every((v) => Math.hypot(v.x - q.x, v.z - q.z) > PESCA.raioSpot + 0.5) && Math.hypot(q.x - px, q.z - pz) < 5);
if (fora) { s.eventos = []; s.pescar('P', { acao: 'lancar', ...fora }); ok(!j.pesca && avisos().some((t) => /spot de pesca/.test(t)), 'água sem spot: não pesca e avisa'); }
// radar: mostra no mapa, não gasta, tem recarga
j.prog.mochila[j.prog.mochila.indexOf(null)] = { k: 'radar_pesca', n: 1 };
const ir = j.prog.mochila.findIndex((o) => o?.k === 'radar_pesca');
s.eventos = []; s.item('P', { acao: 'usar', i: ir });
ok(s.eventos.some((e) => e.t === 'radar' && e.para === 'P') && j.prog.mochila[ir]?.k === 'radar_pesca', 'radar mostra os spots e não some da mochila: ' + avisos().join(' | '));
s.eventos = []; s.item('P', { acao: 'usar', i: ir });
ok(avisos().some((t) => /pronto em/.test(t)), 'radar tem recarga');
s.eventos = []; s.pescar('P', { acao: 'lancar', ...boia });
ok(j.pesca?.st === 'lancando', 'lançou');
s.passoPesca(j, 0.7); s.pescar('P', { acao: 'puxar' });
ok(!j.pesca && avisos().some((t) => /cedo demais/.test(t)), 'puxar antes perde');
// pega vários: o "!" chega e toca; peixe que briga recebe toques até encher a barra
const pegos = {};
for (let n = 0; n < 60; n++) {
  s.eventos = []; s.pescar('P', { acao: 'lancar', ...boia });
  for (let i = 0; i < 100 && j.pesca.st !== 'fisgou'; i++) s.passoPesca(j, 0.1);
  s.pescar('P', { acao: 'puxar' });
  for (let i = 0; i < 40 && j.pesca && j.pesca.st === 'briga'; i++) { s.tempo += 0.1; s.passoPesca(j, 0.1); s.pescar('P', { acao: 'puxar' }); }
  const ev = s.eventos.find((e) => e.t === 'pesca' && e.st === 'pegou'); if (ev) pegos[ev.peixe] = (pegos[ev.peixe] || 0) + 1;
  for (let i = 0; i < 20 && j.pesca; i++) s.passoPesca(j, 0.1);
}
console.log('  pegou:', pegos);
ok(Object.keys(pegos).every((k) => ['lambari', 'tilapia', 'traira'].includes(k)) && pegos.lambari > 10, 'spot comum do lago dá só peixe de água doce, mais lambari');
ok(j.prog.prof.pes > 0 && j.prog.vara === Object.values(pegos).reduce((a, b) => a + b, 0), 'pontos de Pescador e a vara gastou');
// janela do "!" passa: escapa
s.eventos = []; s.pescar('P', { acao: 'lancar', ...boia });
for (let i = 0; i < 100 && j.pesca.st !== 'fisgou'; i++) s.passoPesca(j, 0.1);
for (let i = 0; i < 15 && j.pesca; i++) s.passoPesca(j, 0.1);
ok(!j.pesca && avisos().some((t) => /escapou/.test(t)), 'demorou no "!": o peixe escapa');
// andar recolhe a linha
s.eventos = []; s.pescar('P', { acao: 'lancar', ...boia });
s.posicaoCliente('P', { x: px + ux * 1.5, y: j.y, z: pz + uz * 1.5, ry: 0 });
ok(!j.pesca || avisos().some((t) => /recolheu/.test(t)), 'andar recolhe a linha');
// vara quebra no fim
j.x = px; j.z = pz; j.pesca = null; j.prog.vara = PESCA.durabilidade - 1;
s.eventos = []; s.pescar('P', { acao: 'lancar', ...boia });
for (let i = 0; i < 100 && j.pesca.st !== 'fisgou'; i++) s.passoPesca(j, 0.1);
s.pescar('P', { acao: 'puxar' });
for (let i = 0; i < 40 && j.pesca && j.pesca.st === 'briga'; i++) { s.tempo += 0.1; s.passoPesca(j, 0.1); s.pescar('P', { acao: 'puxar' }); }
ok(avisos().some((t) => /quebrou/.test(t)) && !j.prog.mochila.some((o) => o?.k === 'vara'), 'a vara quebra depois de 150 peixes');
j.prog.vara = 7; ok(progressoValido(j.prog)?.vara === 7, 'o desgaste da vara fica salvo na conta');
