// Ponto de entrada do cliente: monta a cena, conecta no servidor e desenha o que a simulação manda.
import * as THREE from 'three';
import { HEROI, MAPA_CLAREIRA, TIPOS_INIMIGO, PERSONAGENS, PERSONAGEM_PADRAO, BUILD_PADRAO, buildValida } from '@rpg/shared';
import { criarRenderizador, montarCena, RESOLUCAO_MAX } from './cena.js';
import { carregarPersonagens, Corpo, aquecerVRM } from './personagens.js';
import { Efeitos } from './efeitos.js';
import { conectar, enderecoServidor } from './rede.js';
import { Previsao, EFEITOS_LOCAIS } from './previsao.js';
import { entrarNaConta, sairDaConta, apagarConta } from './conta.js';
import { Hud } from './hud.js';
import { Criador } from './criador.js';
import { Controles } from './controles.js';
import { cameraForaDasCasas } from './vila.js';
import { aplicarEstilo, botaoEstilo } from './estilo.js';
import { PainelHeroi } from './layout.js';
import { prepararMontarias } from './montaria.js';
import { Palco } from './palco.js';
import { montarMenu } from './menu.js';

const mapa = MAPA_CLAREIRA;
const $ = (id) => document.getElementById(id);
const msg = (t) => { $('loadmsg').textContent = t; };

const canvas = $('c');
const renderer = criarRenderizador(canvas);
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
const controles = new Controles(canvas);
const hud = new Hud(camera);
const segurarCamera = cameraForaDasCasas(mapa);
botaoEstilo($('menuEstilo'));

let mundo, efeitos, rede, pos;
const corpos = new Map(); // id -> { corpo, info }
window.jogo = { controles, corpos, renderer }; // para testes no console do navegador
let eu = null; // meu estado mais recente
let previsao = null; // online: o meu herói é decidido no aparelho e o servidor confere (client/src/previsao.js)
// Relógio do servidor: a tela mostra os outros um pouco no passado (atraso), sempre entre duas fotos que já chegaram.
// O atraso cresce sozinho quando a internet oscila (fotos chegando fora do ritmo) e volta a diminuir quando ela firma.
const relogioServ = { dif: null, osc: 0, atraso: 0.1 };
function marcarFoto(tempo) {
  const amostra = tempo - performance.now() / 1000, r = relogioServ;
  if (r.dif == null || amostra - r.dif > 1 || amostra - r.dif < -2) r.dif = amostra; // primeira foto ou relógio pulou (reconectou)
  else if (amostra > r.dif) r.dif += (amostra - r.dif) * 0.5; // foto adiantada: a internet está mais rápida que a estimativa
  else r.dif += (amostra - r.dif) * 0.02;
  r.osc = r.osc * 0.92 + Math.abs(amostra - r.dif) * 0.08;
  const alvo = Math.min(0.35, Math.max(0.1, 0.06 + r.osc * 2.5));
  r.atraso += (alvo - r.atraso) * (alvo > r.atraso ? 0.3 : 0.02); // sobe rápido, desce devagar
}
const horaServ = () => (relogioServ.dif == null ? null : performance.now() / 1000 + relogioServ.dif - relogioServ.atraso);

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
  const online = rede.modo === 'online', tf = online ? foto.tempo : null;
  if (online) marcarFoto(foto.tempo);
  for (const j of foto.jogadores) {
    vivos.add(j.id);
    const c = corpoDe(j, 'jogador');
    c.info = j;
    if (j.id === rede.meuId && previsao) {
      // o meu herói é do celular: a foto só traz vida, mana e o resto que o servidor decide
      previsao.corrigir(j, foto.inimigos);
      c.corpo.previsto = previsao.ativo;
      if (!previsao.ativo) c.corpo.aplicar(j, tf);
    } else c.corpo.aplicar(j, tf);
    c.corpo.root.visible = !j.criando; // quem está criando o personagem ainda não entrou no mundo
    if (j.id === rede.meuId) eu = j;
  }
  for (const e of foto.inimigos) { vivos.add(e.id); const c = corpoDe(e, 'inimigo'); c.info = e; c.corpo.aplicar(e, tf); }
  for (const [id, c] of corpos) if (c.tipo !== 'npc' && !vivos.has(id)) { c.corpo.remover(); c.tag?.remove(); efeitos.esquecer(id); corpos.delete(id); }

  // efeitos das minhas próprias ações já apareceram na hora pelo celular: os do servidor são ignorados
  mostrarEventos(previsao?.ativo ? eventos.filter((ev) => !(ev.de === rede.meuId && EFEITOS_LOCAIS.has(ev.t))) : eventos);
  if (eu) {
    hud.barras(eu.vida, eu.vidaMax, eu.mana, HEROI.mana);
    hud.recargas(eu);
    hud.missoes(eu);
  }
}

function mostrarEventos(eventos) {
  for (const ev of eventos) {
    if (ev.t === 'corrigir') { previsao?.encostar(ev); continue; } // o servidor não aceitou a posição: volta para onde ele sabe
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
}

// ---------- comandos do jogador ----------
let ultimoBase = 0;
// manda para o servidor e, no online, faz o mesmo na previsão (o herói reage na hora)
const enviar = (tipo, msg) => { rede?.enviar(tipo, msg); previsao?.cmd(tipo, msg); };
const usar = (i) => { if (i === 0 || i === 10) ultimoBase = t; enviar('habilidade', i); }; // 0 golpe, 10 disparo
const pular = () => enviar('pular');
const dash = () => enviar('dash');
const rolar = () => enviar('rolar');
const falar = () => rede?.enviar('falar');
const montar = () => enviar('montar');
controles.aoTeclar = (code) => {
  const tecla = { KeyJ: 0, KeyK: 1, KeyL: 2, KeyI: 3, KeyU: 4 };
  if (code in tecla) usar(hud.indice(tecla[code]));
  if (code === 'KeyH') usar(9);
  if (code === 'KeyR' || code === 'Tab') hud.trocar();
  if (code === 'Space') pular();
  if (code === 'KeyE' || code === 'ShiftRight') dash();
  if (code === 'KeyQ') rolar();
  if (code === 'KeyF') falar();
  if (code === 'KeyM') montar();
};
hud.montarBotoes({ usar, pular, dash, rolar, montar }); // lobo: botão redondo de baixo (ou tecla M)
hud.aoTrocar = (m) => enviar('modo', m); // tira o cajado (magia) ou a espada das costas

// build (habilidades nos botões) também fica guardada no aparelho
let build = (() => { try { return JSON.parse(localStorage.getItem('build')); } catch { return null; } })();
// foto e nível no painel de vida; toque abre Status, segurar 2 s edita os botões
const painel = new PainelHeroi(renderer, () => ({ eu, nome: $('nome').textContent, build: build || BUILD_PADRAO }));
montarMenu({ status: () => painel.abrirStatus(), editarBotoes: () => painel.editar(true) });
if (!buildValida(build)) build = [...BUILD_PADRAO];
hud.mostrarBuild(build);
hud.montarEscolhaHabilidades(build, (b) => {
  build = b;
  try { localStorage.setItem('build', JSON.stringify(b)); } catch { /* sem armazenamento: vale só nesta visita */ }
  enviar('build', b);
});

// personagem escolhido fica guardado neste aparelho
const lerEscolha = () => { try { return localStorage.getItem('personagem'); } catch { return null; } };
let escolhido = lerEscolha();
if (!PERSONAGENS.some((p) => p.id === escolhido)) escolhido = PERSONAGEM_PADRAO;
// cores e altura do criador de personagem também ficam no aparelho
const lerAparencia = () => { try { return JSON.parse(localStorage.getItem('aparencia')); } catch { return null; } };
// o criador abre uma vez só: na criação da conta (ou, sem conta, na primeira vez neste aparelho)
const lerCriado = () => { try { return localStorage.getItem('personagemCriado') === '1'; } catch { return false; } };
let primeiraVez = !lerCriado() && !lerEscolha();
const criador = new Criador(escolhido, lerAparencia(), (visual, aparencia) => {
  try { localStorage.setItem('personagem', visual); localStorage.setItem('aparencia', JSON.stringify(aparencia)); } catch { /* vale só nesta visita */ }
  if (visual !== escolhido) { escolhido = visual; aquecerVRM(visual); rede?.enviar('visual', visual); }
  rede?.enviar('aparencia', aparencia);
});
// Criando o personagem: o herói vai para o palco (fora do mapa) e o servidor tira ele do mundo, sem dano e sem inimigos
let palco = null, camCriador = null, deslocCam = -1;
criador.aoAlternar = (aberto) => {
  rede?.enviar('criando', aberto);
  if (aberto) { palco ||= new Palco(renderer); camCriador = { yaw: controles.yaw, pitch: controles.pitch, dist: controles.dist }; deslocCam = -1; }
  else if (camCriador) { Object.assign(controles, camCriador); camCriador = null; }
};
// "Pronto" no criador (com nome válido): o servidor grava de vez e o criador não abre mais
criador.aoConcluir = ({ nome, visual, aparencia }) => {
  rede?.enviar('pronto', { nome, visual, aparencia });
  try { localStorage.setItem('personagemCriado', '1'); localStorage.setItem('nomePersonagem', nome); } catch { /* vale só nesta visita */ }
  $('nome').textContent = nome;
  setTimeout(() => hud.aviso('Monte a sua build em Habilidades'), 600);
};
hud.montarTelaCheia();

$('sairBtn').addEventListener('click', async () => { await sairDaConta(enderecoServidor()); location.reload(); });
// Apagar conta: o primeiro toque pede confirmação, o segundo (em até 4 s) apaga
let confirmaApagar = 0;
$('apagarBtn').addEventListener('click', async () => {
  const b = $('apagarBtn');
  if (Date.now() > confirmaApagar) {
    confirmaApagar = Date.now() + 4000; b.textContent = 'Toque de novo para apagar tudo';
    setTimeout(() => { if (Date.now() > confirmaApagar) b.textContent = 'Apagar conta'; }, 4100);
    return;
  }
  b.disabled = true; b.textContent = 'Apagando…';
  try { await apagarConta(enderecoServidor()); }
  catch (e) { b.disabled = false; b.textContent = 'Apagar conta'; confirmaApagar = 0; hud.aviso(e.message); return; }
  for (const k of ['personagem', 'aparencia', 'build', 'personagemCriado', 'nomePersonagem']) try { localStorage.removeItem(k); } catch { /* nada guardado */ }
  location.reload();
});

let ultimaEntrada = '', tempoEntrada = 0;
function enviarEntrada(dt) {
  const m = criador.aberto ? { x: 0, z: 0 } : controles.direcao(); // criando o personagem: fica parado
  const e = { mx: Math.round(m.x * 100) / 100, mz: Math.round(m.z * 100) / 100, correr: controles.correndo() };
  const s = JSON.stringify(e);
  previsao?.cmd('entrada', e); // a previsão recebe todo quadro; o servidor só quando muda
  tempoEntrada -= dt;
  if (s !== ultimaEntrada || tempoEntrada <= 0) { rede.enviar('entrada', e); ultimaEntrada = s; tempoEntrada = 0.25; }
}

// Botões e painéis com o mesmo tamanho na tela, mesmo se o zoom do Chrome for mudado: no celular a
// interface acompanha a altura da tela (407 px = celular do André deitado, com zoom 100%).
const TOQUE = matchMedia('(pointer: coarse)').matches;
function escalaInterface() {
  const k = TOQUE ? Math.min(1.6, Math.max(0.75, Math.min(innerWidth, innerHeight) / 407)) : 1;
  document.documentElement.style.setProperty('--ui', k.toFixed(3));
}

function redimensionar() {
  escalaInterface();
  renderer.setSize(innerWidth, innerHeight, false); deslocCam = -1; // refaz o deslocamento da câmera do criador
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  if (palco) { palco.camera.aspect = camera.aspect; palco.camera.updateProjectionMatrix(); }
}
addEventListener('resize', redimensionar); redimensionar();

// ---------- desempenho no celular ----------
// Personagens fora da tela (e com a sombra fora dela) não são desenhados.
const frustum = new THREE.Frustum(), projTela = new THREE.Matrix4(), luzSol = new THREE.Vector3();
function cortarForaDaTela() {
  camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(projTela.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  luzSol.subVectors(mundo.sol.position, mundo.sol.target.position).normalize();
  for (const c of corpos.values()) c.corpo.cortar(frustum, luzSol);
}

// Resolução que se ajusta sozinha (só no celular): se o FPS cair, a imagem fica um pouco menos nítida em vez de travar,
// e volta ao máximo quando sobra fôlego. Se baixar não ajudar (aparelho ou Chrome travado em 30, economia de bateria),
// volta e não mexe mais por um tempo.
const RESOLUCAO_MIN = TOQUE ? Math.min(RESOLUCAO_MAX, 1.2) : RESOLUCAO_MAX;
const resol = { atual: RESOLUCAO_MAX, teto: RESOLUCAO_MAX, ini: 0, n: 0, bons: 0, antes: null, travado: 0 };
function mudarResolucao(v) {
  resol.atual = Math.round(v * 100) / 100;
  renderer.setPixelRatio(resol.atual); renderer.setSize(innerWidth, innerHeight, false);
}
function ajustarResolucao() {
  const agora = performance.now();
  if (!resol.ini) { resol.ini = agora; resol.travado = agora + 20000; } // começo: o resto dos personagens ainda está chegando
  resol.n++;
  const passou = (agora - resol.ini) / 1000;
  if (passou < 2.5 || RESOLUCAO_MIN >= RESOLUCAO_MAX) return;
  const fps = resol.n / passou; resol.ini = agora; resol.n = 0;
  if (document.hidden || criador.aberto) return;
  if (resol.antes) { // acabou de baixar: confere se adiantou
    const ajudou = fps >= resol.antes.fps * 1.08;
    if (!ajudou) { mudarResolucao(resol.antes.pr); resol.travado = agora + 60000; }
    resol.antes = null; return;
  }
  if (fps < 50 && resol.atual > RESOLUCAO_MIN && agora > resol.travado) {
    resol.antes = { fps, pr: resol.atual }; resol.bons = 0;
    if (resol.atual < resol.teto) resol.teto = resol.atual; // subir até aqui já deu queda: não insiste
    mudarResolucao(Math.max(RESOLUCAO_MIN, resol.atual - 0.1)); // passos pequenos: a nitidez não "pula"
  } else if (fps > 57) {
    if (++resol.bons >= 3 && resol.atual < resol.teto) { resol.bons = 0; mudarResolucao(Math.min(resol.teto, resol.atual + 0.1)); }
  } else resol.bons = 0;
}
setInterval(() => { resol.teto = RESOLUCAO_MAX; }, 120000); // de tempos em tempos tenta a imagem mais nítida de novo

// ---------- laço principal ----------
const relogio = new THREE.Clock(), alvoCam = new THREE.Vector3(), tmp = new THREE.Vector3();
let t = 0;
function quadro() {
  const dt = Math.min(relogio.getDelta(), 0.05); t += dt;
  hud.conexao(rede, dt);
  if (rede) {
    enviarEntrada(dt);
    // golpe base segurado (botão ou tecla J): repete; o servidor guarda o próximo golpe enquanto o atual termina
    if ((hud.segurando !== false || controles.teclas.KeyJ) && t - ultimoBase > 0.2) { ultimoBase = t; usar(hud.indice(0)); }
    rede.passo(dt);
    if (previsao) {
      mostrarEventos(previsao.passo(dt, (p) => rede.enviar('pos', p))); // golpes e efeitos na hora
      const c = corpos.get(rede.meuId);
      if (c && previsao.ativo) { c.info = { ...c.info, ...previsao.estado() }; c.corpo.aplicar(c.info); }
    }
    mundo.atualizar(t);
    painel.atualizar(mundo.scene, corpos.get(rede.meuId)?.corpo);
    const tVer = rede.modo === 'online' ? horaServ() : null;
    for (const c of corpos.values()) c.corpo.atualizar(dt, c.tipo === 'npc' ? null : tVer);
    for (const [id, c] of corpos) if (c.tipo === 'jogador') efeitos.corpo(id, c.corpo, c.info, dt);
    efeitos.atualizar(dt, t, camera, renderer);
    const meu = corpos.get(rede.meuId);
    if (meu) {
      const p = meu.corpo.root.position;
      { const yAntes = alvoCam.y; alvoCam.lerp(tmp.set(p.x, p.y + 1.35, p.z), Math.min(1, dt * 7)); alvoCam.y = yAntes + (p.y + 1.35 - yAntes) * Math.min(1, dt * 3.5); } // na altura sobe devagar: pulo balança pouco, rocha a câmera acompanha
      controles.posicionarCamera(camera, alvoCam); segurarCamera(camera, alvoCam);
      mundo.sol.position.set(p.x + 14, 22, p.z + 8); mundo.sol.target.position.copy(p);
      for (const c of corpos.values()) if (c.tag) hud.posicionarEtiqueta(c.tag, c.corpo.root, c.info, p);
      hud.npcs(p, dt);
    }
    hud.atualizar(dt);
    if (criador.aberto && palco) { // no palco: arrastar gira o herói; ele fica no meio do espaço livre ao lado do painel
      palco.vestir(criador.visual, criador.aparencia);
      palco.atualizar(dt, camCriador ? camCriador.yaw - controles.yaw : 0, criador.foco === 'rosto');
      const desloc = criador.largura() / 2;
      if (desloc !== deslocCam) { deslocCam = desloc; palco.camera.aspect = camera.aspect; palco.camera.setViewOffset(innerWidth, innerHeight, desloc, 0, innerWidth, innerHeight); }
      if (pos) pos.render(palco.scene, palco.camera); else renderer.render(palco.scene, palco.camera);
    } else {
      cortarForaDaTela();
      if (pos) pos.render(); else renderer.render(mundo.scene, camera);
    }
    ajustarResolucao();
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
    prepararMontarias(); // o lobo baixa por trás, enquanto o jogo conecta
    efeitos = new Efeitos(mundo.scene);
    // NPCs da vila: chegue perto e toque em Falar (ou tecla F); o que cada um faz está em Simulacao.falar
    for (const n of mapa.npcs) {
      const c = new Corpo(mundo.scene, { visual: n.visual, tinta: n.tinta, escala: n.escala || 1, armas: 'nenhuma' });
      c.aplicar({ x: n.x, z: n.z, ry: n.ry, anim: 'Idle', acao: null, acaoSeq: 0 });
      hud.adicionarNpc(n, c.root, falar);
      corpos.set('npc:' + n.id, { corpo: c, tipo: 'npc' });
    }
    msg('Conectando ao servidor…');
    let jaTinhaConta = false;
    let nome = new URLSearchParams(location.search).get('nome') || (() => { try { return localStorage.getItem('nomePersonagem'); } catch { return null; } })() || 'Andarilho';
    // Conta Google: o nome, o personagem e a build vêm da conta (salvos no servidor)
    for (let tentativa = 0; ; tentativa++) {
      const entrada = await (tentativa === 0 ? primeiraEntrada : entrarNaConta(servidor));
      if (entrada) {
        const { conta } = entrada;
        jaTinhaConta = !!entrada.jaTinha;
        nome = conta.nome;
        primeiraVez = !conta.visual; // conta sem personagem: começa criando (uma vez só)
        if (conta.visual) {
          escolhido = conta.visual; criador.visual = escolhido;
          if (conta.aparencia) criador.aparencia = conta.aparencia;
          criador.marcar();
          try { localStorage.setItem('personagem', escolhido); localStorage.setItem('aparencia', JSON.stringify(criador.aparencia)); localStorage.setItem('personagemCriado', '1'); } catch { /* vale só nesta visita */ }
        }
        if (conta.build) { build = conta.build; hud.mostrarBuild(build); }
        $('sairBtn').hidden = false; $('apagarBtn').hidden = false;
      }
      try { rede = await conectar(mapa, nome, escolhido, receber, (t) => hud.rede(t), entrada?.sessao, primeiraVez, criador.aparencia); break; }
      catch (e) { if (!e.login || tentativa > 0) throw e; try { localStorage.removeItem('sessao'); } catch { /* nada guardado */ } }
    }
    hud.rede('Online');
    if (rede.modo === 'online') previsao = new Previsao(mapa, rede.meuId);
    enviar('build', build);
    if (primeiraVez) rede.enviar('aparencia', criador.aparencia); // a aparência só muda no criador
    $('nome').textContent = nome;
    msg('Carregando o seu personagem…');
    // espera o próprio corpo ficar pronto (o personagem anime baixa uns 15 a 20 MB na primeira vez)
    for (let i = 0; i < 600 && !corpos.get(rede.meuId)?.corpo.mixer; i++) await new Promise((r) => setTimeout(r, 100));
    hud.montarEsboco();
    pos = aplicarEstilo(renderer, mundo.scene, camera, mundo.sol);
    $('load').hidden = true;
    if (primeiraVez) criador.abrir(); // conta nova: cria o personagem e o nome (uma vez só)
    else setTimeout(() => hud.aviso(jaTinhaConta ? 'Você já tinha conta: entrou nela' : 'Monte a sua build em Habilidades'), 600);
  } catch (e) {
    msg('Não foi possível carregar: ' + e.message); console.error(e);
  }
})();
quadro();
