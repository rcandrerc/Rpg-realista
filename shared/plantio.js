// Árvores plantadas (André 2026-11-16, entrega 3 do plantio, mapa v6 aprovado): a semente vem da Rosa e se planta numa
// área de plantio (as faixas na beira das estradas e os bosques perto das vilas e bairros, PLANTIO.areas) ou no seu
// terreno. Sem regar: só o tempo. O chão é uma grade fixa de quadrados de 4 m (1 árvore por quadrado, a árvore antiga
// ocupa 2 x 2); cada árvore sai até 0,8 m do meio, gira e muda de tamanho, então fica natural. Muda e jovem ninguém
// corta; a adulta qualquer um corta (no terreno, só o dono). Plantar já paga XP do herói e do Lenhador, então vale
// a pena mesmo se outro colher. Cortou a árvore inteira: ela some e o quadrado fica livre de novo.
// As regras ficam aqui e entram na Simulacao (Object.assign, como o transporte); os números e as áreas, em dados.js.
import { ARVORES_PLANTIO as AP, PLANTIO, ITENS, naBaseCla } from './dados.js';
import { contar, tirar, gastarVigor, NIVEL_MAX } from './progresso.js';

const r2 = (n) => Math.round(n * 100) / 100;
const Q = PLANTIO.quadrado;

// quadrados das áreas de plantio: 'i,k' -> id da área (PLANTIO.areas guarda por linha: "k:i0~i1,i2;k2:...")
export const QUADRADOS_PLANTIO = new Map();
for (const A of PLANTIO.areas) for (const linha of A.q.split(';')) {
  const [k, runs] = linha.split(':');
  for (const r of runs.split(',')) { const [a, b] = r.split('~').map(Number); for (let i = a; i <= (Number.isFinite(b) ? b : a); i++) QUADRADOS_PLANTIO.set(i + ',' + k, A.id); }
}
export const areaPlantio = (i, k) => QUADRADOS_PLANTIO.get(i + ',' + k) || null;
// onde fica o tronco no quadrado (sorteio fixo pela posição: o mesmo no servidor e no celular)
export function lugarNoQuadrado(i, k, grande = false) {
  const h = (Math.imul(i, 73856093) ^ Math.imul(k, 19349663)) >>> 0, s = PLANTIO.solto;
  return { x: i * Q + (grande ? Q : Q / 2) + ((h & 255) / 255 * 2 - 1) * s, z: k * Q + (grande ? Q : Q / 2) + (((h >>> 8) & 255) / 255 * 2 - 1) * s,
    ry: ((h >>> 16) & 1023) / 1023 * 6.28, sc: 0.85 + ((h >>> 26) & 63) / 63 * 0.3 };
}
// quadrados de uma árvore: o de baixo à esquerda (i, k) e, se for grande, os outros três
const quadradosDe = (i, k, grande) => (grande ? [[i, k], [i + 1, k], [i, k + 1], [i + 1, k + 1]] : [[i, k]]);
// o quadrado (i, k) de uma árvore a partir do tronco (o sorteio nunca passa de 0,8 m do meio)
const quadradoDoTronco = (x, z, grande) => (grande ? [Math.round(x / Q) - 1, Math.round(z / Q) - 1] : [Math.floor(x / Q), Math.floor(z / Q)]);
export const tempoArvore = (s) => (AP[s]?.h || 1) * 3600; // s para ficar adulta
// fase pela fração crescida: 0 muda, 1 jovem, 2 adulta (PLANTIO.fases)
export const faseArvore = (f) => (f >= 1 ? 2 : f < PLANTIO.fases[0] ? 0 : 1);

export const Plantio = {
  iniciarPlantio() {
    this.plantadas = new Map(); // id 'p12' -> { id, s, x, z, ry, sc, dono, nome, quando (ms), lote? }
    this.plantioQ = new Map(); // 'i,k' -> id (quadrado ocupado)
    this.plantioProx = 1;
    this.plantioMudou = false; // grava no banco (plantioParaSalvar)
    this.plantioLista = null; // o que vai na foto (refeito só quando muda)
  },
  adultaEm(P) { return P.quando + tempoArvore(P.s) * 1000; },
  // m = { s: tipo da árvore, x, z: onde o celular mirou (perto do herói), q: só aquele quadrado (modo plantio do app) }
  plantarArvore(id, m) {
    const j = this.jogadores.get(id); if (!j || j.criando || j.morto || !m) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const T = AP[m.s]; if (!T) return;
    const p = j.prog, semente = 'semente_' + m.s;
    if (j.esc || !j.chao || j.veiculo) return aviso('Fique no chão para plantar');
    if (contar(p.mochila, semente) < 1) return aviso(`Você não tem semente de ${T.nome.toLowerCase()} (a Rosa vende)`);
    let x = Number(m.x), z = Number(m.z);
    if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x - j.x, z - j.z) > PLANTIO.perto) { x = j.x; z = j.z; }
    const q = this.quadradoParaPlantar(j, x, z, T, aviso, !!m.q); if (!q) return; // q: o quadrado exato que o jogador tocou (modo plantio)
    if (!gastarVigor(p, PLANTIO.vigor)) return aviso('Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)');
    if (j.montado) j.montado = null; // desce do lobo sozinho, como na horta
    tirar(p.mochila, semente, 1);
    const L = lugarNoQuadrado(q.i, q.k, !!T.grande);
    this.botarPlantada({ id: 'p' + this.plantioProx++, s: m.s, x: r2(L.x), z: r2(L.z), ry: r2(L.ry), sc: r2(L.sc * (T.s || 1)),
      dono: j.conta || j.id, nome: j.nome, quando: this.agoraMs(), ...(q.lote ? { lote: q.lote } : {}) });
    this.pontosProf(j, 'len', PLANTIO.len); // paga na hora: vale a pena mesmo se outro colher
    if (p.nivel < NIVEL_MAX) this.ganharXP(j, PLANTIO.xp);
    this.evento({ t: 'plantou', para: id, s: m.s, x: r2(L.x), z: r2(L.z) });
    aviso(`${T.nome} plantada! Fica adulta em ${T.h} h`);
    this.historia(j, 'arvore', { k: m.s }); // diária "Plante 4 árvores" (shared/diarias.js)
    this.avisarProg(j);
  },
  // o quadrado mais perto de (x, z) onde dá para plantar ({ i, k, lote? }), ou null (já avisou o motivo)
  quadradoParaPlantar(j, x, z, T, aviso, exato = false) {
    const grande = !!T.grande, L = this.loteDe ? this.loteDe(j) : null;
    const minhasMudas = () => { let n = 0; const agora = this.agoraMs(); for (const P of this.plantadas.values()) if (P.dono === (j.conta || j.id) && !P.lote && agora < this.adultaEm(P)) n++; return n; };
    const ci = Math.floor(x / Q) - (grande ? 1 : 0), ck = Math.floor(z / Q) - (grande ? 1 : 0), cand = [];
    for (let di = -1; di <= 1; di++) for (let dk = -1; dk <= 1; dk++) {
      const i = ci + di, k = ck + dk, l = lugarNoQuadrado(i, k, grande);
      cand.push({ i, k, d: Math.hypot(l.x - x, l.z - z), l });
    }
    cand.sort((a, b) => a.d - b.d);
    if (exato) { const i = Math.floor(x / Q), k = Math.floor(z / Q); cand.length = 0; cand.push({ i, k, d: 0, l: lugarNoQuadrado(i, k, grande) }); }
    let motivo = '';
    const por = (t) => { if (!motivo) motivo = t; return false; };
    const serve = (c) => {
      const qs = quadradosDe(c.i, c.k, grande);
      if (qs.some(([i, k]) => this.plantioQ.has(i + ',' + k))) return por('Já tem árvore nesse quadrado');
      // terreno do jogador: só o dono planta (o quadrado inteiro dentro do terreno, sem peça nem horta em cima)
      const noLote = L && qs.every(([i, k]) => i * Q >= L.def.x0 && (i + 1) * Q <= L.def.x1 && k * Q >= L.def.z0 && (k + 1) * Q <= L.def.z1);
      const areas = qs.map(([i, k]) => areaPlantio(i, k));
      if (!noLote && qs.some(([i, k]) => naBaseCla((i + 0.5) * Q, (k + 0.5) * Q))) return por('Aqui é a base de um clã: só dá para plantar no seu lote'); // André 2026-11-22: base pode ficar em área de plantio
      if (!noLote && !areas.every((a) => a && a === areas[0])) return por(grande ? 'A árvore antiga precisa de 2 x 2 quadrados livres da área de plantio' : 'Plante numa área de plantio (veja no mapa) ou no seu terreno');
      if (noLote) {
        const x0 = c.i * Q, z0 = c.k * Q, x1 = x0 + Q * (grande ? 2 : 1), z1 = z0 + Q * (grande ? 2 : 1);
        if (L.pecas.some((pc) => pc.x > x0 - 0.8 && pc.x < x1 + 0.8 && pc.z > z0 - 0.8 && pc.z < z1 + 0.8)) return por('Tem construção nesse quadrado');
        if (Object.keys(L.horta || {}).some((h) => { const [a, b] = h.split(',').map(Number); return a + 1 > x0 && a < x1 && b + 1 > z0 && b < z1; })) return por('Tem horta nesse quadrado');
      }
      if (this.pertoNaMata(c.l.x, c.l.z).some((o) => Math.hypot(o.x - c.l.x, o.z - c.l.z) < o.r + PLANTIO.folga)) return por('Perto demais de outra árvore ou pedra');
      c.lote = noLote ? L.def.id : null;
      return true;
    };
    const ok = cand.find(serve);
    if (!ok) { aviso(motivo || 'Não dá para plantar aqui'); return null; }
    if (ok.lote && this.loteTravado(this.lotes.get(ok.lote), aviso)) return null;
    // limite do mundo (André 2026-11-17: no máximo 8-9 mil árvores no total): cheio, só planta quando alguém cortar uma
    if (!ok.lote && this.plantadasNasAreas() >= PLANTIO.maxMundo) { aviso('As áreas de plantio estão cheias. Corte uma árvore adulta para abrir espaço'); return null; }
    if (!ok.lote && minhasMudas() >= PLANTIO.mudasMax) { aviso(`Você já tem ${PLANTIO.mudasMax} mudas crescendo nas áreas de plantio`); return null; }
    return ok;
  },
  // árvores plantadas fora dos terrenos (as que contam no PLANTIO.maxMundo)
  plantadasNasAreas() { let n = 0; for (const P of this.plantadas.values()) if (!P.lote) n++; return n; },
  botarPlantada(P) {
    const T = AP[P.s], [i, k] = quadradoDoTronco(P.x, P.z, !!T.grande);
    this.plantadas.set(P.id, P);
    for (const [a, b] of quadradosDe(i, k, !!T.grande)) this.plantioQ.set(a + ',' + b, P.id);
    this.coletaveis.set(P.id, { id: P.id, tipo: 'arvore', x: P.x, z: P.z, r: r2(0.32 * P.sc), plantada: true });
    this.plantioMudou = true; this.plantioLista = null;
  },
  tirarPlantada(id) {
    const P = this.plantadas.get(id); if (!P) return;
    const T = AP[P.s], [i, k] = quadradoDoTronco(P.x, P.z, !!T?.grande);
    for (const [a, b] of quadradosDe(i, k, !!T?.grande)) if (this.plantioQ.get(a + ',' + b) === id) this.plantioQ.delete(a + ',' + b);
    this.plantadas.delete(id); this.coletaveis.delete(id); this.veiosComuns.delete(id);
    this.plantioMudou = true; this.plantioLista = null;
  },
  // dá para cortar? '' = dá. Muda e jovem ninguém corta; no terreno, só o dono
  motivoCortarPlantada(j, no) {
    const P = this.plantadas.get(no.id); if (!P) return 'Essa árvore já foi cortada';
    const falta = (this.adultaEm(P) - this.agoraMs()) / 1000;
    if (falta > 0) return `${AP[P.s].nome} ainda está crescendo: fica adulta em ${falta < 5400 ? Math.ceil(falta / 60) + ' min' : Math.round(falta / 3600) + ' h'}`;
    if (P.lote && P.dono !== (j.conta || j.id)) return 'Essa árvore é do dono do terreno';
    return '';
  },
  // última machadada numa árvore plantada: o resto da lenha e o que o tipo dá; ela some e o quadrado fica livre
  cortouPlantada(j, no, por) {
    const P = this.plantadas.get(no.id); if (!P) return;
    const T = AP[P.s];
    const resto = T.lenha - 3; // as 3 batidas já deram 1 lenha cada
    if (resto > 0) por('lenha', resto);
    for (const [k, n] of Object.entries(T.da || {})) if (ITENS[k]) por(k, n);
    for (const [k, ch] of Object.entries(T.raro || {})) if (ITENS[k] && Math.random() < ch) por(k, 1);
    this.tirarPlantada(no.id);
  },
  // o que vai na foto: [id, tipo, x, z, ry, escala] e a hora (ms) em que fica adulta (server/visao.js manda só perto)
  fotoPlantadas() {
    if (!this.plantioLista) this.plantioLista = [...this.plantadas.values()].map((P) => ({ id: P.id, x: P.x, z: P.z, ate: this.adultaEm(P), a: [P.id, P.s, P.x, P.z, P.ry, P.sc] }));
    return this.plantioLista;
  },
  // banco (tabela mundo, chave 'plantadas'): [n, tipo, x, z, ry, escala, dono, quando, lote]; null = nada mudou
  plantioParaSalvar() {
    if (!this.plantioMudou) return null;
    this.plantioMudou = false;
    return [...this.plantadas.values()].map((P) => [+P.id.slice(1), P.s, P.x, P.z, P.ry, P.sc, P.dono, P.quando, P.lote || null]);
  },
  carregarPlantio(lista) {
    if (!Array.isArray(lista)) return;
    for (const v of lista) {
      if (!Array.isArray(v) || !AP[v[1]] || !Number.isFinite(+v[0]) || !Number.isFinite(+v[2]) || !Number.isFinite(+v[3])) continue;
      const P = { id: 'p' + v[0], s: v[1], x: +v[2], z: +v[3], ry: +v[4] || 0, sc: +v[5] || 1, dono: String(v[6] || ''), nome: '', quando: +v[7] || this.agoraMs(), ...(v[8] ? { lote: String(v[8]) } : {}) };
      const [i, k] = quadradoDoTronco(P.x, P.z, !!AP[P.s].grande);
      if (this.plantadas.has(P.id) || quadradosDe(i, k, !!AP[P.s].grande).some(([a, b]) => this.plantioQ.has(a + ',' + b))) continue;
      this.botarPlantada(P);
      this.plantioProx = Math.max(this.plantioProx, +v[0] + 1);
    }
    this.plantioMudou = false;
  },
};
