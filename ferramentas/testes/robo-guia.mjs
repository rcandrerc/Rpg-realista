// Robô do guia (André 2026-11-14: "essa missão e a anterior tá muito zoada... a gente fez uma auditoria e você disse
// que tava top"). Para cada missão da história, um herói começa nela e faz SÓ o que o quadrinho manda: junta o item que
// o texto pede, cria, colhe, fala. Falha se: a etapa ou o andamento voltam para trás; o guia pede de novo a mesma coisa
// sem andar (vai-e-volta); o texto fica vazio; a missão não termina; a etapa com lugar fica sem "Ir".
// Uso: node ferramentas/testes/robo-guia.mjs [id da missão]
import { Simulacao, MAPA_CLAREIRA, HISTORIA, ITENS, RECEITAS, PLANTAS, LOJA } from '../../shared/index.js';
import { guardar, contar } from '../../shared/progresso.js';
import { etapasDe, totalEtapa } from '../../shared/historia.js';
const so = process.argv[2];
let falhas = 0;
const falhou = (m) => { falhas++; console.error('FALHOU', m); };
const npcDe = (id) => MAPA_CLAREIRA.npcs.find((n) => n.id === id);

// O NPC que brilha (o Falar da HUD pisca só do lado dele, guia.gd npc_da_etapa: hi.npc ou o NPC do "Ir") tem que ser o
// NPC que a etapa pede, e o "Ir" tem que levar a ele (André 2026-11-15: "o balão dele fica brilhando mas a missão, se eu
// apertar em Ir, é pra falar com outro NPC"). Etapas cujo guia passa pelo Falar (guia.gd passos com "hud:falar"):
const COM_FALAR = new Set(['falar', 'vender', 'comprar', 'pack_fez', 'pack', 'passe', 'resetar', 'sintetizar', 'leilao']);
const npcBrilha = (hi) => hi?.npc || hi?.alvo?.npc || '';
function confereNpc(M, hi, quero, onde) {
  if (hi?.npc && hi.alvo && hi.alvo.npc !== hi.npc) falhou(`${M.id} ${onde}: brilha ${hi.npc} mas o Ir leva a ${hi.alvo.npc || hi.alvo.nome}`);
  if (quero && npcBrilha(hi) !== quero) falhou(`${M.id} ${onde}: a etapa pede ${quero} mas brilha "${npcBrilha(hi)}" ("${hi?.txt}")`);
}
let conferidas = 0, vezesTime = 0;
const vezesDe = (E, h) => Math.max(1, totalEtapa(E) - h.n);

function jogar(i) {
  const M = HISTORIA[i], L = etapasDe(M);
  const s = new Simulacao(MAPA_CLAREIRA);
  const j = s.adicionarJogador('R', 'Robo', undefined, { conta: 1 });
  j.criando = false; j.x = -24; j.z = 59;
  const p = j.prog; p.nivel = Math.max(M.nv, 1); p.ouro = 0;
  s.comprarLote; p.ouro = 99999; s.comprarLote('R', { x0: -28, z0: 55, x1: -20, z1: 63 }); p.ouro = 0;
  p.mochila.fill(null); if (p.mochila.length < 160) while (p.mochila.length < 160) p.mochila.push(null);
  for (const k of Object.keys(p.prof || {})) p.prof[k] = 999999; // profissão alta: o nível não é o que se testa aqui
  p.hist = { v: 2, p: i, ac: false, e: 0, n: 0, m: 0, ...(i ? { u: HISTORIA[i - 1].id } : {}) };
  s.estacaoPerto = () => ({}); // está do lado da estação certa (bigorna, fornalha, fogão, bancada)
  confereNpc(M, s.histInfo(j), M.npc, 'para aceitar'); conferidas++;
  s.falaHistoria(j, npcDe(M.npc), () => {}, true); // aceita a missão com o NPC (o kit da primeira etapa vem junto)
  if (!p.hist.ac) { falhou(`${M.id}: não deu para aceitar`); return []; }
  s.eventos = [];
  let ultimo = { e: 0, n: 0 }, voltas = new Map(), achados = [];
  const comprados = new Set(), celulas = [];
  for (let a = -27; a <= -21; a++) for (let b = 56; b <= 62; b++) celulas.push(a + ',' + b);
  const nota = (m) => { if (!achados.includes(m)) achados.push(m); };
  for (let it = 0; it < 3000; it++) {
    const h = p.hist;
    if (h.p > i) return achados; // entregou
    const E = L[h.e];
    // nunca para trás
    if (h.e < ultimo.e || (h.e === ultimo.e && h.n < ultimo.n)) falhou(`${M.id} "${M.nome}": voltou de ${ultimo.e}:${ultimo.n} para ${h.e}:${h.n} (${E?.txt})`);
    ultimo = { e: h.e, n: h.n };
    p.vigor = { v: 999, t: Date.now() }; j.vida = j.vidaMax;
    const hi = s.histInfo(j);
    if (!hi?.txt || /undefined|NaN|null/.test(hi.txt)) falhou(`${M.id} etapa ${h.e + 1}: texto ruim "${hi?.txt}"`);
    const f = s.juntaDe(j, E);
    if (E && !f && COM_FALAR.has(E.ev) && !(E.ev === 'passe' && E.k === 'usar')) { // NPC da etapa: falar = E.npc; o resto = o NPC do alvo
      const quero = E.ev === 'falar' ? E.npc : (typeof E.alvo === 'string' && E.alvo.startsWith('npc:') ? E.alvo.slice(4) : '');
      if (!quero) falhou(`${M.id} etapa ${h.e + 1}: etapa "${E.ev}" sem NPC`);
      confereNpc(M, hi, quero, `etapa ${h.e + 1}`); conferidas++;
    } else if (hi?.npc) confereNpc(M, hi, '', `etapa ${h.e + 1}`);
    // quantidade sempre à vista, entre parênteses (André 2026-11-14: "faça a barra de ferro (0/1)", o "6/8" é a parte)
    if (!f?.pre && !/\(\d+\/\d+\)/.test(hi.txt)) falhou(`${M.id} etapa ${h.e + 1}: sem a quantidade entre parênteses: "${hi.txt}"`);
    if (f && !f.pre && f.fonte) {
      const ch = `${h.e}:${h.n}:${f.k}:${f.tem}:${f.n}:${f.para || ""}`;
      voltas.set(ch, (voltas.get(ch) || 0) + 1);
      if (process.env.VER) console.log('  ', hi.txt, JSON.stringify(f), contar(p.mochila, f.k));
      if (voltas.get(ch) > 2) { falhou(`${M.id} etapa ${h.e + 1}: o guia pede "${hi.txt}" e não anda`); return achados; }
      if (['veio:arvore', 'solto', 'lote', 'spot', 'loja', 'plantar', 'cresce', 'regar'].includes(f.fonte) || f.fonte.startsWith('veio:') || f.fonte.startsWith('caca:')) {
        if (!hi.alvo && f.fonte !== 'loja') nota(`etapa ${h.e + 1} "${hi.txt}": sem Ir`);
      }
      // horta e loja de verdade (André 2026-11-16: "não fala a quantidade, então eu compro um... é pra plantar 8"): o
      // robô compra a quantidade com que o app abre a compra (hi.qtd), ara, planta e colhe no lote; se depois o guia
      // pede de novo a mesma semente, a compra pediu pouco
      if (f.fonte === 'loja' && LOJA.some((o) => o.k === f.k && !(o.r > 0))) {
        const q = Math.max(1, hi.qtd | 0);
        if (hi.ev !== 'comprar' || hi.k !== f.k || !hi.qtd) falhou(`${M.id} etapa ${h.e + 1}: "${hi.txt}" sem a quantidade para a compra (qtd)`);
        if (q < f.n - f.tem) falhou(`${M.id} etapa ${h.e + 1}: "${hi.txt}" mas a compra abre com ${q}`);
        if (comprados.has(`${h.e}:${f.k}`) && /^semente_/.test(f.k)) { falhou(`${M.id} etapa ${h.e + 1}: comprou ${f.k} e o guia manda comprar de novo ("${hi.txt}")`); return achados; }
        comprados.add(`${h.e}:${f.k}`);
        const rosa = MAPA_CLAREIRA.npcs.find((n) => n.funcao === 'loja'), x = j.x, z = j.z;
        j.x = rosa.x + 1; j.z = rosa.z; p.ouro = 999999;
        s.item('R', { acao: 'comprar', i: LOJA.findIndex((o) => o.k === f.k && !(o.r > 0)), n: q });
        j.x = x; j.z = z; p.ouro = 0;
        continue;
      }
      if (f.fonte === 'plantar' && PLANTAS[f.k]) {
        if (f.n > contar(p.mochila, 'semente_' + f.k) + f.tem) falhou(`${M.id} etapa ${h.e + 1}: "${hi.txt}" mas só tem ${contar(p.mochila, 'semente_' + f.k)} semente(s)`);
        const c = celulas.find((x) => !s.loteDe(j).horta[x]?.c);
        if (!c) { falhou(`${M.id}: lote cheio`); return achados; }
        p.vigor = { v: 999, t: Date.now() };
        if (!s.loteDe(j).horta[c]) s.horta('R', { acao: 'arar', c });
        s.horta('R', { acao: 'plantar', c, s: f.k }); s.checarEtapa(j);
        // André 2026-11-16: "itens de plantação da missão ficassem prontos imediatamente": a planta da missão nasce madura
        const t = s.loteDe(j).horta[c]; if (t?.c === f.k && t.g < PLANTAS[f.k].G) falhou(`${M.id} etapa ${h.e + 1}: plantou ${f.k} e não ficou pronta na hora ("${hi.txt}")`);
        continue;
      }
      if ((f.fonte === 'cresce' || f.fonte === 'regar') && PLANTAS[f.k]) falhou(`${M.id} etapa ${h.e + 1}: a horta da missão espera crescer ("${hi.txt}")`);
      if (f.fonte === 'lote' && PLANTAS[f.k]) {
        const c = celulas.find((x) => s.loteDe(j).horta[x]?.c === f.k && s.loteDe(j).horta[x].g >= PLANTAS[f.k].G);
        if (c) { p.vigor = { v: 999, t: Date.now() }; s.horta('R', { acao: 'colher', c }); s.checarEtapa(j); continue; }
      }
      if (f.k === 'ouro') p.ouro = f.n; else if (ITENS[f.k]) guardar(p.mochila, { k: f.k, n: f.n - f.tem });
      else { falhou(`${M.id}: item desconhecido ${f.k}`); return achados; }
      continue;
    }
    if (f?.pre) { nota(`etapa ${h.e + 1}: passo antes "${f.txt}" (feito à mão)`); s.proximaEtapa(j); continue; }
    if (!E) { falhou(`${M.id}: sem etapa`); return achados; }
    const vezes = Math.max(1, totalEtapa(E) - h.n);
    // a ação da etapa
    // etapa de time (André 2026-11-14: "ela recusa e fico preso"): o robô chama a Cecília pelo botão, como o jogador,
    // sem chave de IA e com o sorteio sempre dizendo não. Na missão ela não pode negar.
    // André 2026-11-16: sem ninguém, fecha a tela e vai sozinho. Uma etapa de time sim, outra não, o robô vai sozinho
    // (a missão e a caverna depois têm que dar certo sem time)
    if (E.ev === 'time' && !j.time && (vezesTime++ % 2 === 0)) {
      const e0 = h.e, p0 = h.p; s.time('R', { acao: 'sozinho' });
      if (p.hist.e === e0 && p.hist.p === p0) { falhou(`${M.id} etapa ${h.e + 1}: fechou a tela de amigos e não seguiu sozinho (a missão trava)`); return achados; }
      continue;
    }
    if (E.ev === 'time' && !j.time) {
      if (!s.amiga) { s.amigaEntrar('R', false); Object.assign(s.amiga, { x: j.x + 1, z: j.z }); }
      const rnd = Math.random; Math.random = () => 0.999;
      s.time('R', { acao: 'convidar', com: s.amiga.id }); Math.random = rnd;
      if (!j.time) { falhou(`${M.id} etapa ${h.e + 1}: chamou a Cecília para o time e ela recusou (a missão trava)`); return achados; }
      s.checarEtapa(j); continue;
    }
    if (E.ev === 'criar' && E.ja === 'tem' && contar(p.mochila, E.k) > 0) { s.checarEtapa(j); continue; }
    if (E.ev === 'criar' && Object.values(RECEITAS).some((R) => R.faz === E.k) && !E.ja) {
      const r = Object.entries(RECEITAS).find(([, R]) => R.faz === E.k)[0];
      const a = s.eventos.length, e0 = h.e, n0 = h.n; s.criarUm('R', { r });
      const av = s.eventos.slice(a).filter((x) => x.t === 'aviso').map((x) => x.texto);
      if (p.hist.e === e0 && p.hist.n === n0 && p.hist.p === i) { falhou(`${M.id} etapa ${h.e + 1}: "${hi.txt}" mas criar falha: ${av.join(' | ')}`); return achados; }
      continue;
    }
    if (E.ev === 'falar') {
      const n = npcDe(E.npc); if (!n) { falhou(`${M.id}: NPC ${E.npc}`); return achados; }
      if (!hi.alvo) nota(`etapa ${h.e + 1} "${hi.txt}": sem Ir para o NPC`);
      const a = p.hist.e; s.falaHistoria(j, n, () => {}, true);
      if (p.hist.e === a && p.hist.p === i) { falhou(`${M.id} etapa ${h.e + 1}: falou com ${E.npc} e nada ("${hi.txt}")`); return achados; }
      continue;
    }
    // "Plante 6 sementes de rabanete" (André 2026-11-16: comprou 1 e já mandava plantar): o guia só manda plantar com todas
    // as sementes na mochila; o robô planta de verdade no lote, e cada uma tem que nascer pronta (cota da missão)
    if (E.ev === 'plantar') {
      const ks = E.k ? [E.k] : ['cenoura', 'batata', 'rabanete'], sem = ks.reduce((a, k) => a + contar(p.mochila, 'semente_' + k), 0);
      if (sem < vezesDe(E, h)) falhou(`${M.id} etapa ${h.e + 1}: "${hi.txt}" manda plantar ${vezesDe(E, h)} com ${sem} semente(s)`);
      const k = ks.find((q) => contar(p.mochila, 'semente_' + q) > 0); if (!k) { s.historia(j, E.ev, { k: E.k }); continue; }
      const c = celulas.find((x) => !s.loteDe(j).horta[x]?.c); if (!c) { falhou(`${M.id}: lote cheio`); return achados; }
      if (!s.loteDe(j).horta[c]) s.horta('R', { acao: 'arar', c });
      s.horta('R', { acao: 'plantar', c, s: k }); s.checarEtapa(j);
      const t = s.loteDe(j).horta[c]; if (t?.c === k && t.g < PLANTAS[k].G) falhou(`${M.id} etapa ${h.e + 1}: plantou ${k} e não ficou pronta na hora`);
      continue;
    }
    if (E.ev === 'colher' || E.ev === 'regar') { s.historia(j, E.ev, { k: E.k }); continue; }
    // diárias (André 2026-11-16, missão da Rosa): abre a aba como o app e planta as sementes que ela deu, de verdade,
    // numa área de plantio (o Ir da diária); se travar, a diária de plantar não serve para a missão
    if (E.ev === 'diaria_vista') { s.diaria('R', { acao: 'ver' }); continue; }
    if (E.ev === 'diaria') {
      s.eventos = []; s.diaria('R', { acao: 'ir', id: 'arvores' });
      const a = s.eventos.find((x) => x.t === 'diaria_ir')?.alvo;
      if (!a) { falhou(`${M.id} etapa ${h.e + 1}: a diária de plantar sem Ir`); return achados; }
      if (contar(p.mochila, 'semente_betula') < 4) { falhou(`${M.id} etapa ${h.e + 1}: a Rosa não deu as 4 sementes`); return achados; }
      const e0 = h.e;
      for (let t = 0; t < 40 && p.hist.e === e0 && p.hist.p === i; t++) { j.x = a.x + (t % 8) * 4; j.z = a.z + Math.floor(t / 8) * 4; j.chao = true; p.vigor = { v: 999, t: Date.now() }; s.plantarArvore('R', { s: 'betula', x: j.x, z: j.z }); }
      if (p.hist.e === e0 && p.hist.p === i) { falhou(`${M.id} etapa ${h.e + 1}: plantou e a diária não fechou (${JSON.stringify(s.diariasInfo(j)?.l?.[0])})`); return achados; }
      s.eventos = []; s.diaria('R', { acao: 'receber', id: 'arvores' });
      if (!s.diariasInfo(j)?.l?.[0]?.r) falhou(`${M.id}: não deu para receber a diária de plantar`);
      continue;
    }
    const d = { k: [].concat(E.k ?? [])[0], npc: E.npc, campo: E.campos?.[0], sala: E.salas?.[0], tipo: E.tipos?.[0], hc: E.hc, de: E.de, skill: true, barco: true, v: E.min, n: vezes };
    const a = `${p.hist.e}:${p.hist.n}`; s.historia(j, E.ev, d);
    if (`${p.hist.e}:${p.hist.n}` === a && p.hist.p === i) { s.checarEtapa(j); if (`${p.hist.e}:${p.hist.n}` === a && p.hist.p === i) s.proximaEtapa(j); }
  }
  falhou(`${M.id} "${M.nome}": não terminou (etapa ${p.hist.e + 1}: ${s.textoEtapa(j)})`);
  return achados;
}
HISTORIA.forEach((M, i) => {
  if (so && M.id !== so) return;
  const a = jogar(i);
  console.log(`${M.id} Cap ${M.cap} ${M.nome}: ${a.length ? a.join(' · ') : 'ok'}`);
});
if (!so && conferidas < HISTORIA.length * 2) falhou(`só ${conferidas} conferências do NPC que brilha`);
console.log(`NPC que brilha = NPC da etapa: ${conferidas} conferências`);
console.log(falhas ? `${falhas} falha(s)` : 'robô do guia: todas as missões ok');
if (falhas) process.exitCode = 1;
