// Regras do jogo, sem gráficos. O servidor roda esta simulação e manda o resultado aos jogadores.
// O cliente também consegue rodá-la sozinho (modo solo) quando não há servidor.
import { Terreno } from './terreno.js';
import { ORCAMENTO, A, DURACAO, ARMA, BASICO, BASICO_MAGIA, CURA, ESCALADA, PARADO_PAREDE, SUBIDA, HABILIDADES, BUILD_PADRAO, buildValida, HEROI, MOVIMENTO, MISSOES, MONTARIAS, aparenciaValida, nomeValido, TIPOS_INIMIGO, PERSONAGENS, PERSONAGEM_PADRAO } from './dados.js';

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
    this.obstaculos = [...mapa.obstaculos, ...vila.arvores.map((a) => ({ x: a.x, z: a.z, r: 0.32 * a.s })),
      ...(mapa.npcs || []).map((n) => ({ x: n.x, z: n.z, r: 0.3 })), ...this.terreno.postes];
    // casas: retângulo girado (meia largura / meia profundidade); inimigos não atravessam, o herói escala (shared/terreno.js)
    this.casas = vila.casas.map((c) => ({ x: c.x, z: c.z, cos: Math.cos(c.ry), sin: Math.sin(c.ry), hw: c.w / 2 + 0.35, hd: c.d / 2 + 0.35 }));
    this.obstaculosRocha = this.terreno.rochas.map((r) => ({ x: r.x, z: r.z, r: r.R * 0.62 }));
    this.escadas = (mapa.escadas || []).map((e) => ({ ...e, alt: this.terreno.altura(e.topo.x, e.topo.z) }));
    mapa.inimigos.forEach((sp) => this.criarInimigo(sp));
  }

  // ---------- entidades ----------
  novoCorpo(extra) {
    return { id: 'e' + this.proxId++, x: 0, z: 0, ry: 0, trava: 0, defesa: 0, morto: false, anim: 'Idle',
      acao: null, acaoSeq: 0, dash: null, y: 0, vy: 0, chao: true, esc: null, ...extra };
  }
  // opcoes.podeCriar: personagem ainda não foi criado (o criador abre uma vez só); opcoes.aparencia: a que já foi criada
  adicionarJogador(id, nome, visual, { podeCriar = false, aparencia = null } = {}) {
    const n = this.mapa.nascimento;
    const j = this.novoCorpo({ id, tipo: 'jogador', nome: nome || 'Andarilho', x: n.x + (Math.random() - 0.5) * 3, z: n.z + (Math.random() - 0.5) * 3,
      vida: HEROI.vida, vidaMax: HEROI.vida, mana: HEROI.mana, build: [...BUILD_PADRAO], cds: {}, entrada: { mx: 0, mz: 0, correr: false },
      fila: null, modo: 'Espada', missoes: {}, falas: {}, pulos: 0, puloT: 9, mortal: 0, pouso: 0, empurra: 0, bloqueado: false, arrancada: null, arrancadaNoAr: false, combos: {},
      visual: PERSONAGENS.some((p) => p.id === visual) ? visual : PERSONAGEM_PADRAO, podeCriar: !!podeCriar });
    if (aparencia) j.aparencia = aparenciaValida(aparencia);
    this.jogadores.set(id, j);
    return j;
  }
  removerJogador(id) { this.jogadores.delete(id); }
  criarInimigo(sp) {
    const t = TIPOS_INIMIGO[sp.tipo];
    const e = this.novoCorpo({ tipo: sp.tipo, nome: t.nome, x: sp.x, z: sp.z, casa: { x: sp.x, z: sp.z }, vida: t.vida, vidaMax: t.vida,
      ataqueCd: 1 + Math.random(), sp, v: this.mapa.inimigos.indexOf(sp) });
    e.anim = A.swordIdle;
    this.inimigos.push(e);
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
    if (j?.criando && PERSONAGENS.some((p) => p.id === visual)) j.visual = visual;
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
  // "Pronto" no criador: grava nome, corpo e aparência de vez. Devolve o que valeu (para salvar na conta) ou null.
  concluirCriacao(id, p) {
    const j = this.jogadores.get(id); if (!j?.criando || !j.podeCriar) return null;
    const nome = nomeValido(p?.nome); if (!nome) return null;
    if (PERSONAGENS.some((q) => q.id === p.visual)) j.visual = p.visual;
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
    const mont = MONTARIAS[j.montado], vmax = (mont ? Math.max(mont.correr, HEROI.correr) : HEROI.correr) * 1.3;
    if (j.orcT == null) { j.orc = ORCAMENTO.burst; j.orcT = this.tempo; }
    j.orc = Math.min(ORCAMENTO.burst, j.orc + (this.tempo - j.orcT) * vmax); j.orcT = this.tempo;
    const d = Math.hypot(p.x - j.x, p.z - j.z), chao = this.terreno.altura(p.x, p.z);
    const ok = d <= j.orc + 0.05 && p.y >= chao - 0.6 && p.y <= chao + ORCAMENTO.altura && Math.hypot(p.x, p.z) <= this.mapa.raio;
    if (!ok) {
      this.evento({ t: 'corrigir', para: id, x: r2(j.x), y: r2(j.y), z: r2(j.z), ry: r2(j.ry) });
      j.cliente = null;
      return false;
    }
    j.orc -= d;
    j.x = p.x; j.y = p.y; j.z = p.z; j.ry = p.ry;
    j.chao = p.y - chao < 0.15; j.vy = 0;
    if (typeof p.anim === 'string' && p.anim.length < 64) j.anim = p.anim; // só aparência, para os outros jogadores
    j.cliente = { t: this.tempo };
    return true;
  }
  guiado(j) { return j.tipo === 'jogador' && j.cliente && !j.morto && this.tempo - j.cliente.t < 0.5; }
  usarHabilidade(id, i) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.esc || j.criando) return;
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
    let h = i === 0 ? BASICO : i === 9 ? CURA : i === 10 ? BASICO_MAGIA : HABILIDADES[chave]; if (!h) return;
    if ((j.cds[chave] || 0) > this.tempo) return;
    if (h.mana && j.mana < h.mana) { this.evento({ t: 'aviso', para: id, texto: 'Mana insuficiente' }); return; }
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
    if (h.salto) this.empurrar(j, h.salto, d * 0.6);
    if (h.fx) this.evento({ t: 'conjura', id: j.id, hab: chave, dur: r2(h.segurar || d) });
    if (h.hits) h.hits.forEach((f) => this.depois(d * f, () => this.efeitoHabilidade(j, h)));
    else this.depois(at, () => this.efeitoHabilidade(j, h));
  }
  // No chão pula; no ar, o segundo pulo é um mortal para a frente
  // Botão Falar: o NPC mais perto responde conforme a função dele (cura, missão, habilidades, dica, loja)
  falar(id) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.criando) return;
    let npc = null, md = 3.2;
    for (const n of this.mapa.npcs || []) { const d = dist(n, j); if (d < md) { md = d; npc = n; } }
    if (!npc) return;
    const diga = (texto, extra = {}) => this.evento({ t: 'fala', para: j.id, npc: npc.id, texto, ...extra });
    const proxima = () => npc.falas[(j.falas[npc.id] = (j.falas[npc.id] ?? -1) + 1) % npc.falas.length];
    if (npc.funcao === 'cura') {
      if (j.vida >= j.vidaMax && j.mana >= HEROI.mana) return diga('Você está inteiro. Volte quando precisar.');
      const n = j.vidaMax - j.vida; j.vida = j.vidaMax; j.mana = HEROI.mana;
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
    if (j?.esc) { if (!j.esc.clip) this.soltar(j); return; } // na parede: solta
    if (!j || j.morto || j.criando || j.trava > 0 || j.arrancada) return;
    if (j.chao) { j.vy = MOVIMENTO.pulo; j.chao = false; j.pulos = 1; j.puloT = 0; j.pouso = 0; }
    else if (j.pulos < 2) { j.vy = Math.max(j.vy, MOVIMENTO.pulo * 0.9); j.pulos = 2; j.mortal = DURACAO.mortal; }
  }
  // Rolamento no chão: nenhum golpe pega durante a maior parte dele
  rolar(id) {
    const j = this.jogadores.get(id);
    if (!j || j.morto || j.criando || j.esc || j.trava > 0 || !j.chao || j.arrancada || (j.cds.rolar || 0) > this.tempo) return;
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
    if (!j || j.morto || j.criando || j.esc || j.trava > 0 || j.arrancada || (j.cds.dash || 0) > this.tempo || (!j.chao && j.arrancadaNoAr)) return;
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
      alvos.forEach((o, k) => this.depois(k * 0.12, () => { this.evento({ t: 'raio', x: r2(o.x), z: r2(o.z) }); this.ferir(o, h.raios.dmg, j); }));
    }
    else if (h.cura) {
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
        for (const o of this.inimigosDe(j)) if (dist(o, p) < h.chuva.r) this.ferir(o, h.chuva.dmg, j);
      });
    } else if (h.dmg) this.corpoACorpo(j, h);
  }
  corpoACorpo(c, h) {
    for (const o of this.inimigosDe(c)) {
      const d = dist(o, c);
      if (Math.abs((o.y || 0) - (c.y || 0)) > 1.6) continue; // em cima da pedra o golpe não alcança quem está embaixo
      const acerta = h.area ? d < h.area : d < h.alcance && Math.abs(angDif(Math.atan2(o.x - c.x, o.z - c.z), c.ry)) < h.arco / 2;
      if (!acerta) continue;
      this.ferir(o, h.dmg, c);
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
  ferir(alvo, n, de) {
    if (alvo.morto || alvo.arrancada || alvo.criando) return;
    if (alvo.defesa > 0) n = Math.round(n * (1 - alvo.defesa));
    alvo.vida = Math.max(0, alvo.vida - n);
    this.evento({ t: 'dano', alvo: alvo.id, n });
    if (alvo.vida <= 0) this.morrer(alvo);
    else if (alvo.defesa <= 0 && !alvo.esc && (alvo.trava <= 0 || alvo.tipo !== 'jogador')) this.tocar(alvo, A.hit, 1.4);
  }
  morrer(c) {
    c.morto = true; c.dash = null; c.arrancada = null; c.esc = null;
    this.tocar(c, A.death, 1);
    c.trava = Infinity;
    if (c.tipo === 'jogador') {
      this.depois(HEROI.renascer, () => {
        const n = this.mapa.nascimento;
        Object.assign(c, { morto: false, vida: c.vidaMax, mana: HEROI.mana, x: n.x, z: n.z, y: 0, vy: 0, chao: true, trava: 0, acao: null });
        this.evento({ t: 'aviso', para: c.id, texto: 'Você se levanta de novo' });
      });
    } else {
      this.contarMissao(c);
      this.depois(8, () => {
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
      if (d < 0.7 && d > 0) { c.x = o.x + dx / d * 0.7; c.z = o.z + dz / d * 0.7; }
    }
    const r = Math.hypot(c.x, c.z), lim = this.mapa.raio - 2.2;
    if (r > lim) { c.x *= lim / r; c.z *= lim / r; }
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
    if (!vai(j.x + dx, j.z + dz)) { j.bloqueado = true; if (!vai(j.x + dx, j.z)) vai(j.x, j.z + dz); }
    this.colidir(j);
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
          if (c.fila) { const f = c.fila; c.fila = null; if (f.ate >= this.tempo) this.usarHabilidade(c.id, f.i); }
        }
      }
    }
    for (const j of this.jogadores.values()) this.passoJogador(j, dt);
    for (const e of this.inimigos) this.passoInimigo(e, dt);
    this.passoProjeteis(dt);
    this.passoCampos(dt);
    const ev = this.eventos; this.eventos = [];
    return ev;
  }
  passoJogador(j, dt) {
    j.mana = Math.min(HEROI.mana, j.mana + HEROI.manaPorSeg * dt);
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
    if (b.morto || b.trava > 0) return;
    const t = TIPOS_INIMIGO[b.tipo];
    const alvo = this.maisPerto(b, 14);
    b.ataqueCd -= dt;
    if (alvo && dist(alvo, b) < 1.9 && Math.abs(alvo.y - b.y) < 1.3) {
      this.virarPara(b, alvo); b.anim = A.swordIdle;
      if (b.ataqueCd <= 0) {
        b.ataqueCd = t.intervalo;
        const d = this.tocar(b, Math.random() < 0.5 ? A.slash : A.slash2, 1.1);
        this.depois(d * 0.45, () => { if (!b.morto && !alvo.morto && dist(alvo, b) < 2.4 && Math.abs(alvo.y - b.y) < 1.3) this.ferir(alvo, t.dano, b); });
      }
    } else if (alvo) {
      const d = dist(alvo, b); this.virarPara(b, alvo);
      const v = d > 5 ? 3.6 : 1.7;
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
          p.acertou.add(o); this.ferir(o, p.h.dmg, p.dono);
          if (!p.h.proj.atravessa) { fim = true; break; }
        }
      }
      if (!fim) continue;
      const ex = p.h.proj.explosao;
      if (ex) for (const o of this.inimigosDe(p.dono)) if (!p.acertou.has(o) && Math.hypot(o.x - p.x, o.z - p.z) < ex) this.ferir(o, Math.round(p.h.dmg * 0.6), p.dono);
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
    const corpo = (c) => ({ id: c.id, x: r2(c.x), y: r2(c.y), z: r2(c.z), ry: r2(((c.ry % TAU) + TAU) % TAU), vida: c.vida, vidaMax: c.vidaMax,
      morto: c.morto, anim: c.anim, acao: c.acao, acaoSeq: c.acaoSeq, nome: c.nome });
    return {
      tempo: r2(this.tempo),
      jogadores: [...this.jogadores.values()].map((j) => ({ ...corpo(j), criando: !!j.criando, mana: Math.round(j.mana), build: j.build, visual: j.visual, aparencia: j.aparencia || null, modo: j.modo, missoes: j.missoes, montado: j.montado || null,
        cds: Object.fromEntries(Object.entries(j.cds).map(([k, v]) => [k, r2(Math.max(0, v - this.tempo))])) })),
      inimigos: this.inimigos.map((e) => ({ ...corpo(e), tipo: e.tipo, v: e.v })),
    };
  }
}
