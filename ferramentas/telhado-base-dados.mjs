// dados para ferramentas/telhado-base-foto.gd (André 2026-11-26: "as casas ainda estão sem telhado"): base do clã de um
// jogador com 3 recrutas no Livre e as casas prontas (com telhado) pelo servidor de verdade, sem rede.
// Uso: node ferramentas/telhado-base-dados.mjs /tmp/telhado.json
import { Simulacao, MAPA_CLAREIRA } from '../shared/index.js';
import { acharLugarBase } from '../shared/base.js';
import './testes/_tudo-aberto.mjs';
import fs from 'node:fs';
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'André', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.prog.ouro = 90000; a.prog.nivel = 40;
s.cla('A', { acao: 'fundar', nome: 'Brasil' }); a.prog.cla.nv = 4;
const r = s.mapa.npcs.find((n) => n.funcao === 'recrutador'); a.x = r.x + 1; a.z = r.z;
for (let i = 0; i < 3; i++) s.cla('A', { acao: 'recrutar', tier: 'recruta' });
const pc = acharLugarBase(-6, 1, 'chama', []); a.x = pc.x; a.z = pc.z;
s.cla('A', { acao: 'base' });
const B = s.baseDe(a);
s.passoBasesNpc?.();
for (const m of a.prog.cla.m) m.fn = { k: 'livre' };
for (let k = 0; k < 40; k++) { s.passoObraCasas(60); s.tempo += 60; }
const lotes = [...s.lotes.values()].filter((L) => L.def.baseK === B.k);
const recs = s.recrutasNoMundo(a).map((x) => x.loteDaAmiga()).filter(Boolean);
console.log('lotes da base', lotes.length, 'telhados', recs.map((L) => L.pecas.filter((p) => p.k === 'telhado').length));
s.eventos = []; s.enviarLotes('A');
const ev = s.eventos, lotesEv = ev.find((e) => e.t === 'lotes'), basesEv = ev.find((e) => e.t === 'bases');
const L = recs[0];
fs.writeFileSync(process.argv[2] || '/tmp/telhado.json', JSON.stringify({ lotes: lotesEv.lista.filter((o) => lotes.some((L2) => L2.def.id === o.lote)), bases: basesEv, casa: { x: (L.def.x0 + L.def.x1) / 2, z: (L.def.z0 + L.def.z1) / 2 }, centro: { x: B.x, z: B.z } }));
