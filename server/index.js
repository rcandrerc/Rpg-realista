// Servidor do jogo: Node.js + Colyseus.
// Roda a simulação compartilhada 20 vezes por segundo e manda uma "foto" do mundo para todos.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import colyseus from 'colyseus';
import wsTransport from '@colyseus/ws-transport';
import { Simulacao, MAPA_CLAREIRA, ORDEM_ARMAS } from '@rpg/shared';

const { Server, Room } = colyseus;
const { WebSocketTransport } = wsTransport;

const PORTA = Number(process.env.PORT || 2567);
const TICK = 1 / 20;

class SalaClareira extends Room {
  maxClients = 16;

  onCreate() {
    this.sim = new Simulacao(MAPA_CLAREIRA);
    this.onMessage('entrada', (c, m) => this.sim.entrada(c.sessionId, m || {}));
    this.onMessage('habilidade', (c, i) => { if ([0, 1, 2, 3].includes(i)) this.sim.usarHabilidade(c.sessionId, i); });
    this.onMessage('arma', (c, k) => { if (ORDEM_ARMAS.includes(k)) this.sim.trocarArma(c.sessionId, k); });
    this.onMessage('rolar', (c) => this.sim.rolar(c.sessionId));
    this.onMessage('visual', (c, v) => this.sim.trocarVisual(c.sessionId, String(v)));
    this.setSimulationInterval(() => this.tick(), TICK * 1000);
  }

  tick() {
    const eventos = this.sim.passo(TICK);
    const foto = this.sim.foto();
    for (const c of this.clients) {
      // avisos pessoais vão só para quem precisa
      const meus = eventos.filter((e) => !e.para || e.para === c.sessionId);
      c.send('mundo', { foto, eventos: meus });
    }
  }

  onJoin(client, opcoes) {
    const nome = String(opcoes?.nome || '').slice(0, 20) || `Andarilho ${this.clients.length}`;
    this.sim.adicionarJogador(client.sessionId, nome, opcoes?.visual);
  }

  async onLeave(client, consentiu) {
    // Celular perde conexão o tempo todo: segura o personagem por 20 s para o jogador voltar
    if (!consentiu) {
      try { await this.allowReconnection(client, 20); return; } catch { /* não voltou a tempo */ }
    }
    this.sim.removerJogador(client.sessionId);
  }
}

const app = express();
// Em produção o próprio servidor entrega o jogo (pasta client/dist depois do "npm run build")
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
app.use(express.static(dist));
app.get('/saude', (_req, res) => res.json({ ok: true }));

const servidor = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: servidor, pingInterval: 5000, pingMaxRetries: 4 }) });
gameServer.define('clareira', SalaClareira);
gameServer.listen(PORTA).then(() => console.log(`Servidor do RPG no ar: http://localhost:${PORTA}`));
