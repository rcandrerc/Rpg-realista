// Teste de desempenho no próprio celular (abre com ?diag=1 no endereço).
// Roda o jogo alguns segundos em cada configuração e mostra o FPS de cada uma. Assim dá para saber se o que trava
// é a placa de vídeo (desenhar pixels, sombra, passe de cor) ou o processador (JavaScript: animações, rede, lógica).
// Não muda nada para quem joga sem o ?diag.
const ETAPAS = [
  { nome: 'Normal', aplicar() {} },
  { nome: 'Resolução 1.0x', aplicar(j) { j.resolucao(1); } },
  { nome: 'Resolução 0.5x', aplicar(j) { j.resolucao(0.5); } },
  { nome: 'Sem sombra', aplicar(j) { j.renderer.shadowMap.autoUpdate = false; } },
  { nome: 'Sem passe de cor (nem antisserrilhado)', aplicar(j) { j.estado.semPasse = true; } },
  { nome: 'Sem grama', aplicar(j) { j.grama(false); } },
  { nome: 'Sem personagens', aplicar(j) { j.personagens(false); } },
  { nome: 'Quase nada (0.5x, sem sombra, passe, grama e personagens)', aplicar(j) {
    j.resolucao(0.5); j.renderer.shadowMap.autoUpdate = false; j.estado.semPasse = true; j.grama(false); j.personagens(false);
  } },
];
const ESPERA = 2.5, MEDE = 5; // segundos: deixa assentar e depois mede

export class Diagnostico {
  constructor(jogo) {
    this.j = jogo; this.estado = jogo.estado; this.i = -1; this.t = 0; this.res = []; this.ativo = false;
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;background:rgba(10,14,20,.88);color:#fff;font:12px/1.35 system-ui,sans-serif;padding:8px 10px;border-radius:8px;max-width:62vw;pointer-events:auto;white-space:pre-wrap';
    p.textContent = 'Teste de desempenho: toque aqui quando o jogo já estiver carregado e o herói parado.';
    p.onclick = () => { if (!this.ativo && this.i < 0) this.comecar(); };
    document.body.appendChild(p); this.p = p;
  }

  comecar() { this.ativo = true; this.proxima(); }

  proxima() {
    this.j.restaurar();
    this.i++;
    if (this.i >= ETAPAS.length) return this.terminar();
    ETAPAS[this.i].aplicar(this.j);
    this.t = 0; this.n = 0; this.js = 0; this.pior = 0;
  }

  // chamado no fim de cada quadro: dt do quadro e quanto tempo o JavaScript gastou nele (ms)
  quadro(dt, msJs) {
    if (!this.ativo) return;
    this.t += dt;
    if (this.t > ESPERA) { this.n++; this.js += msJs; this.pior = Math.max(this.pior, msJs); }
    const e = ETAPAS[this.i];
    this.p.textContent = `Testando ${this.i + 1}/${ETAPAS.length}: ${e.nome}…\n` + this.texto();
    if (this.t >= ESPERA + MEDE) {
      this.res.push({ nome: e.nome, fps: this.n / MEDE, js: this.js / Math.max(1, this.n) });
      this.proxima();
    }
  }

  texto() {
    return this.res.map((r) => `${r.nome}: ${r.fps.toFixed(1)} FPS · JS ${r.js.toFixed(1)} ms`).join('\n');
  }

  terminar() {
    this.ativo = false;
    const base = this.res[0], fim = this.res[this.res.length - 1];
    const quadro = 1000 / Math.max(1, base.fps);
    let leitura;
    if (fim.fps < base.fps * 1.25) leitura = 'Mesmo sem quase nada na tela o FPS quase não sobe: o limite é o processador (JavaScript) ou o Chrome travado em 30.';
    else if (base.js > quadro * 0.6) leitura = 'O JavaScript ocupa a maior parte do quadro: o peso está no processador.';
    else leitura = 'O JavaScript ocupa só uma parte do quadro: o peso está na placa de vídeo (pixels, sombra, passe).';
    this.p.textContent = 'Resultado (tire um print e mande):\n' + this.texto() + `\n\nNo normal: quadro ${quadro.toFixed(0)} ms, JS ${base.js.toFixed(1)} ms.\n${leitura}\nToque para fechar.`;
    this.p.onclick = () => this.p.remove();
  }
}
