// Ponto de entrada do cliente: monta a cena, conecta no servidor e desenha o que a simulação manda.
import * as THREE from 'three';
import { HEROI, MAPA_CLAREIRA, TIPOS_INIMIGO, PERSONAGENS, PERSONAGEM_PADRAO, BUILD_PADRAO, buildValida } from '@rpg/shared';
import { criarRenderizador, montarCena } from './cena.js';
import { carregarPersonagens, Corpo } from './personagens.js';
import { Efeitos } from './efeitos.js';
import { conectar } from './rede.js';
import { Hud } from './hud.js';
import { Controles } from './controles.js';

const mapa = MAPA_CLAREIRA;
const $ = (id) => document.getElementById(id);
const msg = (t) => { $('loadmsg').textContent = t; };

const canvas = $('c');
const renderer = criarRenderizador(canvas);
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
const controles = new Controles(canvas);
const hud = new Hud(camera);

let mundo, efeitos, rede;
const corpos = new Map(); // id -> { corpo, info }
window.jogo = { controles, corpos }; // para testes no console do navegador
let eu = null; // meu estado mais recente

function corpoDe(e, tipo) {
  let c = corpos.get(e.id);
  // jogador trocou de personagem: refaz o corpo
  if (c && tipo === 'jogador' && c.visual !== e.visual) { c.corpo.remover(); c.corpo = new Corpo(mundo.scene, { armas: 'heroi', visual: e.visual }); c.visual = e.visual; }
  if (c) return c;
  if (tipo === 'jogador') {
    const meu = e.id === rede.meuId;
    c = { corpo: new Corpo(mundo.scene, { armas: 'heroi', visual: e.visual }), tipo, visual: e.visual };
    if (!meu) c.tag = hud.etiqueta(e.nome, 'ally');
  } else {
    const t = TIPOS_INIMIGO[e.tipo];
    c = { corpo: new Corpo(mundo.scene, { escala: t.escala, armas: 'inimigo', visual: t.visual, brilho: t.brilho, bravo: true }), tipo };
    c.tag = hud.etiqueta(e.nome, 'inimigo');
  }
  corpos.set(e.id, c);
  return c;
}

// Chamado a cada foto do mundo (20 por segundo no online, todo quadro no solo)
function receber(foto, eventos) {
  const vivos = new Set();
  for (const j of foto.jogadores) {
    vivos.add(j.id);
    const c = corpoDe(j, 'jogador');
    c.info = j; c.corpo.aplicar(j);
    if (j.id === rede.meuId) eu = j;
  }
  for (const e of foto.inimigos) { vivos.add(e.id); const c = corpoDe(e, 'inimigo'); c.info = e; c.corpo.aplicar(e); }
  for (const [id, c] of corpos) if (c.tipo !== 'npc' && !vivos.has(id)) { c.corpo.remover(); c.tag?.remove(); efeitos.esquecer(id); corpos.delete(id); }

  for (const ev of eventos) {
    if (ev.t === 'dano' || ev.t === 'cura') { const c = corpos.get(ev.alvo); if (c) hud.numero(c.corpo.root, (ev.t === 'cura' ? '+' : '-') + ev.n, ev.t === 'cura'); }
    else if (ev.t === 'aviso') hud.aviso(ev.texto);
    else efeitos.evento(ev, corpos);
  }
  if (eu) {
    hud.barras(eu.vida / eu.vidaMax, eu.mana / HEROI.mana);
    hud.recargas(eu);
  }
}

// ---------- comandos do jogador ----------
let ultimoBase = 0;
const usar = (i) => { if (i === 0 || i === 10) ultimoBase = t; rede?.enviar('habilidade', i); }; // 0 golpe, 10 disparo
const pular = () => rede?.enviar('pular');
const dash = () => rede?.enviar('dash');
const rolar = () => rede?.enviar('rolar');
controles.aoTeclar = (code) => {
  const tecla = { KeyJ: 0, KeyK: 1, KeyL: 2, KeyI: 3, KeyU: 4 };
  if (code in tecla) usar(hud.indice(tecla[code]));
  if (code === 'KeyH') usar(9);
  if (code === 'KeyR' || code === 'Tab') hud.trocar();
  if (code === 'Space') pular();
  if (code === 'KeyE' || code === 'ShiftRight') dash();
  if (code === 'KeyQ') rolar();
};
hud.montarBotoes({ usar, pular, dash, rolar });

// build (habilidades nos botões) também fica guardada no aparelho
let build = (() => { try { return JSON.parse(localStorage.getItem('build')); } catch { return null; } })();
if (!buildValida(build)) build = [...BUILD_PADRAO];
hud.mostrarBuild(build);
hud.montarEscolhaHabilidades(build, (b) => {
  build = b;
  try { localStorage.setItem('build', JSON.stringify(b)); } catch { /* sem armazenamento: vale só nesta visita */ }
  rede?.enviar('build', b);
});

// personagem escolhido fica guardado neste aparelho
const lerEscolha = () => { try { return localStorage.getItem('personagem'); } catch { return null; } };
let escolhido = lerEscolha();
if (!PERSONAGENS.some((p) => p.id === escolhido)) escolhido = PERSONAGEM_PADRAO;
hud.montarEscolhaPersonagem(PERSONAGENS, escolhido, (id) => {
  try { localStorage.setItem('personagem', id); } catch { /* sem armazenamento: vale só nesta visita */ }
  rede?.enviar('visual', id);
});

let ultimaEntrada = '', tempoEntrada = 0;
function enviarEntrada(dt) {
  const m = controles.direcao();
  const e = { mx: Math.round(m.x * 100) / 100, mz: Math.round(m.z * 100) / 100, correr: controles.correndo() };
  const s = JSON.stringify(e);
  tempoEntrada -= dt;
  if (s !== ultimaEntrada || tempoEntrada <= 0) { rede.enviar('entrada', e); ultimaEntrada = s; tempoEntrada = 0.25; }
}

function redimensionar() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionar); redimensionar();

// ---------- laço principal ----------
const relogio = new THREE.Clock(), alvoCam = new THREE.Vector3(), tmp = new THREE.Vector3();
let t = 0;
function quadro() {
  const dt = Math.min(relogio.getDelta(), 0.05); t += dt;
  if (rede) {
    enviarEntrada(dt);
    // golpe base segurado (botão ou tecla J): repete; o servidor guarda o próximo golpe enquanto o atual termina
    if ((hud.segurando !== false || controles.teclas.KeyJ) && t - ultimoBase > 0.2) { ultimoBase = t; usar(hud.indice(0)); }
    rede.passo(dt);
    mundo.atualizar(t);
    for (const c of corpos.values()) c.corpo.atualizar(dt);
    for (const [id, c] of corpos) if (c.tipo === 'jogador') efeitos.corpo(id, c.corpo, c.info, dt);
    efeitos.atualizar(dt, t, camera, renderer);
    const meu = corpos.get(rede.meuId);
    if (meu) {
      const p = meu.corpo.root.position;
      { const yAntes = alvoCam.y; alvoCam.lerp(tmp.set(p.x, p.y + 1.35, p.z), Math.min(1, dt * 7)); alvoCam.y = yAntes + (p.y + 1.35 - yAntes) * Math.min(1, dt * 3.5); } // na altura sobe devagar: pulo balança pouco, rocha a câmera acompanha
      controles.posicionarCamera(camera, alvoCam);
      mundo.sol.position.set(p.x + 14, 22, p.z + 8); mundo.sol.target.position.copy(p);
      for (const c of corpos.values()) if (c.tag) hud.posicionarEtiqueta(c.tag, c.corpo.root, c.info, p);
      hud.npcs(p);
    }
    hud.atualizar(dt);
    renderer.render(mundo.scene, camera);
  }
  requestAnimationFrame(quadro);
}

(async () => {
  try {
    msg('Carregando o mundo…');
    mundo = await montarCena(renderer, mapa);
    msg('Carregando os personagens…');
    await carregarPersonagens();
    efeitos = new Efeitos(mundo.scene);
    // NPCs são só visuais por enquanto (falam quando o jogador chega perto)
    for (const n of mapa.npcs) {
      const c = new Corpo(mundo.scene, { cor: n.cor, armas: 'nenhuma' });
      c.aplicar({ x: n.x, z: n.z, ry: n.ry, anim: 'Idle', acao: null, acaoSeq: 0 });
      hud.adicionarNpc(n, c.root);
      corpos.set('npc:' + n.nome, { corpo: c, tipo: 'npc' });
    }
    msg('Conectando ao servidor…');
    const nome = new URLSearchParams(location.search).get('nome') || 'Andarilho';
    rede = await conectar(mapa, nome, escolhido, receber, (t) => hud.rede(t));
    hud.rede(rede.modo === 'online' ? 'Online' : 'Modo solo (sem servidor)');
    rede.enviar('build', build);
    $('nome').textContent = nome;
    msg('Carregando o seu personagem…');
    // espera o próprio corpo ficar pronto (o personagem anime baixa uns 15 a 20 MB na primeira vez)
    for (let i = 0; i < 600 && !corpos.get(rede.meuId)?.corpo.mixer; i++) await new Promise((r) => setTimeout(r, 100));
    hud.montarEsboco();
    $('load').hidden = true;
    setTimeout(() => hud.aviso('Monte a sua build em Habilidades'), 600);
  } catch (e) {
    msg('Não foi possível carregar: ' + e.message); console.error(e);
  }
})();
quadro();
