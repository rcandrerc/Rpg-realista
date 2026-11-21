// Linha de visão da magia no mundo todo (André 2026-11-21: "as skills de mágico se tiver algum objeto entre o alvo não
// deve ser possível usar... ainda consigo botar por dentro dos blocos, isso não pode no mundo todo"). Uso:
// node ferramentas/testes/magia-visao.mjs
import { Simulacao, MAPA_CLAREIRA, HABS } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('T', 'Teo');
j.criando = false; j.morto = false; j.prog.nivel = 60; s.aplicarStatus(j, true);
s.passo(0.05);

// um rochedo grande e alto fora da arena (cenário da mata), com chão livre dos dois lados
const ach = MAPA_CLAREIRA.cenario.solidos.filter((o) => !o.arena && o.r > 1 && (o.alto ?? 9) > 2.6)
  .flatMap((o) => [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([ux, uz]) => ({ o, a: { x: o.x - ux * (o.r + 2.5), z: o.z - uz * (o.r + 2.5) }, b: { x: o.x + ux * (o.r + 2.5), z: o.z + uz * (o.r + 2.5) } })))
  .find((q) => s.livreParaHeroi({ y: s.terreno.altura(q.a.x, q.a.z) }, q.a.x, q.a.z) && s.livreParaHeroi({ y: s.terreno.altura(q.b.x, q.b.z) }, q.b.x, q.b.z) && Math.abs(s.terreno.altura(q.a.x, q.a.z) - s.terreno.altura(q.b.x, q.b.z)) < 0.8);
ok(!!ach, `achou um rochedo para o teste (r ${ach?.o.r} m)`);
const { o: R, a: A, b: B } = ach;
const por = (c, p) => { c.x = p.x; c.z = p.z; c.y = s.terreno.altura(p.x, p.z); };
por(j, A);
const e = s.inimigos.find((x) => !x.treino && !x.bm && !x.sub);
por(e, B); e.vida = e.vidaMax = 99999; e.parado = 1e9; e.morto = false;
for (const x of s.inimigos) if (x !== e) { x.x += 500; x.z += 500; }

ok(!s.visaoLivre(j, e), 'o rochedo no meio tapa a visão');
// casa da vila no meio também tapa (parede e telhado)
{ const c = MAPA_CLAREIRA.vila.casas.find((q) => !q.aberta), d = Math.max(c.w, c.d) / 2 + 3;
  ok(!s.visaoLivre({ x: c.x - d, z: c.z }, { x: c.x + d, z: c.z }), 'casa da vila no meio tapa a visão'); }

// Bola de Fogo e Faísca: não saem e avisam "Sem visão do alvo" (sem gastar mana)
j.prog.barras.cajado = ['bola_fogo', null, null, null].slice(0, j.prog.barras.cajado.length); j.prog.barras.cajado[0] = 'bola_fogo';
j.prog.habs.bola_fogo = { nv: 1, uso: 0 };
const mana = j.mana; s.eventos.length = 0; j.trava = 0; j.cds = {};
s.usarHabQ('T', 'bola_fogo');
ok(j.mana === mana && s.eventos.some((v) => v.t === 'aviso' && v.texto === 'Sem visão do alvo'), 'Bola de Fogo atrás do rochedo: não sai, "Sem visão do alvo"');
s.eventos.length = 0; j.trava = 0; j.cds = {};
s.usarHabQ('T', { id: 'cajado_basico', v: e.v });
ok(s.eventos.some((v) => v.t === 'aviso' && v.texto === 'Sem visão do alvo'), 'Faísca no alvo travado atrás do rochedo: não sai');

// meteoro e anel de chamas: área não pega quem está do outro lado
const v0 = e.vida;
s.areaQ(j, { x: B.x, z: B.z }, 0.1, 50, { ...HABS.meteoro, tipo: 'meteoro', id: 'meteoro' }); // centro do lado dele: pega
ok(e.vida < v0, 'meteoro do lado dele pega');
const v1 = e.vida;
s.areaQ(j, j, 40, 50, { tipo: 'anel', id: 'anel_chamas' });
ok(e.vida === v1, 'anel de chamas não passa pelo rochedo');

// projétil no mundo (não só na arena): para no rochedo
const h = { dmg: 40, proj: { vel: 30, vida: 2, largura: 0.6, cor: '#fff' } };
s.projeteis.push({ id: 999999, x: A.x + (B.x - A.x) / Math.hypot(B.x - A.x, B.z - A.z) * 0.6, y: j.y + 1.3, z: A.z + (B.z - A.z) / Math.hypot(B.x - A.x, B.z - A.z) * 0.6, dx: (B.x - A.x) / Math.hypot(B.x - A.x, B.z - A.z), dy: 0, dz: (B.z - A.z) / Math.hypot(B.x - A.x, B.z - A.z), h, dono: j, vida: 2, acertou: new Set() });
for (let i = 0; i < 30; i++) s.passoProjeteis(0.05);
ok(e.vida === v1, 'a magia lançada para no rochedo');

// saindo de trás do rochedo, volta a poder
por(j, { x: B.x + (B.x - R.x) * 0.6, z: B.z + (B.z - R.z) * 0.6 });
ok(s.visaoLivre(j, e), 'do mesmo lado, vê');
s.eventos.length = 0; j.trava = 0; j.cds = {}; j.mana = j.manaMax;
s.usarHabQ('T', 'bola_fogo');
ok(!s.eventos.some((v) => v.t === 'aviso' && v.texto === 'Sem visão do alvo') && j.mana < j.manaMax, 'com visão a Bola de Fogo sai');

// NPC do mundo não tapa a magia
ok(s.obstaculos.filter((k) => k.gente).length === (MAPA_CLAREIRA.npcs || []).length, 'NPCs parados marcados (não tapam)');
