// Regras do jogo, sem gráficos. O servidor roda esta simulação e manda o resultado aos jogadores.
// O cliente também consegue rodá-la sozinho (modo solo) quando não há servidor.
import { Terreno } from './terreno.js';
import { dentroDoMapa, limitarAoMapa } from './mapa.js';
import { HABS, ATRIBUTOS, XP_INIMIGO, NIVEL_MAX, PONTOS_POR_NIVEL, BARRAS, barraValida, xpProximo, calcularStatus, habNoNivel, progressoValido, passivasDe, usosParaSubir, SKILL_MAX, NIVEL_SEM_TOMO, guardar, nomeItem, precoVenda, ehEquip, profNivel, profBonus, mercador, chanceRaridade, vigorAgora, gastarVigor, contar, tirar } from './progresso.js';
import { ORCAMENTO, A, DURACAO, ARMA, BASICO, BASICO_MAGIA, CURA, ESCALADA, PARADO_PAREDE, SUBIDA, HABILIDADES, BUILD_PADRAO, buildValida, HEROI, MOVIMENTO, MISSOES, MONTARIAS, aparenciaValida, visualValido, nomeValido, TIPOS_INIMIGO, COMBATE_INIMIGO, PERSONAGENS, PERSONAGEM_PADRAO, ITENS, LOJA, LOJA_DISTANCIA, DROPS, ROMANO, MOCHILA, ESTAMINA, PROFISSOES, MERCADOR, COLETA, COLETA_DISTANCIA, VEIO_RAIO, RECEITAS, OFICINA, OFICINA_DISTANCIA, RARIDADE_CRIAR, RESET_BUILD } from './dados.js';

const TAU = Math.PI * 2;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angDif = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const r2 = (n) => Math.round(n * 100) / 100;

export class Simulacao {
  constructor(mapa) {
    this.mapa = mapa;
    this.tempo = 0;
    this.jogadores = new Map();
    this.inimigos = [];
    this.projeteis = [];
    this.campos = [];
    this.timers = [];
    this.eventos = [];
    this.proxId = 1;
    this.ator = null; // quem está agindo agora: vai junto nos eventos (campo "de"), para o celular não repetir o efeito que ele já mostrou
    // pedras: o herói usa a altura de verdade (pode subir); os inimigos só contornam um círculo
    this.terreno = new Terreno(mapa);
    const vila = mapa.vila || { casas: [], arvores: [] };
    // onde se coleta (Parte 3): veios do Minerador (v0, v1...) e as árvores do Lenhador (a0, a1...)
    this.coletaveis = new Map([
      ...(mapa.veios || []).map((v, i) => ['v' + i, { id: 'v' + i, tipo: v.tipo, x: v.x, z: v.z, r: VEIO_RAIO, ...(v.mina ? { mina: v.mina } : {}) }]),
      ...vila.arvores.map((a, i) => ['a' + i, { id: 'a' + i, tipo: 'arvore', x: a.x, z: a.z, r: 0.32 * a.s }]),
    ]);
    this.obstaculos = [...mapa.obstaculos, ...vila.arvores.map((a) => ({ x: a.x, z: a.z, r: 0.32 * a.s })), ...(mapa.veios || []).map((v) => ({ x: v.x, z: v.z, r: VEIO_RAIO })),
      ...(mapa.npcs || []).map((n) => ({ x: n.x, z: n.z, r: 0.3 })), ...this.terreno.postes];
    // casas: retângulo girado (meia largura / meia profundidade); inimigos não atravessam, o herói escala (shared/terreno.js)
    this.casas = vila.casas.map((c) => ({ x: c.x, z: c.z, cos: Math.cos(c.ry), sin: Math.sin(c.ry), hw: c.w / 2 + 0.35, hd: c.d / 2 + 0.35 }));
    this.obstaculosRocha = this.terreno.rochas.map((r) => ({ x: r.x, z: r.z, r: r.R * 0.62 }));
    this.escadas = (mapa.escadas || []).map((e) => ({ ...e, alt: this.terreno.altura(e.topo.x, e.topo.z) }));
    mapa.inimigos.forEach((sp) => this.criarInimigo(sp));
    // campos de caça (CACA, regra do Quimera): cada vaga tem um índice v fixo (depois dos inimigos parados) e já começa cheia
    let v = mapa.inimigos.length;
    this.cacas = (mapa.caca || []).map((def, ci) => {
      const c = { def, vagas: def.tipos.map((tipo, k) => ({ tipo, k, v: v + k, e: null })), nx: 0, t: 0 };
      v += def.tipos.length;
      for (const vg of c.vagas) this.nascerNaCaca(c, ci, vg, true);
      return c;
    });
    // zonas de mineração (MINA): o minério de cada pedra é de todos (cargas e hora de voltar por veio)
    this.minas = new Map((mapa.mina || []).map((z) => [z.id, z]));
    this.veiosComuns = new Map();
  }
  // nasce um monstro na vaga do campo de caça, num ponto ao acaso (longe dos jogadores, fora de pedra, árvore e casa)
  nascerNaCaca(c, ci, vg, inicio = false) {
    const d = c.def;
    for (let t = 0; t < 8; t++) {
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * d.r * d.ate, x = d.x + Math.cos(a) * r, z = d.z + Math.sin(a) * r;
      if (!inicio && [...this.jogadores.values()].some((j) => !j.morto && Math.hypot(j.x - x, j.z - z) < d.longe)) continue;
      if (this.obstaculos.some((k) => Math.hypot(k.x - x, k.z - z) < k.r + 0.8) || !dentroDoMapa(this.mapa, x, z, 2.2)) continue;
      vg.e = this.criarInimigo({ tipo: vg.tipo, x, z, caca: ci, vaga: vg.k, v: vg.v });
      return true;
    }
    return false;
  }
  // Quimera (znSp): a cada "passo" s, se falta monstro, nasce um; o próximo em "rapido" s com menos da metade, senão "normal" s
  passoCacas(dt) {
    this.cacas.forEach((c, ci) => {
      const d = c.def;
      c.t -= dt; if (c.t > 0) return;
      c.t = d.passo;
      const vivos = c.vagas.filter((vg) => vg.e).length, vaga = c.vagas.find((vg) => !vg.e);
      if (!vaga || this.tempo < c.nx) return;
      if (this.nascerNaCaca(c, ci, vaga)) c.nx = this.tempo + (vivos < d.n / 2 ? d.rapido : d.normal);
      else c.nx = this.tempo + d.rapido;
    });
  }

  // ---------- entidades ----------
  novoCorpo(extra) {
    return { id: 'e' + this.proxId++, x: 0, z: 0, ry: 0, trava: 0, defesa: 0, morto: false, anim: 'Idle',
      acao: null, acaoSeq: 0, dash: null, y: 0, vy: 0, chao: true, esc: null, ...extra };
  }
  // opcoes.podeCriar: personagem ainda não foi criado (o criador abre uma vez só); opcoes.aparencia: a que já foi criada
  // opcoes.progresso: nível, atributos e skills guardados na conta (shared/progresso.js)
  adicionarJogador(id, nome, visual, { podeCriar = false, aparencia = null, progresso = null } = {}) {
    const n = this.mapa.nascimento;
    const j = this.novoCorpo({ id, tipo: 'jogador', nome: nome || 'Andarilho', x: n.x + (Math.random() - 0.5) * 3, z: n.z + (Math.random() - 0.5) * 3,
      vida: HEROI.vida, vidaMax: HEROI.vida, mana: HEROI.mana, build: [...BUILD_PADRAO], cds: {}, entrada: { mx: 0, mz: 0, correr: false },
      fila: null, modo: 'Espada', missoes: {}, falas: {}, sta: 0, staT: 0, semFolego: false, seguida: { k: 1, t: -9 }, combateAte: 0, ciente: false, coleta: null, coletas: {}, pulos: 0, puloT: 9, mortal: 0, pouso: 0, empurra: 0, bloqueado: false, arrancada: null, arrancadaNoAr: false, combos: {},
      visual: visualValido(visual) ? visual : PERSONAGEM_PADRAO, podeCriar: !!podeCriar });
    if (aparencia) j.aparencia = aparenciaValida(aparencia);
    j.prog = progressoValido(progresso);
    this.aplicarStatus(j, true);
    j.sta = j.staMax;
    this.jogadores.set(id, j);
    this.avisarProg(j);
    return j;
  }
  removerJogador(id) { this.jogadores.delete(id); }
  criarInimigo(sp) {
    const t = TIPOS_INIMIGO[sp.tipo];
    const e = this.novoCorpo({ tipo: sp.tipo, nome: t.nome, x: sp.x, z: sp.z, casa: { x: sp.x, z: sp.z }, vida: t.vida, vidaMax: t.vida,
      ataqueCd: 1 + Math.random(), sp, v: sp.v ?? this.mapa.inimigos.indexOf(sp) });
    e.anim = A.swordIdle;
    this.inimigos.push(e);
    return e;
  }
  todos() { return [...this.jogadores.values(), ...this.inimigos]; }
  inimigosDe(c) {
    return (c.tipo === 'jogador' ? this.inimigos : [...this.jogadores.values()]).filter((o) => !o.morto && !o.criando);
  }
  maisPerto(c, max = 22) {
    let melhor = null, md = max;
    for (const o of this.inimigosDe(c)) { const d = dist(o, c); if (d < md) { md = d; melhor = o; } }
    return melhor;
  }

  // ---------- comandos vindos dos jogadores ----------
  entrada(id, e) {
    const j = this.jogadores.get(id); if (!j || j.criando) return;
    // só número de verdade (texto, NaN ou infinito viram 0): o cliente manda a direção, a velocidade é daqui
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const mx = num(e?.mx), mz = num(e?.mz), m = Math.hypot(mx, mz);
    const k = m > 1 ? 1 / m : 1; // nunca mais rápido que o permitido
    j.entrada = { mx: mx * k, mz: mz * k, correr: e?.correr === true };
  }
  // Sobe ou desce da montaria (teste: por enquanto todo jogador tem o lobo)
  montar(id) {
    const j = this.jogadores.get(id);
    if (!j || j.morto || j.esc || j.criando || j.trava > 0) return;
    j.montado = j.montado ? null : 'lobo';
  }
  // Visual e aparência só mudam no criador, e o criador só abre uma vez (na criação da conta)
  trocarVisual(id, visual) {
    const j = this.jogadores.get(id);
    if (j?.criando && visualValido(visual)) j.visual = visual;
  }
  // Criando o personagem (no palco, fora do mapa): ninguém vê, nenhum inimigo persegue, não leva dano e não age.
  // Só entra quem ainda não criou o personagem; sair é sempre permitido.
  definirCriando(id, v) {
    const j = this.jogadores.get(id); if (!j) return;
    if (v && !j.podeCriar) return;
    j.criando = !!v;
    if (j.criando) { j.entrada = { mx: 0, mz: 0, correr: false }; j.fila = null; j.montado = null; }
  }
  // Cores e altura do criador de personagem (os outros jogadores veem igual)
  definirAparencia(id, a) {
    const j = this.jogadores.get(id); if (j?.criando) j.aparencia = aparenciaValida(a);
  }
  // Aparência mudada depois de criado (fora do criador): cores, altura e rosto. O nome não muda.
  mudarAparencia(id, a) {
    const j = this.jogadores.get(id); if (!j || j.criando) return null;
    const ap = aparenciaValida(a); if (!ap) return null;
    j.aparencia = ap;
    return ap;
  }
  // Corpo trocado depois de criado (criador do app Godot, pedido do André 2026-11-03): só os corpos da lista.
  // Devolve o corpo novo (para gravar na conta) ou null.
  mudarVisual(id, v) {
    const j = this.jogadores.get(id); if (!j || j.criando || !visualValido(v)) return null;
    j.visual = v;
    return v;
  }
  // "Pronto" no criador: grava nome, corpo e aparência de vez. Devolve o que valeu (para salvar na conta) ou null.
  concluirCriacao(id, p) {
    const j = this.jogadores.get(id); if (!j?.criando || !j.podeCriar) return null;
    const nome = nomeValido(p?.nome); if (!nome) return null;
    if (visualValido(p.visual)) j.visual = p.visual;
    j.aparencia = aparenciaValida(p.aparencia);
    j.nome = nome; j.podeCriar = false; j.criando = false;
    return { nome, visual: j.visual, aparencia: j.aparencia };
  }
  // Habilidades escolhidas pelo jogador para os botões (a build)
  definirBuild(id, build) {
    const j = this.jogadores.get(id); if (!j || !buildValida(build)) return;
    j.build = [...build];
  }
  // Espada na mão ou cajado na mão (a outra arma fica nas costas)
  trocarModo(id, modo) {
    const j = this.jogadores.get(id);
    if (j && (modo === 'Espada' || modo === 'Magia')) j.modo = modo;
  }
  // O celular decide o movimento do próprio herói e manda a posição (20 vezes por segundo); aqui só conferimos.
  // Velocidade: um "balde" de metros que enche na velocidade máxima de corrida (+30%) e guarda até ORCAMENTO.burst
  // (para dash, rolamento e golpes que avançam). Altura: nem embaixo do chão nem voando. Mapa: dentro do limite.
  // Se não bater, o herói fica onde o servidor sabe que ele está e o celular recebe "corrigir" (volta para lá).
  posicaoCliente(id, p) {
    const j = this.jogadores.get(id);
    if (!j || j.morto || j.criando) return false;
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    if (!p || !num(p.x) || !num(p.y) || !num(p.z) || !num(p.ry)) return false;
    if (p.e === 1) j.ciente = true; // app que conhece a estamina (o Godot): sem fôlego não corre
    const mont = MONTARIAS[j.montado], vmax = (mont ? Math.max(mont.correr, HEROI.correr) : j.ciente && j.semFolego ? HEROI.correr * ESTAMINA.trote : HEROI.correr) * 1.3;
    if (j.orcT == null) { j.orc = ORCAMENTO.burst; j.orcT = this.tempo; }
    j.orc = Math.min(ORCAMENTO.burst, j.orc + (this.tempo - j.orcT) * vmax); j.orcT = this.tempo;
    const d = Math.hypot(p.x - j.x, p.z - j.z), chao = this.terreno.altura(p.x, p.z);
    const tele = j.tele && j.tele.ate > this.tempo ? j.tele.m : 0; // Salto Arcano: o herói some e aparece metros à frente
    const ok = d <= j.orc + tele + 0.05 && p.y >= chao - 0.6 && p.y <= chao + ORCAMENTO.altura && dentroDoMapa(this.mapa, p.x, p.z);
    if (!ok) {
      this.evento({ t: 'corrigir', para: id, x: r2(j.x), y: r2(j.y), z: r2(j.z), ry: r2(j.ry) });
      j.cliente = null;
      return false;
    }
    if (tele && d > 1) { j.tele = null; j.orc = Math.max(0, j.orc - Math.max(0, d - tele)); } else j.orc -= d;
    // correndo (pela velocidade de verdade, sem dash, montaria ou parede): gasta estamina
    const dtc = j.cliente ? Math.min(0.5, this.tempo - j.cliente.t) : 0;
    if (j.ciente && dtc > 0 && !mont && !j.arrancada && !j.esc && !(j.dash?.t > 0) && !(tele && d > 1) && d / dtc > HEROI.correr * ESTAMINA.trote * 1.12) this.correndo(j, dtc);
    if (j.coleta && Math.hypot(p.x - j.coleta.x, p.z - j.coleta.z) > 0.5) this.pararColeta(j); // saiu do lugar: para de coletar
    if (j.canal && Math.hypot(p.x - j.canal.x, p.z - j.canal.z) > 0.6) this.cancelarCanal(j); // andou: a magia concentrada não sai
    j.x = p.x; j.y = p.y; j.z = p.z; j.ry = p.ry;
    j.chao = p.y - chao < 0.15; j.vy = 0;
    if (typeof p.anim === 'string' && p.anim.length < 64) j.anim = p.anim; // só aparência, para os outros jogadores
    j.cliente = { t: this.tempo };
    return true;
  }
  guiado(j) { return j.tipo === 'jogador' && j.cliente && !j.morto && this.tempo - j.cliente.t < 0.5; }
  usarHabilidade(id, i) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.esc || j.criando) return;
    if (j.coleta) this.pararColeta(j);
    const antes = this.ator; this.ator = j;
    try { this.usarHabilidadeDe(j, id, i); } finally { this.ator = antes; }
  }
  usarHabilidadeDe(j, id, i) {
    j.montado = null; // luta a pé
    if (i !== 9) j.modo = i === 10 || i > 4 ? 'Magia' : 'Espada'; // golpe usa a espada, magia usa o cajado
    // tocou um pouco antes do golpe atual acabar: guarda e solta assim que ele termina (o combo não perde o ritmo)
    if (j.trava > 0) { if (j.trava < 0.5 && j.trava !== Infinity) j.fila = { i, ate: this.tempo + 0.5 }; return; }
    if (!j.chao || j.arrancada) return;
    // 0 = golpe de espada, 1 a 8 = build (4 de espada e 4 de magia), 9 = cura, 10 = disparo de magia
    const chave = i === 0 ? 'basico' : i === 9 ? 'cura' : i === 10 ? 'magia' : j.build[i - 1];
    const h = i === 0 ? BASICO : i === 9 ? CURA : i === 10 ? BASICO_MAGIA : HABILIDADES[chave]; if (!h) return;
    this.executar(j, chave, h);
  }
  // Solta a habilidade h (com a chave da recarga). Devolve true se saiu.
  executar(j, chave, h) {
    const id = j.id;
    if ((j.cds[chave] || 0) > this.tempo) return false;
    if (h.mana && j.mana < h.mana) { this.evento({ t: 'aviso', para: id, texto: 'Mana insuficiente' }); return false; }
    j.mana -= h.mana || 0;
    j.cds[chave] = this.tempo + h.cd;
    // combo: tocando de novo logo depois do golpe, vem o próximo corte
    let n = 0; const cb = j.combos[chave] || { n: 0, ate: 0 };
    if (h.combo) { n = this.tempo < cb.ate ? (cb.n + 1) % h.combo.length : 0; h = { ...h, ...h.combo[n] }; }
    h = { ...h, chave };
    const alvo = this.maisPerto(j);
    if (alvo && !h.salto) this.virarPara(j, alvo);
    const d = this.tocar(j, h.anim, h.ts || 1, h.segurar || 0);
    if (h.combo) j.combos[chave] = { n, ate: this.tempo + d + 0.35 };
    if (h.lamina) j.acao.lamina = true;
    const at = h.segurar ? 0.05 : d * (h.at || 0.5);
    if (!h.segurar && !h.salto && !h.hits) j.trava = Math.min(d, at + 0.45); // libera o próximo comando logo depois do impacto
    if (h.segurar) { j.defesa = h.defesa; this.depois(h.segurar, () => { j.defesa = 0; }); }
    // investida: para logo na frente do alvo, para o golpe sair assim que chega
    const metros = h.dash && alvo ? Math.max(1.5, Math.min(h.avanco, dist(alvo, j) - 1.1)) : h.avanco;
    if (h.avanco) this.empurrar(j, metros, h.avancoT ? d * h.avancoT : h.hits ? d * 0.8 : at || 0.3);
    if (h.dash) { // investida: arranca como no dash e nenhum golpe pega durante a arrancada
      j.defesa = 1; this.depois(d * h.avancoT, () => { j.defesa = 0; });
      this.evento({ t: 'dash', id: j.id, dur: r2(d * h.avancoT + 0.12), forte: 1 });
    }
    if (h.puxa) this.depois(d * h.puxa.de, () => this.puxar(j, h));
    if (h.salto) {
      this.empurrar(j, h.salto, d * 0.6);
      if (h.q) { j.defesa = 1; this.depois(d * 0.6, () => { j.defesa = 0; }); this.evento({ t: 'dash', id: j.id, dur: r2(d * 0.6), forte: 1 }); }
    }
    if (h.fx) this.evento({ t: 'conjura', id: j.id, hab: chave, dur: r2(h.segurar || d) });
    if (h.hits) h.hits.forEach((f) => this.depois(d * f, () => this.efeitoHabilidade(j, h)));
    else this.depois(at, () => this.efeitoHabilidade(j, h));
    return true;
  }
  // ---------- progressão (ideia do Quimera: shared/progresso.js) ----------
  // Recalcula vida, mana, defesa, dano... a partir do nível e dos atributos. cheio: enche vida e mana.
  aplicarStatus(j, cheio = false) {
    const fv = j.vidaMax ? j.vida / j.vidaMax : 1;
    j.pas = passivasDe(j.prog);
    j.st = calcularStatus(j.prog, j.pas);
    j.vidaMax = j.st.vidaMax; j.manaMax = j.st.manaMax; j.staMax = j.st.estaminaMax; j.sta = Math.min(j.sta ?? j.staMax, j.staMax);
    if (cheio) { j.vida = j.vidaMax; j.mana = j.manaMax; }
    else { j.vida = Math.min(j.vidaMax, Math.max(j.morto ? 0 : 1, Math.round(fv * j.vidaMax))); j.mana = Math.min(j.mana, j.manaMax); }
  }
  // Manda para o próprio jogador o progresso e os números do herói (o menu do personagem mostra)
  avisarProg(j) {
    const st = Object.fromEntries(Object.entries(j.st).map(([k, v]) => [k, Math.round(v * 1e4) / 1e4]));
    this.eventos.push({ t: 'prog', para: j.id, prog: j.prog, st, xpProx: xpProximo(j.prog.nivel), agora: Date.now() });
    j.progSujo = true;
  }
  // O servidor grava na conta quem mudou (index.js chama de tempos em tempos e quando o jogador sai)
  progressosParaSalvar() {
    const r = [];
    for (const j of this.jogadores.values()) if (j.progSujo) { j.progSujo = false; r.push({ id: j.id, prog: j.prog }); }
    return r;
  }
  ganharXP(j, n) {
    const p = j.prog; if (p.nivel >= NIVEL_MAX) return;
    p.xp += n;
    let subiu = false;
    while (p.nivel < NIVEL_MAX && p.xp >= xpProximo(p.nivel)) { p.xp -= xpProximo(p.nivel); p.nivel++; p.pontos += PONTOS_POR_NIVEL; subiu = true; }
    if (p.nivel >= NIVEL_MAX) p.xp = 0;
    if (subiu) {
      this.aplicarStatus(j, true);
      this.evento({ t: 'nivel', id: j.id, nivel: p.nivel });
      this.evento({ t: 'aviso', para: j.id, texto: `Nível ${p.nivel}! +${PONTOS_POR_NIVEL} pontos de atributo` });
    }
    this.avisarProg(j);
  }
  // Ponto livre num atributo (for, des, int, vit)
  distribuirAtributo(id, k) {
    const j = this.jogadores.get(id); if (!j || !ATRIBUTOS[k] || j.prog.pontos <= 0) return;
    j.prog.atr[k]++; j.prog.pontos--;
    this.aplicarStatus(j);
    this.avisarProg(j);
  }
  // Mestre Ivo (NPC funcao 'resetar', perto de onde o herói nasce): atributos voltam para 3 e os pontos voltam; skills ficam
  custoReset(j) { return Math.max(RESET_BUILD.minimo, RESET_BUILD.porNivel * j.prog.nivel); }
  resetarBuild(id) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.criando) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (!(this.mapa.npcs || []).some((n) => n.funcao === 'resetar' && dist(n, j) < 4.5)) return aviso('Fale com o Mestre Ivo');
    const p = j.prog, gastos = Object.values(p.atr).reduce((s, v) => s + v - 3, 0), custo = this.custoReset(j);
    if (gastos <= 0) return aviso('Você ainda não gastou nenhum ponto.');
    if (p.ouro < custo) return aviso(`Falta ouro: custa ${custo}`);
    p.ouro -= custo;
    for (const k of Object.keys(p.atr)) p.atr[k] = 3;
    p.pontos += gastos;
    this.aplicarStatus(j);
    this.avisarProg(j);
    aviso(`Build resetada: ${gastos} pontos para distribuir de novo`);
  }
  // Uma das duas barras (espada ou cajado): 6 botões, só skill que serve nela, sem repetir (null = vazio)
  definirBarra(id, m) {
    const j = this.jogadores.get(id); if (!j || !m || !BARRAS.includes(m.barra)) return;
    const b = barraValida(m.lista, m.barra); if (!b) return;
    j.prog.barras[m.barra] = b;
    this.avisarProg(j);
  }
  // ---------- skills do Quimera (cada tipo = uma função do Quimera, com os mesmos números) ----------
  // Números da skill no nível dela, já com o dano em pontos (Força para espada, Inteligência para cajado)
  habPronta(j, hid) {
    const base = HABS[hid], h = habNoNivel(hid, j.prog.habs[hid]?.nv || 1);
    const dano = base.arvore === 'cajado' ? j.st.danoMagico : base.arvore === 'espada' ? j.st.danoFisico : Math.max(j.st.danoFisico, j.st.danoMagico);
    h.q = true; h.id = hid; h.chave = hid;
    h.dmg = dano * (h.pct || 0);
    if (!base.basico) h.cd = h.cd * (1 - j.st.recarga);
    if (j.st.areaK && !base.basico) { // conjunto de 6 peças: área das skills maior
      if (h.area) h.area = r2(h.area * (1 + j.st.areaK));
      if (h.proj?.explosao) h.proj = { ...h.proj, explosao: r2(h.proj.explosao * (1 + j.st.areaK)) };
    }
    return h;
  }
  // O alvo que a skill precisa (como no Quimera: sem ninguém no alcance ela nem sai). false = não pode soltar.
  alvoHab(j, h) {
    const t = h.tipo;
    if (t === 'basicoEspada') return this.maisPerto(j, h.alcance + 1.5);
    if (t === 'corte' || t === 'esmagar') return this.maisPerto(j, h.lunge.r);
    if (t === 'basicoMagia' || t === 'bola' || t === 'cadeia' || t === 'meteoro' || t === 'investida') return this.maisPerto(j, h.alcance + 0.5) || false;
    if (t === 'anel' || t === 'gelo' || t === 'puxar') return this.maisPerto(j, h.area) || false;
    return null;
  }
  // Usa uma skill (botão da barra da arma na mão, ou o ataque básico). m: id ou { id, dx, dz } (direção do joystick)
  usarHabQ(id, m) {
    const hid = typeof m === 'string' ? m : m?.id;
    const j = this.jogadores.get(id), base = HABS[hid];
    if (!j || j.morto || j.esc || j.criando || !base) return;
    if (j.coleta) this.pararColeta(j);
    if (base.libera > j.prog.nivel) return this.evento({ t: 'aviso', para: id, texto: `Libera no nível ${base.libera}` });
    if (!base.basico && !BARRAS.some((b) => j.prog.barras[b].includes(hid))) return;
    const antes = this.ator; this.ator = j;
    try {
      j.montado = null;
      if (j.canal) return; // concentrando outra magia
      if (j.trava > 0) { if (j.trava < 0.5 && j.trava !== Infinity) j.fila = { q: m, ate: this.tempo + 0.5 }; return; }
      if (!j.chao || j.arrancada || (j.cds[hid] || 0) > this.tempo) return;
      const h = this.habPronta(j, hid);
      if (h.mana && j.mana < h.mana) return this.evento({ t: 'aviso', para: id, texto: 'Mana insuficiente' });
      const alvo = this.alvoHab(j, h);
      if (alvo === false) return this.evento({ t: 'aviso', para: id, texto: this.maisPerto(j, 40) ? 'Longe demais' : 'Nenhum inimigo por perto' });
      if (base.arvore === 'espada') j.modo = 'Espada'; else if (base.arvore === 'cajado') j.modo = 'Magia';
      j.mana -= h.mana || 0;
      if (alvo) this.virarPara(j, alvo);
      if (h.canal) { // magia concentrada: sai no fim; andar, pular ou dar dash cancela (volta 70% da mana)
        const c = j.canal = { hid, h, alvo, x: j.x, z: j.z };
        this.tocarQ(j, h.anim, h.canal / h.at);
        j.trava = h.canal;
        this.evento({ t: 'conjura', id: j.id, hab: hid, dur: r2(h.canal / h.at) });
        this.depois(h.canal, () => {
          if (j.canal !== c || j.morto) return;
          j.canal = null;
          j.cds[hid] = this.tempo + h.cd;
          this.soltarQ(j, h, alvo && !alvo.morto ? alvo : this.alvoHab(j, h) || null, m);
          if (!base.basico) this.contarUso(j, hid);
        });
        return;
      }
      j.cds[hid] = this.tempo + h.cd;
      this.soltarQ(j, h, alvo, m);
      if (!base.basico) this.contarUso(j, hid);
    } finally { this.ator = antes; }
  }
  cancelarCanal(id, motivo = 'Cancelado') {
    const j = typeof id === 'string' ? this.jogadores.get(id) : id; if (!j?.canal) return;
    j.mana = Math.min(j.manaMax, j.mana + (j.canal.h.mana || 0) * 0.7);
    j.canal = null; j.trava = 0; j.acao = null;
    this.evento({ t: 'aviso', para: j.id, texto: motivo });
  }
  // Toca uma animação com a duração em segundos (as skills do Quimera dizem quanto tempo cada uma dura)
  tocarQ(c, nome, dur) {
    c.acao = { nome, ts: (DURACAO[nome] || 1) / dur, segurar: false }; c.acaoSeq++;
    c.trava = dur;
    return dur;
  }
  // golpe do Quimera: dano (com crítico) e o inimigo voa para longe do ponto p
  bater(j, o, n, h, p = j) {
    this.ferir(o, n, j, h);
    if (o.morto || !h.empurra || o.tipo === 'chefe' || o.firmeAte > this.tempo) return;
    const d = Math.hypot(o.x - p.x, o.z - p.z) || 1, t = 0.22;
    o.dash = { vx: (o.x - p.x) / d * h.empurra / t, vz: (o.z - p.z) / d * h.empurra / t, t };
  }
  areaQ(j, p, r, n, h) {
    const alvos = this.inimigosDe(j).filter((o) => dist(o, p) < r + 0.3 && Math.abs((o.y || 0) - (j.y || 0)) < 2.2);
    for (const o of alvos) this.bater(j, o, n, h, p);
    return alvos;
  }
  // passo até o inimigo mais perto antes do golpe (lunge do Quimera); o celular faz o mesmo no herói dele
  lunge(j, alvo, para, dur) {
    if (!alvo) return;
    const d = dist(alvo, j) - para;
    if (d > 0.3 && !this.guiado(j)) this.empurrar(j, d, dur);
  }
  soltarQ(j, h, alvo, m) {
    const t = h.tipo, chefe = (o) => o.tipo === 'chefe';
    if (t === 'basicoEspada') {
      const cb = j.comboQ || { n: -1, fim: 0 };
      const n = this.tempo - cb.fim > h.comboZera ? 0 : (cb.n + 1) % h.combo.length, g = h.combo[n];
      j.comboQ = { n, fim: this.tempo + g.dur };
      if (g.dur > h.cd) j.cds[h.id] = this.tempo + g.dur; // o 4º golpe é mais longo
      this.tocarQ(j, g.anim, g.dur); j.acao.lamina = true;
      this.depois(g.hit, () => {
        if (j.morto) return;
        let acertou = 0;
        for (const o of this.inimigosDe(j)) {
          if (Math.abs((o.y || 0) - (j.y || 0)) > 1.6 || dist(o, j) > h.alcance) continue;
          if (Math.abs(angDif(Math.atan2(o.x - j.x, o.z - j.z), j.ry)) > h.arco / 2) continue;
          this.bater(j, o, h.dmg, h); acertou++;
        }
        if (!acertou && alvo && !alvo.morto && dist(alvo, j) < 3.6) this.bater(j, alvo, h.dmg, h);
      });
    } else if (t === 'basicoMagia') {
      const mao = j.maoQ = (j.maoQ || 0) ^ 1, g = h.combo[mao];
      this.tocarQ(j, g.anim, g.dur);
      this.depois(g.hit, () => { if (!j.morto) this.lancar(j, h, alvo && !alvo.morto ? alvo : null); });
    } else if (t === 'corte' || t === 'esmagar') {
      this.lunge(j, alvo, h.lunge.para, 0.2);
      this.tocarQ(j, h.anim, h.dur); j.acao.lamina = true;
      this.evento({ t: 'conjura', id: j.id, hab: h.id, dur: h.dur });
      for (const s of h.hits) this.depois(s, () => {
        if (j.morto) return;
        const p = this.aFrente(j, h.ponto);
        const hh = t === 'esmagar' ? { ...h, atordoa: 0 } : h;
        for (const o of this.areaQ(j, p, h.area, h.dmg, hh)) if (t === 'esmagar' && !chefe(o) && !o.morto) { o.parado = Math.max(o.parado || 0, this.tempo + h.atordoa); o.ef = 'atordoado'; o.trava = 0; o.acao = null; }
        this.evento({ t: 'explosao', x: r2(p.x), z: r2(p.z), r: h.area, fx: h.id });
      });
    } else if (t === 'giro' || t === 'pisao') {
      this.tocarQ(j, h.anim, h.dur); j.acao.lamina = true;
      this.evento({ t: 'conjura', id: j.id, hab: h.id, dur: h.dur });
      for (const s of h.hits) this.depois(s, () => {
        if (j.morto) return;
        this.areaQ(j, j, h.area, h.dmg, h);
        this.evento({ t: 'explosao', x: r2(j.x), z: r2(j.z), r: h.area, fx: h.id });
      });
    } else if (t === 'investida') {
      const L = Math.min(h.alcance, dist(alvo, j) + 2.5), x0 = j.x, z0 = j.z, dx = Math.sin(j.ry), dz = Math.cos(j.ry);
      this.tocarQ(j, h.anim, h.dur); j.acao.lamina = true;
      if (!this.guiado(j)) this.empurrar(j, L, h.dashT);
      j.defesa = 1; this.depois(h.dashT, () => { j.defesa = 0; });
      this.evento({ t: 'dash', id: j.id, dur: r2(h.dashT + 0.12), forte: 1 });
      this.depois(h.hits[0], () => {
        if (j.morto) return;
        const linha = this.inimigosDe(j).map((o) => { const a = (o.x - x0) * dx + (o.z - z0) * dz, lado = Math.abs((o.x - x0) * dz - (o.z - z0) * dx); return { o, a, lado }; })
          .filter((q) => q.a > -0.5 && q.a < L + 1 && q.lado < h.largura).sort((a, b) => a.a - b.a).slice(0, Math.round(h.alvos));
        linha.forEach((q, i) => { this.bater(j, q.o, h.dmg * h.cai ** i, h, { x: x0, z: z0 }); this.evento({ t: 'impacto', x: r2(q.o.x), z: r2(q.o.z), ry: r2(j.ry), fx: h.id }); });
      });
    } else if (t === 'bola') {
      this.lancar(j, h, alvo);
    } else if (t === 'anel' || t === 'gelo') {
      this.areaQ(j, j, h.area, h.dmg, h);
      this.evento({ t: 'explosao', x: r2(j.x), z: r2(j.z), r: h.area, fx: h.id });
    } else if (t === 'meteoro') {
      const p = alvo ? { x: alvo.x, z: alvo.z } : this.aFrente(j, 5);
      this.evento({ t: 'meteoro', x: r2(p.x), z: r2(p.z), r: h.area, queda: h.queda });
      this.depois(h.queda, () => this.areaQ(j, p, h.area, h.dmg, h));
    } else if (t === 'cadeia') {
      const feitos = [];
      let de = { x: j.x, y: (j.y || 0) + 1.3, z: j.z }, o = alvo;
      for (let i = 0; o && i < Math.round(h.alvos); i++) {
        feitos.push(o);
        const n = h.dmg * h.cai ** i, alvoI = o, deI = de;
        this.depois(i * 0.08, () => { this.evento({ t: 'cadeia', x0: r2(deI.x), y0: r2(deI.y), z0: r2(deI.z), x: r2(alvoI.x), z: r2(alvoI.z) }); this.bater(j, alvoI, n, h); });
        de = { x: o.x, y: (o.y || 0) + 1, z: o.z };
        let prox = null, md = h.pula;
        for (const q of this.inimigosDe(j)) { const d = dist(q, o); if (!feitos.includes(q) && d < md) { md = d; prox = q; } }
        o = prox;
      }
    } else if (t === 'teleporte') {
      const dx = Number.isFinite(m?.dx) ? m.dx : 0, dz = Number.isFinite(m?.dz) ? m.dz : 0, mm = Math.hypot(dx, dz);
      if (mm > 0.15) j.ry = Math.atan2(dx, dz);
      const fx = Math.sin(j.ry), fz = Math.cos(j.ry), x0 = j.x, z0 = j.z;
      let n = 0; const passos = Math.round(h.distancia / 0.25);
      for (let i = 1; i <= passos; i++) { if (!this.livreParaHeroi(j, x0 + fx * 0.25 * i, z0 + fz * 0.25 * i)) break; n = i; }
      const x1 = x0 + fx * 0.25 * n, z1 = z0 + fz * 0.25 * n;
      j.tele = { m: 0.25 * n + 0.6, ate: this.tempo + 1.5 }; // o celular manda a posição nova: vale o salto
      if (!this.guiado(j)) { j.x = x1; j.z = z1; j.y = this.terreno.altura(x1, z1, j.y); }
      this.evento({ t: 'teleporte', id: j.id, x0: r2(x0), z0: r2(z0), x: r2(x1), z: r2(z1) });
    } else if (t === 'cura') {
      const n = Math.min(Math.round(j.vidaMax * h.curaPct), j.vidaMax - j.vida); j.vida += n;
      this.evento({ t: 'cura', alvo: j.id, n });
      for (const o of this.jogadores.values()) {
        if (o === j || o.morto || o.criando || dist(o, j) > h.grupo) continue;
        const q = Math.min(Math.round(o.vidaMax * h.curaPct * 0.5), o.vidaMax - o.vida); o.vida += q;
        if (q > 0) this.evento({ t: 'cura', alvo: o.id, n: q });
      }
      this.evento({ t: 'anel', x: r2(j.x), z: r2(j.z), r: h.grupo, cor: 0x9be08f, dur: 0.9 });
    } else if (t === 'escudo') {
      this.tocarQ(j, h.anim, h.dur);
      j.escudo = { n: Math.round(h.absorve + j.st.defesa * h.defK), ate: this.tempo + h.duracao };
      this.evento({ t: 'escudo', id: j.id, n: j.escudo.n, dur: h.duracao });
    } else if (t === 'puxar') {
      this.evento({ t: 'vortice', x: r2(j.x), z: r2(j.z), r: h.area });
      for (const o of this.inimigosDe(j)) {
        const d = dist(o, j); if (d > h.area || chefe(o)) continue;
        const fica = 1.6, tt = 0.3, m2 = Math.max(0, d - fica);
        o.dash = { vx: (j.x - o.x) / (d || 1) * m2 / tt, vz: (j.z - o.z) / (d || 1) * m2 / tt, t: tt };
        o.parado = Math.max(o.parado || 0, this.tempo + h.atordoa); o.trava = 0; o.acao = null;
        (o.atacantes ||= new Set()).add(j.id);
      }
    }
  }
  // o herói pode ficar ali? (sem pedra alta, casa, árvore ou poço; dentro do mapa) — o Salto Arcano para antes
  livreParaHeroi(j, x, z) {
    if (!dentroDoMapa(this.mapa, x, z, 2.2)) return false;
    if (this.terreno.altura(x, z, j.y) > j.y + SUBIDA.degrau) return false;
    for (const k of this.obstaculos) {
      if (k.alto != null && (j.y || 0) > k.alto) continue;
      if (Math.hypot(x - k.x, z - k.z) < k.r + 0.35) return false;
    }
    return true;
  }
  // Skill sobe de nível usando até o 5; do 6 ao 10 a barra de usos enche e espera o Tomo daquele nível (como no Quimera)
  contarUso(j, hid) {
    const s = j.prog.habs[hid] ||= { nv: 1, uso: 0 }, max = HABS[hid].max || SKILL_MAX;
    if (s.nv >= max) return;
    const precisa = usosParaSubir(s.nv);
    if (s.uso >= precisa) return; // cheia: esperando o Tomo
    s.uso++;
    if (s.uso >= precisa) {
      if (s.nv < NIVEL_SEM_TOMO) { s.uso = 0; s.nv++; this.evento({ t: 'aviso', para: j.id, texto: `${HABS[hid].nome} subiu para Nv ${s.nv}` }); }
      else this.evento({ t: 'aviso', para: j.id, texto: `${HABS[hid].nome}: barra cheia. Use o ${HABS[hid].tomo} ${ROMANO[s.nv + 1]}` });
    }
    this.avisarProg(j);
  }

  // ---------- mochila, equipamento e loja (dados em shared/dados.js: ITENS, LOJA, DROPS) ----------
  // m = { acao: 'equipar' | 'usar' | 'vender', i } (lugar da mochila) · { acao: 'tirar', lugar } · { acao: 'comprar', i } (item da loja)
  item(id, m) {
    const j = this.jogadores.get(id); if (!j || !m || typeof m !== 'object' || j.criando) return;
    const p = j.prog, aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const i = Number.isInteger(m.i) ? m.i : -1, it = i >= 0 && i < MOCHILA ? p.mochila[i] : null;
    if (m.acao === 'equipar' && it && ehEquip(it.k)) {
      const l = ITENS[it.k].lugar;
      p.mochila[i] = p.equip[l]; p.equip[l] = it;
    } else if (m.acao === 'tirar' && p.equip[m.lugar]) {
      const v = p.mochila.indexOf(null); if (v < 0) return aviso('Mochila cheia');
      p.mochila[v] = p.equip[m.lugar]; p.equip[m.lugar] = null;
    } else if (m.acao === 'usar' && it && !ehEquip(it.k)) {
      if (j.morto || ITENS[it.k].mat) return;
      if (it.k === 'tomo') {
        const s = p.habs[it.h] || { nv: 1, uso: 0 };
        if (s.nv >= it.nv) return aviso(`${HABS[it.h].nome} já está no Nv ${s.nv}`);
        if (s.nv !== it.nv - 1) return aviso(`Este Tomo é para subir do Nv ${it.nv - 1} para o ${it.nv}`);
        if (s.uso < usosParaSubir(s.nv)) return aviso(`Encha a barra de usos de ${HABS[it.h].nome} primeiro`);
        p.habs[it.h] = { nv: it.nv, uso: 0 };
        aviso(`${HABS[it.h].nome} subiu para Nv ${it.nv}!`);
      } else {
        const u = ITENS[it.k].usar;
        if (u.vida) { if (j.vida >= j.vidaMax) return aviso('A vida já está cheia'); const n = Math.min(j.vidaMax - j.vida, Math.round(j.vidaMax * u.vida)); j.vida += n; this.evento({ t: 'cura', alvo: j.id, n }); }
        if (u.mana) { if (j.mana >= j.manaMax) return aviso('A mana já está cheia'); j.mana = Math.min(j.manaMax, j.mana + j.manaMax * u.mana); }
      }
      if (--it.n <= 0) p.mochila[i] = null;
    } else if (m.acao === 'vender' && it) {
      if (!this.pertoDeQuemCompra(j)) return aviso('Venda com a Rosa, a comerciante, ou com o Tomás, o ferreiro');
      const preco = precoVenda(it, mercador(p.prof.mer).venda);
      if (it.n > 1) it.n--; else p.mochila[i] = null;
      p.ouro += preco;
      this.pontosMercador(j, preco);
      aviso(`Vendeu ${nomeItem(it)} por ${preco} de ouro`);
    } else if (m.acao === 'comprar' && LOJA[i]) {
      if (!this.pertoDaLoja(j)) return aviso('Compre com a Rosa, a comerciante');
      const o = LOJA[i], preco = this.precoCompra(j, o);
      if (p.ouro < preco) return aviso('Ouro insuficiente');
      const novo = ehEquip(o.k) ? { k: o.k, r: o.r } : { k: o.k, n: 1 };
      if (!guardar(p.mochila, novo)) return aviso('Mochila cheia');
      p.ouro -= preco;
      this.pontosMercador(j, preco);
      aviso(`Comprou ${nomeItem(novo)}`);
    } else if (m.acao === 'capacete') {
      // mostrar ou esconder o capacete no corpo (fica gravado na conta; o bônus da peça continua)
      p.semCapacete = m.mostrar === false;
    } else return;
    this.aplicarStatus(j);
    this.avisarProg(j);
  }
  precoCompra(j, o) { return Math.max(1, Math.round(o.preco * (1 - mercador(j.prog.prof.mer).compra))); }
  pontosMercador(j, ouro) { this.pontosProf(j, 'mer', ouro / MERCADOR.pontoOuro); }
  // Pontos numa profissão (sobe de nível sozinha, como no Quimera)
  pontosProf(j, k, n) {
    if (!PROFISSOES[k] || !(n > 0)) return;
    const antes = profNivel(j.prog.prof[k]);
    j.prog.prof[k] = Math.round((j.prog.prof[k] + n) * 1000) / 1000;
    const nv = profNivel(j.prog.prof[k]);
    if (nv > antes) {
      const b = profBonus(j.prog.prof[k]);
      this.evento({ t: 'aviso', para: j.id, texto: `${PROFISSOES[k].nome} subiu para o Nv ${nv}` + (b.menosVigor ? ` (gasta ${Math.round(b.menosVigor * 100)}% menos vigor)` : '') });
      this.evento({ t: 'profNivel', para: j.id, prof: k, nv });
    }
  }

  // ---------- estamina (Parte 3 do Quimera: shared/dados.js ESTAMINA) ----------
  emCombate(j) { return j.combateAte > this.tempo; }
  // Gasto de uma vez (dash, rolamento, mortal): seguido fica mais caro. App antigo (site) não conhece a estamina: passa.
  gastarEstamina(j, n) {
    if (!j.ciente) return true;
    const E = ESTAMINA, k = this.tempo - j.seguida.t < E.seguidaJanela ? Math.min(E.seguidaMax, j.seguida.k + E.seguidaK) : 1;
    if (j.sta < n * k) { this.evento({ t: 'aviso', para: j.id, texto: 'Sem fôlego!' }); return false; }
    j.seguida = { k, t: this.tempo };
    j.sta -= n * k; j.staT = Math.max(j.staT, E.espera);
    return true;
  }
  correndo(j, dt) {
    const E = ESTAMINA, c = this.emCombate(j);
    j.sta = Math.max(0, j.sta - E.correr * (c ? E.combateK : 1) * dt);
    j.staT = Math.max(j.staT, c ? E.esperaCombate : E.espera);
    if (j.sta <= 0 && !j.semFolego) { j.semFolego = true; this.evento({ t: 'aviso', para: j.id, texto: 'Sem fôlego!' }); }
  }
  passoEstamina(j, dt) {
    const E = ESTAMINA;
    if (j.staT > 0) { j.staT -= dt; return; }
    if (j.sta < j.staMax) j.sta = Math.min(j.staMax, j.sta + j.staMax * E.volta * (this.emCombate(j) ? E.voltaCombate : 1) * dt);
    if (j.semFolego && j.sta >= j.staMax * E.folego) j.semFolego = false;
  }

  // ---------- coleta: Minerador e Lenhador (shared/dados.js COLETA e VEIOS) ----------
  // m = { no: 'v3' | 'a12' } (veio ou árvore) ou { parar: true }. Bate sozinho até acabar a carga do veio, o vigor ou o jogador sair.
  coletar(id, m) {
    const j = this.jogadores.get(id); if (!j || j.criando || j.morto || !m || typeof m.no !== 'string') return;
    if (m.parar || j.coleta) return this.pararColeta(j, null); // o jogador parou (ou tocou de novo)
    const no = this.coletaveis.get(m.no), aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (!no) return;
    if (j.esc || !j.chao || j.trava > 0 || j.arrancada || j.montado) return;
    if (dist(no, j) - no.r > COLETA_DISTANCIA) return aviso('Chegue mais perto');
    const C = COLETA[no.tipo];
    if (profNivel(j.prog.prof[C.prof]) < (C.nivel || 1)) return aviso(`${C.nome}: precisa de ${PROFISSOES[C.prof].nome} Nv ${C.nivel}`);
    if (this.cargas(j, no) <= 0) return aviso(`${C.nome}: ${C.esgotado || 'esgotado'}, volta em ${Math.ceil((no.mina ? this.veiosComuns.get(no.id) : j.coletas[no.id]).volta - this.tempo)} s`);
    if (vigorAgora(j.prog.vigor) < this.custoVigor(j, C)) return aviso('Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)');
    this.virarPara(j, no);
    this.proximaBatida(j, no);
  }
  custoVigor(j, C) { return C.vigor * (1 - profBonus(j.prog.prof[C.prof]).menosVigor); }
  // batidas que ainda restam neste veio para este jogador (cada um tem o seu: ninguém rouba o veio do outro)
  cargas(j, no) {
    if (no.mina) { // zona de mineração: o veio é de todos
      const s = this.veiosComuns.get(no.id);
      return !s || s.volta <= this.tempo ? COLETA[no.tipo].cargas : s.n;
    }
    const s = j.coletas[no.id];
    if (!s || s.volta <= this.tempo) return COLETA[no.tipo].cargas;
    return s.n;
  }
  proximaBatida(j, no) {
    const C = COLETA[no.tipo], dur = C.tempo / profBonus(j.prog.prof[C.prof]).rapidez;
    j.coleta = { no: no.id, x: j.x, z: j.z, fim: this.tempo + dur };
    this.evento({ t: 'coleta', id: j.id, no: no.id, dur: r2(dur), prof: C.prof });
  }
  batidaColeta(j) {
    const no = this.coletaveis.get(j.coleta.no), C = COLETA[no.tipo], p = j.prog;
    if (this.cargas(j, no) <= 0) return this.pararColeta(j, `${C.nome} ${C.esgotado || 'esgotado'}`); // outro jogador esgotou antes
    const custo = this.custoVigor(j, C);
    if (!gastarVigor(p, custo)) return this.pararColeta(j, 'Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)');
    const b = profBonus(p.prof[C.prof]), ganhou = [];
    const por = (k, n) => { if (guardar(p.mochila, { k, n })) { const g = ganhou.find((x) => x.k === k); if (g) g.n += n; else ganhou.push({ k, nome: ITENS[k].nome, n }); } else this.evento({ t: 'aviso', para: j.id, texto: 'Mochila cheia' }); };
    for (const [k, n] of Object.entries(C.da)) por(k, n + (Math.random() < b.extra ? 1 : 0));
    for (const [k, ch] of Object.entries(C.raro || {})) if (Math.random() < ch) por(k, 1);
    const volta = no.mina ? this.minas.get(no.mina)?.volta ?? C.volta : C.volta;
    const s = { n: this.cargas(j, no) - 1, volta: this.tempo + volta };
    if (no.mina) { this.veiosComuns.set(no.id, s); this.evento({ t: 'veio', no: no.id, cargas: s.n, volta }); } // todo mundo vê a pedra sumir
    else j.coletas[no.id] = s;
    this.pontosProf(j, C.prof, C.vigor);
    if (p.nivel < NIVEL_MAX) this.ganharXP(j, Math.max(1, Math.round(C.vigor))); else this.avisarProg(j); // um pouco de XP pelo trabalho (Quimera: mgVgXp)
    this.evento({ t: 'coletou', para: j.id, no: no.id, itens: ganhou, cargas: s.n, volta });
    if (!ganhou.length) return this.pararColeta(j, null);
    if (s.n <= 0) return this.pararColeta(j, `${C.nome} ${C.esgotado || 'esgotado'}`);
    if (vigorAgora(p.vigor) < this.custoVigor(j, C)) return this.pararColeta(j, 'Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)');
    this.proximaBatida(j, no);
  }
  pararColeta(j, motivo = undefined) {
    if (!j.coleta) return;
    const no = j.coleta.no; j.coleta = null;
    this.evento({ t: 'coletaFim', id: j.id, no });
    if (motivo) this.evento({ t: 'aviso', para: j.id, texto: motivo });
  }

  // ---------- criação: Ferreiro e Alfaiate (shared/dados.js RECEITAS) ----------
  // m = { r: 'espada' } (receita). Perto da oficina: usa os materiais, gasta vigor e dá a peça (raridade sorteada).
  criar(id, m) {
    const j = this.jogadores.get(id); if (!j || j.criando || j.morto || !m) return;
    const R = RECEITAS[m.r], p = j.prog, aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (!R) return;
    const of = OFICINA[R.prof], npc = (this.mapa.npcs || []).find((n) => n.id === of.npc);
    if (!npc || dist(npc, j) > OFICINA_DISTANCIA) return aviso(`Crie ${of.onde}`);
    if (profNivel(p.prof[R.prof]) < R.nivel) return aviso(`Precisa de ${PROFISSOES[R.prof].nome} Nv ${R.nivel}`);
    for (const [k, n] of Object.entries(R.usa)) if (contar(p.mochila, k) < n) return aviso(`Falta ${ITENS[k].nome} (${contar(p.mochila, k)}/${n})`);
    const custo = R.vigor * (1 - profBonus(p.prof[R.prof]).menosVigor);
    if (vigorAgora(p.vigor) < custo) return aviso('Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)');
    let novo;
    if (ehEquip(R.faz)) {
      let r = 0; const ch = chanceRaridade(p.prof[R.prof]);
      while (r < RARIDADE_CRIAR.ate && Math.random() < ch) r++;
      novo = { k: R.faz, r };
    } else novo = { k: R.faz, n: 1 };
    // confere se cabe antes de gastar (numa cópia da mochila sem os materiais)
    const prova = p.mochila.map((o) => (o ? { ...o } : null));
    for (const [k, n] of Object.entries(R.usa)) tirar(prova, k, n);
    if (!guardar(prova, novo)) return aviso('Mochila cheia');
    gastarVigor(p, custo);
    p.mochila = prova;
    this.pontosProf(j, R.prof, R.vigor);
    this.ganharXP(j, Math.max(1, Math.round(R.vigor)));
    this.evento({ t: 'criou', para: id, prof: R.prof, nome: nomeItem(novo), r: novo.r ?? -1, x: r2(npc.x), z: r2(npc.z) });
    aviso(`Criou ${nomeItem(novo)}!`);
    this.aplicarStatus(j);
    this.avisarProg(j);
  }
  // quem compra itens: a Rosa e os NPCs com 'vender' nas acoes (o Tomás, o ferreiro)
  pertoDeQuemCompra(j) { return this.pertoDaLoja(j) || (this.mapa.npcs || []).some((n) => (n.acoes || []).includes('vender') && dist(n, j) < LOJA_DISTANCIA); }
  pertoDaLoja(j) { return (this.mapa.npcs || []).some((n) => n.funcao === 'loja' && dist(n, j) < LOJA_DISTANCIA); }
  // Monstro caiu: cada herói que ganhou XP tira a sua sorte (ouro, poções, peça, Tomo de uma skill que ele já tem)
  soltarDrops(c, j) {
    const d = DROPS[c.tipo]; if (!d) return;
    const p = j.prog, ganhou = [];
    const por = (it) => { if (guardar(p.mochila, it)) ganhou.push({ nome: nomeItem(it), r: it.r ?? -1 }); else this.evento({ t: 'aviso', para: j.id, texto: `Mochila cheia! ${nomeItem(it)} ficou no chão` }); };
    const ouro = d.ouro[0] + Math.floor(Math.random() * (d.ouro[1] - d.ouro[0] + 1));
    p.ouro += ouro;
    if (Math.random() < d.pocao) por({ k: 'pocao', n: 1 });
    if (Math.random() < d.mana) por({ k: 'pocao_mana', n: 1 });
    for (const [k, [ch, n]] of Object.entries(d.mat || {})) if (Math.random() < ch) por({ k, n });
    if (Math.random() < d.equip) {
      let s = Math.random(), r = 0;
      while (r < d.raridade.length - 1 && s >= d.raridade[r]) s -= d.raridade[r++];
      const pecas = Object.keys(ITENS).filter(ehEquip);
      por({ k: pecas[Math.floor(Math.random() * pecas.length)], r });
    }
    if (Math.random() < d.tomo) { // Tomo do próximo nível que a skill vai precisar (do VI ao X)
      const sk = Object.keys(HABS).filter((k) => HABS[k].tomo && HABS[k].libera <= p.nivel && (p.habs[k]?.nv || 1) < SKILL_MAX);
      if (sk.length) { const h = sk[Math.floor(Math.random() * sk.length)]; por({ k: 'tomo', h, nv: Math.max(NIVEL_SEM_TOMO + 1, (p.habs[h]?.nv || 1) + 1), n: 1 }); }
    }
    this.evento({ t: 'drop', para: j.id, x: r2(c.x), z: r2(c.z), ouro, itens: ganhou });
    this.avisarProg(j);
  }

  // No chão pula; no ar, o segundo pulo é um mortal para a frente
  // Botão Falar: o NPC mais perto responde conforme a função dele (cura, missão, habilidades, dica, loja)
  // m (opcional, menu do NPC no app): { npc: id de quem tocou, conversa: true = só a próxima fala, sem a função }
  falar(id, m) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.criando) return;
    let npc = null, md = 3.2;
    for (const n of this.mapa.npcs || []) { const d = dist(n, j); if (d < md) { md = d; npc = n; } }
    const quem = m && typeof m === 'object' && typeof m.npc === 'string' ? (this.mapa.npcs || []).find((n) => n.id === m.npc) : null;
    if (quem && dist(quem, j) < 3.2) npc = quem;
    if (!npc) return;
    const diga = (texto, extra = {}) => this.evento({ t: 'fala', para: j.id, npc: npc.id, texto, ...extra });
    const proxima = () => npc.falas[(j.falas[npc.id] = (j.falas[npc.id] ?? -1) + 1) % npc.falas.length];
    if (m?.conversa) return diga(proxima());
    if (npc.funcao === 'cura') {
      if (j.vida >= j.vidaMax && j.mana >= j.manaMax) return diga('Você está inteiro. Volte quando precisar.');
      const n = j.vidaMax - j.vida; j.vida = j.vidaMax; j.mana = j.manaMax;
      if (n > 0) this.evento({ t: 'cura', alvo: j.id, n });
      return diga('Pronto, novinho em folha. Vá com cuidado lá fora.');
    }
    if (npc.funcao === 'missao') {
      const M = MISSOES[npc.missao], m = j.missoes[npc.missao];
      if (!m) { j.missoes[npc.missao] = { n: 0, entregue: false }; this.evento({ t: 'aviso', para: j.id, texto: 'Missão nova: ' + M.nome }); return diga(M.pedido); }
      if (m.entregue) return diga(M.depois);
      if (m.n >= M.total) { m.entregue = true; this.evento({ t: 'aviso', para: j.id, texto: 'Missão cumprida: ' + M.nome }); return diga(M.pronto); }
      return diga(M.andamento.replace('{faltam}', M.total - m.n));
    }
    if (npc.funcao === 'habilidades') return diga(npc.falas[0], { abrir: 'habilidades' });
    if (npc.funcao === 'loja') return diga('Dá uma olhada no que eu tenho. E se quiser vender algo, eu compro.', { abrir: 'loja' });
    if (npc.funcao === 'resetar') return diga(npc.falas[0] + ` Custa ${this.custoReset(j)} de ouro.`, { abrir: 'resetar', custo: this.custoReset(j) });
    diga(proxima());
  }
  // Inimigo caiu: conta para quem está numa missão contra a horda dele (vale para todos do grupo)
  contarMissao(c) {
    const horda = TIPOS_INIMIGO[c.tipo]?.horda;
    for (const j of this.jogadores.values()) for (const [k, m] of Object.entries(j.missoes)) {
      const M = MISSOES[k]; if (M.horda !== horda || m.entregue || m.n >= M.total) continue;
      m.n++;
      this.evento({ t: 'aviso', para: j.id, texto: m.n >= M.total ? `${M.horda}: ${m.n}/${M.total}. Volte à vila!` : `${M.horda}: ${m.n}/${M.total}` });
    }
  }
  pular(id) {
    const j = this.jogadores.get(id);
    if (j?.coleta) this.pararColeta(j);
    if (j?.canal) this.cancelarCanal(j);
    if (j?.esc) { if (!j.esc.clip) this.soltar(j); return; } // na parede: solta
    if (!j || j.morto || j.criando || j.trava > 0 || j.arrancada) return;
    if (j.chao) { j.vy = MOVIMENTO.pulo; j.chao = false; j.pulos = 1; j.puloT = 0; j.pouso = 0; }
    else if (j.pulos < 2 && this.gastarEstamina(j, ESTAMINA.mortal)) { j.vy = Math.max(j.vy, MOVIMENTO.pulo * 0.9); j.pulos = 2; j.mortal = DURACAO.mortal; }
  }
  // Rolamento no chão: nenhum golpe pega durante a maior parte dele
  rolar(id) {
    const j = this.jogadores.get(id);
    if (j?.coleta) this.pararColeta(j);
    if (j?.canal) this.cancelarCanal(j);
    if (!j || j.morto || j.criando || j.esc || j.trava > 0 || !j.chao || j.arrancada || (j.cds.rolar || 0) > this.tempo) return;
    if (!this.gastarEstamina(j, ESTAMINA.rolar)) return;
    j.cds.rolar = this.tempo + HEROI.rolarCd; j.montado = null;
    const { mx, mz } = j.entrada;
    if (Math.hypot(mx, mz) > 0.1) j.ry = Math.atan2(mx, mz);
    const d = this.tocar(j, A.roll, 1.25);
    this.empurrar(j, 4.2, d);
    j.defesa = 1;
    this.depois(d * 0.7, () => { j.defesa = 0; });
  }
  // Arrancada reta para onde o jogador aponta (no ar, uma por pulo). Nenhum golpe pega durante ela.
  dash(id) {
    const j = this.jogadores.get(id);
    if (j?.coleta) this.pararColeta(j);
    if (j?.canal) this.cancelarCanal(j);
    if (!j || j.morto || j.criando || j.esc || j.trava > 0 || j.arrancada || (j.cds.dash || 0) > this.tempo || (!j.chao && j.arrancadaNoAr)) return;
    if (!this.gastarEstamina(j, ESTAMINA.dash)) return;
    j.cds.dash = this.tempo + MOVIMENTO.dashCd; j.montado = null;
    const { mx, mz } = j.entrada;
    if (Math.hypot(mx, mz) > 0.1) j.ry = Math.atan2(mx, mz);
    if (j.chao && this.correrNaParede(j)) return; // dash contra a rocha: corre pela parede
    j.arrancada = { t: MOVIMENTO.dashTempo, dx: Math.sin(j.ry), dz: Math.cos(j.ry) };
    j.mortal = 0; j.pouso = 0;
    if (!j.chao) { j.vy = Math.max(0, j.vy); j.arrancadaNoAr = true; }
    this.evento({ t: 'dash', id: j.id, de: j.id });
  }

  // ---------- combate ----------
  efeitoHabilidade(j, h) {
    if (j.morto) return;
    if (h.proj?.leque) { // vários tiros abertos em leque, o do meio no alvo
      const alvo = this.maisPerto(j); if (alvo) this.virarPara(j, alvo);
      const n = h.proj.leque;
      for (let k = 0; k < n; k++) this.lancar(j, h, null, (k - (n - 1) / 2) * 0.28);
    } else if (h.proj) this.lancar(j, h, this.maisPerto(j));
    else if (h.linha) { // trilha de explosões saindo da espada para a frente
      const L = h.linha, ry = j.ry, x0 = j.x, z0 = j.z, atingidos = new Set();
      this.evento({ t: 'fenda', x: r2(x0), z: r2(z0), ry: r2(ry), comp: L.comp, passos: L.passos, larg: L.larg });
      for (let k = 0; k < L.passos; k++) this.depois(k * 0.07, () => {
        const d = 1.2 + (L.comp - 1.2) * k / (L.passos - 1), p = { x: x0 + Math.sin(ry) * d, z: z0 + Math.cos(ry) * d };
        for (const o of this.inimigosDe(j)) if (!atingidos.has(o) && dist(o, p) < L.larg) { atingidos.add(o); this.ferir(o, L.dmg, j); }
      });
    } else if (h.raios) { // raios do céu nos inimigos mais perto (ou à frente, se não houver)
      const alvos = this.inimigosDe(j).filter((o) => dist(o, j) < h.raios.alcance).sort((a, b) => dist(a, j) - dist(b, j)).slice(0, h.raios.n);
      if (!alvos.length) { const p = this.aFrente(j, 5); this.evento({ t: 'raio', x: r2(p.x), z: r2(p.z) }); }
      alvos.forEach((o, k) => this.depois(k * 0.12, () => { this.evento({ t: 'raio', x: r2(o.x), z: r2(o.z) }); this.ferir(o, h.raios.dmg, j, h); }));
    }
    else if (h.curaPct) { // Cura da Floresta: % da vida máxima; quem estiver perto recebe um pouco
      const n = Math.min(Math.round(j.vidaMax * h.curaPct), j.vidaMax - j.vida); j.vida += n;
      this.evento({ t: 'cura', alvo: j.id, n });
      if (h.grupo) for (const o of this.jogadores.values()) {
        if (o === j || o.morto || o.criando || dist(o, j) > h.grupo.r) continue;
        const m = Math.min(Math.round(o.vidaMax * h.grupo.pct), o.vidaMax - o.vida); o.vida += m;
        if (m > 0) this.evento({ t: 'cura', alvo: o.id, n: m });
      }
      this.evento({ t: 'anel', x: r2(j.x), z: r2(j.z), r: h.grupo?.r || 1.6, cor: 0x9be08f, dur: 0.9 });
    } else if (h.escudo) {
      j.escudo = { n: h.escudo.absorve, ate: this.tempo + h.escudo.dur };
      this.evento({ t: 'escudo', id: j.id, n: j.escudo.n, dur: h.escudo.dur });
    } else if (h.cura) {
      const n = Math.min(h.cura, j.vidaMax - j.vida); j.vida += n;
      this.evento({ t: 'cura', alvo: j.id, n });
      this.evento({ t: 'anel', x: j.x, z: j.z, r: 1.6, cor: 0x9be08f, dur: 0.8 });
    } else if (h.campo) {
      const a = this.maisPerto(j, 16);
      const p = a ? { x: a.x, z: a.z } : this.aFrente(j, 5);
      this.campos.push({ ...p, ...h.campo, dono: j, vida: h.campo.dur, tique: 0 });
      this.evento({ t: 'campo', x: r2(p.x), z: r2(p.z), r: h.campo.r, dur: h.campo.dur });
    } else if (h.chuva) {
      const a = this.maisPerto(j, 22);
      const p = a ? { x: a.x, z: a.z } : this.aFrente(j, 8);
      this.evento({ t: 'chuva', x: r2(p.x), z: r2(p.z), r: h.chuva.r, ondas: h.chuva.ondas });
      for (let k = 0; k < h.chuva.ondas; k++) this.depois(0.25 + k * 0.22, () => {
        for (const o of this.inimigosDe(j)) if (dist(o, p) < h.chuva.r) this.ferir(o, h.chuva.dmg, j, h);
      });
    } else if (h.dmg) this.corpoACorpo(j, h);
  }
  corpoACorpo(c, h) {
    for (const o of this.inimigosDe(c)) {
      const d = dist(o, c);
      if (Math.abs((o.y || 0) - (c.y || 0)) > 1.6) continue; // em cima da pedra o golpe não alcança quem está embaixo
      const acerta = h.area ? d < h.area : d < h.alcance && Math.abs(angDif(Math.atan2(o.x - c.x, o.z - c.z), c.ry)) < h.arco / 2;
      if (!acerta) continue;
      this.ferir(o, h.dmg, c, h);
      if (h.impacto) this.evento({ t: 'impacto', x: r2(o.x), z: r2(o.z), ry: r2(c.ry), fx: h.chave });
      const emp = h.empurra || 1.2;
      if (h.area && d > 0) { o.x += (o.x - c.x) / d * emp; o.z += (o.z - c.z) / d * emp; this.colidir(o); }
    }
    if (h.area && c.tipo === 'jogador') this.evento({ t: 'explosao', x: r2(c.x), z: r2(c.z), r: h.area, fx: h.chave });
  }
  // Vórtice: arrasta para perto quem estiver em volta; a explosão vem depois (efeitoHabilidade)
  puxar(j, h) {
    if (j.morto) return;
    this.evento({ t: 'vortice', x: r2(j.x), z: r2(j.z), r: h.puxa.r });
    for (const o of this.inimigosDe(j)) {
      const d = dist(o, j); if (d > h.puxa.r || d < 1.3) continue;
      const t = 0.45, m = d - 1.1; o.dash = { vx: (j.x - o.x) / d * m / t, vz: (j.z - o.z) / d * m / t, t };
    }
  }
  lancar(c, h, alvo, giro = 0) {
    const f = this.aFrente(c, 0.6);
    const de = { x: f.x, y: (c.y || 0) + (h.proj.estilo === 'corte' ? 1 : 1.35), z: f.z };
    let dx = Math.sin(c.ry + giro), dy = 0, dz = Math.cos(c.ry + giro);
    if (alvo) { dx = alvo.x - de.x; dy = (alvo.y || 0) + 1.1 - de.y; dz = alvo.z - de.z; const n = Math.hypot(dx, dy, dz) || 1; dx /= n; dy /= n; dz /= n; }
    const p = { id: this.proxId++, ...de, dx, dy, dz, h, dono: c, vida: h.proj.vida || 2.2, acertou: new Set() };
    this.projeteis.push(p);
    this.evento({ t: 'proj', id: p.id, x: r2(de.x), y: de.y, z: r2(de.z), dx: r2(dx), dy: r2(dy), dz: r2(dz), ...h.proj });
  }
  // h: a habilidade que acertou (skills do Quimera trazem crítico e efeitos: atordoa, congela, lento, vulnerável)
  ferir(alvo, n, de, h = null) {
    if (alvo.morto || alvo.arrancada || alvo.criando) return;
    let crit = false;
    if (h?.q && de?.st) { n *= 0.85 + Math.random() * 0.3; if (Math.random() < de.st.critico) { n *= 2; crit = true; } } // como no Quimera: ±15% e crítico ×2
    if (alvo.vuln && alvo.vuln.ate > this.tempo) n *= 1 + alvo.vuln.k;
    if (alvo.st) n *= 1 - alvo.st.reducao; // defesa do herói
    if (alvo.defesa > 0) n *= 1 - alvo.defesa;
    n = Math.max(1, Math.round(n));
    if (alvo.escudo && alvo.escudo.ate > this.tempo) { // Escudo Arcano segura primeiro
      const seg = Math.min(alvo.escudo.n, n); alvo.escudo.n -= seg; n -= seg;
      if (alvo.escudo.n <= 0) { alvo.escudo = null; this.evento({ t: 'escudo', id: alvo.id, n: 0, dur: 0 }); }
      if (n <= 0) { this.evento({ t: 'dano', alvo: alvo.id, n: 0, escudo: true }); return; }
    }
    if (de?.tipo === 'jogador' && de.contraAte > this.tempo && alvo.tipo !== 'jogador') { // contra-ataque depois da esquiva
      n = Math.round(n * COMBATE_INIMIGO.contraK); crit = true; de.contraAte = 0;
    }
    alvo.vida = Math.max(0, alvo.vida - n);
    if (alvo.tipo === 'jogador') { alvo.combateAte = this.tempo + ESTAMINA.combate; if (alvo.coleta) this.pararColeta(alvo, 'Atacado! A coleta parou'); }
    if (de?.tipo === 'jogador') de.combateAte = this.tempo + ESTAMINA.combate;
    this.evento(crit ? { t: 'dano', alvo: alvo.id, n, crit: true } : { t: 'dano', alvo: alvo.id, n });
    if (alvo.tipo !== 'jogador' && de?.tipo === 'jogador') (alvo.atacantes ||= new Set()).add(de.id);
    if (h && alvo.tipo !== 'jogador' && alvo.vida > 0) {
      const ate = (s) => this.tempo + s * (alvo.tipo === 'chefe' ? 0.5 : 1); // chefe sofre metade
      if (h.atordoa) { alvo.parado = Math.max(alvo.parado || 0, ate(h.atordoa)); alvo.ef = 'atordoado'; }
      if (h.congela) { alvo.parado = Math.max(alvo.parado || 0, ate(h.congela)); alvo.ef = 'congelado'; }
      const meio = alvo.tipo === 'chefe' ? 0.5 : 1; // no chefe lentidão e Quebrado valem metade
      if (h.lento) alvo.lento = { k: h.lento.k * meio, ate: this.tempo + h.lento.dur };
      if (h.vulneravel) alvo.vuln = { k: h.vulneravel.k * meio, ate: this.tempo + h.vulneravel.dur };
      if (h.atordoa || h.congela) { alvo.trava = 0; alvo.acao = null; }
    }
    let firme = false;
    if (alvo.tipo !== 'jogador' && alvo.vida > 0) { // resistência: muitos golpes seguidos e o monstro aguenta e revida
      const CI = COMBATE_INIMIGO;
      if (this.tempo - (alvo.golpeT || -9) > CI.firmeJanela) alvo.golpes = 0;
      alvo.golpeT = this.tempo; alvo.golpes = (alvo.golpes || 0) + 1;
      if (alvo.golpes >= (CI.firmeGolpes[alvo.tipo] ?? 6) && !(alvo.firmeAte > this.tempo) && !(alvo.parado > this.tempo)) {
        alvo.firmeAte = this.tempo + CI.firmeDur; alvo.golpes = 0; alvo.ataqueCd = Math.min(alvo.ataqueCd, 0.25);
        this.evento({ t: 'firme', id: alvo.id, dur: CI.firmeDur });
      }
      firme = alvo.firmeAte > this.tempo;
    }
    if (alvo.vida <= 0) {
      this.morrer(alvo);
      if (alvo.tipo !== 'jogador' && de && alvo.tipo !== 'chefe') { // o golpe final joga o corpo para trás
        const d = Math.hypot(alvo.x - de.x, alvo.z - de.z) || 1, t = 0.35, m = COMBATE_INIMIGO.voaMorte;
        alvo.dash = { vx: (alvo.x - de.x) / d * m / t, vz: (alvo.z - de.z) / d * m / t, t };
      }
    } else if (firme) { /* firme: aguenta o golpe sem parar o que está fazendo */ }
    else if (alvo.parado > this.tempo) { /* atordoado ou congelado: nem reage */ }
    else if (alvo.defesa <= 0 && !alvo.esc && (alvo.trava <= 0 || alvo.tipo !== 'jogador')) this.tocar(alvo, A.hit, 1.4);
  }
  morrer(c) {
    if (c.coleta) this.pararColeta(c, null);
    c.morto = true; c.dash = null; c.arrancada = null; c.esc = null;
    this.tocar(c, A.death, 1);
    c.trava = Infinity;
    if (c.tipo === 'jogador') {
      this.depois(HEROI.renascer, () => {
        const n = this.mapa.nascimento;
        Object.assign(c, { morto: false, vida: c.vidaMax, mana: c.manaMax ?? HEROI.mana, x: n.x, z: n.z, y: 0, vy: 0, chao: true, trava: 0, acao: null });
        this.evento({ t: 'aviso', para: c.id, texto: 'Você se levanta de novo' });
      });
    } else {
      this.contarMissao(c);
      // XP para quem bateu nele ou estava perto (grupo)
      const xp = XP_INIMIGO[c.tipo] || 5;
      for (const j of this.jogadores.values()) if (!j.morto && !j.criando && (c.atacantes?.has(j.id) || dist(j, c) < 14)) { this.ganharXP(j, xp); this.soltarDrops(c, j); }
      c.atacantes = null; c.parado = 0; c.ef = null; c.lento = null; c.vuln = null;
      if (c.sp.caca != null) { // campo de caça: o corpo some e a vaga abre (o próximo nasce pela regra do Quimera, em passoCacas)
        const vg = this.cacas[c.sp.caca].vagas[c.sp.vaga];
        this.depois(this.cacas[c.sp.caca].def.corpo, () => { this.inimigos.splice(this.inimigos.indexOf(c), 1); if (vg.e === c) vg.e = null; });
      } else this.depois(8, () => {
        this.inimigos.splice(this.inimigos.indexOf(c), 1);
        this.criarInimigo(c.sp);
      });
    }
  }

  // ---------- ajudantes ----------
  evento(e) { if (this.ator && e.de === undefined && e.t !== 'aviso' && e.t !== 'fala') e.de = this.ator.id; this.eventos.push(e); }
  // o que roda depois guarda quem agiu (o golpe que acerta 0,3 s depois continua sendo do mesmo herói)
  depois(dt, fn) {
    const ator = this.ator;
    this.timers.push({ t: this.tempo + dt, fn: ator ? () => { const a = this.ator; this.ator = ator; try { fn(); } finally { this.ator = a; } } : fn });
  }
  aFrente(c, d) { return { x: c.x + Math.sin(c.ry) * d, z: c.z + Math.cos(c.ry) * d }; }
  virarPara(c, alvo) { c.ry = Math.atan2(alvo.x - c.x, alvo.z - c.z); }
  empurrar(c, metros, t) { c.dash = { vx: Math.sin(c.ry) * metros / t, vz: Math.cos(c.ry) * metros / t, t }; }
  // Toca uma animação de uma vez só; devolve a duração em segundos
  tocar(c, nome, ts = 1, segurar = 0) {
    const d = segurar || (DURACAO[nome] || 1) / ts;
    c.acao = { nome, ts, segurar: segurar > 0 };
    c.acaoSeq++;
    c.trava = d;
    return d;
  }
  colidir(c) {
    for (const k of c.tipo === 'jogador' ? this.obstaculos : [...this.obstaculos, ...this.obstaculosRocha]) {
      if (k.alto != null && (c.y || 0) > k.alto) continue; // por cima (esteio da ferraria visto do telhado)
      const dx = c.x - k.x, dz = c.z - k.z, d = Math.hypot(dx, dz), m = k.r + 0.35;
      if (d < m && d > 0) { c.x = k.x + dx / d * m; c.z = k.z + dz / d * m; }
    }
    if (c.tipo !== 'jogador') for (const k of this.casas) { // o herói usa a altura de verdade (escala a parede, anda no telhado)
      const dx = c.x - k.x, dz = c.z - k.z;
      const lx = dx * k.cos - dz * k.sin, lz = dx * k.sin + dz * k.cos; // no sistema da casa
      const px = k.hw - Math.abs(lx), pz = k.hd - Math.abs(lz);
      if (px <= 0 || pz <= 0) continue;
      let nx = lx, nz = lz;
      if (px < pz) nx = Math.sign(lx || 1) * k.hw; else nz = Math.sign(lz || 1) * k.hd;
      c.x = k.x + nx * k.cos + nz * k.sin; c.z = k.z - nx * k.sin + nz * k.cos;
    }
    for (const o of this.todos()) {
      if (o === c || o.morto || o.criando || Math.abs((o.y || 0) - (c.y || 0)) > 1) continue;
      const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz);
      const m = c.tipo !== 'jogador' && o.tipo !== 'jogador' ? 1.2 : 0.7; // monstro com monstro: ~0,6 m de raio cada
      if (d < m && d > 0) { c.x = o.x + dx / d * m; c.z = o.z + dz / d * m; }
    }
    [c.x, c.z] = limitarAoMapa(this.mapa, c.x, c.z, 2.2); // dentro da vila, da passagem e da clareira de fora (shared/mapa.js)
  }
  mover(c, dx, dz) { if (c.tipo === 'jogador') return this.moverJogador(c, dx, dz); c.x += dx; c.z += dz; this.colidir(c); }
  // O herói anda por cima das pedras: degrau baixo sobe andando, pedra alta bloqueia (e aí dá para escalar)
  moverJogador(j, dx, dz) {
    const T = this.terreno, lim = j.y + SUBIDA.degrau;
    const vai = (x, z) => {
      const h = T.altura(x, z, j.y); if (h > lim) return false;
      j.x = x; j.z = z;
      if (j.chao && j.vy <= 0) { if (h >= j.y - 0.4) j.y = h; else j.chao = false; } // desce a pedra andando ou cai da beirada
      return true;
    };
    const x0 = j.x, y0 = j.y, z0 = j.z, chao0 = j.chao;
    if (!vai(j.x + dx, j.z + dz)) { j.bloqueado = true; if (!vai(j.x + dx, j.z)) vai(j.x, j.z + dz); }
    this.colidir(j);
    // o empurrão de um obstáculo (tina, bigorna, esteio, outro jogador) não pode jogar o herói para dentro de uma parede:
    // senão o chão "sobe" até o alto dela e ele aparece no telhado (ferraria: tina rente ao muro do fundo)
    if (T.altura(j.x, j.z, j.y) > lim) { j.x = x0; j.y = y0; j.z = z0; j.chao = chao0; j.bloqueado = true; }
  }

  // ---------- escalada ----------
  // Toca um pedaço de escalada; o corpo segue o caminho do quadril da animação (esticado por vs, hs e ls)
  iniciarClip(j, nome, { vs = 1, hs = 1, ls = 1, depois = null } = {}) {
    const e = ESCALADA[nome], dur = DURACAO[e.anim] / e.ts;
    j.esc = j.esc || { parado: 0 };
    j.esc.clip = { nome, t: 0, dur, vs, hs, ls, x: j.x, y: j.y, z: j.z, depois };
    j.acao = { nome: e.anim, ts: e.ts }; j.acaoSeq++; j.trava = dur;
    j.chao = false; j.vy = 0; j.arrancada = null; j.dash = null; j.empurra = 0;
  }
  ficarEmPe(j) {
    const h = this.terreno.altura(j.x, j.z, j.y), cai = h < j.y - 0.3; // pousou fora (ponta de pedra, canto da chaminé): cai em vez de teleportar para baixo
    j.esc = null; if (!cai) j.y = h; j.chao = !cai; j.vy = 0; j.trava = 0; j.acao = null; j.pulos = 0; j.anim = this.animMovimento(j, false, false);
  }
  soltar(j) { // larga a parede e cai
    const fx = Math.sin(j.ry), fz = Math.cos(j.ry);
    j.esc = null; j.trava = 0; j.acao = null; j.x -= fx * 0.35; j.z -= fz * 0.35; j.vy = 1; j.chao = false; j.pulos = 2;
  }
  // primeira coisa alta à frente: distância até uma pedra mais alta que a mini escalada, se antes dela o caminho for livre.
  // Debaixo de telhado (ferraria) não tem escalada: lá em cima é teto.
  paredeAFrente(j, ry, ate) {
    const T = this.terreno, fx = Math.sin(ry), fz = Math.cos(ry);
    if (T.teto(j.x, j.z, j.y) < Infinity) return null;
    for (let d = 0.1; d <= ate; d += 0.1) {
      if (T.teto(j.x + fx * d, j.z + fz * d, j.y) < Infinity) return null; // o caminho entra debaixo de um telhado (ferraria aberta): parede lá dentro não se escala correndo
      const h = T.altura(j.x + fx * d, j.z + fz * d, j.y);
      if (h > j.y + SUBIDA.degrau) return h > j.y + SUBIDA.mini ? { dist: d, r: T.rochaEm(j.x + fx * d, j.z + fz * d, j.y) } : null;
    }
    return null;
  }
  // a beirada: o ponto mais alto da pedra logo à frente
  beirada(j) {
    const e = j.esc?.escada; if (e) return e.alt; // na escada, a beirada é o topo dela
    const T = this.terreno, fx = Math.sin(j.ry), fz = Math.cos(j.ry);
    // casa: a beirada é o alto da parede (onde começa o telhado), não o telhado subindo lá atrás;
    // senão ela escalava acima do beiral e ficava "escalando" em cima do telhado
    // (se logo atrás da beirada algo sobe reto, como a chaminé da ferraria, a parede continua até lá em cima)
    if (T.rochaEm(j.x + fx * 0.8, j.z + fz * 0.8, j.y)?.casa) for (let d = 0.05; d <= 1.2; d += 0.05) {
      const h = T.altura(j.x + fx * d, j.z + fz * d, j.y); if (h <= j.y + SUBIDA.degrau) continue;
      const atras = T.frente(j.x + fx * d, j.z + fz * d, j.ry, 0.6, null, j.y).topo;
      return atras > h + 0.8 ? atras : h;
    }
    return T.frente(j.x, j.z, j.ry, 1.0, null, j.y).topo;
  }
  // encosta o corpo na parede (na altura do peito) e vira de frente para a pedra
  ajustarParede(j) {
    const T = this.terreno, r = T.rochaEm(j.x + Math.sin(j.ry) * 0.8, j.z + Math.cos(j.ry) * 0.8, j.y);
    if (r) j.ry = r.casa ? T.deFrentePara(r, j.x, j.z) : Math.atan2(r.x - j.x, r.z - j.z);
    const fx = Math.sin(j.ry), fz = Math.cos(j.ry);
    for (let d = -0.5; d <= 1.2; d += 0.05) if (T.altura(j.x + fx * (d + 0.4), j.z + fz * (d + 0.4), j.y) > j.y + 0.9) { j.x += fx * d; j.z += fz * d; return; }
  }
  // fica agarrado na parede
  agarrar(j) { j.esc = j.esc || { parado: 0 }; j.esc.clip = null; j.esc.parado = 0; j.chao = false; j.vy = 0; j.anim = PARADO_PAREDE.agarrado; if (!j.esc.escada) this.ajustarParede(j); }
  // pedra baixa: mini escalada até em cima
  miniSubida(j, ry) {
    const T = this.terreno, fx = Math.sin(ry), fz = Math.cos(ry), topo = T.frente(j.x, j.z, ry, 1.6, null, j.y).topo;
    let d = 0.3; for (; d < 1.6; d += 0.1) if (T.altura(j.x + fx * d, j.z + fz * d, j.y) >= topo - 0.2) break;
    // pousa em cima (mureta fina: não passa do outro lado)
    let pousa = d; while (pousa < d + 0.3 && T.altura(j.x + fx * (pousa + 0.05), j.z + fz * (pousa + 0.05), j.y) >= topo - 0.2) pousa += 0.05;
    j.ry = ry;
    this.iniciarClip(j, 'miniSubida', { vs: (topo - j.y) / 1.38, hs: Math.min(1.7, pousa) / 1.15, depois: () => this.ficarEmPe(j) });
  }
  // da beirada para cima da pedra
  subirNoTopo(j) {
    const T = this.terreno, fx = Math.sin(j.ry), fz = Math.cos(j.ry), topo = this.beirada(j);
    let d = 0.3; for (; d < 2; d += 0.1) if (T.altura(j.x + fx * d, j.z + fz * d, j.y) >= topo - 0.25) break;
    let pousa = d; while (pousa < d + 0.35 && T.altura(j.x + fx * (pousa + 0.05), j.z + fz * (pousa + 0.05), j.y) >= topo - 0.25) pousa += 0.05; // topo estreito (chaminé): não passa do outro lado
    this.iniciarClip(j, 'topo', { vs: Math.max(0.3, (topo - j.y) / 1.29), hs: Math.min(2.2, pousa) / 0.49, depois: () => this.ficarEmPe(j) });
  }
  pegarEscada(j, e) {
    j.ry = e.ry; j.x = e.x; j.z = e.z; j.esc = { parado: 0, escada: e };
    this.iniciarClip(j, 'pegarEscada', { hs: 0, ls: 0, depois: () => this.agarrar(j) });
  }
  // dash contra a rocha alta: corre pela parede (reto ou na diagonal, se a pedra estiver à direita)
  correrNaParede(j) {
    const f = this.paredeAFrente(j, j.ry, 2.9); if (!f || f.dist < 0.5 || !f.r) return false;
    const lado = angDif(Math.atan2(f.r.x - j.x, f.r.z - j.z), j.ry);
    j.esc = { parado: 0 };
    if (lado < -0.35) this.iniciarClip(j, 'diagonal', { hs: Math.max(0.3, (f.dist - 0.3) / 1.44), depois: () => this.agarrar(j) });
    else this.iniciarClip(j, 'correrNaParede', { hs: Math.max(0.2, (f.dist - 0.4) / 2.69), depois: () => this.agarrar(j) });
    this.evento({ t: 'dash', id: j.id });
    return true;
  }
  // andando no chão contra uma pedra: decide se sobe (escada, corrida na parede, mini escalada ou agarra na parede)
  tentarEscalar(j, correr, dt) {
    const { mx, mz } = j.entrada, ry = Math.atan2(mx, mz);
    for (const e of this.escadas) if (Math.hypot(j.x - (e.x - Math.sin(e.ry) * 0.2), j.z - (e.z - Math.cos(e.ry) * 0.2)) < 0.55 && Math.cos(angDif(ry, e.ry)) > 0.6) return this.pegarEscada(j, e); // de frente para a escada, no pé dela
    if (correr) {
      const f = this.paredeAFrente(j, ry, 3.1);
      if (f && f.dist >= 1.5) { j.ry = ry; j.esc = { parado: 0 }; return this.iniciarClip(j, 'corridaParede', { hs: (f.dist - 0.4) / 2.79, depois: () => this.agarrar(j) }); }
    }
    if (!j.bloqueado) { j.empurra = 0; return; }
    j.empurra += dt; if (j.empurra < SUBIDA.empurrar) return;
    const topo = this.terreno.frente(j.x, j.z, ry, 1.6, null, j.y).topo;
    if (topo - j.y <= SUBIDA.mini) return this.miniSubida(j, ry);
    if (this.terreno.teto(j.x, j.z, j.y) < Infinity) { j.empurra = 0; return; } // debaixo de telhado: não escala a parede de dentro
    j.ry = ry; this.agarrar(j);
  }
  passoEscalada(j, dt) {
    const s = j.esc, T = this.terreno;
    const fx = Math.sin(j.ry), fz = Math.cos(j.ry), lx = Math.cos(j.ry), lz = -Math.sin(j.ry);
    if (s.clip) {
      const c = s.clip; c.t += dt;
      const u = Math.min(1, c.t / c.dur), tr = ESCALADA[c.nome].traj, k = u * (tr.length - 1), i = Math.min(tr.length - 2, Math.floor(k)), a = k - i;
      const p = [0, 1, 2].map((n) => tr[i][n] * (1 - a) + tr[i + 1][n] * a);
      j.y = c.y + p[1] * c.vs;
      if (s.escada && c.nome !== 'topo') { // na escada: o corpo vai um pouco atrás da linha da escada
        const e = s.escada, t = Math.max(0, Math.min(1, (j.y + 0.5) / e.alt)); // escada inclinada: segue a linha um pouco acima do corpo (mãos e pés nos degraus)
        j.x = e.x + (e.topo.x - e.x) * t - fx * 0.35; j.z = e.z + (e.topo.z - e.z) * t - fz * 0.35;
      } else { j.x = c.x + lx * p[0] * c.ls + fx * p[2] * c.hs; j.z = c.z + lz * p[0] * c.ls + fz * p[2] * c.hs; }
      if (u < 1) return;
      s.clip = null; j.trava = 0; j.acao = null; c.depois?.();
      if (j.esc !== s || s.clip) return; // ficou em pé ou já emendou outro pedaço
    }
    // agarrado: o controle para a frente sobe, para trás desce, para os lados anda pela parede
    const { mx, mz } = j.entrada, m = Math.hypot(mx, mz);
    const frente = mx * fx + mz * fz, lado = mx * lx + mz * lz, falta = this.beirada(j) - j.y;
    s.parado += dt;
    if (m > 0.5 && frente > 0.5 * m) {
      s.parado = 0;
      if (falta <= SUBIDA.topo) return this.subirNoTopo(j);
      if (s.escada) return this.iniciarClip(j, 'subirEscada', { hs: 0, ls: 0, depois: () => this.agarrar(j) });
      return this.iniciarClip(j, 'subirParede', { vs: Math.max(0.3, Math.min(1, (falta - 1.29) / 1.06)), depois: () => this.agarrar(j) }); // para com a beirada na altura do 'topo'
    }
    if (m > 0.5 && frente < -0.5 * m) {
      s.parado = 0;
      const chao = T.altura(j.x - fx * 0.3, j.z - fz * 0.3, j.y), alt = j.y - chao;
      if (alt < 0.25) { j.esc = null; j.trava = 0; j.y = Math.max(chao, j.y); j.chao = false; return; }
      return this.iniciarClip(j, 'descerParede', { vs: Math.min(1, alt / 1.06), depois: () => (j.y - T.altura(j.x - fx * 0.3, j.z - fz * 0.3, j.y) < 0.3 ? this.ficarEmPe(j) : this.agarrar(j)) });
    }
    if (!s.escada && m > 0.5 && Math.abs(lado) > 0.5 * m) {
      s.parado = 0;
      const sx = j.x + lx * Math.sign(lado) * 0.5, sz = j.z + lz * Math.sign(lado) * 0.5;
      if (T.altura(sx + fx * 0.8, sz + fz * 0.8, j.y) > j.y + 0.9) return this.iniciarClip(j, lado > 0 ? 'esquerda' : 'direita', { depois: () => this.agarrar(j) });
    }
    j.anim = falta < SUBIDA.topo + 0.3 ? PARADO_PAREDE.beirada : s.parado > 4 && s.parado % 8 < 4 ? PARADO_PAREDE.balanca : PARADO_PAREDE.agarrado;
  }

  // ---------- passo da simulação ----------
  passo(dt) {
    this.tempo += dt;
    const vencidos = this.timers.filter((t) => t.t <= this.tempo);
    this.timers = this.timers.filter((t) => t.t > this.tempo);
    vencidos.forEach((t) => t.fn());

    for (const c of this.todos()) {
      if (c.dash && c.dash.t > 0) { if (!this.guiado(c)) this.mover(c, c.dash.vx * dt, c.dash.vz * dt); c.dash.t -= dt; } // guiado: o celular já fez o avanço
      if (c.trava > 0 && c.trava !== Infinity) {
        c.trava -= dt;
        if (c.trava <= 0) {
          c.trava = 0; c.acao = null;
          if (c.fila) { const f = c.fila; c.fila = null; if (f.ate >= this.tempo) { if (f.q) this.usarHabQ(c.id, f.q); else this.usarHabilidade(c.id, f.i); } }
        }
      }
    }
    for (const j of this.jogadores.values()) this.passoJogador(j, dt);
    for (const e of this.inimigos) this.passoInimigo(e, dt);
    this.passoCacas(dt);
    this.passoProjeteis(dt);
    this.passoCampos(dt);
    const ev = this.eventos; this.eventos = [];
    return ev;
  }
  passoJogador(j, dt) {
    j.mana = Math.min(j.manaMax, j.mana + j.st.regenMana * dt);
    this.passoEstamina(j, dt);
    if (j.coleta && this.tempo >= j.coleta.fim) this.batidaColeta(j);
    if (!j.morto && j.vida < j.vidaMax) j.vida = Math.min(j.vidaMax, j.vida + j.st.regenVida * dt);
    if (j.escudo && j.escudo.ate <= this.tempo) j.escudo = null;
    if (this.guiado(j)) { // o celular move o herói; aqui só corre o tempo do dash
      if (j.arrancada) { j.arrancada.t -= dt; if (j.arrancada.t <= 0) j.arrancada = null; }
      return;
    }
    if (j.esc && !j.morto) return this.passoEscalada(j, dt);
    this.passoVertical(j, dt);
    if (j.morto) j.montado = null;
    if (j.morto || j.trava > 0) return;
    const { mx, mz, correr } = j.entrada, m = Math.hypot(mx, mz), mont = MONTARIAS[j.montado];
    j.bloqueado = false;
    if (j.arrancada) {
      const a = j.arrancada, x = 1 - a.t / MOVIMENTO.dashTempo, v = MOVIMENTO.dashVel * (1.6 * (1 - x) ** 0.7 + 0.15); // sai rápido e freia
      this.mover(j, a.dx * v * dt, a.dz * v * dt);
      a.t -= dt; if (a.t <= 0) j.arrancada = null;
    } else if (m > 0.15) {
      const v = mont ? (correr ? mont.correr : mont.andar) : correr ? HEROI.correr : HEROI.andar;
      this.mover(j, mx * v * dt, mz * v * dt);
      const alvo = Math.atan2(mx, mz);
      j.ry += angDif(alvo, j.ry) * Math.min(1, dt * 12);
    }
    if (j.chao && !j.arrancada && m > 0.5 && !mont) { this.tentarEscalar(j, correr, dt); if (j.esc) return; } else j.empurra = 0;
    j.anim = this.animMovimento(j, m > 0.15, correr);
  }
  // Queda, pouso e o tempo do mortal
  passoVertical(j, dt) {
    const chao = this.terreno.altura(j.x, j.z, j.y); // chão ou topo da pedra
    if (j.arrancada) j.vy = 0; else if (!j.chao || j.vy > 0) j.vy -= MOVIMENTO.gravidade * dt;
    j.y += j.vy * dt;
    const teto = this.terreno.teto(j.x, j.z, j.y - j.vy * dt) - HEROI.altura; // debaixo do telhado: a cabeça bate e volta
    if (j.y > teto && j.vy > 0) { j.y = Math.max(chao, teto); j.vy = 0; }
    if (j.y <= chao + 0.001) {
      if (!j.chao && j.vy < -3) j.pouso = DURACAO.pouso * 0.6;
      if (!j.chao) { j.pulos = 0; j.mortal = 0; j.arrancadaNoAr = false; }
      j.y = chao; j.vy = 0; j.chao = true;
    } else j.chao = false;
    j.puloT += dt;
    if (j.mortal > 0) j.mortal = Math.max(0, j.mortal - dt);
    if (j.pouso > 0) j.pouso = Math.max(0, j.pouso - dt);
  }
  animMovimento(j, andando, correr) {
    if (j.arrancada) return 'dash';
    if (j.mortal > 0) return 'mortal';
    if (!j.chao) return j.pulos === 1 && j.vy > 0 && j.puloT < 0.45 ? (correr && andando ? 'puloCorrendo' : 'pulo') : 'queda';
    if (j.pouso > 0 && !andando) return 'pouso';
    return andando ? (correr ? 'Run' : 'Walk') : ARMA.idle;
  }
  passoInimigo(b, dt) {
    if (b.morto) return;
    if (b.parado > this.tempo) return; // atordoado ou congelado
    if (b.ef) b.ef = null;
    if (b.trava > 0) return;
    const t = TIPOS_INIMIGO[b.tipo];
    const lento = b.lento && b.lento.ate > this.tempo ? 1 - b.lento.k : 1;
    const alvo = this.maisPerto(b, 14);
    b.ataqueCd -= dt;
    const CI = COMBATE_INIMIGO;
    if (b.vez && (!alvo || alvo.id !== b.vez || dist(alvo, b) > 5)) b.vez = null; // largou a vez de bater
    // no máximo CI.aoMesmoTempo monstros batem no mesmo herói; os outros rodeiam esperando a vez
    const esperando = alvo && !b.vez && this.inimigos.filter((o) => o !== b && !o.morto && o.vez === alvo.id).length >= CI.aoMesmoTempo;
    if (alvo && esperando && dist(alvo, b) < CI.roda + 1.2) {
      this.virarPara(b, alvo);
      const d = dist(alvo, b), lado = (b.v % 2 ? 1 : -1), perto = (d - CI.roda) * 1.5;
      const vx = Math.cos(b.ry) * lado * CI.rodaVel + Math.sin(b.ry) * perto, vz = -Math.sin(b.ry) * lado * CI.rodaVel + Math.cos(b.ry) * perto;
      this.mover(b, vx * dt, vz * dt);
      b.anim = 'Walk';
    } else if (alvo && dist(alvo, b) < 1.9 && Math.abs(alvo.y - b.y) < 1.3) {
      this.virarPara(b, alvo); b.anim = A.swordIdle; b.vez = alvo.id;
      if (b.ataqueCd <= 0) {
        b.ataqueCd = t.intervalo;
        // preparo: a animação começa bem devagar (braço para trás) e o celular acende um brilho vermelho
        const nome = Math.random() < 0.5 ? A.slash : A.slash2, P = CI.preparo[b.tipo] ?? 0.5;
        const dur = DURACAO[nome] || 1, hit = P + Math.max(0.05, dur * CI.acerto - P * CI.preparoTs) / CI.golpeTs;
        b.acao = { nome, ts: CI.preparoTs, segurar: false, preparo: P, ts2: CI.golpeTs }; b.acaoSeq++;
        b.trava = P + Math.max(0.1, dur - P * CI.preparoTs) / CI.golpeTs;
        this.evento({ t: 'preparo', id: b.id, dur: P });
        const seq = b.acaoSeq; // apanhou no meio (ou foi atordoado): o golpe foi cortado
        this.depois(hit, () => {
          if (b.acaoSeq !== seq || b.parado > this.tempo || b.morto || alvo.morto) return;
          if ((alvo.defesa >= 1 || alvo.arrancada) && dist(alvo, b) < 6) { // rolou ou deu dash na hora: esquiva e contra-ataque
            alvo.contraAte = this.tempo + CI.contraDur;
            this.evento({ t: 'esquiva', id: alvo.id, de: b.id });
            return;
          }
          if (dist(alvo, b) >= 2.4 || Math.abs(alvo.y - b.y) >= 1.3) return;
          this.ferir(alvo, t.dano, b);
        });
        if (Math.random() < 0.5) b.vez = null; // passa a vez para quem está rodeando
      }
    } else if (alvo) {
      const d = dist(alvo, b); this.virarPara(b, alvo);
      const v = (d > 5 ? 3.6 : 1.7) * lento;
      this.mover(b, Math.sin(b.ry) * v * dt, Math.cos(b.ry) * v * dt);
      b.anim = d > 5 ? 'Run' : 'Walk';
    } else if (dist(b, b.casa) > 1) {
      this.virarPara(b, b.casa);
      this.mover(b, Math.sin(b.ry) * 1.7 * dt, Math.cos(b.ry) * 1.7 * dt);
      b.anim = 'Walk';
    } else b.anim = A.swordIdle;
  }
  passoProjeteis(dt) {
    for (let i = this.projeteis.length - 1; i >= 0; i--) {
      const p = this.projeteis[i], v = p.h.proj.vel;
      this.ator = p.dono;
      p.vida -= dt; p.x += p.dx * v * dt; p.y += p.dy * v * dt; p.z += p.dz * v * dt;
      let fim = p.vida <= 0 || p.y < this.terreno.altura(p.x, p.z, p.y); // bate no chão ou na pedra
      for (const o of this.inimigosDe(p.dono)) {
        if (p.acertou.has(o)) continue;
        const esc = TIPOS_INIMIGO[o.tipo]?.escala || 1;
        if (Math.hypot(o.x - p.x, o.z - p.z) < (p.h.proj.largura || 0.6) && p.y - (o.y || 0) < 2.1 * esc && p.y > (o.y || 0) - 0.3) {
          p.acertou.add(o); this.ferir(o, p.h.dmg, p.dono, p.h);
          if (!p.h.proj.atravessa) { fim = true; break; }
        }
      }
      if (!fim) continue;
      const ex = p.h.proj.explosao;
      if (ex) for (const o of this.inimigosDe(p.dono)) if (!p.acertou.has(o) && Math.hypot(o.x - p.x, o.z - p.z) < ex) this.ferir(o, p.h.dmg * (p.h.q ? 1 : 0.6), p.dono, p.h);
      this.evento({ t: 'projFim', id: p.id, x: r2(p.x), y: r2(p.y), z: r2(p.z), explosao: ex || 0, cor: p.h.proj.cor, estilo: p.h.proj.estilo });
      this.projeteis.splice(i, 1);
    }
    this.ator = null;
  }
  passoCampos(dt) {
    for (let i = this.campos.length - 1; i >= 0; i--) {
      const f = this.campos[i]; f.vida -= dt; f.tique -= dt;
      this.ator = f.dono;
      if (f.tique <= 0) { f.tique = 0.5; for (const o of this.inimigosDe(f.dono)) if (dist(o, f) < f.r) this.ferir(o, Math.round(f.dps * 0.5), f.dono); }
      if (f.vida <= 0) this.campos.splice(i, 1);
    }
    this.ator = null;
  }

  // ---------- o que vai para a tela ----------
  foto() {
    const roupa = (eq) => ['cabeca', 'corpo', 'pernas', 'pes', 'capa'].map((l) => (eq?.[l] ? eq[l].k + eq[l].r : '')).filter(Boolean).join(',');
    const corpo = (c) => ({ id: c.id, x: r2(c.x), y: r2(c.y), z: r2(c.z), ry: r2(((c.ry % TAU) + TAU) % TAU), vida: c.vida, vidaMax: c.vidaMax,
      morto: c.morto, anim: c.anim, acao: c.acao, acaoSeq: c.acaoSeq, nome: c.nome });
    return {
      tempo: r2(this.tempo),
      jogadores: [...this.jogadores.values()].map((j) => ({ ...corpo(j), vida: Math.round(j.vida), criando: !!j.criando, mana: Math.round(j.mana), manaMax: j.manaMax, nivel: j.prog.nivel, sta: Math.round(j.sta), staMax: j.staMax, coleta: j.coleta?.no || null,
        roupa: roupa(j.prog.equip), // o que aparece no corpo para os outros: "peitoral3,capa1"
        semCapacete: !!j.prog.semCapacete, // capacete escondido pelo dono: os outros também não veem
        escudo: j.escudo && j.escudo.ate > this.tempo ? j.escudo.n : 0, build: j.build, visual: j.visual, aparencia: j.aparencia || null, modo: j.modo, missoes: j.missoes, montado: j.montado || null,
        cds: Object.fromEntries(Object.entries(j.cds).map(([k, v]) => [k, r2(Math.max(0, v - this.tempo))])) })),
      inimigos: this.inimigos.map((e) => ({ ...corpo(e), tipo: e.tipo, v: e.v, ef: e.parado > this.tempo ? e.ef : e.lento?.ate > this.tempo ? 'lento' : null })),
      // veios das zonas de mineração já batidos: [id, cargas que sobram, s para voltar] (quem entra depois também vê)
      veios: [...this.veiosComuns].filter(([, v]) => v.volta > this.tempo).map(([id, v]) => [id, v.n, r2(v.volta - this.tempo)]),
    };
  }
}
