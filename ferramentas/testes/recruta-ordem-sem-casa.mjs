// Recruta com ordem no painel não faz a vida dele (André 2026-11-24: "mandei meu primeiro recruta farmar uma madeira e ele
// foi construir a casa dele... eu pensei que ele só faria essas coisas se eu deixasse ele no modo livre"): sem machado, a
// ordem "Farmar recurso: Lenha" não sai, e antes ele caía na rotina da casa. Agora espera; no modo Livre constrói.
// Uso: node ferramentas/testes/recruta-ordem-sem-casa.mjs
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
const x = s.recrutasNoMundo(a)[0], j = x.amiga, m = a.prog.cla.m.find((o) => o.id === x.AMIGA.id);
const L = x.loteDaAmiga(); ok(L, 'recruta tem lote na base');
const R = x.rotinaAmiga(); j.prog.dia = { h: (R.saiDe + 1) % 24, t: Date.now() }; j.prog.vigor = { v: 100, t: Date.now() };
const fer = x.AMIGA.atividades.lenha.ferramenta;
j.prog.mochila = j.prog.mochila.map((o) => (o && o.k === fer ? null : o)); // sem machado
m.fn = { k: 'recurso', r: 'lenha' }; s.aplicarFuncao(a, x, m, true);
const p0 = L.pecas.length;
for (let i = 0; i < 10 * 600; i++) s.passo(0.1); // 10 min
ok(L.pecas.length === p0, `com ordem de lenha e sem machado não constrói a casa (${p0} -> ${L.pecas.length} peças)`);
ok(j.ia.anim !== 'construir' && !j.ia.av?.coleta, 'fica esperando (não sai fazendo outra coisa)');
m.fn = { k: 'livre' }; s.aplicarFuncao(a, x, m, true);
for (let i = 0; i < 15 * 600; i++) s.passo(0.1);
ok(L.pecas.length > p0, `no modo Livre volta a construir a casa (${p0} -> ${L.pecas.length} peças)`);
