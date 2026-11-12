// Teste da progressão até o Nv 100 (André 2026-11-10): missões principais em ordem, zonas fechadas pela névoa, o que
// abre por nível e conta antiga ganhando as missões até o nível dela. Uso: node ferramentas/testes/progressao.mjs
import { Simulacao, MAPA_CLAREIRA, HISTORIA, ZONAS, LIBERA_NIVEL, CACA, TOTENS, xpProximo } from '../../shared/index.js';
import { progressoValido } from '../../shared/progresso.js';
import { ZONAS_GEO, zonaFechadaEm, liberado, histPorNivel, motivoLibera, naZona } from '../../shared/historia.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Ana');
const correr = (seg) => { const ev = []; for (let t = 0; t < seg / 0.05; t++) ev.push(...s.passo(0.05)); return ev; };
const avisos = (ev) => ev.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto).join(' | ');
const npc = (id) => s.mapa.npcs.find((n) => n.id === id);
const ir = (x, z) => Object.assign(j, { x, z, y: s.terreno.altura(x, z), cliente: null, orcT: null });

// dados: toda missão aponta para NPC, campo e zona que existem; cada zona é liberada por uma missão
for (const M of HISTORIA) {
  ok(!!npc(M.npc), `${M.id}: NPC ${M.npc} existe`);
  for (const c of M.matar?.campos || []) ok(CACA.some((k) => k.id === c), `${M.id}: campo ${c} existe`);
  // o NPC da missão fica fora das zonas que ainda estão fechadas quando ele dá a missão
  const p = { nivel: M.nv, hist: { p: HISTORIA.indexOf(M), ac: false, n: 0 } };
  const N = npc(M.npc); ok(!zonaFechadaEm(p, N.x, N.z), `${M.id}: ${N.nome} está fora da névoa na hora da missão`);
  // e os campos da missão já estão liberados
  for (const c of M.matar?.campos || []) { const k = CACA.find((o) => o.id === c); ok(!zonaFechadaEm(p, k.x, k.z), `${M.id}: campo ${c} já aberto`); }
}
for (const Z of ZONAS) ok(HISTORIA.some((M) => M.libera.includes(Z.id)), `zona ${Z.id} tem missão`);
ok(HISTORIA.every((M, i) => !i || M.nv >= HISTORIA[i - 1].nv), 'missões em ordem de nível');

// regiões (André 2026-11-11): a Vila (R0) começa aberta com o campo Nv 1 e o Nv 3; o resto do mapa de hoje fechado
const novo = { nivel: 1, hist: { p: 0, ac: false, n: 0 } };
const campo = (id) => CACA.find((k) => k.id === id);
ok(!zonaFechadaEm(novo, campo('caca1').x, campo('caca1').z) && !zonaFechadaEm(novo, campo('caca2').x, campo('caca2').z), 'campos Nv 1 e Nv 3 abertos no começo');
for (const id of ['caca3', 'caca5', 'caca6', 'caca9', 'caca11']) ok(!!zonaFechadaEm(novo, campo(id).x, campo(id).z), `${id} fechado no começo`);
for (const n of ['lider', 'ferreiro', 'curandeira', 'andarilho', 'comerciante', 'reset']) ok(!zonaFechadaEm(novo, npc(n).x, npc(n).z), `${n} fora da névoa no começo`);
// história v2, Entrega 3 (plano aprovado pelo André 2026-11-11): a Mirela, a alquimista, muda para a Vila do Rio Claro
ok(npc('alquimista').vila === 'rio_claro' && liberado(progressoValido({ nivel: 31, mochila: [] }), 'B1'), 'alquimista no Rio Claro, aberto com o Oeste de Vael');
// toda região cobre um pedaço de terra de verdade e todo campo de caça fora da Vila cai em alguma região
for (const k of CACA) { const Z = ZONAS_GEO.find((z) => naZona(z, k.x, k.z)); ok(['caca1', 'caca2'].includes(k.id) ? !Z : !!Z, `campo ${k.id} na região ${Z?.id || 'Vila'}`); }
for (const t of TOTENS.lista) { const Z = ZONAS_GEO.find((z) => naZona(z, t.x, t.z)); ok(t.id === 'clareira' ? !Z : !!Z, `totem ${t.id} na zona ${Z?.id || '-'}`); }

// conta antiga: as missões até o nível dela contam como feitas
ok(progressoValido({ nivel: 31, mochila: [] }).hist.p === HISTORIA.filter((M) => M.nv <= 31).length && liberado(progressoValido({ nivel: 31, mochila: [] }), 'B1'), 'conta antiga Nv 31 abre até o Oeste de Vael');
ok(progressoValido({ nivel: 100, mochila: [] }).hist.p === HISTORIA.length, 'conta antiga Nv 100 abre tudo');
ok(j.prog.hist.p === 0, 'personagem novo começa na missão 1');

// névoa: entrar no campo dos lobos (fechado) não deixa e avisa
ir(104, 52); correr(0.1);
let ok1 = s.posicaoCliente('A', { x: 104, y: s.terreno.altura(104, 40), z: 40, ry: 0 });
ok(!ok1, 'não entra nos Campos do Leste fechados');
let ev = correr(0.1); ok(true, 'aviso: ' + avisos(ev));

// capítulo 1 (história v2): o Aldo dá "Acordar"; a missão que abre os Campos do Leste é a 3ª (a3). O teste inteiro do
// Ato I fica em ferramentas/testes/historia.mjs; aqui só o essencial da névoa.
const L = npc('lider'); ir(L.x + 1, L.z); s.falar('A'); ev = correr(0.1);
ok(j.prog.hist.ac && j.prog.hist.p === 0, 'Aldo deu a missão 1: ' + avisos(ev));
const i3 = HISTORIA.findIndex((M) => M.id === 'a3');
Object.assign(j.prog.hist, { p: i3, ac: true, e: 0, n: 0 });
const ci = s.cacas.findIndex((c) => c.def.id === 'caca1');
for (let k = 0; k < 6; k++) s.contarHistoria(j, { tipo: 'puglin', sp: { caca: ci } });
ok(j.prog.hist.e === 1, 'contou 6 Puglins: agora o Gorduncho');
s.contarHistoria(j, { tipo: 'puglin', sp: { caca: ci }, hc: 'gorduncho' });
ir(77, -8); correr(0.6);
ok(j.prog.hist.e === 3, 'tocou no fragmento: volta ao Aldo');
const ouro0 = j.prog.ouro; ir(L.x + 1, L.z); s.falar('A'); ev = correr(0.1);
ok(j.prog.hist.p === i3 + 1 && liberado(j.prog, '1b') && j.prog.ouro > ouro0, 'entregou: Campos do Leste liberados | ' + avisos(ev));
ok(s.posicaoCliente('A', { x: j.x, y: j.y, z: j.z, ry: 0 }) !== false, 'segue andando');

// forja: antes da missão do Tomás, não cria; na etapa de fundir, libera
ok(/Tomás|forja/.test(motivoLibera(j.prog, 'forja')), 'forja fechada antes da missão do cobre: ' + motivoLibera(j.prog, 'forja'));
j.prog.nivel = 3; const T = npc('ferreiro'); ir(T.x + 1, T.z); s.falar('A'); correr(0.1);
ok(j.prog.hist.ac && HISTORIA[j.prog.hist.p].id === 'a4', 'Tomás deu a missão do cobre');
s.historia(j, 'item', { k: 'minerio_cobre', n: 6, de: 'coleta' });
ok(liberado(j.prog, 'forja'), 'minerou o cobre: a forja abre para fundir');

// níveis
ok(motivoLibera({ nivel: 4 }, 'receita', 'peitoral') === 'Libera no nível 8', 'peitoral no Nv 8');
ok(motivoLibera({ nivel: 9 }, 'evoluir', 2) === 'Libera no nível 20' && motivoLibera({ nivel: 20 }, 'evoluir', 2) === '', 'Épico no Nv 20');
ok(motivoLibera({ nivel: 14 }, 'obra', 'carrinho') === 'Libera no nível 15', 'carrinho no Nv 15');
ok(motivoLibera({ nivel: 11 }, 'pack') !== '' && motivoLibera({ nivel: 12 }, 'pack') === '', 'packs no Nv 12');

// lobo: sem a missão do Bento não monta
j.montado = null; s.montar('A'); ev = correr(0.1); ok(!j.montado, 'sem a missão 3 não monta: ' + avisos(ev));
// subir de nível avisa o que abriu (e a missão do Bento, a próxima depois do capítulo 2)
Object.assign(j.prog.hist, { p: HISTORIA.findIndex((M) => M.id === 'a7'), ac: false, e: 0, n: 0 });
s.ganharXP(j, xpProximo(3) + xpProximo(4) + 1); ev = correr(0.1);
ok(/Liberado: .*Capacete|Liberado: .*Fornalha/.test(avisos(ev)) && /Missão nova: fale com Bento/.test(avisos(ev)), 'Nv 5 avisa o que abriu e a missão nova | ' + avisos(ev));

// totem numa zona fechada: não viaja
j.prog.totens = ['clareira', 'rio_claro']; j.prog.ouro = 5000; const C = TOTENS.lista[0]; ir(C.x + 3, C.z); correr(0.1);
s.irTotem('A', 'rio_claro'); ev = correr(0.2); ok(/Região fechada: .*Conclua a missão/.test(avisos(ev)), 'totem dentro da névoa não leva: ' + avisos(ev));
// ilha e Aurora: a terra inteira (e um pouco de mar) fecham
ok(zonaFechadaEm(j.prog, 200, 662)?.id === 'C' && zonaFechadaEm(j.prog, 200, 1085)?.id === 'D1' && !zonaFechadaEm(j.prog, 200, 520), 'ilha e Aurora fechadas, o mar do meio aberto');

// monstro de região fechada não persegue nem apanha de quem está fora (André 2026-11-11: puxou mob pela névoa)
{ const s2 = new Simulacao(MAPA_CLAREIRA); const k = s2.adicionarJogador('K', 'Kai');
  const ci3 = s2.cacas.findIndex((c) => c.def.id === 'caca3'); const b = s2.inimigos.find((e) => e.sp?.caca === ci3 && !e.morto) || s2.criarInimigo({ tipo: 'lobo', x: 104, z: 30, caca: ci3, nivel: 5 });
  ok(s2.mobFechadoPara(b, k), 'lobo do campo fechado conta como fechado para o herói Nv 1');
  const v0 = b.vida; s2.ferir(b, 50, k); ok(b.vida === v0, 'golpe do herói de fora não tira vida dele');
  k.prog.hist.p = HISTORIA.findIndex((M) => M.id === 'a3') + 1; ok(!s2.mobFechadoPara(b, k), 'depois da missão dos Puglins vale de novo'); }

// André 2026-11-11: "consegui passar pela névoa andando esquisito". O celular insiste em andar para dentro; o servidor
// recusa, anda o herói pelo joystick e antes ele escalava a borda da névoa como parede. Agora tem que ficar fora.
{ const s3 = new Simulacao(MAPA_CLAREIRA); const k = s3.adicionarJogador('K', 'Kai'); k.prog.nivel = 10; k.prog.hist = { p: 0, ac: false, n: 0 };
  for (const mont of [null, 'lobo']) for (const [x0, z0, dx, dz] of [[80, 0, 1, 0], [0, 60, 0, 1], [-50, 0, -1, 0], [0, -60, 0, -1]]) {
    Object.assign(k, { x: x0, z: z0, y: s3.terreno.altura(x0, z0), cliente: null, orcT: null, montado: mont, esc: null });
    let cx = x0, cz = z0;
    for (let t = 0; t < 600; t++) {
      k.entrada = { mx: dx, mz: dz, correr: true };
      const c = s3.passo(0.05).find((e) => e.t === 'corrigir' && e.para === 'K'); if (c) { cx = c.x; cz = c.z; }
      cx += dx * 0.4; cz += dz * 0.4; s3.posicaoCliente('K', { x: cx, y: s3.terreno.altura(cx, cz), z: cz, ry: 0 });
    }
    ok(!zonaFechadaEm(k.prog, k.x, k.z), `insistindo para ${dx > 0 ? 'leste' : dx < 0 ? 'oeste' : dz > 0 ? 'sul' : 'norte'}${mont ? ' de lobo' : ''} não entra na névoa (parou em ${k.x.toFixed(0)}, ${k.z.toFixed(0)})`);
  } }

// regiões redondas (André 2026-11-11, desenho regioes-v3-arredondadas.png): cada campo, vila e totem na região certa
{ const { LUGARES_MUNDO } = await import('../../shared/mundo.js');
  const onde = (x, z) => ZONAS_GEO.find((Z) => !Z.selo && naZona(Z, x, z))?.id || 'Vila';
  const pos = {}; for (const c of CACA) pos[c.id] = c; for (const l of LUGARES_MUNDO) pos[l.id] ??= l; for (const t of TOTENS.lista) pos['t_' + t.id] = t; for (const n of MAPA_CLAREIRA.npcs) pos['n_' + n.id] ??= n;
  const esp = { Vila: 'caca1 caca2 t_clareira n_lider n_ferreiro n_m_lenha n_m_pedra', '1b': 'caca3 caca4 caca5 n_guardiao n_m_metal', '1c': 'caca6 caca8 n_m_horta n_m_peixe',
    '1d': 'caca7 caca9 caca10', '1f': 'caca11 caca12', B1: 'c_v1 c_v2 c_v3 t_rio_claro posto_oeste', B2: 'c_v7 c_v8 cav_serra_norte', B3: 'c_v5 c_v6 c_v9 cav_juncos t_juncos',
    B4: 'c_v4 vila_vael t_porto_vael', C: 'c_i1 c_i2 c_i3 c_i4 cav_ilha t_ilha', D1: 'c_a1 c_a2 c_a3 c_a4 cav_aurora vila_aurora t_aurora', D2: 'c_a5 c_a6 c_a7 c_a8 t_posto_leste', D3: 'c_a9 cav_nevoa' };
  for (const [Z, lista] of Object.entries(esp)) for (const id of lista.split(' ')) ok(onde(pos[id].x, pos[id].z) === Z, `${id} na região ${Z} (está em ${onde(pos[id].x, pos[id].z)})`);
  // as minas de cada campo do mundo ficam na região do campo
  for (const l of LUGARES_MUNDO.filter((q) => q.tipo === 'mina')) { const c = pos[l.id.split('_').slice(1, 3).join('_')]; if (c) ok(onde(l.x, l.z) === onde(c.x, c.z), `mina ${l.id} na região do campo`); }
  // borda redonda: nenhum canto em ângulo reto nos contornos das regiões de Vael
  let reto = 0; for (const Z of ZONAS_GEO.filter((q) => /^1|^B/.test(q.id) && q.poligono)) { const P = Z.poligono; for (let i = 0; i < P.length; i++) { const a = P[(i + P.length - 1) % P.length], b = P[i], c = P[(i + 1) % P.length]; const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]]; const cos = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v) || 1); if (cos < 0.3 && Math.abs(b[0]) < 590 && b[1] > -570) reto++; } }
  ok(reto === 0, `regiões sem quina (${reto})`); }
