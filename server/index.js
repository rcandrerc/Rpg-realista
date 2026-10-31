// Servidor do jogo: Node.js + Colyseus.
// Roda a simulação compartilhada 20 vezes por segundo e manda uma "foto" do mundo para todos.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import colyseus from 'colyseus';
import wsTransport from '@colyseus/ws-transport';
import { Simulacao, MAPA_CLAREIRA, GOOGLE_CLIENT_ID } from '@rpg/shared';
import { Contas, verificadorGoogle } from './contas.js';

const { Server, Room, ServerError } = colyseus;
const { WebSocketTransport } = wsTransport;

const PORTA = Number(process.env.PORT || 2567);
const TICK = 1 / 20;
// Limite de mensagens por jogador (balde que enche 60 por segundo, guarda até 120).
// O jogo normal manda bem menos; quem passa disso tem o excesso ignorado. O que grava na conta custa mais.
const LIMITE = { porSeg: 60, max: 120, custo: { build: 20, visual: 20, aparencia: 10 } };

// Contas só com Google. Sem Client ID o servidor aceita qualquer um sem conta (como antes).
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;
const contas = CLIENT_ID ? new Contas({ pasta: path.resolve(process.env.DADOS || 'dados'), verificar: verificadorGoogle(CLIENT_ID) }) : null;
// Páginas que podem pedir login a este servidor (o jogo no GitHub Pages e o "npm run dev")
const ORIGENS = [/^https:\/\/rcandrerc\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/];

class SalaClareira extends Room {
  maxClients = 16;

  onCreate() {
    this.sim = new Simulacao(MAPA_CLAREIRA);
    this.ouvir('entrada', (c, m) => this.sim.entrada(c.sessionId, m || {}));
    this.ouvir('habilidade', (c, i) => { if (Number.isInteger(i) && i >= 0 && i <= 10) this.sim.usarHabilidade(c.sessionId, i); });
    this.ouvir('build', (c, b) => { this.sim.definirBuild(c.sessionId, b); if (contas && c.auth) contas.salvarBuild(c.auth.id, b); });
    this.ouvir('rolar', (c) => this.sim.rolar(c.sessionId));
    this.ouvir('pular', (c) => this.sim.pular(c.sessionId));
    this.ouvir('dash', (c) => this.sim.dash(c.sessionId));
    this.ouvir('aparencia', (c, a) => this.sim.definirAparencia(c.sessionId, a));
    this.ouvir('criando', (c, v) => this.sim.definirCriando(c.sessionId, v === true)); // no palco do criador: fora do mundo
    this.ouvir('modo', (c, m) => this.sim.trocarModo(c.sessionId, String(m)));
    this.ouvir('falar', (c) => this.sim.falar(c.sessionId));
    this.ouvir('montar', (c) => this.sim.montar(c.sessionId));
    this.ouvir('visual', (c, v) => { this.sim.trocarVisual(c.sessionId, String(v)); if (contas && c.auth) contas.salvarVisual(c.auth.id, String(v)); });
    this.setSimulationInterval(() => this.tick(), TICK * 1000);
  }

  // Igual a onMessage, mas descarta o que passar do limite (cliente alterado inundando o servidor)
  ouvir(tipo, fn) {
    const custo = LIMITE.custo[tipo] || 1;
    this.onMessage(tipo, (c, m) => {
      const agora = Date.now(), b = (c.userData ||= {}).balde ||= { n: LIMITE.max, t: agora };
      b.n = Math.min(LIMITE.max, b.n + ((agora - b.t) / 1000) * LIMITE.porSeg); b.t = agora;
      if (b.n < custo) return;
      b.n -= custo;
      fn(c, m);
    });
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

  // Só entra quem tem sessão de uma conta Google (quando as contas estão ligadas)
  onAuth(_client, opcoes) {
    if (!contas) return true;
    const conta = contas.porSessao(opcoes?.sessao);
    if (!conta) throw new ServerError(401, 'login');
    return conta;
  }

  onJoin(client, opcoes) {
    const conta = contas ? client.auth : null;
    if (conta) {
      // a mesma conta abriu o jogo em outro aparelho ou aba: o antigo sai
      for (const outro of this.clients) if (outro !== client && outro.auth?.id === conta.id) { (outro.userData ||= {}).substituido = true; outro.leave(4001); }
    }
    const nome = conta?.nome || String(opcoes?.nome || '').slice(0, 20) || `Andarilho ${this.clients.length}`;
    this.sim.adicionarJogador(client.sessionId, nome, conta?.visual || opcoes?.visual);
    if (conta?.build) this.sim.definirBuild(client.sessionId, conta.build);
    if (opcoes?.criando === true) this.sim.definirCriando(client.sessionId, true); // primeira vez: entra já no palco do criador
    if (conta && !conta.visual) contas.salvarVisual(conta.id, String(opcoes?.visual)); // conta nova: guarda o personagem que já usava no aparelho
  }

  async onLeave(client, consentiu) {
    // Celular perde conexão o tempo todo: segura o personagem por 20 s para o jogador voltar
    if (!consentiu && !client.userData?.substituido) {
      try { await this.allowReconnection(client, 20); return; } catch { /* não voltou a tempo */ }
    }
    this.sim.removerJogador(client.sessionId);
  }
}

const app = express();
// Em produção o próprio servidor entrega o jogo (pasta client/dist depois do "npm run build")
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
app.use(express.static(dist));
// O jogo no GitHub Pages fala com este servidor de outro endereço: libera só as nossas páginas
app.use((req, res, next) => {
  const origem = req.headers.origin;
  if (origem && ORIGENS.some((r) => r.test(origem))) {
    res.set({ 'Access-Control-Allow-Origin': origem, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST', Vary: 'Origin' });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.get('/saude', (_req, res) => res.json({ ok: true, contas: !!contas }));

// ---------- conta (login com Google) ----------
app.use('/conta', (_req, res, next) => (contas ? next() : res.status(404).json({ erro: 'contas desligadas' })), express.json({ limit: '8kb' }));
const sessaoDe = (req) => (req.headers.authorization || '').replace(/^Bearer /, '');
app.post('/conta/entrar', async (req, res) => {
  try { res.json(await contas.entrar(req.body?.credencial)); }
  catch (e) { console.warn('Login recusado:', e.message); res.status(401).json({ erro: 'Não foi possível confirmar a conta Google.' }); }
});
app.get('/conta/eu', (req, res) => {
  const conta = contas.porSessao(sessaoDe(req));
  conta ? res.json({ conta }) : res.status(401).json({ erro: 'login' });
});
app.post('/conta/sair', (req, res) => { contas.sair(sessaoDe(req)); res.json({ ok: true }); });

const servidor = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: servidor, pingInterval: 5000, pingMaxRetries: 4 }) });
gameServer.define('clareira', SalaClareira);
gameServer.listen(PORTA).then(() => console.log(`Servidor do RPG no ar: http://localhost:${PORTA}`));
