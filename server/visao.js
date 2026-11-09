// Área de interesse (o que cada jogador vê): em vez de mandar o mundo inteiro 20 vezes por segundo para todo mundo,
// cada celular recebe só os monstros, jogadores e efeitos que estão perto do herói dele.
// Antes: os 111 monstros iam para todos (~22 KB por foto, ~3,6 Mbit/s por jogador). Agora vai só o pedaço de perto,
// e de cada corpo só o que mudou desde a última foto que aquele celular recebeu:
//   - parte que muda sempre (posição, vida, animação, golpe): vai quando mudou;
//   - parte que quase não muda (nome, nível, tipo, roupa, aparência, corpo, modo): vai na primeira vez e quando muda;
//   - nada mudou (monstro parado): vai só {"id"} para o celular saber que ele continua ali.
// Quem tem só o "id" (ou falta parte) o app completa com o que já sabia (online.gd: _juntar).
//
// Só vale para o app Godot que avisa que entende (opção "aoi" ao entrar). O site e APKs antigos seguem recebendo tudo.
// Quem sai do raio some no celular (o app esconde o monstro que não veio na foto) e volta quando chega perto de novo.
// Entrar e sair usam raios diferentes (histerese) para nada ficar piscando na borda.

export const VISAO = {
  inimigoEntra: 80, // m: o app esconde o corpo do monstro a 70 m (LONGE_INIMIGO no main.gd), então chega antes
  inimigoSai: 92,
  jogadorEntra: 120, // outros jogadores aparecem de mais longe (são poucos e chamam mais atenção)
  jogadorSai: 135,
  maxJogadores: 30, // multidão (cidade cheia): só os 30 mais perto aparecem; o resto fica no mapa
  meiaVelocidade: 40, // m: corpo mais longe que isso atualiza 10 vezes por segundo em vez de 20 (o app desliza entre as fotos)
  evento: 100, // efeito, número de dano e magia mais longe que isso não vão (ninguém veria)
  mapaCada: 10, // a cada 10 fotos (0,5 s) vai a lista leve de onde está todo mundo (mapa grande e minimapa)
};

// o que muda quase toda foto
const MUDA_J = ['x', 'y', 'z', 'ry', 'vida', 'morto', 'anim', 'acao', 'acaoSeq', 'escudo', 'coleta', 'montado', 'pack', 'veiculo'];
const MUDA_I = ['x', 'y', 'z', 'ry', 'vida', 'morto', 'anim', 'acao', 'acaoSeq', 'ef'];
// o que quase não muda. Dos OUTROS jogadores o celular só usa isto (online.gd: outro e animar);
// recargas, missões, mana, estamina e build são só do dono e vão só para ele (inteiro, como antes).
const FIXO_J = ['vidaMax', 'nome', 'nivel', 'roupa', 'semCapacete', 'visual', 'aparencia', 'modo', 'bot']; // bot: a Cecília (shared/amiga.js)
const FIXO_I = ['vidaMax', 'nome', 'tipo', 'v', 'nivel'];
// pedaço de JSON sem as chaves de fora: "x":1,"z":2 (null entra; undefined fica de fora, igual ao JSON.stringify)
const pedaco = (o, ks) => { let s = ''; for (const k of ks) if (o[k] !== undefined) s += (s ? ',' : '') + JSON.stringify(k) + ':' + JSON.stringify(o[k]); return s; };
const r1 = (n) => Math.round(n * 10) / 10;

export class Visao {
  constructor() {
    this.vendo = new Map(); // sessionId -> Map(id do corpo -> { m: parte que muda, f: parte fixa }) do que ele já recebeu
    this.passos = 0;
  }

  esquecer(id) { this.vendo.delete(id); }

  // uma vez por passo: cada corpo e cada evento viram texto JSON uma vez só (depois cada jogador só junta os dele)
  preparar(foto, eventos) {
    this.passos++;
    const pos = new Map(); // id -> {x, z} (para achar onde aconteceu o evento que só diz "id" ou "alvo")
    const jogadores = [];
    let total = 0;
    for (const j of foto.jogadores) {
      pos.set(j.id, j);
      if (j.criando) { jogadores.push({ c: j, fora: true }); continue; } // no palco do criador: fora do mundo
      total++;
      jogadores.push({ c: j, id: JSON.stringify(j.id), m: pedaco(j, MUDA_J), f: pedaco(j, FIXO_J) });
    }
    const inimigos = foto.inimigos.map((e) => { pos.set(e.id, e); return { c: e, id: JSON.stringify(e.id), m: pedaco(e, MUDA_I), f: pedaco(e, FIXO_I) }; });
    const evs = [];
    for (const ev of eventos) {
      let x = ev.x, z = ev.z;
      if (typeof x !== 'number' || typeof z !== 'number') {
        const o = pos.get(ev.id ?? ev.alvo);
        if (o) { x = o.x; z = o.z; } else { x = z = null; } // sem lugar (nível, veio...): vai para todos
      }
      evs.push({ para: ev.para, x, z, s: JSON.stringify(ev) });
    }
    const mapa = this.passos % VISAO.mapaCada === 1
      ? JSON.stringify(foto.jogadores.filter((j) => !j.criando).map((j) => [j.id, r1(j.x), r1(j.z)]))
      : null;
    // spots de pesca e carga (packs no chão, carrinhos e navios: FASE 1) vão iguais para todos
    return { foto, pos, jogadores, inimigos, evs, total, mapa, veios: JSON.stringify(foto.veios || []), spots: JSON.stringify(foto.spots || []), carga: JSON.stringify(foto.carga || { packs: [], veic: [] }) };
  }

  // a mensagem "mundoJ" de um jogador: só o que está perto do herói dele, e de cada corpo só o que mudou
  paraJogador(ctx, id) {
    const eu = ctx.pos.get(id);
    let viu = this.vendo.get(id);
    if (!viu) this.vendo.set(id, (viu = new Map()));
    const px = eu ? eu.x : 0, pz = eu ? eu.z : 0;
    const meia = VISAO.meiaVelocidade ** 2 / (ctx.total > VISAO.maxJogadores * 2 ? 4 : 1), // muita gente: meia velocidade já a partir de 20 m
      impar = this.passos & 1;
    const dentro = (o, entra, sai) => { // distância² se está no raio (quem já via usa o raio de sair), senão -1
      const d2 = (o.c.x - px) ** 2 + (o.c.z - pz) ** 2;
      const r = viu.has(o.c.id) ? sai : entra;
      return d2 <= r * r ? d2 : -1;
    };
    const corpo = (o, d2) => {
      const antes = viu.get(o.c.id);
      let s = '"id":' + o.id;
      if (!antes || (antes.m !== o.m && !(impar && d2 > meia))) { if (o.m) s += ',' + o.m; if (antes) antes.m = o.m; }
      if (!antes || antes.f !== o.f) { if (o.f) s += ',' + o.f; if (antes) antes.f = o.f; }
      if (!antes) viu.set(o.c.id, { m: o.m, f: o.f });
      return '{' + s + '}';
    };
    const js = [];
    let perto = [];
    for (const o of ctx.jogadores) {
      if (o.c.id === id) { js.push(JSON.stringify(o.c)); continue; } // eu: tudo (recargas, missões, mana...)
      if (o.fora) continue;
      const d2 = dentro(o, VISAO.jogadorEntra, VISAO.jogadorSai);
      if (d2 >= 0) perto.push([viu.has(o.c.id) ? d2 * 0.8 : d2, o, d2]); else viu.delete(o.c.id);
    }
    if (perto.length > VISAO.maxJogadores) { // multidão: os mais perto (quem já estava na tela tem um pouco de preferência)
      perto.sort((a, b) => a[0] - b[0]);
      for (let k = VISAO.maxJogadores; k < perto.length; k++) viu.delete(perto[k][1].c.id);
      perto = perto.slice(0, VISAO.maxJogadores);
    }
    for (const [, o, d2] of perto) js.push(corpo(o, d2));
    const is = [];
    for (const o of ctx.inimigos) {
      const d2 = dentro(o, VISAO.inimigoEntra, VISAO.inimigoSai);
      if (d2 >= 0) is.push(corpo(o, d2)); else viu.delete(o.c.id); // longe: some no celular
    }
    // quem sumiu do servidor (monstro que acabou de virar fumaça, jogador que saiu) sai da lista também
    if (viu.size > is.length + js.length) {
      const tem = new Set([...ctx.jogadores, ...ctx.inimigos].map((o) => o.c.id));
      for (const k of viu.keys()) if (!tem.has(k)) viu.delete(k);
    }
    const r2ev = VISAO.evento * VISAO.evento;
    const es = [];
    for (const ev of ctx.evs) {
      if (ev.para) { if (ev.para === id) es.push(ev.s); continue; }
      if (ev.x === null || (ev.x - px) ** 2 + (ev.z - pz) ** 2 <= r2ev) es.push(ev.s);
    }
    return `{"foto":{"tempo":${ctx.foto.tempo},"aoi":1,"total":${ctx.total},"jogadores":[${js.join(',')}],"inimigos":[${is.join(',')}],"veios":${ctx.veios},"spots":${ctx.spots},"carga":${ctx.carga}${ctx.mapa ? `,"mapa":${ctx.mapa}` : ''}},"eventos":[${es.join(',')}]}`;
  }
}
