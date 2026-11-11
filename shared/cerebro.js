// Cérebro dos NPCs por regras (André 2026-11-11, inspirado nos bots do WoW: AzerothCore + playerbots).
// Nada de IA aqui: o NPC lê o que está em volta (sentidos), passa pela lista de regras em ordem de prioridade e a
// primeira que bate decide a ação. As regras são DADOS (CEREBRO.regras em shared/dados.js), no mesmo formato que as
// dicas do jogador vão usar depois: { id, pri, quando: [[sentido, op, valor]], faca, por, texto }.
//   op: '<' '>' '=' '!'. valor que começa com '$' lê outro sentido (ex.: '$limPocao' = o limite de poção desse NPC).
// O jeito de cada NPC (coragem, cuidado, gosto pelo cajado) muda os limites, então o mesmo motor dá NPCs diferentes.
// Custa pouco: decide CEREBRO.pensar vezes por segundo (cada NPC num tick diferente); entre uma decisão e outra só
// executa a última (andar, bater).

const valor = (s, v) => (typeof v === 'string' && v[0] === '$' ? s[v.slice(1)] : v);

// a regra bate com o que o NPC está vendo?
export function confere(s, quando) {
  for (const [k, op, v] of quando) {
    const a = s[k], b = valor(s, v);
    if (a === undefined || b === undefined) return false;
    if (op === '<' ? !(a < b) : op === '>' ? !(a > b) : op === '=' ? a !== b : op === '!' ? a === b : true) return false;
  }
  return true;
}

// regras em ordem (maior prioridade primeiro; empate fica na ordem da lista)
export function ordenarRegras(regras) {
  return regras.map((r, i) => [r, i]).sort((a, b) => (b[0].pri - a[0].pri) || (a[1] - b[1])).map(([r]) => r);
}

// a primeira regra que bate (ou null)
export function decidir(s, regras) {
  for (const r of regras) if (confere(s, r.quando)) return r;
  return null;
}

// limites que saem do jeito do NPC (e das dicas antigas, que continuam valendo)
export function limites(jeito, base) {
  return {
    limPocao: base.pocao,
    limCura: base.curaDono,
    limCuraSi: base.curaVida,
    limFugir: base.fugir,
    limRecuar: 0.35 + 0.4 * (1 - jeito.coragem), // corajosa só recua do golpe carregado com a vida mais baixa
    limProteger: 0.4 + 0.4 * jeito.cuidado, // cuidadoso vai ajudar o aliado mais cedo
  };
}

// Espada ou cajado (não tem classe: o estilo é a arma na mão). Pontua o cajado pela situação; troca só depois de
// C.trocaMin s da última troca e com folga (histerese) para não ficar piscando.
export function escolherArma(s, jeito, atual, C) {
  let p = jeito.cajado;
  if (s.distAlvo > C.longe) p += 0.35; // alvo longe: atira em vez de correr atrás
  if (s.vida < 0.45 && s.pertoDeMim >= 2) p += 0.3; // apanhando de vários com pouca vida: se afasta atirando
  if (s.agrupados >= 3 && s.mana > 0.5) p += 0.2; // monstros juntos: magia de área
  if (s.mana < 0.15) p -= 0.3;
  if (s.distAlvo < 2.2 && s.vida >= 0.45) p -= 0.25; // colado e com vida: espada
  const quer = atual === 'Magia' ? (p >= C.ficar ? 'Magia' : 'Espada') : (p >= C.trocar ? 'Magia' : 'Espada');
  return quer;
}

// ---------- dica vira regra (entrega 2) ----------
const OPS = { n: ['<', '>'], b: ['='], a: ['='] };
// regra que veio da IA (ou do banco) -> regra limpa, ou null se não dá para seguir. C = CEREBRO.
export function validarRegra(r, C) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.quando)) return null;
  const D = C.dicas, faca = r.faca;
  if (!Object.hasOwn(C.acoes, faca)) return null;
  if (r.quando.length < 1 || r.quando.length > D.condicoes) return null;
  const quando = [];
  for (const q of r.quando) {
    if (!Array.isArray(q) || q.length !== 3) return null;
    const [k, op, v] = q, S = C.sentidos[k];
    if (!S || !OPS[S.tipo].includes(op)) return null;
    if (S.tipo === 'n' && !(typeof v === 'number' && Number.isFinite(v) && v >= -100 && v <= 1000)) return null;
    if (S.tipo === 'b' && typeof v !== 'boolean') return null;
    if (S.tipo === 'a' && v !== 'Espada' && v !== 'Magia') return null;
    quando.push([k, op, v]);
  }
  const pri = Number.isFinite(r.pri) ? Math.min(D.priMax, Math.max(D.priMin, Math.round(r.pri))) : D.pri;
  const por = Number.isFinite(r.por) ? Math.min(D.por[1], Math.max(D.por[0], r.por)) : D.porPadrao;
  const texto = String(r.texto || C.acoes[faca]).replace(/\s+/g, ' ').trim().slice(0, D.texto);
  const out = { id: String(r.id || 'dica').slice(0, 24), pri, quando, faca, por, texto };
  if (typeof r.autor === 'string') out.autor = r.autor.slice(0, 64);
  if (Number.isFinite(r.t)) out.t = r.t;
  return out;
}
// duas regras falam da mesma situação (mesmos sentidos)? Aí a nova substitui a velha (ex.: "usa espada no chefe" depois
// de "usa cajado no chefe"). Ações da mesma família (trocar de arma; atacar ou não) também contam como a mesma coisa.
const FAMILIA = { usarCajado: 'arma', usarEspada: 'arma', atacar: 'luta', naoAtacar: 'luta', proteger: 'luta', recuar: 'luta', fugir: 'luta' };
export function mesmaSituacao(a, b) {
  const ka = a.quando.map(([k, op]) => k + op).sort().join(), kb = b.quando.map(([k, op]) => k + op).sort().join();
  return ka === kb && (a.faca === b.faca || (FAMILIA[a.faca] && FAMILIA[a.faca] === FAMILIA[b.faca]));
}
// junta a dica nova na lista do NPC: troca a que fala da mesma situação; passou do máximo, sai a mais velha
export function juntarDica(lista, nova, max) {
  const l = lista.filter((d) => !mesmaSituacao(d, nova));
  const trocou = l.length < lista.length;
  l.push(nova);
  while (l.length > max) l.shift();
  return { lista: l, trocou };
}
