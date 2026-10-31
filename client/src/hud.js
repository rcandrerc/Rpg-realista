// Interface na tela: barras, botões de habilidade, escolha da build, nomes sobre as cabeças, números de dano
import * as THREE from 'three';
import { icone } from './icones.js';
import { ARMA, BASICO, BASICO_MAGIA, CURA, HABILIDADES, BUILD_PADRAO, ESPACOS_BUILD, ESPACOS_ESPADA, ESPACOS_MAGIA, HEROI, MOVIMENTO, MISSOES } from '@rpg/shared';

const $ = (id) => document.getElementById(id);
const v = new THREE.Vector3();

export class Hud {
  constructor(camera) { this.camera = camera; this.pops = []; this.npcLista = []; this.avisoT = 0; this.netT = 0; this.build = [...BUILD_PADRAO]; this.modo = 'Espada'; }

  montarBotoes({ usar, pular, dash, rolar, montar }) {
    [0, 1, 2, 3, 4].forEach((i) => $('b' + i).addEventListener('pointerdown', (e) => { e.preventDefault(); usar(this.indice(i)); }));
    // golpe base: segurando o botão ele continua golpeando (as outras habilidades não)
    this.segurando = false; // id do dedo que segura
    $('b0').addEventListener('pointerdown', (e) => { this.segurando = e.pointerId; });
    for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, (e) => { if (e.pointerId === this.segurando) this.segurando = false; });
    $('b9').addEventListener('pointerdown', (e) => { e.preventDefault(); usar(9); });
    $('bt').addEventListener('pointerdown', (e) => { e.preventDefault(); this.trocar(); });
    $('bd').addEventListener('pointerdown', (e) => { e.preventDefault(); dash(); });
    $('bp').addEventListener('pointerdown', (e) => { e.preventDefault(); pular(); });
    $('br').addEventListener('pointerdown', (e) => { e.preventDefault(); rolar(); });
    $('bm').addEventListener('pointerdown', (e) => { e.preventDefault(); montar(); });
    $('infoBtn').addEventListener('click', () => { $('sheet').hidden = false; });
    $('closeSheet').addEventListener('click', () => { $('sheet').hidden = true; });
    $('style').textContent = ARMA.nome;
    this.simbolo('b9', 'cura', CURA.nome);
    this.simbolo('bp', 'pular', 'Pular'); this.simbolo('bd', 'dash', 'Dash'); this.simbolo('br', 'rolar', 'Rolar'); this.simbolo('bm', 'lobo', 'Montar ou descer do lobo');
    this.mostrarBuild(this.build);
  }
  // Botão na tela -> comando da simulação: 0 = golpe (ou 10 = disparo), 1 a 4 = espada (ou 5 a 8 = magia)
  indice(i) { const m = this.modo === 'Magia'; return i === 0 ? (m ? 10 : 0) : m ? i + ESPACOS_ESPADA : i; }
  // Troca espada <-> magia na hora, sem recarga
  trocar() { this.modo = this.modo === 'Espada' ? 'Magia' : 'Espada'; this.mostrarBuild(this.build); this.aoTrocar?.(this.modo); }
  mostrarBuild(build) {
    this.build = build; const m = this.modo === 'Magia';
    document.querySelector('.acts').classList.toggle('magia', m);
    this.simbolo('b0', m ? 'magia' : 'basico', m ? BASICO_MAGIA.nome : BASICO.nome);
    this.simbolo('bt', 'troca', m ? 'Trocar para espada' : 'Trocar para magia');
    for (let i = 1; i <= 4; i++) { const k = build[this.indice(i) - 1]; this.simbolo('b' + i, k, HABILIDADES[k].nome); $('b' + i).dataset.tipo = HABILIDADES[k].tipo; }
  }
  // Nos botões só o símbolo; o nome fica para leitor de tela e para o dedo parado em cima (title)
  simbolo(id, k, nome) { const b = $(id); b.querySelector('.lbl').innerHTML = icone(k); b.setAttribute('aria-label', nome); b.title = nome; }
  // Painel da build: toque para pôr ou tirar. 4 de espada (modo espada) e 4 de magia (modo magia), na ordem da escolha
  montarEscolhaHabilidades(atual, aoSalvar) {
    const grade = $('hgrid'); let escolha = [...atual];
    const ordem = () => [...escolha.filter((k) => HABILIDADES[k].tipo === 'Espada'), ...escolha.filter((k) => HABILIDADES[k].tipo === 'Magia')];
    const desenhar = () => {
      const o = ordem();
      grade.querySelectorAll('button').forEach((b) => {
        const n = o.indexOf(b.dataset.k); b.classList.toggle('on', n >= 0); b.querySelector('.n').textContent = n >= 0 ? (n % ESPACOS_ESPADA) + 1 : '';
      });
      const ne = escolha.filter((k) => HABILIDADES[k].tipo === 'Espada').length, nm = escolha.length - ne;
      $('salvarHab').disabled = ne !== ESPACOS_ESPADA || nm !== ESPACOS_MAGIA;
      $('habConta').textContent = `Espada ${ne} de ${ESPACOS_ESPADA} · Magia ${nm} de ${ESPACOS_MAGIA}`;
    };
    // duas listas separadas: golpes de espada e magias
    grade.className = '';
    for (const tipo of ['Espada', 'Magia']) {
      const tit = document.createElement('h3'); tit.className = 'htit ' + tipo.toLowerCase();
      tit.textContent = tipo === 'Espada' ? `Golpes de espada (escolha ${ESPACOS_ESPADA})` : `Magias (escolha ${ESPACOS_MAGIA})`;
      const lista = document.createElement('div'); lista.className = 'hgrid';
      grade.append(tit, lista);
      for (const [k, h] of Object.entries(HABILIDADES)) {
        if (h.tipo !== tipo) continue;
        const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k; b.dataset.tipo = tipo;
        b.innerHTML = `<span class="n"></span><span class="ic">${icone(k)}</span><b></b><small></small><span class="d"></span>`;
        b.querySelector('small').textContent = (h.mana ? `${h.mana} de mana · ` : 'sem mana · ') + `recarga ${h.cd} s`;
        b.querySelector('b').textContent = h.nome; b.querySelector('.d').textContent = h.desc;
        b.addEventListener('click', () => {
          const n = escolha.indexOf(k), mesmos = escolha.filter((x) => HABILIDADES[x].tipo === h.tipo);
          const max = h.tipo === 'Espada' ? ESPACOS_ESPADA : ESPACOS_MAGIA;
          if (n >= 0) escolha.splice(n, 1); else if (mesmos.length < max) escolha.push(k); else escolha[escolha.indexOf(mesmos[max - 1])] = k; // cheio: troca a última do mesmo tipo
          desenhar();
        });
        lista.appendChild(b);
      }
    }
    $('habBtn').addEventListener('click', () => { escolha = [...this.build]; desenhar(); $('hab').hidden = false; });
    $('fecharHab').addEventListener('click', () => { $('hab').hidden = true; });
    $('salvarHab').addEventListener('click', () => { $('hab').hidden = true; escolha = ordem(); aoSalvar([...escolha]); this.mostrarBuild([...escolha]); this.aviso('Build salva'); });
    desenhar();
  }
  montarTelaCheia() {
    // Sempre em tela cheia e deitado: o navegador só deixa entrar depois de um toque, então qualquer toque
    // na tela liga a tela cheia (e de novo se a pessoa sair dela). Travar deitado gira o jogo mesmo com a
    // rotação automática do celular desligada. No iPhone o navegador não deixa: usa o atalho da tela inicial.
    const el = document.documentElement, pedir = el.requestFullscreen || el.webkitRequestFullscreen;
    const cheia = () => document.fullscreenElement || document.webkitFullscreenElement;
    if (!pedir || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) return;
    const ligar = async () => {
      if (cheia()) return;
      try {
        await pedir.call(el, { navigationUI: 'hide' });
        await screen.orientation?.lock?.('landscape').catch(() => {});
      } catch {}
    };
    addEventListener('pointerup', ligar, true);
  }
  montarEsboco() {
    const cards = $('skillCards');
    for (const tipo of ['Espada', 'Magia']) {
      const c = document.createElement('div'); c.className = 'card';
      const lista = Object.values(HABILIDADES).filter((h) => h.tipo === tipo);
      c.innerHTML = `<small>${tipo}</small><h3>${tipo === 'Espada' ? 'Golpes da lâmina' : 'Magias da espada'}</h3><ul>${
        (tipo === 'Espada' ? [BASICO, ...lista] : [BASICO_MAGIA, ...lista, CURA]).map((h) => `<li><b>${h.nome}</b>: ${h.desc}${h.cd >= 1 ? ` Recarga ${h.cd} s${h.mana ? `, ${h.mana} de mana` : ''}.` : ''}</li>`).join('')}</ul>`;
      cards.appendChild(c);
    }
  }
  barras(vida, vidaMax, mana, manaMax) {
    $('hpb').style.width = vida / vidaMax * 100 + '%'; $('mpb').style.width = mana / manaMax * 100 + '%';
    $('hpt').textContent = `${Math.ceil(vida)} / ${vidaMax}`; $('mpt').textContent = `${Math.floor(mana)} / ${manaMax}`;
  }
  recargas(eu) {
    [0, 1, 2, 3, 4, 9].forEach((i) => {
      const n = i === 9 ? 9 : this.indice(i), k = n === 0 ? 'basico' : n === 9 ? 'cura' : n === 10 ? 'magia' : this.build[n - 1];
      const h = k === 'basico' ? BASICO : k === 'cura' ? CURA : k === 'magia' ? BASICO_MAGIA : HABILIDADES[k], resta = eu.cds[k] || 0;
      document.querySelector(`#b${i} .cdv`).style.transform = `scaleY(${h.cd ? Math.min(1, resta / h.cd) : 0})`;
    });
    document.querySelector('#br .cdv').style.transform = `scaleY(${Math.min(1, (eu.cds.rolar || 0) / HEROI.rolarCd)})`;
    document.querySelector('#bd .cdv').style.transform = `scaleY(${Math.min(1, (eu.cds.dash || 0) / MOVIMENTO.dashCd)})`;
  }
  // Situação da conexão (mensagens como "Reconectando…"); 'Online' deixa o ping aparecer
  rede(texto) { this.netTexto = texto; this.netT = 0; }
  // Ping e conexão no canto: bolinha verde (até 100 ms), amarela (até 200 ms) ou vermelha. Atualiza 4 vezes por segundo.
  // Junto vai o FPS do aparelho: se o FPS cair, o atraso é do celular e não da internet.
  conexao(rede, dt) {
    const agora = performance.now(); // relógio de verdade (o dt do jogo é limitado e esconderia quadros lentos)
    this.qN = (this.qN || 0) + 1; this.q0 ??= agora;
    // a primeira leitura sai rápido para o FPS aparecer junto desde o começo
    if (agora - this.q0 >= (this.fps ? 1000 : 400)) { this.fps = Math.round(this.qN * 1000 / (agora - this.q0)); this.qN = 0; this.q0 = agora; }
    if ((this.netT -= dt) > 0) return;
    this.netT = 0.25;
    const t = this.netTexto || 'Conectando…';
    let nivel, txt;
    if (!rede) { nivel = 'espera'; txt = t; }
    else if (rede.modo !== 'online') { nivel = 'solo'; txt = 'Solo (sem servidor)'; }
    else if (!rede.conectado || t !== 'Online') { nivel = /Sem|apagada|outro/.test(t) ? 'ruim' : 'aviso'; txt = t; }
    else if (performance.now() - rede.ultimaFoto > 1500) { nivel = 'ruim'; txt = 'Servidor sem resposta'; }
    else if (rede.ping == null) { nivel = 'espera'; txt = 'Online'; }
    else { const ms = Math.round(rede.ping); nivel = ms <= 100 ? 'bom' : ms <= 200 ? 'medio' : 'ruim'; txt = `${ms} ms`; }
    if (this.fps != null && rede) txt += ` · ${this.fps} FPS`;
    const el = $('net');
    if (el.dataset.nivel !== nivel) el.dataset.nivel = nivel;
    const s = $('netTxt'); if (s.textContent !== txt) s.textContent = txt;
  }
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
    el.hidden = !s.vis || !obj.visible || obj.position.distanceTo(perto) > 18; // invisível: jogador criando o personagem
    el.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-100%)`;
    const hb = el.querySelector('.hb i'); if (hb && info) hb.style.width = (info.vida / info.vidaMax * 100) + '%';
  }
  // NPC: perto dele aparece o botão Falar em cima da cabeça; a resposta vem da simulação (evento 'fala')
  adicionarNpc(n, obj, aoFalar) {
    const el = this.etiqueta(n.nome, 'npc'), b = document.createElement('button');
    b.type = 'button'; b.className = 'falar'; b.textContent = 'Falar'; b.hidden = true;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); aoFalar(); });
    el.appendChild(b);
    this.npcLista.push({ n, obj, el, b, falaT: 0 });
  }
  npcPerto(perto) { return this.npcLista.find((p) => p.obj.position.distanceTo(perto) < 3); }
  npcs(perto, dt) {
    const junto = this.npcPerto(perto);
    for (const p of this.npcLista) {
      this.posicionarEtiqueta(p.el, p.obj, null, perto);
      p.b.hidden = p !== junto;
      p.falaT -= dt; p.el.querySelector('.say').hidden = p.falaT <= 0;
      if (p.obj.position.distanceTo(perto) > 6) p.falaT = 0; // foi embora: a conversa acaba
    }
  }
  fala(ev) {
    const p = this.npcLista.find((q) => q.n.id === ev.npc); if (!p) return;
    p.el.querySelector('.say').textContent = ev.texto; p.falaT = 3 + ev.texto.length * 0.05;
  }
  missoes(eu) {
    let t = '';
    for (const [k, m] of Object.entries(eu.missoes || {})) {
      const M = MISSOES[k]; if (!M || m.entregue) continue;
      t = m.n >= M.total ? `${M.nome}: volte ao líder da vila` : `${M.nome}: ${m.n} de ${M.total}`;
    }
    const el = $('missao'); if (el.textContent !== t) el.textContent = t; el.hidden = !t;
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
