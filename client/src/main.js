// Ponto de entrada do cliente: monta a cena, conecta no servidor e desenha o que a simulação manda.
import * as THREE from 'three';
import { HEROI, MAPA_CLAREIRA, TIPOS_INIMIGO, PERSONAGENS, PERSONAGEM_PADRAO, BUILD_PADRAO, buildValida } from '@rpg/shared';
import { criarRenderizador, montarCena } from './cena.js';
import { carregarPersonagens, Corpo, aquecerVRM } from './personagens.js';
import { Efeitos } from './efeitos.js';
import { conectar, enderecoServidor } from './rede.js';
import { entrarNaConta, sairDaConta } from './conta.js';
import { Hud } from './hud.js';
import { Criador } from './criador.js';
import { Controles } from './controles.js';
import { cameraForaDasCasas } from './vila.js';

const mapa = MAPA_CLAREIRA;
const $ = (id) => document.getElementById(id);
const msg = (t) => { $('loadmsg').textContent = t; };

const canvas = $('c');
const renderer = criarRenderizador(canvas);
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
const controles = new Controles(canvas);
const hud = new Hud(camera);
const segurarCamera = cameraForaDasCasas(mapa);

let mundo, efeitos, rede;
const corpos = new Map(); // id -> { corpo, info }
window.jogo = { controles, corpos, renderer }; // para testes no console do navegador
let eu = null; // meu estado mais recente

function corpoDe(e, tipo) {
  let c = corpos.get(e.id);
  // jogador trocou de personagem: refaz o corpo
  if (c && tipo === 'jogador' && c.visual !== e.visual) { c.corpo.remover(); c.corpo = new Corpo(mundo.scene, { armas: 'heroi', visual: e.visual }); c.visual = e.visual; c.aparencia = ''; }
  // cores e altura do criador: pinta por cima, sem recarregar o modelo
  if (c && tipo === 'jogador') { const a = JSON.stringify(e.aparencia); if (c.aparencia !== a) { c.aparencia = a; c.corpo.repintar(e.aparencia); } }
  if (c) return c;
  if (tipo === 'jogador') {
    const meu = e.id === rede.meuId;
    c = { corpo: new Corpo(mundo.scene, { armas: 'heroi', visual: e.visual }), tipo, visual: e.visual, aparencia: '' };
    if (!meu) c.tag = hud.etiqueta(e.nome, 'ally');
  } else {
    const t = TIPOS_INIMIGO[e.tipo], sp = mapa.inimigos[e.v] || {}; // cada um do bando com o seu visual
    c = { corpo: new Corpo(mundo.scene, { escala: t.escala * (sp.escala || 1), armas: 'inimigo', visual: sp.visual || t.visual, tinta: sp.tinta, brilho: t.brilho, bravo: true }), tipo };
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
    else if (ev.t === 'fala') {
      hud.fala(ev);
      const n = corpos.get('npc:' + ev.npc), d = mapa.npcs.find((q) => q.id === ev.npc);
      if (n && d && eu) n.corpo.aplicar({ x: d.x, z: d.z, ry: Math.atan2(eu.x - d.x, eu.z - d.z), anim: 'Idle', acao: null, acaoSeq: 0 }); // vira para quem fala com ele
      if (ev.abrir === 'habilidades') setTimeout(() => $('habBtn').click(), 1200);
    }
    else efeitos.evento(ev, corpos);
  }
  if (eu) {
    hud.barras(eu.vida / eu.vidaMax, eu.mana / HEROI.mana);
    hud.recargas(eu);
    hud.missoes(eu);
  }
}

// ---------- comandos do jogador ----------
let ultimoBase = 0;
const usar = (i) => { if (i === 0 || i === 10) ultimoBase = t; rede?.enviar('habilidade', i); }; // 0 golpe, 10 disparo
const pular = () => rede?.enviar('pular');
const dash = () => rede?.enviar('dash');
const rolar = () => rede?.enviar('rolar');
const falar = () => rede?.enviar('falar');
controles.aoTeclar = (code) => {
  const tecla = { KeyJ: 0, KeyK: 1, KeyL: 2, KeyI: 3, KeyU: 4 };
  if (code in tecla) usar(hud.indice(tecla[code]));
  if (code === 'KeyH') usar(9);
  if (code === 'KeyR' || code === 'Tab') hud.trocar();
  if (code === 'Space') pular();
  if (code === 'KeyE' || code === 'ShiftRight') dash();
  if (code === 'KeyQ') rolar();
  if (code === 'KeyF') falar();
};
hud.montarBotoes({ usar, pular, dash, rolar });
hud.aoTrocar = (m) => rede?.enviar('modo', m); // tira o cajado (magia) ou a espada das costas

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
// cores e altura do criador de personagem também ficam no aparelho
const lerAparencia = () => { try { return JSON.parse(localStorage.getItem('aparencia')); } catch { return null; } };
const primeiraVez = !lerEscolha() && !lerAparencia();
const criador = new Criador(escolhido, lerAparencia(), (visual, aparencia) => {
  try { localStorage.setItem('personagem', visual); localStorage.setItem('aparencia', JSON.stringify(aparencia)); } catch { /* vale só nesta visita */ }
  if (visual !== escolhido) { escolhido = visual; aquecerVRM(visual); rede?.enviar('visual', visual); }
  rede?.enviar('aparencia', aparencia);
});
hud.montarTelaCheia();
let camCriador = null, deslocCam = 0; // câmera guardada e deslocamento da tela enquanto o criador está aberto

$('sairBtn').addEventListener('click', async () => { await sairDaConta(enderecoServidor()); location.reload(); });

let ultimaEntrada = '', tempoEntrada = 0;
function enviarEntrada(dt) {
  const m = criador.aberto ? { x: 0, z: 0 } : controles.direcao(); // criando o personagem: fica parado
  const e = { mx: Math.round(m.x * 100) / 100, mz: Math.round(m.z * 100) / 100, correr: controles.correndo() };
  const s = JSON.stringify(e);
  tempoEntrada -= dt;
  if (s !== ultimaEntrada || tempoEntrada <= 0) { rede.enviar('entrada', e); ultimaEntrada = s; tempoEntrada = 0.25; }
}

function redimensionar() {
  renderer.setSize(innerWidth, innerHeight, false); deslocCam = -1; // refaz o deslocamento da câmera do criador
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
      if (criador.aberto) { // criador aberto: câmera de frente para o herói, ele no meio do espaço livre da tela
        if (!camCriador) camCriador = { yaw: controles.yaw, pitch: controles.pitch, dist: controles.dist };
        Object.assign(controles, { yaw: meu.corpo.root.rotation.y + Math.PI, pitch: 0.06, dist: 2.4 });
      } else if (camCriador) { Object.assign(controles, camCriador); camCriador = null; }
      controles.posicionarCamera(camera, alvoCam); segurarCamera(camera, alvoCam);
      const desloc = criador.largura() / 2;
      if (desloc !== deslocCam) { deslocCam = desloc; if (desloc) camera.setViewOffset(innerWidth, innerHeight, desloc, 0, innerWidth, innerHeight); else camera.clearViewOffset(); }
      mundo.sol.position.set(p.x + 14, 22, p.z + 8); mundo.sol.target.position.copy(p);
      for (const c of corpos.values()) if (c.tag) hud.posicionarEtiqueta(c.tag, c.corpo.root, c.info, p);
      hud.npcs(p, dt);
    }
    hud.atualizar(dt);
    renderer.render(mundo.scene, camera);
  }
  requestAnimationFrame(quadro);
}

(async () => {
  try {
    // o login do Google aparece logo, enquanto o mundo carrega por trás
    const servidor = enderecoServidor();
    const primeiraEntrada = entrarNaConta(servidor);
    msg('Carregando o mundo…');
    mundo = await montarCena(renderer, mapa);
    msg('Carregando os personagens…');
    aquecerVRM(escolhido); // o herói vai na frente dos NPCs e do bando
    await carregarPersonagens();
    efeitos = new Efeitos(mundo.scene);
    // NPCs da vila: chegue perto e toque em Falar (ou tecla F); o que cada um faz está em Simulacao.falar
    for (const n of mapa.npcs) {
      const c = new Corpo(mundo.scene, { visual: n.visual, tinta: n.tinta, escala: n.escala || 1, armas: 'nenhuma' });
      c.aplicar({ x: n.x, z: n.z, ry: n.ry, anim: 'Idle', acao: null, acaoSeq: 0 });
      hud.adicionarNpc(n, c.root, falar);
      corpos.set('npc:' + n.id, { corpo: c, tipo: 'npc' });
    }
    msg('Conectando ao servidor…');
    let nome = new URLSearchParams(location.search).get('nome') || 'Andarilho';
    // Conta Google: o nome, o personagem e a build vêm da conta (salvos no servidor)
    for (let tentativa = 0; ; tentativa++) {
      const entrada = await (tentativa === 0 ? primeiraEntrada : entrarNaConta(servidor));
      if (entrada) {
        const { conta } = entrada;
        nome = conta.nome;
        if (conta.visual) { escolhido = conta.visual; criador.visual = escolhido; criador.marcar(); }
        if (conta.build) { build = conta.build; hud.mostrarBuild(build); }
        $('sairBtn').hidden = false;
      }
      try { rede = await conectar(mapa, nome, escolhido, receber, (t) => hud.rede(t), entrada?.sessao); break; }
      catch (e) { if (!e.login || tentativa > 0) throw e; try { localStorage.removeItem('sessao'); } catch { /* nada guardado */ } }
    }
    hud.rede(rede.modo === 'online' ? 'Online' : 'Modo solo (sem servidor)');
    rede.enviar('build', build);
    rede.enviar('aparencia', criador.aparencia);
    $('nome').textContent = nome;
    msg('Carregando o seu personagem…');
    // espera o próprio corpo ficar pronto (o personagem anime baixa uns 15 a 20 MB na primeira vez)
    for (let i = 0; i < 600 && !corpos.get(rede.meuId)?.corpo.mixer; i++) await new Promise((r) => setTimeout(r, 100));
    hud.montarEsboco();
    $('load').hidden = true;
    if (primeiraVez) criador.abrir(); // primeira vez no jogo: começa criando o personagem
    else setTimeout(() => hud.aviso('Monte a sua build em Habilidades'), 600);
  } catch (e) {
    msg('Não foi possível carregar: ' + e.message); console.error(e);
  }
})();
quadro();
