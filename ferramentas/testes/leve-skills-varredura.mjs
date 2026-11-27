// Varredura das skills (André 2026-11-27: "fazer uma varredura teste primeiro em todas as skills"): cada skill do jogo usada
// do jeito do jogo 3D (msg habQ como o main.gd manda) e do jeito do leve (leveHab), no mesmo cenário, e compara o que saiu:
// dano em cada bicho, quem ficou congelado/atordoado/lento, recarga, mana, para onde o herói foi e os efeitos que a página
// recebe. Também usa cada uma com o joystick seguro (no 3D o herói fica parado na skill; o tiro do cajado anda a 60%).
// Uso: node ferramentas/testes/leve-skills-varredura.mjs [-v]
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { HABS, ANDAR_ATIRANDO } from '../../shared/progresso.js';
import { HEROI } from '../../shared/dados.js';
import './_tudo-aberto.mjs';
const V = process.argv.includes('-v');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
let semente = 1; const rnd = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
Math.random = rnd;
const r1 = (v) => Math.round(v * 10) / 10;
function cena(k, modo, joy, passos = 60) {
  semente = 7;
  const s = new Simulacao(MAPA_CLAREIRA);
  const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
  a.criando = false; a.ciente = true; a.prog.nivel = 63; a.leve = modo === 'leve'; s.aplicarStatus(a, true);
  const b = HABS[k], arv = b.arvore === 'cajado' ? 'cajado' : 'espada';
  if (!b.basico) { const l = [...a.prog.barras[arv]]; if (!l.includes(k)) l[0] = k; a.prog.barras[arv] = l; }
  const vivos = s.inimigos.filter((o) => !o.morto && !o.bm && !o.chefe).slice(0, 3); s.inimigos.length = 0; s.inimigos.push(...vivos);
  for (let i = 0; i < 5; i++) s.passo(1 / 20);
  semente = 11;
  a.ry = Math.PI / 2; a.mana = a.manaMax ?? HEROI.mana; a.vida = a.vidaMax; a.cds = {}; a.trava = 0; a.acao = null; a.modo = arv === 'cajado' ? 'Magia' : 'Espada';
  vivos.forEach((e, i) => { e.ia = null; e.velocidade = 0; e.vida = e.vidaMax = 1e6; e.x = a.x + 2.6 + i * 1.2; e.z = a.z + (i - 1) * 0.7; e.y = a.y; e.parado = 0; e.ef = null; e.lento = null; });
  const fx = []; const ev0 = s.evento.bind(s); s.evento = (e) => { const f = s.fxLeve(a, e); if (f) fx.push(f[0] + (f[4] && typeof f[4] === 'string' ? ':' + f[4] : '')); if (e.t === 'cadeia' || e.t === 'raio' || e.t === 'efeito' || e.t === 'conjura') fx.push('ev:' + e.t); return ev0(e); };
  const x0 = a.x, z0 = a.z, mana0 = a.mana;
  if (modo === 'leve') { if (joy) s.leveMover('A', { mx: 0, mz: 0.5 }); s.leveHab('A', k); }
  else { // como o main.gd manda
    const alvo = vivos[0];
    const m = b.tipo === 'teleporte' ? { id: k, dx: 1, dz: 0 } : ['bola', 'cadeia', 'meteoro', 'basicoMagia'].includes(b.tipo) ? { id: k, v: alvo.v } : k;
    s.usarHabQ('A', m);
  }
  const cd = (a.cds[k] || 0) - s.tempo, mana = mana0 - a.mana;
  for (let t = 0; t < passos; t++) { if (modo === 'leve' && joy) s.leveMover('A', { mx: 0, mz: 0.5 }); s.passo(1 / 20); }
  const efs = s.fotoLeve(a).m.map((o) => o[6]);
  return { efs, dano: vivos.map((e) => Math.round(1e6 - e.vida)), ef: vivos.map((e) => (e.parado > s.tempo - 3 && e.ef) || (e.lento ? 'lento' : '') || ''), cd: r1(cd), mana: Math.round(mana), anda: r1(Math.hypot(a.x - x0, a.z - z0)), fx: [...new Set(fx)].sort().join(' '), eu: { escudo: !!a.escudo, vida: Math.round(a.vida) } };
}
const dif = [];
for (const k of Object.keys(HABS)) {
  const j3 = cena(k, '3d'), lv = cena(k, 'leve');
  const a = JSON.stringify({ ...j3, fx: undefined, efs: undefined }), b = JSON.stringify({ ...lv, fx: undefined, efs: undefined });
  if (V) console.log(k, '\n  3D  ', a, j3.fx, '\n  leve', b, lv.fx);
  ok(a === b, `${HABS[k].nome}: leve igual ao jogo${a === b ? '' : ` (3D ${a} | leve ${b})`}`);
  if (a !== b) dif.push(k);
  ok(lv.fx.length > 0, `${HABS[k].nome}: a página recebe efeito (${lv.fx || 'nada'})`);
  // joystick seguro: a skill sai igual e o herói só anda no tiro do cajado
  const jy = cena(k, 'leve', true);
  ok(JSON.stringify(jy.dano) === JSON.stringify(lv.dano), `${HABS[k].nome} com o joystick seguro: mesmo dano (${jy.dano} | ${lv.dano})`);
}
// o que a página desenha: gelo deixa os bichos brancos, o raio risca, o escudo e o salto aparecem
ok(cena('nova_gelo', 'leve').efs.filter((e) => e === 'g').length >= 2, 'Nova de Gelo: os bichos atingidos vão brancos (congelados) na foto');
ok(cena('pisao_sismico', 'leve').efs.includes('a'), 'Pisão Sísmico: atordoados vão amarelos');
ok(cena('cajado_basico', 'leve', false, 20).efs.includes('l'), 'Faísca: o bicho lento vai azul-claro');
ok(/\br\b/.test(cena('raio_cadeia', 'leve').fx), 'Raio em Cadeia: a página recebe o risco do raio');
ok(/a:escudo/.test(cena('escudo_arcano', 'leve').fx) && /\bt\b/.test(cena('salto_arcano', 'leve').fx), 'Escudo e Salto Arcano: a página recebe o efeito');
// tiro do cajado com o joystick: anda junto, devagar (no jogo: acao.livre, ANDAR_ATIRANDO), e a espada para no golpe
{ const p = cena('cajado_basico', 'leve', true), e = cena('espada_basico', 'leve', true); ok(p.anda > 0.5, `Faísca segurando o joystick: o herói anda junto (${p.anda} m em 3 s)`); ok(e.anda > 0, `espada com o joystick: volta a andar depois do golpe (${e.anda} m)`); }
console.log(dif.length ? 'diferentes: ' + dif.join(', ') : 'todas iguais');
