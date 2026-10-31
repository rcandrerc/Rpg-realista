// Previsão do próprio herói no modo online.
// O celular roda as mesmas regras (shared/simulacao.js) só para o seu herói, então ele anda, pula e ataca na hora,
// sem esperar a ida e volta até o servidor. O servidor continua decidindo tudo (dano, vida, posição de verdade):
// a cada foto do mundo a previsão compara com o servidor e corrige aos poucos (ou de uma vez, se a diferença for grande).
import { Simulacao, A } from '@rpg/shared';

const CORRIGE = 0.15; // fração do erro corrigida a cada foto (20 por segundo): some em uns 300 ms sem dar tranco
const PULO_GRANDE = 3.5; // diferença em metros que vira teleporte (renasceu, empurrão forte, servidor recusou algo)
const COPIA = ['vida', 'vidaMax', 'mana', 'build', 'criando', 'missoes'];

export class Previsao {
  constructor(mapa, id) {
    this.id = id;
    this.sim = new Simulacao(mapa);
    // inimigos aqui são só cópias paradas das posições do servidor: servem para o golpe mirar e para colidir.
    // Quem mexe neles e quem decide dano é o servidor.
    this.sim.inimigos = [];
    this.sim.passoInimigo = () => {};
    this.sim.ferir = () => {};
    this.j = null;
    this.hist = []; // onde o herói estava em cada quadro (para comparar com a foto, que chega atrasada)
    this.ativo = false;
    this.ultSeqServ = -1;
  }

  // comandos: os mesmos que vão para o servidor
  cmd(tipo, msg) {
    if (!this.j || !this.ativo) return;
    const s = this.sim, id = this.id;
    if (tipo === 'entrada') s.entrada(id, msg);
    else if (tipo === 'habilidade') s.usarHabilidade(id, msg);
    else if (tipo === 'pular') s.pular(id);
    else if (tipo === 'dash') s.dash(id);
    else if (tipo === 'rolar') s.rolar(id);
    else if (tipo === 'montar') s.montar(id);
    else if (tipo === 'modo') s.trocarModo(id, String(msg));
    else if (tipo === 'build') s.definirBuild(id, msg);
  }

  passo(dt) {
    if (!this.j) return;
    this.sim.passo(dt); // eventos daqui são descartados: efeitos e números de dano vêm do servidor
    const j = this.j;
    this.hist.push({ t: this.sim.tempo, x: j.x, y: j.y, z: j.z });
    while (this.hist.length > 2 && this.hist[0].t < this.sim.tempo - 2) this.hist.shift();
  }

  // posição prevista há "atraso" segundos (o que o servidor está mostrando agora)
  passado(atraso) {
    const t = this.sim.tempo - atraso, h = this.hist;
    if (!h.length) return null;
    if (t <= h[0].t) return h[0];
    for (let i = h.length - 1; i > 0; i--) {
      if (h[i - 1].t <= t) {
        const a = h[i - 1], b = h[i], k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
      }
    }
    return h[h.length - 1];
  }

  encostar(s) {
    const j = this.j;
    Object.assign(j, { x: s.x, y: s.y || 0, z: s.z, ry: s.ry, vy: 0, chao: true, arrancada: null, dash: null, esc: null, trava: 0, acao: null, fila: null, pulos: 0, mortal: 0 });
    this.hist = [];
  }

  // chegou foto do servidor: s = meu estado lá, atraso = quanto tempo a foto está atrasada em relação ao meu quadro
  corrigir(s, inimigos, atraso) {
    if (!this.j) { this.j = this.sim.adicionarJogador(this.id, s.nome, s.visual); this.encostar(s); }
    const j = this.j;
    for (const k of COPIA) j[k] = s[k];
    // cópias dos inimigos (para a mira e a colisão)
    this.sim.inimigos = inimigos.map((e) => ({ id: e.id, tipo: e.tipo, x: e.x, y: e.y, z: e.z, ry: e.ry, morto: e.morto, vida: e.vida, vidaMax: e.vidaMax }));
    // morto ou no palco do criador: quem manda é o servidor, a previsão só espera
    const podePrever = !s.morto && !s.criando;
    if (!podePrever) { this.ativo = false; j.morto = !!s.morto; this.encostar(s); this.ultSeqServ = s.acaoSeq; return; }
    if (!this.ativo) { this.ativo = true; j.morto = false; j.modo = s.modo; j.montado = s.montado; this.encostar(s); this.ultSeqServ = s.acaoSeq; return; }
    // levou um golpe lá no servidor: a reação também trava o herói aqui
    if (s.acaoSeq !== this.ultSeqServ && s.acao?.nome === A.hit && (j.acao?.nome !== A.hit)) this.sim.tocar(j, A.hit, 1.4);
    this.ultSeqServ = s.acaoSeq;
    const p = this.passado(atraso);
    if (!p) return;
    const ex = s.x - p.x, ez = s.z - p.z, ey = (s.y || 0) - p.y;
    if (Math.hypot(ex, ez) > PULO_GRANDE || Math.abs(ey) > PULO_GRANDE) { this.encostar(s); return; }
    // corrige um pouco agora e desloca o histórico junto (para não corrigir o mesmo erro duas vezes)
    const dx = ex * CORRIGE, dz = ez * CORRIGE;
    j.x += dx; j.z += dz;
    for (const h of this.hist) { h.x += dx; h.z += dz; }
  }

  // o que vai para o corpo na tela
  estado() {
    const j = this.j;
    return { x: j.x, y: j.y, z: j.z, ry: j.ry, anim: j.anim, acao: j.acao, acaoSeq: j.acaoSeq, modo: j.modo, montado: j.montado || null };
  }
}
