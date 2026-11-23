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
  // NPCs (André 2026-11-11: 22 vivendo no mundo; Poco X7 e celulares mais fracos): aparecem de mais perto e no máximo os
  // maxBots mais perto ficam com corpo na tela (cada corpo VRoid pesa); o resto continua no mapa e no minimapa
  // 2026-11-11 (André: a vila travava com os 20 aventureiros juntos, FPS 18-40): 55/65 m e no máximo 8 corpos; no app
  // só os 4 mais perto ficam com sombra, contorno e cabelo com mola (online.gd _detalhe_outros)
  botEntra: 55, botSai: 65, maxBots: 8,
  meiaVelocidade: 40, // m: corpo mais longe que isso atualiza 10 vezes por segundo em vez de 20 (o app desliza entre as fotos)
  evento: 100, // efeito, número de dano e magia mais longe que isso não vão (ninguém veria)
  mapaCada: 10, // a cada 10 fotos (0,5 s) vai a lista leve de onde está todo mundo (mapa grande e minimapa)
  // árvores cortadas e veios batidos (André 2026-11-16, árvores plantadas): antes a lista inteira ia em toda foto
  // para todo mundo (1.000 árvores cortadas = ~22 KB por foto, ~430 KB/s por jogador). Agora vai só o que está a
  // menos de veio m do herói, e cada um só uma vez (de novo só se mudar). O app já faz a árvore voltar sozinho
  // no tempo certo (trabalho.gd), então quem sai da lista não precisa de aviso.
  veio: 140,
};

// o que muda quase toda foto
const MUDA_J = ['x', 'y', 'z', 'ry', 'vida', 'morto', 'anim', 'acao', 'acaoSeq', 'escudo', 'coleta', 'montado', 'pack', 'veiculo', 'guerra', 'prot', 'bd']; // bd: lugar no convés do navio (shared/transporte.js fotoBordo) // guerra/prot: Chama x Geada (o app mira na outra raça por eles; André 2026-11-22 "continuo não conseguindo atacar os Geada")
const MUDA_I = ['x', 'y', 'z', 'ry', 'vida', 'morto', 'anim', 'acao', 'acaoSeq', 'ef'];
// o que quase não muda. Dos OUTROS jogadores o celular só usa isto (online.gd: outro e animar);
// recargas, missões, mana, estamina e build são só do dono e vão só para ele (inteiro, como antes).
const FIXO_J = ['vidaMax', 'nome', 'nivel', 'tit', 'roupa', 'semCapacete', 'visual', 'aparencia', 'modo', 'bot', 'raca']; // bot: a Cecília (shared/amiga.js)
const FIXO_I = ['vidaMax', 'nome', 'tipo', 'v', 'nivel', 'hc', 'esc', 'cor']; // hc/esc/cor: chefe com nome da história (CHEFES_HISTORIA)
// pedaço de JSON sem as chaves de fora: "x":1,"z":2 (null entra; undefined fica de fora, igual ao JSON.stringify)
const pedaco = (o, ks) => { let s = ''; for (const k of ks) if (o[k] !== undefined) s += (s ? ',' : '') + JSON.stringify(k) + ':' + JSON.stringify(o[k]); return s; };
const r1 = (n) => Math.round(n * 10) / 10;

export class Visao {
  // onde(id) -> {x, z} do veio ou da árvore (Simulacao.coletaveis). Sem ele, a lista inteira vai para todos (como antes).
  constructor(onde = null) {
    this.vendo = new Map(); // sessionId -> Map(id do corpo -> { m: parte que muda, f: parte fixa }) do que ele já recebeu
    this.plantasVistas = new Map(); // sessionId -> Set(ids das árvores plantadas que ele já recebeu)
    this.veiosVistos = new Map(); // sessionId -> Map(id do veio -> chave "cargas@hora de voltar") do que ele já recebeu
    this.onde = onde;
    this.passos = 0;
  }

  esquecer(id) { this.vendo.delete(id); this.veiosVistos.delete(id); this.plantasVistas.delete(id); }

  // uma vez por passo: cada corpo e cada evento viram texto JSON uma vez só (depois cada jogador só junta os dele)
  preparar(foto, eventos) {
    this.passos++;
    // de 30 em 30 s os veios de perto vão de novo (seguro barato: o app ignora o que já sabia; cobre um app que refez a mata)
    if (this.passos % 600 === 0) for (const vv of this.veiosVistos.values()) vv.clear();
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
    // raça no 4º lugar (só quem não é da Chama): o app esconde a outra raça longe, menos com o Pó de rastreio (André 2026-11-22)
    const mapa = this.passos % VISAO.mapaCada === 1
      ? JSON.stringify(foto.jogadores.filter((j) => !j.criando).map((j) => (j.raca ? [j.id, r1(j.x), r1(j.z), j.raca] : [j.id, r1(j.x), r1(j.z)])))
      : null;
    // spots de pesca e carga (packs no chão, carrinhos e navios: FASE 1) vão iguais para todos
    // veios: com onde(), cada um leva o lugar e a chave (muda quando outro bate ou quando a hora de voltar muda)
    let veios = null, veiosL = null;
    if (this.onde) {
      veiosL = [];
      for (const v of foto.veios || []) {
        const c = this.onde(v[0]);
        if (c) veiosL.push({ id: v[0], x: c.x, z: c.z, k: v[1] + '@' + Math.round(foto.tempo + v[2]), s: JSON.stringify(v) });
      }
    } else veios = JSON.stringify(foto.veios || []);
    // de 1 em 1 s: quem voltou sai da memória de cada jogador (ids que ainda estão caídos)
    const veiosIds = veiosL && this.passos % 20 === 0 ? new Set(veiosL.map((v) => v.id)) : null;
    // árvores plantadas (shared/plantio.js): cada uma vai uma vez para quem chega perto; a que some vai como [id]
    const plantas = foto.plantadas || [], plantasIds = this.passos % 20 === 0 ? new Set(plantas.map((p) => p.id)) : null;
    return { plantas, plantasIds, agoraMs: foto.agoraMs || Date.now(), veiosIds, foto, pos, jogadores, inimigos, evs, total, mapa, veios, veiosL, spots: JSON.stringify(foto.spots || []), carga: JSON.stringify(foto.carga || { packs: [], veic: [] }) };
  }

  // a mensagem "mundoJ" de um jogador: só o que está perto do herói dele, e de cada corpo só o que mudou
  paraJogador(ctx, id) {
    const eu = ctx.pos.get(id);
    let viu = this.vendo.get(id);
    if (!viu) this.vendo.set(id, (viu = new Map()));
    const esp = eu?.espia ? ctx.pos.get(eu.espia) : null; // "Ver" o recruta: em volta dele (shared/cla.js espiar)
    const px = esp ? esp.x : eu ? eu.x : 0, pz = esp ? esp.z : eu ? eu.z : 0;
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
    const bots = [];
    for (const o of ctx.jogadores) {
      if (o.c.id === id) { js.push(JSON.stringify(o.c)); continue; } // eu: tudo (recargas, missões, mana...)
      if (o.fora) continue;
      const bot = !!o.c.bot, d2 = bot ? dentro(o, VISAO.botEntra, VISAO.botSai) : dentro(o, VISAO.jogadorEntra, VISAO.jogadorSai);
      if (d2 >= 0) (bot ? bots : perto).push([viu.has(o.c.id) ? d2 * 0.8 : d2, o, d2]); else viu.delete(o.c.id);
    }
    if (bots.length > VISAO.maxBots) { // muitos NPCs juntos (a vila de noite): só os mais perto ganham corpo
      bots.sort((a, b) => a[0] - b[0]);
      for (let k = VISAO.maxBots; k < bots.length; k++) viu.delete(bots[k][1].c.id);
      bots.length = VISAO.maxBots;
    }
    perto.push(...bots);
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
    let veios = ctx.veios;
    if (ctx.veiosL) { // só os de perto que ele ainda não recebeu assim
      let vv = this.veiosVistos.get(id);
      if (!vv) this.veiosVistos.set(id, (vv = new Map()));
      const r2v = VISAO.veio * VISAO.veio, vs = [];
      for (const v of ctx.veiosL) {
        if (vv.get(v.id) === v.k || (v.x - px) ** 2 + (v.z - pz) ** 2 > r2v) continue;
        vv.set(v.id, v.k); vs.push(v.s);
      }
      if (ctx.veiosIds) for (const k of vv.keys()) if (!ctx.veiosIds.has(k)) vv.delete(k); // voltou: esquece (o app já fez voltar sozinho)
      veios = '[' + vs.join(',') + ']';
    }
    let pv = this.plantasVistas.get(id);
    if (!pv) this.plantasVistas.set(id, (pv = new Set()));
    const ps = [], r2p = VISAO.veio * VISAO.veio;
    for (const p of ctx.plantas) {
      if (pv.has(p.id) || (p.x - px) ** 2 + (p.z - pz) ** 2 > r2p) continue;
      pv.add(p.id);
      ps.push(JSON.stringify([...p.a, Math.max(0, Math.round((p.ate - ctx.agoraMs) / 1000))])); // + s até ficar adulta
    }
    if (ctx.plantasIds) for (const k of pv) if (!ctx.plantasIds.has(k)) { pv.delete(k); ps.push(JSON.stringify([k])); } // cortada: some
    return `{"foto":{"tempo":${ctx.foto.tempo},"aoi":1,"total":${ctx.total},"jogadores":[${js.join(',')}],"inimigos":[${is.join(',')}],"veios":${veios},"plantadas":[${ps.join(',')}],"spots":${ctx.spots},"carga":${ctx.carga}${ctx.mapa ? `,"mapa":${ctx.mapa}` : ''}},"eventos":[${es.join(',')}]}`;
  }
}
