// Teste: recruta Livre constrói fora do jogo
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { acharLugarBase } from '../../shared/base.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 }); a.criando = false; a.ciente = true; a.prog.ouro = 90000; a.prog.nivel = 40;
s.carregarClasNpc(null);
for (const ctx of s.amigosIa) ctx.amigaEntrar('A', false);
s.cla('A', { acao: 'fundar', nome: 'Ruivas' }); a.prog.cla.nv = 3;
const rec = s.mapa.npcs.find((n) => n.funcao === 'recrutador'); a.x = rec.x + 1; a.z = rec.z;
s.cla('A', { acao: 'recrutar', tier: 'recruta' });
const pc = acharLugarBase(-6, 1, 'chama', []); a.x = pc.x; a.z = pc.z;
s.cla('A', { acao: 'base' }); ok(s.baseDe(a), 'base do jogador fundada');
s.passoClasNpc(); s.passoBasesNpc();
const x = s.recrutasNoMundo(a)[0], m = a.prog.cla.m.find((o) => o.id === x.AMIGA.id);
// Recruta em modo Livre constrói a casa (até o telhado) enquanto o líder está fora do jogo (André 2026-11-25).
// Uso: node ferramentas/testes/recruta-livre-fora.mjs
const L = x.loteDaAmiga(); ok(L && !m.fn, 'recruta Livre com lote na base');
const tel = () => L.pecas.filter((p) => p.k === 'telhado').length;
a.prog.cla.saiu = Date.now() - 3600e3; x.foraDesde = 0;
s.foraRecrutas(a);
ok(tel() === 6 && L.pecas.length >= 25, `1 h fora no Livre: casa pronta com telhado (${L.pecas.length} peças, ${tel()} telhados)`);
