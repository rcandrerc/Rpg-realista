// Farm fora do jogo segue a conta do jogo: desconto de rank no vigor, +1 do rank, pesca peixe a peixe (André 2026-11-25)
// Uso: node ferramentas/testes/recruta-farm-fora.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { COLETA } from '../../shared/dados.js';
import { RECURSOS_CLA } from '../../shared/cla.js';
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
const x = s.recrutasNoMundo(a)[0], m = a.prog.cla.m.find((o) => o.id === x.AMIGA.id), j = x.amiga;
const K = s.claDoRecruta(x), B = s.bauDoCla(K);
const conta = (k) => (B ? B.itens : j.prog.mochila).reduce((q, o) => q + (o && (k === 'peixe' ? !!o.k.match(/lambari|tilapia|traira/) : o.k === k) ? o.n : 0), 0);
const limpa = () => { for (const l of [B?.itens, j.prog.mochila]) if (l) for (let i = 0; i < l.length; i++) if (l[i] && /lenha|lambari|tilapia|traira/.test(l[i].k)) l[i] = null; };
const roda = (rec, pontos) => { limpa(); j.prog.prof[C.prof] = pontos; j.prog.prof.pes = pontos; j.prog.vigor = { v: 100, t: Date.now(), m: 100 }; m.fn = { k: 'recurso', r: rec }; m.mo = 100; s.trabalhoFora(x, m, 0.01, 40); return conta(rec === 'peixe' ? 'peixe' : RECURSOS_CLA[rec].item); };
const no = RECURSOS_CLA.lenha.no, C = COLETA[no];
const C0 = C; const base = roda('lenha', 0), alto = roda('lenha', 8 * 19 * 19);
console.log('lenha: rank 0 =', base, ' rank alto =', alto, ' (vigor/batida', C.vigor, ')');
ok(Math.abs(base - 100 / C.vigor * (C.da.lenha || 1) * 1.1) <= 2 && base > 0, `rank 0: conta base (${base})`);
ok(alto > base, `rank alto junta mais que rank 0 (${alto} > ${base})`);
const p0 = roda('peixe', 0), p1 = roda('peixe', 8 * 19 * 19);
ok(p0 > 0 && p1 >= p0 * 0.9, `pesca peixe a peixe (${p0} com rank 0, ${p1} com rank alto)`);
