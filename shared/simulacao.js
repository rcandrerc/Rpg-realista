// Regras do jogo, sem gráficos. O servidor roda esta simulação e manda o resultado aos jogadores.
// O cliente também consegue rodá-la sozinho (modo solo) quando não há servidor.
import { A, DURACAO, ARMAS, HEROI, TIPOS_INIMIGO } from './dados.js';

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
    this.obstaculos = [
      ...mapa.pedras.map(([x, z, s]) => ({ x, z, r: s * 0.6 })),
      ...mapa.obstaculos,
    ];
    mapa.inimigos.forEach((sp) => this.criarInimigo(sp));
  }

  // ---------- entidades ----------
  novoCorpo(extra) {
    return { id: 'e' + this.proxId++, x: 0, z: 0, ry: 0, trava: 0, defesa: 0, morto: false, anim: 'Idle',
      acao: null, acaoSeq: 0, dash: null, ...extra };
  }
  adicionarJogador(id, nome) {
    const n = this.mapa.nascimento;
    const j = this.novoCorpo({ id, tipo: 'jogador', nome: nome || 'Andarilho', x: n.x + (Math.random() - 0.5) * 3, z: n.z + (Math.random() - 0.5) * 3,
      vida: HEROI.vida, vidaMax: HEROI.vida, mana: HEROI.mana, arma: 'espada', cds: {}, entrada: { mx: 0, mz: 0, correr: false } });
    this.jogadores.set(id, j);
    return j;
  }
  removerJogador(id) { this.jogadores.delete(id); }
  criarInimigo(sp) {
    const t = TIPOS_INIMIGO[sp.tipo];
    const e = this.novoCorpo({ tipo: sp.tipo, nome: t.nome, x: sp.x, z: sp.z, casa: { x: sp.x, z: sp.z }, vida: t.vida, vidaMax: t.vida,
      ataqueCd: 1 + Math.random(), sp });
    e.anim = A.swordIdle;
    this.inimigos.push(e);
  }
  todos() { return [...this.jogadores.values(), ...this.inimigos]; }
  inimigosDe(c) {
    return (c.tipo === 'jogador' ? this.inimigos : [...this.jogadores.values()]).filter((o) => !o.morto);
  }
  maisPerto(c, max = 22) {
    let melhor = null, md = max;
    for (const o of this.inimigosDe(c)) { const d = dist(o, c); if (d < md) { md = d; melhor = o; } }
    return melhor;
  }

  // ---------- comandos vindos dos jogadores ----------
  entrada(id, e) {
    const j = this.jogadores.get(id); if (!j) return;
    const m = Math.hypot(e.mx || 0, e.mz || 0);
    const k = m > 1 ? 1 / m : 1; // nunca mais rápido que o permitido
    j.entrada = { mx: (e.mx || 0) * k, mz: (e.mz || 0) * k, correr: !!e.correr };
  }
  trocarArma(id, arma) {
    const j = this.jogadores.get(id); if (!j || !ARMAS[arma] || j.morto) return;
    j.arma = arma;
    this.evento({ t: 'anel', x: j.x, z: j.z, r: 1.4, cor: 0xd9a54a, dur: 0.4 });
  }
  usarHabilidade(id, i) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.trava > 0) return;
    const arma = ARMAS[j.arma];
    const h = i === 0 ? arma.basico : arma.habilidades[i - 1]; if (!h) return;
    const chave = j.arma + i;
    if ((j.cds[chave] || 0) > this.tempo) return;
    if (h.mana && j.mana < h.mana) { this.evento({ t: 'aviso', para: id, texto: 'Mana insuficiente' }); return; }
    j.mana -= h.mana || 0;
    j.cds[chave] = this.tempo + h.cd;
    const alvo = this.maisPerto(j);
    if (alvo && !h.salto) this.virarPara(j, alvo);
    const d = this.tocar(j, h.anim, h.ts || 1, h.segurar || 0);
    const at = h.segurar ? 0.05 : d * (h.at || 0.5);
    if (!h.segurar && !h.salto) j.trava = Math.min(d, at + 0.45); // libera o próximo comando logo depois do impacto
    if (h.segurar) { j.defesa = h.defesa; this.depois(h.segurar, () => { j.defesa = 0; }); }
    if (h.avanco) this.empurrar(j, h.avanco, at || 0.3);
    if (h.salto) this.empurrar(j, h.salto, d * 0.6);
    this.depois(at, () => this.efeitoHabilidade(j, h));
  }
  rolar(id) {
    const j = this.jogadores.get(id);
    if (!j || j.morto || j.trava > 0 || (j.cds.rolar || 0) > this.tempo) return;
    j.cds.rolar = this.tempo + HEROI.rolarCd;
    const { mx, mz } = j.entrada;
    if (Math.hypot(mx, mz) > 0.1) j.ry = Math.atan2(mx, mz);
    const d = this.tocar(j, A.roll, 1.25);
    this.empurrar(j, 4.2, d);
    j.defesa = 1;
    this.depois(d * 0.7, () => { j.defesa = 0; });
  }

  // ---------- combate ----------
  efeitoHabilidade(j, h) {
    if (j.morto) return;
    if (h.proj) this.lancar(j, h, this.maisPerto(j));
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
      const acerta = h.area ? d < h.area : d < h.alcance && Math.abs(angDif(Math.atan2(o.x - c.x, o.z - c.z), c.ry)) < h.arco / 2;
      if (!acerta) continue;
      this.ferir(o, h.dmg, c);
      if (h.area && d > 0) { o.x += (o.x - c.x) / d * 1.2; o.z += (o.z - c.z) / d * 1.2; this.colidir(o); }
    }
    if (h.area) this.evento({ t: 'anel', x: r2(c.x), z: r2(c.z), r: h.area, cor: 0xd9c49a, dur: 0.5 });
  }
  lancar(c, h, alvo) {
    const f = this.aFrente(c, 0.6);
    const de = { x: f.x, y: 1.35, z: f.z };
    let dx = Math.sin(c.ry), dy = 0, dz = Math.cos(c.ry);
    if (alvo) { dx = alvo.x - de.x; dy = 1.1 - de.y; dz = alvo.z - de.z; const n = Math.hypot(dx, dy, dz) || 1; dx /= n; dy /= n; dz /= n; }
    const p = { id: this.proxId++, ...de, dx, dy, dz, h, dono: c, vida: 2.2, acertou: new Set() };
    this.projeteis.push(p);
    this.evento({ t: 'proj', id: p.id, x: r2(de.x), y: de.y, z: r2(de.z), dx: r2(dx), dy: r2(dy), dz: r2(dz), ...h.proj });
  }
  ferir(alvo, n, de) {
    if (alvo.morto) return;
    if (alvo.defesa > 0) n = Math.round(n * (1 - alvo.defesa));
    alvo.vida = Math.max(0, alvo.vida - n);
    this.evento({ t: 'dano', alvo: alvo.id, n });
    if (alvo.vida <= 0) this.morrer(alvo);
    else if (alvo.defesa <= 0 && (alvo.trava <= 0 || alvo.tipo !== 'jogador')) this.tocar(alvo, A.hit, 1.4);
  }
  morrer(c) {
    c.morto = true; c.dash = null;
    this.tocar(c, A.death, 1);
    c.trava = Infinity;
    if (c.tipo === 'jogador') {
      this.depois(HEROI.renascer, () => {
        const n = this.mapa.nascimento;
        Object.assign(c, { morto: false, vida: c.vidaMax, mana: HEROI.mana, x: n.x, z: n.z, trava: 0, acao: null });
        this.evento({ t: 'aviso', para: c.id, texto: 'Você se levanta de novo' });
      });
    } else {
      this.depois(8, () => {
        this.inimigos.splice(this.inimigos.indexOf(c), 1);
        this.criarInimigo(c.sp);
      });
    }
  }

  // ---------- ajudantes ----------
  evento(e) { this.eventos.push(e); }
  depois(dt, fn) { this.timers.push({ t: this.tempo + dt, fn }); }
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
    for (const k of this.obstaculos) {
      const dx = c.x - k.x, dz = c.z - k.z, d = Math.hypot(dx, dz), m = k.r + 0.35;
      if (d < m && d > 0) { c.x = k.x + dx / d * m; c.z = k.z + dz / d * m; }
    }
    for (const o of this.todos()) {
      if (o === c || o.morto) continue;
      const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz);
      if (d < 0.7 && d > 0) { c.x = o.x + dx / d * 0.7; c.z = o.z + dz / d * 0.7; }
    }
    const r = Math.hypot(c.x, c.z), lim = this.mapa.raio - 2.2;
    if (r > lim) { c.x *= lim / r; c.z *= lim / r; }
  }
  mover(c, dx, dz) { c.x += dx; c.z += dz; this.colidir(c); }

  // ---------- passo da simulação ----------
  passo(dt) {
    this.tempo += dt;
    const vencidos = this.timers.filter((t) => t.t <= this.tempo);
    this.timers = this.timers.filter((t) => t.t > this.tempo);
    vencidos.forEach((t) => t.fn());

    for (const c of this.todos()) {
      if (c.dash && c.dash.t > 0) { this.mover(c, c.dash.vx * dt, c.dash.vz * dt); c.dash.t -= dt; }
      if (c.trava > 0 && c.trava !== Infinity) { c.trava -= dt; if (c.trava <= 0) { c.trava = 0; c.acao = null; } }
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
    const idle = ARMAS[j.arma].idle;
    if (j.morto || j.trava > 0) return;
    const { mx, mz, correr } = j.entrada, m = Math.hypot(mx, mz);
    if (m > 0.15) {
      const v = correr ? HEROI.correr : HEROI.andar;
      this.mover(j, mx * v * dt, mz * v * dt);
      const alvo = Math.atan2(mx, mz);
      j.ry += angDif(alvo, j.ry) * Math.min(1, dt * 12);
      j.anim = correr ? 'Run' : 'Walk';
    } else j.anim = idle;
  }
  passoInimigo(b, dt) {
    if (b.morto || b.trava > 0) return;
    const t = TIPOS_INIMIGO[b.tipo];
    const alvo = this.maisPerto(b, 14);
    b.ataqueCd -= dt;
    if (alvo && dist(alvo, b) < 1.9) {
      this.virarPara(b, alvo); b.anim = A.swordIdle;
      if (b.ataqueCd <= 0) {
        b.ataqueCd = t.intervalo;
        const d = this.tocar(b, Math.random() < 0.5 ? A.slash : A.slash2, 1.1);
        this.depois(d * 0.45, () => { if (!b.morto && !alvo.morto && dist(alvo, b) < 2.4) this.ferir(alvo, t.dano, b); });
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
      p.vida -= dt; p.x += p.dx * v * dt; p.y += p.dy * v * dt; p.z += p.dz * v * dt;
      let fim = p.vida <= 0 || p.y < 0;
      for (const o of this.inimigosDe(p.dono)) {
        if (p.acertou.has(o)) continue;
        const esc = TIPOS_INIMIGO[o.tipo]?.escala || 1;
        if (Math.hypot(o.x - p.x, o.z - p.z) < 0.6 && p.y < 2.1 * esc) {
          p.acertou.add(o); this.ferir(o, p.h.dmg, p.dono);
          if (!p.h.proj.atravessa) { fim = true; break; }
        }
      }
      if (!fim) continue;
      const ex = p.h.proj.explosao;
      if (ex) for (const o of this.inimigosDe(p.dono)) if (!p.acertou.has(o) && Math.hypot(o.x - p.x, o.z - p.z) < ex) this.ferir(o, Math.round(p.h.dmg * 0.6), p.dono);
      this.evento({ t: 'projFim', id: p.id, x: r2(p.x), y: r2(p.y), z: r2(p.z), explosao: ex || 0, cor: p.h.proj.cor });
      this.projeteis.splice(i, 1);
    }
  }
  passoCampos(dt) {
    for (let i = this.campos.length - 1; i >= 0; i--) {
      const f = this.campos[i]; f.vida -= dt; f.tique -= dt;
      if (f.tique <= 0) { f.tique = 0.5; for (const o of this.inimigosDe(f.dono)) if (dist(o, f) < f.r) this.ferir(o, Math.round(f.dps * 0.5), f.dono); }
      if (f.vida <= 0) this.campos.splice(i, 1);
    }
  }

  // ---------- o que vai para a tela ----------
  foto() {
    const corpo = (c) => ({ id: c.id, x: r2(c.x), z: r2(c.z), ry: r2(((c.ry % TAU) + TAU) % TAU), vida: c.vida, vidaMax: c.vidaMax,
      morto: c.morto, anim: c.anim, acao: c.acao, acaoSeq: c.acaoSeq, nome: c.nome });
    return {
      tempo: r2(this.tempo),
      jogadores: [...this.jogadores.values()].map((j) => ({ ...corpo(j), mana: Math.round(j.mana), arma: j.arma,
        cds: Object.fromEntries(Object.entries(j.cds).map(([k, v]) => [k, r2(Math.max(0, v - this.tempo))])) })),
      inimigos: this.inimigos.map((e) => ({ ...corpo(e), tipo: e.tipo })),
    };
  }
}
