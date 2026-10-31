// Ligação com o servidor. Se não houver servidor, o jogo roda as mesmas regras sozinho no aparelho (modo solo).
import { Client } from 'colyseus.js';
import { Simulacao } from '@rpg/shared';

// Servidor usado quando o jogo é aberto pelo GitHub Pages (que não roda servidor). Vazio = modo solo.
const SERVIDOR_PARA_PAGES = 'wss://163-176-80-126.sslip.io'; // Oracle Cloud (São Paulo)

export function enderecoServidor() {
  const forcado = new URLSearchParams(location.search).get('servidor');
  if (forcado) return forcado;
  if (location.hostname.endsWith('github.io')) return SERVIDOR_PARA_PAGES || null;
  const ws = location.protocol === 'https:' ? 'wss' : 'ws';
  // no "npm run dev" a página vem do Vite (porta 5173) e o servidor fica na 2567
  const porta = location.port === '5173' ? '2567' : location.port;
  return `${ws}://${location.hostname}${porta ? ':' + porta : ''}`;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const comPrazo = (p, ms) => Promise.race([p, new Promise((_, nao) => setTimeout(() => nao(new Error('sem resposta')), ms))]);

// criando: entra já no palco do criador (fora do mundo, sem levar dano)
export async function conectar(mapa, nome, visual, aoReceber, aoMudarStatus = () => {}, sessao = null, criando = false) {
  const endereco = enderecoServidor();
  if (!endereco) return modoSolo(mapa, nome, visual, aoReceber, criando);
  const cliente = new Client(endereco);
  let sala;
  try {
    sala = await comPrazo(cliente.joinOrCreate(mapa.id, { nome, visual, sessao, criando }), 4000);
  } catch (e) {
    if (e.code === 401) throw Object.assign(new Error('sessão vencida'), { login: true }); // pede o login do Google de novo
    console.warn('Servidor indisponível, jogando no modo solo:', e.message);
    return modoSolo(mapa, nome, visual, aoReceber, criando);
  }
  const rede = { modo: 'online', meuId: sala.sessionId, passo: () => {} };
  rede.enviar = (tipo, msg) => { if (sala.connection.isOpen) sala.send(tipo, msg); };

  const ligar = (s) => {
    sala = s;
    s.onMessage('mundo', (m) => aoReceber(m.foto, m.eventos));
    s.onLeave(async (codigo) => {
      console.warn('Conexão caiu, código', codigo);
      if (codigo === 1000) return; // saiu de propósito
      if (codigo === 4001) { aoMudarStatus('Sua conta entrou em outro aparelho.'); return; }
      aoMudarStatus('Reconectando…');
      const token = s.reconnectionToken;
      for (let tentativa = 0; tentativa < 8; tentativa++) {
        await espera(1000 + tentativa * 1000);
        try { ligar(await comPrazo(cliente.reconnect(token), 4000)); aoMudarStatus('Online'); return; } catch { /* tenta de novo */ }
      }
      aoMudarStatus('Sem conexão. Recarregue a página.');
    });
  };
  ligar(sala);
  return rede;
}

function modoSolo(mapa, nome, visual, aoReceber, criando) {
  const sim = new Simulacao(mapa);
  sim.adicionarJogador('solo', nome, visual);
  sim.definirCriando('solo', criando);
  window.jogo = Object.assign(window.jogo || {}, { sim }); // para testes no console
  const cmd = {
    entrada: (m) => sim.entrada('solo', m),
    habilidade: (i) => sim.usarHabilidade('solo', i),
    build: (b) => sim.definirBuild('solo', b),
    rolar: () => sim.rolar('solo'),
    pular: () => sim.pular('solo'),
    dash: () => sim.dash('solo'),
    visual: (v) => sim.trocarVisual('solo', v),
    falar: () => sim.falar('solo'),
    montar: () => sim.montar('solo'),
    modo: (m) => sim.trocarModo('solo', m),
    aparencia: (a) => sim.definirAparencia('solo', a),
    criando: (v) => sim.definirCriando('solo', v),
  };
  return {
    modo: 'solo', meuId: 'solo',
    enviar: (tipo, msg) => cmd[tipo]?.(msg),
    passo: (dt) => { const ev = sim.passo(dt); aoReceber(sim.foto(), ev); },
  };
}
