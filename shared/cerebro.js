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
