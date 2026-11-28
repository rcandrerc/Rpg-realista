// Medidor de grind dos jogadores (André 2026-11-28: "mapeie aí o tempo que eu vou gastar de grind em cada nível... tempo que
// eu tô grindando, o tempo que eu tô parado"): só lê o herói de cada conta de gente e soma o tempo por estado, por nível.
// Uso: node ferramentas/testes/medidor-jogador.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Simulacao, MAPA_CLAREIRA, CACA } from '../../shared/index.js';
import { Medidor, campoEm } from '../../server/medidor.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'medidor-')), arq = path.join(pasta, 'medidor.json');
const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Luiza', null, { conta: 7 }); j.criando = false; j.morto = false;
const bot = s.adicionarJogador('B', 'Recruta'); bot.criando = false; bot.bot = true;
const robo = s.adicionarJogador('R', 'Robô', null, { conta: 9, robo: true }); robo.criando = false;
j.prog.nivel = 1; j.prog.equip = { corpo: { k: 'peitoral', r: 0, d: 100 }, espada: { k: 'espada', r: 0, d: 100 } };
const campo = CACA.find((c) => c.nivel === 1 && !c.boss);
// um lugar fora de todo campo de caça (para andar e ficar parado)
let livre = null;
const semCampo = (x, z) => { for (let d = 0; d <= 64; d += 2) if (campoEm(x + d, z)) return false; return true; }; // o caminho todo da andada
for (let x = -400; !livre && x < 400; x += 7) for (let z = -400; !livre && z < 400; z += 7) if (semCampo(x, z)) livre = { x, z };
ok(campo && livre, `campo Nv 1 (${campo?.nome}) e um lugar livre (${JSON.stringify(livre)})`);

const m = new Medidor(arq);
let t = 1.8e12;
const passos = (n, antes = () => {}) => { for (let i = 0; i < n; i++) { antes(i); t += 1000; m.passo([s], t); } };
m.passo([s], t);
ok(m.saude().contas === 1, `só a conta de gente é medida (bot e robô ficam de fora): ${JSON.stringify(m.saude())}`);
// 60 s no campo (caçando), 30 s andando fora, 20 s parado, um morte de 4 s, 10 s em luta fora do campo
j.x = campo.x; j.z = campo.z; passos(60);
j.x = livre.x; j.z = livre.z; passos(1);
passos(30, () => { j.x += 2; });
passos(20);
j.morto = true; passos(4); j.morto = false;
j.combateAte = s.tempo + 1e6; passos(10); j.combateAte = 0;
// o livro-caixa manda conta = j.conta ("c7": a sim põe o "c" na frente do id da conta)
m.caixa({ conta: j.conta, abates: 1 }); m.caixa({ conta: j.conta, abates: 1 }); m.caixa({ conta: j.conta, abates: 1 });
m.caixa({ conta: j.conta, fonte: 'reforco', v: -120 }); m.caixa({ conta: robo.conta, abates: 1 });
j.prog.equip.corpo = { ...j.prog.equip.corpo, e: 1 }; passos(1);
j.prog.nivel = 2; passos(1);
let r = m.relatorio()[0], L = r.niveis[0];
ok(r.nome === 'Luiza' && r.nivel === 2 && r.niveis.length === 2 && L.nv === 1 && !L.jogando && r.niveis[1].jogando, `fechou o Nv 1 ao subir (${r.niveis.map((x) => x.nv).join(',')})`);
ok(Math.abs(L.t.caca - 70 / 60) < 0.05 && Math.abs(L.t.anda - 30 / 60) < 0.05 && Math.abs(L.t.morto - 4 / 60) < 0.05, `caçando 70 s (campo + luta), andando 30 s, morto 4 s: ${JSON.stringify(L.t)}`);
ok(Math.abs(L.t.para - 23 / 60) < 0.05, `parado ~23 s (20 s + os passos de troca): ${L.t.para}`);
ok(L.mortes === 1 && L.abates === 3 && L.reforco?.n === 1 && L.reforco.ouro === 120, `1 morte, 3 abates, 1 reforço de 120 (${L.mortes}, ${L.abates}, ${JSON.stringify(L.reforco)})`);
ok(L.up?.includes('corpo reforço +0→+1') && r.ups.length === 1 && r.ups[0].nv === 1, `upgrade marcado no nível (${JSON.stringify(L.up)})`);
ok(Object.keys(L.campos)[0] === `${campo.nome} (Nv 1)`, `campo do nível: ${JSON.stringify(L.campos)}`);
ok(Math.abs(L.min - (L.t.caca + L.t.anda + L.t.morto + L.t.para + L.t.fora)) < 0.15, `total = soma dos estados (${L.min})`);
// queda de 40 s: conta como "fora"; 20 min fora: pausa, não conta
for (let i = 0; i < 40; i++) { t += 1000; m.passo([], t); }
passos(1);
r = m.relatorio()[0];
ok(Math.abs(r.niveis[1].t.fora - 41 / 60) < 0.05, `queda de 40 s vira "fora" (${r.niveis[1].t.fora})`);
t += 20 * 60e3; m.passo([], t); passos(1);
r = m.relatorio()[0];
ok(r.niveis[1].pausas === 1 && Math.abs(r.niveis[1].t.fora - 41 / 60) < 0.05, 'pausa de 20 min não entra no tempo');
// grava e lê de novo (o servidor reinicia a cada merge)
m.salvar(t);
const m2 = new Medidor(arq);
ok(m2.relatorio()[0].niveis.length === 2 && m2.relatorio()[0].niveis[0].abates === 3, 'gravou e leu de novo depois de reiniciar');
// reset da conta (nível voltou): série nova do Nv 1, a de antes fica guardada
j.prog.nivel = 1; t += 1000; m2.passo([s], t);
r = m2.relatorio()[0];
ok(r.nivel === 1 && r.niveis.length === 1 && r.seriesAntes?.length === 1 && r.seriesAntes[0].niveis === 1, `reset: série nova do Nv 1 (antes: ${JSON.stringify(r.seriesAntes)})`);
// botão de teste do André (2026-11-28): descer várias vezes seguidas não empurra a série medida de verdade para fora
{
  const m3 = new Medidor(); let t3 = 1.9e12; const passo3 = () => { t3 += 1000; m3.passo([s], t3); };
  j.prog.nivel = 60; passo3(); j.prog.nivel = 61; passo3(); // série de verdade com o Nv 60 fechado
  j.prog.nivel = 50; passo3(); j.prog.nivel = 40; passo3(); j.prog.nivel = 30; passo3(); j.prog.nivel = 1; passo3();
  let r3 = m3.relatorio()[0];
  ok(r3.nivel === 1 && r3.seriesAntes?.length === 1 && r3.seriesAntes[0].niveis === 1, `cliques seguidos de descer: 1 série guardada (${JSON.stringify(r3.seriesAntes)})`);
  j.prog.nivel = 2; passo3(); passo3();
  r3 = m3.relatorio()[0];
  ok(r3.niveis.length === 2 && r3.niveis[0].nv === 1 && !r3.niveis[0].jogando, 'depois de descer, cada nível novo é medido de novo');
  j.prog.nivel = 1; passo3();
  ok(m3.relatorio()[0].seriesAntes.length === 2, 'descer depois de medir um nível guarda essa série também');
}
fs.rmSync(pasta, { recursive: true, force: true });
