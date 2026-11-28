// Fórmula única de balanceamento (proposta, André 2026-11-28). Só simula: não muda nada no jogo.
// Junta num lugar só: nível, build (Int pura / mista), set (raridade + reforço), skills (Faísca, Meteoro A', Giro),
// golem do mesmo nível e curva de XP. Compara "hoje" com a "proposta" (3 números novos, PROPOSTA abaixo).
// Uso: node ferramentas/balanceamento/formula.mjs [--md arquivo.md]
import '../../shared/index.js';
import { calcularStatus, xpProximo, xpDoInimigo, habNoNivel, reducaoContra, reforcoOk } from '../../shared/progresso.js';
import { statusInimigo, NIVEL_INIMIGO as N, LUGARES, ITENS, REFORCO, TIPOS_INIMIGO } from '../../shared/dados.js';
import { writeFileSync } from 'node:fs';

// ---- a proposta (3 números) ----
// 1) arma multiplica o dano em vez de somar: dano x (armaBase + dano da arma) / (armaBase + 5). Raro +0 = x1 (igual hoje).
// 2) "peso do fim de jogo" P(n) = 1 + a·d + b·d², d = nível do mob - 50 (1 até o 50): só a vida do mob x P.
//    Mesmo jeito da curva de XP (#891). Dano do mob e XP não mudam: a luta mais longa já cobra a armadura e o tempo.
export const PROPOSTA = { armaBase: 45, a: 0.1, b: 0.0016, desde: 50 };
export const pesoFim = (n, P = PROPOSTA) => { const d = Math.max(0, n - P.desde); return 1 + P.a * d + P.b * d * d; };

const K = { cabeca: 'chapeu', corpo: 'peitoral', pernas: 'calca', capa: 'capa', pes: 'botas', acessorio: 'colar', espada: 'espada', cajado: 'cajado' };
// build: 'int' = 2 pontos/nível em Int; 'mista' = Int até o 50, depois metade Int metade Vit. 'for'/'forMista' igual com Força.
export function atributos(n, build) {
  const p = 2 * (n - 1), base = { for: 3, des: 3, int: 3, vit: 3 }, k = build.startsWith('for') ? 'for' : 'int';
  if (!build.endsWith('ista') && build !== 'mista') { base[k] += p; return base; }
  const a = Math.min(p, 98), r = p - a; base[k] += a + Math.floor(r / 2); base.vit += Math.ceil(r / 2); return base;
}
// set inteiro de uma raridade; o reforço para no máximo da raridade e no que o atributo deixa (regra do Quimera)
export function setDe(r, e, atr) {
  const q = {};
  for (const l of LUGARES) { let x = Math.min(e, REFORCO.max[r]); while (x > 0 && !reforcoOk({ k: K[l], r, e: x }, atr)) x--; q[l] = { k: K[l], r, e: x }; }
  return q;
}
const armaDano = (it, campo) => ITENS[it.k].st[campo][it.r] * (1 + REFORCO.bonus * (it.e | 0));

export function cenario(n, build, r, e, proposta) {
  const atr = atributos(n, build), equip = setDe(r, e, atr), st = calcularStatus({ atr, nivel: n, equip, tit: {} });
  const magia = !build.startsWith('for'), campo = magia ? 'danoMagico' : 'danoFisico', arma = equip[magia ? 'cajado' : 'espada'];
  let dano = st[campo];
  if (proposta) { // tira a soma da arma e põe o multiplicador; o resto (colar, conjunto) multiplica igual hoje
    const w = armaDano(arma, campo), puro = 10 * (1 + 0.08 * (n - 1)) * (1 + 0.06 * (atr[magia ? 'int' : 'for'] - 3));
    dano = puro * (PROPOSTA.armaBase + w) / (PROPOSTA.armaBase + 5) * (st[campo] / (puro + w));
  }
  const P = proposta ? pesoFim(n) : 1, g = statusInimigo('golem', n), vidaMob = g.vida * P;
  const faisca = dano * habNoNivel('cajado_basico', 5).pct, meteoro = dano * 2.4 * (1 + 0.18 * 9); // Meteoro A' na skill 10
  const giro = dano * habNoNivel('giro', 10).pct * 2;
  const golpe = Math.min(g.dano * (1 - reducaoContra(st.defesa, n, N)), st.vidaMax * N.teto);
  const golpes = st.vidaMax / golpe, tiros = vidaMob / (magia ? faisca : dano * habNoNivel('espada_basico', 5).pct);
  const mobs = xpProximo(n) / xpDoInimigo('golem', n, n, N);
  // tempo: 8 s por bicho (andar, puxar, descansar) + 0,52 s por tiro; morre se o golem te derruba antes (golpe a cada 2,6 s)
  const morre = tiros * 0.52 > golpes * TIPOS_INIMIGO.golem.intervalo;
  const seg = 8 + tiros * 0.52;
  return { n, build, r, e: arma.e, tiros, meteoros: vidaMob / meteoro, giros: vidaMob / giro, golpes, mobs, minNivel: mobs * seg / 60, morre };
}

// ---- tabelas ----
const NIVEIS = [10, 30, 50, 60, 80, 100];
const SETS = [[1, 0, 'Raro +0'], [2, 20, 'Épico reforçado'], [3, 20, 'Lendário reforçado'], [4, 40, 'Mítico reforçado']];
const f1 = (x) => x.toFixed(1).replace('.', ',');
function tabela(titulo, build, campo, prop) {
  const linhas = [`| ${titulo} | ${NIVEIS.map((n) => 'Nv ' + n).join(' | ')} |`, `|---|${NIVEIS.map(() => '---').join('|')}|`];
  for (const [r, e, nome] of SETS) linhas.push(`| ${nome} | ${NIVEIS.map((n) => { const c = cenario(n, build, r, e, prop); return (campo === 'minNivel' ? Math.round(c[campo]) : f1(c[campo])) + (c.morre && campo === 'tiros' ? ' ☠' : ''); }).join(' | ')} |`);
  return linhas.join('\n');
}
function horas(build, r, e, prop, de, ate) { let m = 0; for (let n = de; n < ate; n++) m += cenario(n, build, r, e, prop).minNivel; return m / 60; }

const out = [];
for (const prop of [false, true]) {
  out.push(`\n## ${prop ? 'PROPOSTA' : 'HOJE (com o Meteoro A\')'}\n`);
  out.push(tabela('Faíscas por golem, Int pura', 'int', 'tiros', prop), '');
  out.push(tabela('Faíscas por golem, build mista', 'mista', 'tiros', prop), '');
  out.push(tabela('Meteoros (A\') por golem, Int pura', 'int', 'meteoros', prop), '');
  out.push(tabela('Giros por golem, Força pura', 'for', 'giros', prop), '');
  out.push(tabela('Golpes do golem para te matar, Int pura', 'int', 'golpes', prop), '');
  out.push(tabela('Minutos por nível (estimativa, Int pura)', 'int', 'minNivel', prop), '');
  out.push(`Horas de caça do 50 ao 100 (Int pura): ${SETS.map(([r, e, nome]) => `${nome} ${Math.round(horas('int', r, e, prop, 50, 100))} h`).join(' · ')}`);
}
out.push('\n☠ = o golem do seu nível te mata antes de você matar ele (sozinho, sem poção).');
const txt = out.join('\n');
const i = process.argv.indexOf('--md');
if (i > 0) writeFileSync(process.argv[i + 1], txt); else console.log(txt);
