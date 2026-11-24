// Base do clã segura (André 2026-11-24: "a área dentro da nossa base deve ser safe igual os totens, somente a área da
// base mesmo, sem raio de segurança"): dentro do centro (nível de agora) e dos lotes abertos vale a regra do totem
// (monstro não persegue nem bate, vida volta mais rápido); 1 m para fora do retângulo, não.
// Uso: node ferramentas/testes/base-segura.mjs
import { Simulacao, MAPA_CLAREIRA, CLA, TOTENS } from '../../shared/index.js';
import { naAreaSegura, naBaseSegura, AREAS_SEGURAS_BASE } from '../../shared/dados.js';
import { acharLugarBase } from '../../shared/base.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const pc = acharLugarBase(-6, 1, 'chama', Object.values(s.basesCla || {}));
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.prog.ouro = 90000; a.prog.nivel = 40;
s.cla('A', { acao: 'fundar', nome: 'Ruivas' });
a.prog.cla.nv = 2; a.x = pc.x; a.z = pc.z;
s.cla('A', { acao: 'base' });
const B = s.baseDe(a);
ok(B, 'base fundada');
const h = CLA.base.niveis[B.nv].centro / 2, D = s.basesDesenho[B.k];
ok(AREAS_SEGURAS_BASE.filter((r) => r.k === B.k).length === 1 + D.lotes.length, 'área segura = centro + lotes abertos');
ok(naBaseSegura(B.x, B.z) && naAreaSegura(B.x + h - 0.2, B.z - h + 0.2), 'dentro do centro é seguro (até a beirada)');
ok(!naBaseSegura(B.x + h + 1, B.z) && !naAreaSegura(B.x, B.z - h - 1), '1 m fora do centro não é seguro (sem raio)');
const L = D.lotes[0];
ok(naAreaSegura((L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2), 'lote aberto é seguro');
const [fx, fz] = CLA.base.lugares[D.lotes.length];
ok(!naBaseSegura(B.x + fx, B.z + fz), 'lote ainda fechado não é seguro');
ok(!naBaseSegura(B.x + CLA.base.pegada + 1, B.z) && !naBaseSegura(B.x, B.z + CLA.base.pegada + 1), 'fora da pegada da base não é seguro');
ok(TOTENS.lista.every((t) => naAreaSegura(t.x, t.z)), 'totens continuam seguros');
// veneno e sangramento não pegam dentro (feridaDot, a mesma regra do totem); fora pega
a.x = B.x; a.z = B.z; a.vida = 100;
s.feridaDot(a, { n: 10, k: 'veneno' });
ok(a.vida === 100, 'dentro da base o veneno não tira vida');
a.x = B.x + h + 2;
s.feridaDot(a, { n: 10, k: 'veneno' });
ok(a.vida === 90, 'fora da base (2 m da beirada) o veneno tira');
// o centro cresce com o clã: a área segura também
s.basesCla[B.k].nv = 6; s.refazerBases();
const h6 = CLA.base.niveis[6].centro / 2;
ok(naBaseSegura(B.x + h6 - 0.5, B.z) && !naBaseSegura(B.x + h6 + 1, B.z), 'no Nv 6 vale o centro maior, ainda sem raio');
