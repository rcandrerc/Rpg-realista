// Criador de personagem: escolhe o corpo (base feminina, masculina ou um dos prontos) e pinta cabelo, olhos, pele e roupa.
// Muda na hora no próprio herói (a câmera vem para a frente dele); o resultado fica guardado no aparelho.
import { PERSONAGENS, CRIADOR, aparenciaValida } from '@rpg/shared';

const $ = (id) => document.getElementById(id);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const NOMES = { cabelo: 'cabelo', olhos: 'olhos', pele: 'pele', roupa: 'roupa', calca: 'calça e saia' };

export class Criador {
  // aoMudar(visual, aparencia) a cada toque
  constructor(visual, aparencia, aoMudar) {
    this.visual = visual; this.aparencia = aparenciaValida(aparencia) || aparenciaValida({}); this.aoMudar = aoMudar;
    this.aberto = false; this.foco = 'corpo'; // 'rosto': câmera perto do rosto
    const bases = $('cBases');
    for (const p of PERSONAGENS.filter((q) => q.tipo === 'vrm')) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.id = p.id;
      b.innerHTML = `<img alt="" src="assets/personagens/vrm/${p.id}.jpg"><span></span>`;
      b.lastChild.textContent = p.base ? p.nome.replace('Base ', '') : p.nome;
      b.addEventListener('click', () => { this.visual = p.id; this.mudou(); });
      bases.appendChild(b);
    }
    for (const lista of document.querySelectorAll('#criar .cores')) {
      const k = lista.dataset.k;
      for (const c of CRIADOR[k]) {
        const b = document.createElement('button'); b.type = 'button'; b.dataset.c = c ?? '';
        if (c == null) { b.className = 'orig'; b.textContent = 'orig.'; b.setAttribute('aria-label', `${NOMES[k]}: cor original`); }
        else { b.style.background = hex(c); b.setAttribute('aria-label', `${NOMES[k]}: ${hex(c)}`); }
        b.addEventListener('click', () => { this.aparencia[k] = c; this.mudou(); });
        lista.appendChild(b);
      }
    }
    $('cAltura').addEventListener('input', (e) => { this.aparencia.altura = +e.target.value; this.foco = 'corpo'; this.mudou(); });
    // formato do rosto: a câmera chega perto do rosto enquanto mexe nesses
    for (const f of document.querySelectorAll('#criar .cfaixa')) f.addEventListener('input', () => { this.aparencia[f.dataset.k] = +f.value; this.foco = 'rosto'; this.mudou(); });
    $('criar').addEventListener('click', (e) => { if (e.target.closest('button')) this.foco = 'corpo'; });
    $('cSorte').addEventListener('click', () => this.sortear());
    $('cPronto').addEventListener('click', () => this.fechar());
    $('pickBtn').addEventListener('click', () => this.abrir());
    this.marcar();
  }
  abrir() { this.aberto = true; this.foco = 'corpo'; $('criar').hidden = false; document.body.classList.add('criando'); } // some o resto da interface
  fechar() { this.aberto = false; $('criar').hidden = true; document.body.classList.remove('criando'); }
  // largura do painel (para a câmera pôr o herói no meio do que sobra da tela)
  largura() { return this.aberto ? $('criar').querySelector('.cp').offsetWidth : 0; }
  sortear() {
    const um = (l) => l[1 + Math.floor(Math.random() * (l.length - 1))]; // nunca a "original"
    const bases = PERSONAGENS.filter((p) => p.base);
    this.visual = bases[Math.floor(Math.random() * bases.length)].id;
    for (const k of ['cabelo', 'olhos', 'pele', 'roupa', 'calca']) this.aparencia[k] = um(CRIADOR[k]);
    const [min, max] = CRIADOR.altura; this.aparencia.altura = Math.round((min + Math.random() * (max - min)) * 100) / 100;
    for (const [k, [lo, hi]] of Object.entries(CRIADOR.rosto)) this.aparencia[k] = Math.round((1 + (Math.random() - 0.5) * 0.6 * (hi - lo)) * 100) / 100; // sem os extremos
    this.mudou();
  }
  mudou() { this.aparencia = aparenciaValida(this.aparencia); this.marcar(); this.aoMudar(this.visual, { ...this.aparencia }); }
  marcar() {
    document.querySelectorAll('#cBases button').forEach((b) => b.classList.toggle('on', b.dataset.id === this.visual));
    for (const lista of document.querySelectorAll('#criar .cores')) {
      const atual = this.aparencia[lista.dataset.k];
      lista.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.c === String(atual ?? '')));
    }
    $('cAltura').value = this.aparencia.altura;
    for (const f of document.querySelectorAll('#criar .cfaixa')) f.value = this.aparencia[f.dataset.k];
  }
}
