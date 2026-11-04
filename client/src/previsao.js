// O próprio herói no modo online é decidido no celular.
// O celular roda as mesmas regras (shared/simulacao.js) só para o seu herói: anda, pula, dá dash e ataca na hora,
// com efeitos e números de dano na hora. A posição vai para o servidor 20 vezes por segundo e ele só confere
// (Simulacao.posicaoCliente: velocidade, altura, limite do mapa). Se não bater, chega um "corrigir" e o herói volta.
// Dano de verdade, vida, morte, mana e recompensas continuam sendo do servidor.
import { Simulacao, A } from '@rpg/shared';

const COPIA = ['vida', 'vidaMax', 'mana', 'build', 'criando', 'missoes'];
// efeitos das próprias ações que o celular mostra sozinho (o servidor manda os mesmos com "de" = eu, e esses são ignorados)
export const EFEITOS_LOCAIS = new Set(['proj', 'projFim', 'fenda', 'raio', 'anel', 'campo', 'chuva', 'conjura', 'cura', 'dano', 'dash', 'explosao', 'impacto', 'vortice']);

export class Previsao {
  constructor(mapa, id) {
    this.id = id;
    this.sim = new Simulacao(mapa);
    this.sim.proxId = 1e6; // tiros daqui com números que não se misturam com os do servidor
    // inimigos aqui são só cópias das posições do servidor: servem para mirar, colidir e mostrar o número do dano.
    // Quem mexe neles e quem tira vida de verdade é o servidor.
    this.sim.inimigos = [];
    this.sim.passoInimigo = () => {};
    this.sim.ferir = (alvo, n) => {
      if (alvo.tipo === 'jogador' || alvo.morto) return;
      alvo.vida = Math.max(0, alvo.vida - n); if (alvo.vida <= 0) alvo.morto = true;
      this.sim.evento({ t: 'dano', alvo: alvo.id, n });
    };
    this.j = null;
    this.ativo = false;
    this.ultSeqServ = -1;
    this.envio = 0;
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

  // anda um quadro; devolve os efeitos das minhas ações para mostrar já. enviar(pos) a cada 50 ms.
  passo(dt, enviar) {
    if (!this.j) return [];
    const ev = this.sim.passo(dt).filter((e) => EFEITOS_LOCAIS.has(e.t));
    if (this.ativo && (this.envio -= dt) <= 0) {
      this.envio = 0.05;
      const j = this.j, r2 = (n) => Math.round(n * 100) / 100;
      enviar({ x: r2(j.x), y: r2(j.y), z: r2(j.z), ry: r2(j.ry), anim: j.anim });
    }
    return ev;
  }

  encostar(s) {
    const j = this.j; if (!j) return;
    // no ar (voltou para o meio de uma parede, por exemplo): cai em vez de ficar em pé no vazio
    const chao = (s.y || 0) - this.sim.terreno.altura(s.x, s.z, s.y || 0) < 0.15;
    Object.assign(j, { x: s.x, y: s.y || 0, z: s.z, ry: s.ry ?? j.ry, vy: 0, chao, arrancada: null, dash: null, esc: null, trava: 0, acao: null, fila: null, pulos: 0, mortal: 0 });
  }

  // chegou foto do servidor: s = meu estado lá
  corrigir(s, inimigos) {
    if (!this.j) { this.j = this.sim.adicionarJogador(this.id, s.nome, s.visual); this.encostar(s); }
    const j = this.j;
    for (const k of COPIA) j[k] = s[k];
    this.sim.inimigos = inimigos.map((e) => ({ id: e.id, tipo: e.tipo, x: e.x, y: e.y, z: e.z, ry: e.ry, morto: e.morto, vida: e.vida, vidaMax: e.vidaMax }));
    // morto ou no palco do criador: quem manda é o servidor, o celular só espera
    const podePrever = !s.morto && !s.criando;
    if (!podePrever) { this.ativo = false; j.morto = !!s.morto; this.encostar(s); this.ultSeqServ = s.acaoSeq; return; }
    if (!this.ativo) { this.ativo = true; j.morto = false; j.modo = s.modo; j.montado = s.montado; this.encostar(s); this.ultSeqServ = s.acaoSeq; return; }
    // levou um golpe lá no servidor: a reação também trava o herói aqui
    if (s.acaoSeq !== this.ultSeqServ && s.acao?.nome === A.hit && j.acao?.nome !== A.hit) this.sim.tocar(j, A.hit, 1.4);
    this.ultSeqServ = s.acaoSeq;
  }

  // o que vai para o corpo na tela
  estado() {
    const j = this.j;
    return { x: j.x, y: j.y, z: j.z, ry: j.ry, anim: j.anim, acao: j.acao, acaoSeq: j.acaoSeq, modo: j.modo, montado: j.montado || null };
  }
}
