// Interface na tela: barras, botões de arma e habilidade, nomes sobre as cabeças, números de dano
import * as THREE from 'three';
import { ARMAS, ORDEM_ARMAS, HEROI } from '@rpg/shared';

const $ = (id) => document.getElementById(id);
const v = new THREE.Vector3();

export class Hud {
  constructor(camera) { this.camera = camera; this.pops = []; this.npcLista = []; this.avisoT = 0; this.arma = 'espada'; }

  montarBotoes({ usar, rolar, trocar }) {
    const wb = $('weapons');
    ORDEM_ARMAS.forEach((k) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k;
      b.innerHTML = `${ARMAS[k].nome}<small>${ARMAS[k].estilo}</small>`;
      b.addEventListener('click', () => trocar(k)); wb.appendChild(b);
    });
    [0, 1, 2, 3].forEach((i) => $('b' + i).addEventListener('pointerdown', (e) => { e.preventDefault(); usar(i); }));
    $('bd').addEventListener('pointerdown', (e) => { e.preventDefault(); rolar(); });
    $('infoBtn').addEventListener('click', () => { $('sheet').hidden = false; });
    $('closeSheet').addEventListener('click', () => { $('sheet').hidden = true; });
    this.mostrarArma('espada');
  }
  montarEscolhaPersonagem(lista, atual, aoEscolher) {
    const grade = $('pgrid');
    const marcar = (id) => grade.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    for (const p of lista) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.id = p.id;
      b.innerHTML = (p.tipo === 'vrm' ? `<img alt="" src="assets/personagens/vrm/${p.id}.jpg">` : '<span class="sem">realista</span>') + '<span></span>';
      b.lastChild.textContent = p.nome;
      b.addEventListener('click', () => { marcar(p.id); aoEscolher(p.id); $('pick').hidden = true; this.aviso(p.nome); });
      grade.appendChild(b);
    }
    marcar(atual);
    $('pickBtn').addEventListener('click', () => { $('pick').hidden = false; });
    $('closePick').addEventListener('click', () => { $('pick').hidden = true; });
    // Tela cheia: no Android funciona direto; no iPhone o navegador não deixa, então ensina o atalho
    const tela = $('telaBtn');
    const pode = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
    tela.addEventListener('click', async () => {
      const el = document.documentElement;
      if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      if (!pode) { this.aviso('No iPhone: Compartilhar → Adicionar à Tela de Início'); this.avisoT = 5; return; }
      try {
        await (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
        await screen.orientation?.lock?.('landscape').catch(() => {});
      } catch { this.aviso('O navegador não deixou abrir em tela cheia'); }
    });
    const rotulo = () => { tela.textContent = (document.fullscreenElement || document.webkitFullscreenElement) ? 'Sair da tela cheia' : 'Tela cheia'; };
    document.addEventListener('fullscreenchange', rotulo); document.addEventListener('webkitfullscreenchange', rotulo);
    // aberto pelo atalho da tela inicial já está sem a barra do navegador
    if (matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) tela.hidden = true;
  }
  montarEsboco() {
    const cards = $('skillCards');
    ORDEM_ARMAS.forEach((k) => {
      const w = ARMAS[k]; const c = document.createElement('div'); c.className = 'card';
      c.innerHTML = `<small>${w.nome} = ${w.estilo}</small><h3>${w.desc}</h3><ul><li><b>${w.basico.nome}</b>: golpe básico, ${w.basico.dmg} de dano.</li>${
        w.habilidades.map((s) => `<li><b>${s.nome}</b>: ${s.desc} Recarga ${s.cd} s${s.mana ? `, ${s.mana} de mana` : ''}.</li>`).join('')}</ul>`;
      cards.appendChild(c);
    });
  }
  mostrarArma(k) {
    this.arma = k; const w = ARMAS[k];
    $('style').textContent = w.estilo;
    document.querySelectorAll('#weapons button').forEach((b) => b.classList.toggle('on', b.dataset.k === k));
    [w.basico, ...w.habilidades].forEach((s, i) => { document.querySelector(`#b${i} .lbl`).textContent = s.nome; });
  }
  barras(vida, mana) { $('hpb').style.width = vida * 100 + '%'; $('mpb').style.width = mana * 100 + '%'; }
  recargas(eu) {
    const w = ARMAS[eu.arma];
    [w.basico, ...w.habilidades].forEach((s, i) => {
      const resta = eu.cds[eu.arma + i] || 0;
      document.querySelector(`#b${i} .cdv`).style.transform = `scaleY(${s.cd ? Math.min(1, resta / s.cd) : 0})`;
    });
    document.querySelector('#bd .cdv').style.transform = `scaleY(${Math.min(1, (eu.cds.rolar || 0) / HEROI.rolarCd)})`;
  }
  rede(texto) { $('net').textContent = texto; }
  aviso(t) { const el = $('toast'); el.textContent = t; el.style.opacity = 1; this.avisoT = 1.6; }

  tela(obj, altura) {
    v.set(obj.position.x, altura * obj.scale.x, obj.position.z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, vis: v.z < 1 };
  }
  etiqueta(nome, tipo) {
    const el = document.createElement('div'); el.className = 'tag3d ' + (tipo === 'ally' ? 'ally' : tipo === 'npc' ? 'npc' : '');
    el.innerHTML = (tipo === 'npc' ? '<div class="say" hidden></div>' : '') + '<b></b>' + (tipo === 'npc' ? '' : '<div class="hb"><i></i></div>');
    el.querySelector('b').textContent = nome; document.body.appendChild(el); return el;
  }
  posicionarEtiqueta(el, obj, info, perto) {
    const s = this.tela(obj, 2.05);
    el.hidden = !s.vis || obj.position.distanceTo(perto) > 18;
    el.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-100%)`;
    const hb = el.querySelector('.hb i'); if (hb && info) hb.style.width = (info.vida / info.vidaMax * 100) + '%';
  }
  adicionarNpc(n, obj) { this.npcLista.push({ n, obj, el: this.etiqueta(n.nome, 'npc'), fala: 0 }); }
  npcs(perto) {
    for (const p of this.npcLista) {
      this.posicionarEtiqueta(p.el, p.obj, null, perto);
      const say = p.el.querySelector('.say'), junto = p.obj.position.distanceTo(perto) < 4;
      if (junto && say.hidden) say.textContent = p.n.falas[p.fala++ % p.n.falas.length];
      say.hidden = !junto;
    }
  }
  numero(obj, texto, cura) {
    const el = document.createElement('div'); el.className = 'dmg' + (cura ? ' heal' : ''); el.textContent = texto;
    document.body.appendChild(el); this.pops.push({ el, obj, vida: 1, ox: Math.random() * 40 - 20 });
  }
  atualizar(dt) {
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i]; p.vida -= dt; const s = this.tela(p.obj, 2.2);
      p.el.style.transform = `translate(${s.x + p.ox}px,${s.y - (1 - p.vida) * 50}px) translate(-50%,-50%)`;
      p.el.style.opacity = Math.min(1, p.vida * 2);
      if (p.vida <= 0) { p.el.remove(); this.pops.splice(i, 1); }
    }
    if (this.avisoT > 0) { this.avisoT -= dt; if (this.avisoT <= 0) $('toast').style.opacity = 0; }
  }
}
