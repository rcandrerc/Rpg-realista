// Guia das missões (André 2026-11-12: depois de aceitar, o botão do próximo toque pisca: mochila, a peça, Destruir...).
// O app (godot-prototipo/guia.gd) monta os toques pelo tipo da etapa que o servidor manda em hist_info.
// Aqui: o servidor manda ev/k/min/de da etapa da vez, e todo tipo de etapa da história tem guia no app (ou é dos que só
// usam o "Ir"). Também roda o teste do motor do guia no Godot, se o Godot estiver instalado (GODOT=caminho).
// Uso: node ferramentas/testes/guia-missoes.mjs
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Simulacao, MAPA_CLAREIRA, HISTORIA } from '../../shared/index.js';
import { etapasDe } from '../../shared/historia.js';
import { guardar } from '../../shared/progresso.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const raiz = new URL('../../', import.meta.url).pathname;

// ---------- o servidor manda o tipo da etapa ----------
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('G', 'Guia');
const em = (id, e, nivel) => {
  const i = HISTORIA.findIndex((M) => M.id === id);
  Object.assign(j.prog, { nivel: nivel ?? HISTORIA[i].nv });
  j.prog.hist = { v: 2, p: i, ac: e >= 0, e: Math.max(0, e), n: 0, m: 0 };
  return s.histInfo(j);
};
const a15 = HISTORIA.find((M) => M.id === 'a15'), eDes = etapasDe(a15).findIndex((E) => E.ev === 'destruir');
let hi = em('a15', eDes);
ok(hi.ev === 'destruir' && hi.npc === '', 'etapa de destruir: hist_info traz ev = destruir');
const eEvo = etapasDe(a15).findIndex((E) => E.ev === 'evoluir');
hi = em('a15', eEvo);
ok(hi.ev === 'evoluir' && hi.min === 1, 'evoluir: traz min (raridade pedida)');
const a2 = HISTORIA.find((M) => M.id === 'a2');
hi = em('a2', etapasDe(a2).findIndex((E) => E.ev === 'criar'));
ok(hi.ev === 'item' && hi.de === 'solto' && hi.k === 'lenha', 'criar sem material: o guia vai pegar o que falta (shared/kit.js)');
guardar(j.prog.mochila, { k: 'lenha', n: 3 }); guardar(j.prog.mochila, { k: 'pedra', n: 2 });
hi = em('a2', etapasDe(a2).findIndex((E) => E.ev === 'criar'));
ok(hi.ev === 'criar' && hi.k === 'machado', 'criar: traz k (machado)');
hi = em('a2', etapasDe(a2).findIndex((E) => E.ev === 'item' && E.de === 'solto'));
ok(hi.ev === 'item' && hi.de === 'solto', 'item solto: traz de');
hi = em('a2', -1);
ok(!('ev' in hi) && hi.npc === a2.npc, 'antes de aceitar: só o NPC (o guia pisca Ir / Falar / Missão)');
const c2 = HISTORIA.find((M) => M.id === 'c2');
if (c2) { hi = em('c2', etapasDe(c2).findIndex((E) => E.ev === 'leilao')); ok(hi.ev === 'leilao' && hi.de === 'anunciar', 'leilão: traz de (anunciar)'); }

// ---------- todo tipo de etapa tem guia no app ----------
const gd = readFileSync(raiz + 'godot-prototipo/guia.gd', 'utf8');
const passos = gd.slice(gd.indexOf('func passos('), gd.indexOf('func _passos_criar('));
const comGuia = new Set([...passos.matchAll(/^\t\t("[a-z_]+"(?:, "[a-z_]+")*):$/gm)].flatMap((r) => r[1].match(/[a-z_]+/g)));
const soIr = new Set(['matar', 'pos', 'pistas', 'totem', 'ter', 'noite', 'falar']); // só andar até lá: o "Ir" pisca
const tipos = new Set(HISTORIA.flatMap((M) => etapasDe(M).map((E) => E.ev)));
for (const ev of tipos) ok(comGuia.has(ev) || soIr.has(ev), `etapa "${ev}": tem guia no app`);
ok(comGuia.has('destruir') && comGuia.has('criar') && comGuia.has('construir'), 'guia de destruir, criar e construir');

// ---------- motor do guia no Godot (opcional) ----------
const godot = process.env.GODOT || '/tmp/claude-0/godot/Godot_v4.5-stable_linux.x86_64';
if (existsSync(godot)) {
  let saida = '';
  try { saida = execFileSync(godot, ['--headless', '--path', 'godot-prototipo', '--script', '../ferramentas/testes/guia-godot.gd'], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }); } catch (e) { saida = String(e.stdout || '') + String(e.stderr || ''); }
  const r = saida.match(/guia: (\d+) ok, (\d+) falhas/);
  ok(r && +r[2] === 0 && +r[1] > 0 && !/SCRIPT ERROR/.test(saida), `motor do guia no Godot (${r ? r[0] : saida.slice(-300)})`);
} else console.log('(sem Godot: pulando o teste do motor do guia)');
