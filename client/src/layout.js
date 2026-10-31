// Painel de vida e mana: foto do herói com o nível, toque abre Status e Equipamento,
// segurar 2 s entra no modo de editar a posição e o tamanho dos botões (guardado no aparelho).
import * as THREE from 'three';
import { HABILIDADES, HEROI } from '@rpg/shared';

const $ = (id) => document.getElementById(id);
const SEGURAR = 2000; // ms para entrar no modo de edição
const CHAVE = 'layoutBotoes2'; // 2: botões na distribuição do Quimera (a arrumação antiga não serve mais)
const BOTOES = ['b0', 'b1', 'b2', 'b3', 'b4', 'b9', 'bt', 'bd', 'bp', 'br'];
const NOMES = { b0: 'Golpe', b9: 'Cura', bt: 'Trocar', bd: 'Dash', bp: 'Pular', br: 'Rolar' };
const ESCALA = [0.6, 1.6];

const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { return {}; } };
const gravar = (v) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem armazenamento: vale só agora */ } };

// ---------- foto do herói ----------
// Uma câmera própria olha o rosto de frente e desenha um quadrinho; a imagem vira <img> (não custa nada depois).
const camFoto = new THREE.PerspectiveCamera(24, 1, 0.05, 30);
let alvoFoto;
function tirarFoto(renderer, scene, corpo) {
  let cabeca = null;
  corpo.root.traverse((o) => { if (!cabeca && /Head$/.test(o.name)) cabeca = o; });
  if (!cabeca) return null;
  corpo.root.updateMatrixWorld(true);
  const p = cabeca.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.05, 0));
  const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(corpo.root.getWorldQuaternion(new THREE.Quaternion()));
  camFoto.position.copy(p).addScaledVector(frente, 0.95).add(new THREE.Vector3(0, 0.04, 0));
  camFoto.lookAt(p);
  const T = 160;
  alvoFoto ||= new THREE.WebGLRenderTarget(T, T, { samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
  const antes = renderer.getRenderTarget(), sombra = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = false; // a sombra do quadro principal serve
  renderer.setRenderTarget(alvoFoto); renderer.render(scene, camFoto); renderer.setRenderTarget(antes);
  renderer.shadowMap.autoUpdate = sombra;
  const px = new Uint8Array(T * T * 4); renderer.readRenderTargetPixels(alvoFoto, 0, 0, T, T, px);
  const cv = document.createElement('canvas'); cv.width = cv.height = T;
  const g = cv.getContext('2d'), img = g.createImageData(T, T);
  // o alvo não passa pelo filtro de cor da tela: converte para sRGB e escurece um pouco (como o filtro de cinema faria)
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const de = ((T - 1 - y) * T + x) * 4, para = (y * T + x) * 4;
    for (let k = 0; k < 3; k++) { const l = px[de + k] / 255 * 0.85; img.data[para + k] = 255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055); }
    img.data[para + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv.toDataURL('image/jpeg', 0.85);
}

export class PainelHeroi {
  // dados(): { eu, nome, build, visual } do jogo agora
  constructor(renderer, dados) {
    this.renderer = renderer; this.dados = dados; this.chaveFoto = ''; this.foto = '';
    this.layout = ler(); this.editando = false; this.sel = null;
    this.montarPainel(); this.montarStatus(); this.montarEditor();
    this.aplicar();
  }

  // ---------- painel de vida: foto + nível ----------
  montarPainel() {
    const v = document.querySelector('.vitals');
    const f = document.createElement('div'); f.className = 'retrato';
    f.innerHTML = '<img id="fotoHeroi" alt=""><b id="nivelHeroi" aria-label="Nível">1</b>';
    v.prepend(f);
    // toque curto: Status; segurar 2 s: editar botões (o anel em volta da foto mostra o tempo)
    let t0 = 0, timer = 0, x0 = 0, y0 = 0;
    const cancelar = () => { clearTimeout(timer); timer = 0; v.classList.remove('segurando'); };
    v.addEventListener('pointerdown', (e) => {
      if (this.editando) return;
      e.preventDefault(); t0 = performance.now(); x0 = e.clientX; y0 = e.clientY;
      v.classList.add('segurando');
      timer = setTimeout(() => { cancelar(); t0 = 0; navigator.vibrate?.(30); this.editar(true); }, SEGURAR);
    });
    v.addEventListener('pointermove', (e) => { if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 14) { cancelar(); t0 = 0; } });
    v.addEventListener('pointerup', () => { const curto = timer && performance.now() - t0 < 450; cancelar(); if (curto) this.abrirStatus(); });
    v.addEventListener('pointercancel', cancelar);
    v.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // chamado todo quadro: refaz a foto quando o herói muda (personagem, cores, altura)
  atualizar(scene, corpo) {
    if (!corpo?.mixer) return;
    const chave = corpo.visual + JSON.stringify(corpo.tinta || {}) + corpo.root.scale.y.toFixed(2);
    if (chave === this.chaveFoto || this.esperaFoto) return;
    // espera a pose parada assentar antes de fotografar
    this.esperaFoto = setTimeout(() => {
      this.esperaFoto = 0;
      const url = tirarFoto(this.renderer, scene, corpo);
      if (url) { this.foto = url; $('fotoHeroi').src = url; $('statusFoto').src = url; this.chaveFoto = chave; }
    }, 900);
  }
  nivel(n) { $('nivelHeroi').textContent = n; }

  // ---------- Status e Equipamento ----------
  montarStatus() {
    const s = document.createElement('div'); s.id = 'status'; s.hidden = true;
    s.innerHTML = `<div class="in">
      <div class="cab"><img id="statusFoto" alt=""><div><h2 id="statusNome"></h2><p class="muted" id="statusNivel"></p>
        <div class="xp"><i style="width:0%"></i></div><p class="muted pequeno">Experiência: o nível ainda não sobe (vem com os inimigos e as missões).</p></div></div>
      <div class="cols">
        <section><h3>Status</h3><dl id="statusAtrib"></dl></section>
        <section><h3>Equipamento</h3><ul class="equip" id="statusEquip"></ul></section>
      </div>
      <section><h3>Build</h3><ul class="build" id="statusBuild"></ul></section>
      <div class="linha"><button class="close" type="button" id="fecharStatus">Fechar</button>
        <button class="close sec" type="button" id="editarBotoes">Editar botões</button></div>
    </div>`;
    document.body.appendChild(s);
    $('fecharStatus').addEventListener('click', () => { s.hidden = true; });
    $('editarBotoes').addEventListener('click', () => { s.hidden = true; this.editar(true); });
  }
  abrirStatus() {
    const { eu, nome, build } = this.dados();
    const nivel = eu?.nivel || 1;
    $('statusNome').textContent = nome; $('statusNivel').textContent = 'Nível ' + nivel;
    if (this.foto) $('statusFoto').src = this.foto;
    const linha = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    $('statusAtrib').innerHTML = [
      linha('Vida', `${Math.ceil(eu?.vida ?? HEROI.vida)} / ${eu?.vidaMax ?? HEROI.vida}`),
      linha('Mana', `${Math.floor(eu?.mana ?? HEROI.mana)} / ${HEROI.mana}`),
      linha('Mana por segundo', HEROI.manaPorSeg),
      linha('Velocidade', `${HEROI.correr} m/s correndo`),
    ].join('');
    const slot = (onde, o, vazio) => `<li class="${vazio ? 'vazio' : ''}"><small>${onde}</small><b>${o}</b></li>`;
    $('statusEquip').innerHTML = [
      slot('Arma', 'Espada mágica'), slot('Foco de magia', 'Cajado mágico'),
      slot('Cabeça', 'vazio', true), slot('Corpo', 'vazio', true), slot('Mãos', 'vazio', true), slot('Pés', 'vazio', true), slot('Acessório', 'vazio', true),
    ].join('');
    $('statusBuild').innerHTML = (build || []).map((k) => HABILIDADES[k]).filter(Boolean)
      .map((h) => `<li data-tipo="${h.tipo}"><small>${h.tipo}</small>${h.nome}</li>`).join('');
    $('status').hidden = false;
  }

  // ---------- editar botões ----------
  montarEditor() {
    const e = document.createElement('div'); e.id = 'editor'; e.hidden = true;
    e.innerHTML = `<div class="barra"><b>Editar botões</b><span id="edSel" class="muted">Arraste um botão. Toque nele para mudar o tamanho.</span>
      <span class="tam"><button type="button" id="edMenos" aria-label="Diminuir">−</button><button type="button" id="edMais" aria-label="Aumentar">+</button></span>
      <button type="button" class="sec" id="edPadrao">Padrão</button><button type="button" id="edPronto">Pronto</button></div>`;
    document.body.appendChild(e);
    const tam = (d) => { if (!this.sel) return; const c = this.cfg(this.sel); c.s = Math.min(ESCALA[1], Math.max(ESCALA[0], +(c.s + d).toFixed(2))); this.aplicar(); this.rotuloSel(); };
    $('edMenos').addEventListener('click', () => tam(-0.1));
    $('edMais').addEventListener('click', () => tam(0.1));
    $('edPadrao').addEventListener('click', () => { this.layout = {}; this.aplicar(); this.selecionar(null); });
    $('edPronto').addEventListener('click', () => this.editar(false));
    // no modo de edição os botões não disparam golpes: o toque é capturado antes e vira arrastar
    const acts = document.querySelector('.acts');
    let arr = null;
    acts.addEventListener('pointerdown', (ev) => {
      if (!this.editando) return;
      ev.stopPropagation(); ev.preventDefault();
      const b = ev.target.closest('button'); if (!b || !BOTOES.includes(b.id)) return;
      this.selecionar(b.id);
      const st = getComputedStyle(b), c = this.cfg(b.id);
      arr = { id: b.id, x: ev.clientX, y: ev.clientY, r: c.r ?? parseFloat(st.right), b: c.b ?? parseFloat(st.bottom), p: ev.pointerId };
      b.setPointerCapture?.(ev.pointerId);
    }, true);
    acts.addEventListener('pointermove', (ev) => {
      if (!arr || ev.pointerId !== arr.p) return;
      ev.stopPropagation();
      const c = this.cfg(arr.id), esc = acts.getBoundingClientRect().width / acts.offsetWidth || 1;
      const el = $(arr.id), w = el.offsetWidth, h = el.offsetHeight, caixa = acts.getBoundingClientRect();
      // não deixa sair da tela
      c.r = Math.round(Math.min(caixa.right / esc - w, Math.max(0, arr.r - (ev.clientX - arr.x) / esc)));
      c.b = Math.round(Math.min(caixa.bottom / esc - h, Math.max(0, arr.b - (ev.clientY - arr.y) / esc)));
      this.aplicar();
    }, true);
    for (const t of ['pointerup', 'pointercancel']) acts.addEventListener(t, (ev) => { if (arr && ev.pointerId === arr.p) { arr = null; ev.stopPropagation(); } }, true);
  }
  cfg(id) { return (this.layout[id] ||= { s: 1 }); }
  selecionar(id) {
    this.sel = id;
    for (const b of BOTOES) $(b).classList.toggle('sel', b === id);
    this.rotuloSel();
  }
  rotuloSel() {
    $('edSel').textContent = this.sel ? `${NOMES[this.sel] || 'Habilidade'}: ${Math.round(this.cfg(this.sel).s * 100)}%` : 'Arraste um botão. Toque nele para mudar o tamanho.';
  }
  editar(sim) {
    this.editando = sim; $('editor').hidden = !sim; document.body.classList.toggle('editando', sim);
    if (!sim) { this.selecionar(null); gravar(this.layout); }
  }
  aplicar() {
    for (const id of BOTOES) {
      const el = $(id), c = this.layout[id];
      el.style.right = c?.r != null ? c.r + 'px' : ''; el.style.bottom = c?.b != null ? c.b + 'px' : '';
      el.style.transform = c && c.s !== 1 ? `scale(${c.s})` : '';
    }
  }
}
