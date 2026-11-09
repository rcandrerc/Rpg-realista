// Servidor do jogo: Node.js + Colyseus.
// Roda a simulação compartilhada 20 vezes por segundo e manda uma "foto" do mundo para todos.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import colyseus from 'colyseus';
import wsTransport from '@colyseus/ws-transport';
import { Simulacao, MAPA_CLAREIRA, GOOGLE_CLIENT_ID, retTerreno, LOTES_ANTIGOS, AMIGOS, CHAT } from '@rpg/shared';
import { Contas, verificadorGoogle } from './contas.js';
import { Visao } from './visao.js';
import { ligarAtualizacaoTrancada } from './atualizar.js';

const { Server, Room, ServerError } = colyseus;
const { WebSocketTransport } = wsTransport;

const PORTA = Number(process.env.PORT || 2567);
const TICK = 1 / 20;
// Limite de mensagens por jogador (balde que enche 90 por segundo, guarda até 150; a posição sozinha usa 20).
// O jogo normal manda bem menos; quem passa disso tem o excesso ignorado. O que grava na conta custa mais.
const LIMITE = { porSeg: 90, max: 150, custo: { build: 20, visual: 20, aparencia: 10, mudarAparencia: 30, mudarVisual: 30, pronto: 20, barra: 10, atributo: 5, atributos: 5, item: 5, coletar: 5, criar: 5, lote: 10, venderLote: 10, mudarLote: 10, pagarTaxa: 5, construir: 5, desmontar: 5, horta: 3, troca: 3, fabricar: 5, bau: 3, forno: 3, amigo: 3, time: 3, chat: 10 } };
const salas = new Set(); // salas abertas (para tirar da sala quem apagou a conta)
// chat (André 2026-11-06): as últimas mensagens de cada canal ficam na memória para quem acabou de entrar (não vão para o disco)
const historicoChat = { geral: [], amigos: [], pm: [] }; // pm: mensagens privadas entre amigos (de todos juntos)

// Contas só com Google. Sem Client ID o servidor aceita qualquer um sem conta (como antes).
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;
const contas = CLIENT_ID ? new Contas({ pasta: path.resolve(process.env.DADOS || 'dados'), verificar: verificadorGoogle(CLIENT_ID) }) : null;
// Páginas que podem pedir login a este servidor (o jogo no GitHub Pages e o "npm run dev")
const ORIGENS = [/^https:\/\/rcandrerc\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/];

class SalaClareira extends Room {
  maxClients = 16;

  onCreate() {
    salas.add(this);
    this.sim = new Simulacao(MAPA_CLAREIRA);
    this.visao = new Visao(); // cada app Godot novo recebe só o que está perto do herói dele (server/visao.js)
    // Vila dos Lotes: dono, peças e horta guardados no servidor; a compra confere no banco (vale entre salas)
    if (contas) {
      this.sim.carregarLotes(contas.lotes());
      this.sim.aoComprarLote = (id, dono, nome, ret) => contas.reservarLote(id, dono, nome, ret, (o) => retTerreno(o.dados?.ret) || LOTES_ANTIGOS[o.id] || null);
      this.sim.aoVenderLote = (id) => contas.soltarLote(id);
      this.sim.aoMudarLote = (id, dono, ret) => contas.mudarLote(id, dono, ret, (o) => retTerreno(o.dados?.ret) || LOTES_ANTIGOS[o.id] || null);
    }
    this.ouvir('entrada', (c, m) => this.sim.entrada(c.sessionId, m || {}));
    this.ouvir('habilidade', (c, i) => { if (Number.isInteger(i) && i >= 0 && i <= 10) this.sim.usarHabilidade(c.sessionId, i); });
    this.ouvir('build', (c, b) => { this.sim.definirBuild(c.sessionId, b); if (contas && c.auth) contas.salvarBuild(c.auth.id, b); });
    // skills do Quimera (shared/progresso.js): usar, as duas barras de 6 botões e os pontos de atributo
    this.ouvir('habQ', (c, k) => {
      if (typeof k === 'string' && k.length < 32) this.sim.usarHabQ(c.sessionId, k);
      else if (k && typeof k.id === 'string' && k.id.length < 32) this.sim.usarHabQ(c.sessionId, { id: k.id, dx: Number(k.dx) || 0, dz: Number(k.dz) || 0, ...(Number.isInteger(k.v) ? { v: k.v } : {}) }); // v: alvo travado do mago
    });
    this.ouvir('cancelar', (c) => this.sim.cancelarCanal(c.sessionId)); // andou no meio da magia concentrada
    this.ouvir('barra', (c, b) => this.sim.definirBarra(c.sessionId, b)); // barra da espada ou do cajado
    this.ouvir('item', (c, m) => this.sim.item(c.sessionId, m)); // mochila: equipar, tirar, usar, comprar, vender
    // troca entre jogadores com cadeado (shared/simulacao.js troca): pedir, aceitar, pôr item e ouro, trancar e confirmar
    this.ouvir('troca', (c, m) => {
      if (!m || typeof m.acao !== 'string' || m.acao.length > 12) return;
      const int = (v) => (Number.isInteger(v) && v >= 0 && v < 1e9 ? v : undefined);
      this.sim.troca(c.sessionId, { acao: m.acao, com: typeof m.com === 'string' ? m.com.slice(0, 32) : undefined, i: int(m.i), n: int(m.n), o: int(m.o), v: m.v === true });
    });
    // amigos (até 20, ficam na conta) e time (shared/simulacao.js amigo/time): pedir, aceitar, recusar, remover, convidar, sair
    const texto = (v) => (typeof v === 'string' ? v.slice(0, 32) : undefined);
    this.ouvir('amigo', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 10) this.sim.amigo(c.sessionId, { acao: m.acao, com: texto(m.com), c: texto(m.c) }); });
    this.ouvir('time', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 10) this.sim.time(c.sessionId, { acao: m.acao, com: texto(m.com) }); });
    // amizade feita ou desfeita: grava na conta (as duas pontas); desfeita, avisa também as outras salas
    const idConta = (k) => (/^c\d+$/.test(k) ? Number(k.slice(1)) : null);
    this.sim.aoAmizade = (a, b, junta) => {
      const ia = idConta(a), ib = idConta(b);
      if (contas && ia != null && ib != null) {
        if (junta) return contas.fazerAmizade(ia, ib, AMIGOS.max);
        contas.desfazerAmizade(ia, ib);
      }
      if (!junta) for (const s of salas) if (s !== this) s.sim.esquecerAmigo(b, a);
      return true;
    };
    // o amigo está jogando em outra sala (a lista mostra "online")
    this.sim.onlineFora = (k) => { for (const s of salas) if (s !== this && s.sim.porConta(k)) return true; return false; };
    // chat geral (todo mundo online, em qualquer sala), de amigos e pm com um amigo (shared/simulacao.js chat): m = { canal, texto, para? }
    this.ouvir('chat', (c, m) => {
      if (!m || typeof m.canal !== 'string' || typeof m.texto !== 'string' || m.texto.length > 400) return;
      const msg = this.sim.chat(c.sessionId, { canal: m.canal, texto: m.texto, para: typeof m.para === 'string' ? m.para : undefined });
      if (!msg) return;
      const h = historicoChat[msg.canal];
      h.push(msg); if (h.length > (msg.canal === 'pm' ? CHAT.historicoPm : CHAT.historico)) h.shift();
      for (const s of salas) s.sim.receberChat(msg);
    });
    // profissões (Parte 3): coletar num veio ou árvore e criar pela receita (o servidor confere distância, vigor e materiais)
    this.ouvir('coletar', (c, m) => { if (m && typeof m.no === 'string' && m.no.length < 8) this.sim.coletar(c.sessionId, { no: m.no, parar: m.parar === true }); });
    // rar (André 2026-11-09): raridade escolhida na aba Criar (0 a 4); sem rar = a receita de sempre
    this.ouvir('criar', (c, m) => { if (m && typeof m.r === 'string' && m.r.length < 32) { const rar = Number.isInteger(m.rar) && m.rar > 0 && m.rar < 5 ? m.rar : 0; this.sim.criar(c.sessionId, Number.isInteger(m.n) ? { r: m.r, n: m.n, rar } : { r: m.r, rar }); } });
    // Vila dos Lotes (construção e fazenda do Quimera): comprar o lote, construir, desmontar e a horta
    // Terras: m = { x0, z0, x1, z1 } (o terreno que ele marcou arrastando o dedo)
    this.ouvir('lote', (c, m) => { if (m && typeof m === 'object') this.sim.comprarLote(c.sessionId, { x0: Number(m.x0), z0: Number(m.z0), x1: Number(m.x1), z1: Number(m.z1) }); });
    // 2026-11-05 (André): vender o terreno de volta para o jogo, mudar o tamanho e pagar a conta do correio
    this.ouvir('venderLote', (c) => this.sim.venderLote(c.sessionId));
    this.ouvir('mudarLote', (c, m) => { if (m && typeof m === 'object') this.sim.mudarLote(c.sessionId, { x0: Number(m.x0), z0: Number(m.z0), x1: Number(m.x1), z1: Number(m.z1) }); });
    this.ouvir('pagarTaxa', (c) => this.sim.pagarTaxa(c.sessionId));
    this.ouvir('construir', (c, m) => { if (m && typeof m.k === 'string' && m.k.length < 16) this.sim.construir(c.sessionId, { k: m.k, x: Number(m.x), z: Number(m.z), r: Number(m.r) | 0 }); });
    this.ouvir('desmontar', (c, m) => { if (m && typeof m.p === 'string' && m.p.length < 12) this.sim.desmontar(c.sessionId, { p: m.p }); });
    // construção completa (2026-11-04): criar a peça ou a ferramenta e mexer no baú
    this.ouvir('fabricar', (c, m) => {
      if (m && m.parar === true) this.sim.fabricar(c.sessionId, { parar: true });
      else if (m && typeof m.k === 'string' && m.k.length < 20) this.sim.fabricar(c.sessionId, { k: m.k, n: Number.isInteger(m.n) ? m.n : 1 });
    });
    this.ouvir('regador', (c) => this.sim.encherRegador(c.sessionId)); // encher no poço da vila ou na beira do lago
    // pescaria (igual ao Quimera, André 2026-11-08): lançar (onde a boia cai), puxar (o "!" e a briga) e recolher
    this.ouvir('pescar', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 8) this.sim.pescar(c.sessionId, { acao: m.acao, x: Number(m.x), z: Number(m.z) }); });
    // FASE 1 (André 2026-11-09): packs e transportes do Quimera (shared/transporte.js decide tudo)
    this.ouvir('pack', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 16) this.sim.pack(c.sessionId, { acao: m.acao, npc: String(m.npc || '').slice(0, 24), de: String(m.de || '').slice(0, 10), i: Number.isInteger(m.i) ? m.i : 0, g: String(m.g || '').slice(0, 12) }); });
    this.ouvir('veiculo', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 12) this.sim.veiculo(c.sessionId, { acao: m.acao, k: String(m.k || '').slice(0, 12), x: Number(m.x), z: Number(m.z), ry: Number(m.ry) }); });
    this.ouvir('dormir', (c) => this.sim.dormir(c.sessionId)); // dormir na cama do meu terreno (dia e noite do Quimera)
    this.ouvir('bau', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 10) this.sim.bau(c.sessionId, { acao: m.acao, i: Number.isInteger(m.i) ? m.i : -1 }); });
    this.ouvir('forno', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 10) this.sim.forno(c.sessionId, { acao: m.acao, p: String(m.p || '').slice(0, 20), lugar: String(m.lugar || '').slice(0, 6), i: Number.isInteger(m.i) ? m.i : -1, r: String(m.r || '').slice(0, 20), n: Number.isInteger(m.n) ? Math.max(1, Math.min(m.n, 99)) : 1 }); });
    this.ouvir('horta', (c, m) => { if (m && typeof m.acao === 'string' && typeof m.c === 'string' && m.c.length < 12) this.sim.horta(c.sessionId, { acao: m.acao, c: m.c, s: typeof m.s === 'string' ? m.s.slice(0, 16) : '' }); });
    this.ouvir('atributo', (c, k) => { if (typeof k === 'string') this.sim.distribuirAtributo(c.sessionId, k); });
    this.ouvir('atributos', (c, m) => this.sim.distribuirAtributos(c.sessionId, m)); // + e − no menu, aplica no Confirmar
    this.ouvir('nivelTeste', (c, m) => this.sim.nivelTeste(c.sessionId, m?.nv, m?.zerar === true)); // só a conta de teste do André (o sim confere)
    this.ouvir('resetar', (c) => this.sim.resetarBuild(c.sessionId)); // Mestre Ivo: atributos de volta (paga em ouro)
    this.ouvir('rolar', (c) => this.sim.rolar(c.sessionId));
    this.ouvir('pular', (c) => this.sim.pular(c.sessionId));
    this.ouvir('dash', (c) => this.sim.dash(c.sessionId));
    this.ouvir('aparencia', (c, a) => this.sim.definirAparencia(c.sessionId, a));
    this.ouvir('criando', (c, v) => this.sim.definirCriando(c.sessionId, v === true)); // no palco do criador: fora do mundo
    this.ouvir('modo', (c, m) => this.sim.trocarModo(c.sessionId, String(m)));
    this.ouvir('falar', (c, m) => this.sim.falar(c.sessionId, m)); // m opcional: { npc, conversa } (menu do NPC no app)
    this.ouvir('montar', (c) => this.sim.montar(c.sessionId));
    this.ouvir('vila', (c) => this.sim.voltarVila(c.sessionId)); // botão da casinha: canaliza e volta para a vila (recarga de 10 min)
    // posição que o celular decidiu (o servidor confere velocidade, altura e limite do mapa: Simulacao.posicaoCliente)
    this.ouvir('pos', (c, p) => this.sim.posicaoCliente(c.sessionId, p));
    // medidor de ping: devolve na hora o número que o jogo mandou (o jogo mede quanto tempo levou a volta)
    this.ouvir('ping', (c, t) => { if (Number.isFinite(t)) c.send('pong', t); });
    this.ouvir('visual', (c, v) => this.sim.trocarVisual(c.sessionId, String(v))); // só vale no criador
    // "Pronto" no criador: nome, corpo e aparência ficam gravados na conta e o criador não abre mais
    this.ouvir('pronto', (c, p) => {
      const r = this.sim.concluirCriacao(c.sessionId, p);
      if (r && contas && c.auth) contas.salvarPersonagem(c.auth.id, r);
    });
    // Mudar a aparência depois de criado (botão Aparência no menu do personagem do app): cores, altura e rosto; nome e corpo ficam
    this.ouvir('mudarAparencia', (c, a) => {
      const r = this.sim.mudarAparencia(c.sessionId, a);
      if (r && contas && c.auth) contas.salvarAparencia(c.auth.id, r);
    });
    // Trocar o corpo depois de criado (criador do app Godot: a Ruiva, os masculinos e os outros corpos, sem nome)
    this.ouvir('mudarVisual', (c, v) => {
      const r = this.sim.mudarVisual(c.sessionId, String(v));
      if (r && contas && c.auth) contas.salvarVisual(c.auth.id, r);
    });
    this.sim.aoTrocar = () => this.salvarProgressos(); // troca feita: as duas contas gravam na hora
    this.setSimulationInterval(() => this.tick(), TICK * 1000);
    this.clock.setInterval(() => this.salvarProgressos(), 15000); // nível, XP e skills vão para a conta
  }

  // Grava na conta o progresso de quem mudou desde a última vez
  salvarProgressos() {
    if (!contas) return;
    const porSessao = new Map(this.clients.map((c) => [c.sessionId, c.auth]));
    for (const { id, prog } of this.sim.progressosParaSalvar()) {
      const conta = porSessao.get(id) || this.contaDe?.get(id);
      if (conta) contas.salvarProgresso(conta.id, prog);
    }
    for (const l of this.sim.lotesParaSalvar()) contas.salvarLote(l); // lotes que mudaram (compra, peça, horta)
  }

  // Igual a onMessage, mas descarta o que passar do limite (cliente alterado inundando o servidor)
  ouvir(tipo, fn) {
    const custo = LIMITE.custo[tipo] || 1;
    this.onMessage(tipo, (c, m) => {
      const agora = Date.now(), b = (c.userData ||= {}).balde ||= { n: LIMITE.max, t: agora };
      b.n = Math.min(LIMITE.max, b.n + ((agora - b.t) / 1000) * LIMITE.porSeg); b.t = agora;
      if (b.n < custo) return;
      b.n -= custo;
      // mensagem que dá erro não derruba a sala nem desconecta ninguém (André 2026-11-07: "Usar" na bancada desconectava)
      try { fn(c, m); } catch (e) { console.error(`mensagem ${tipo} deu erro:`, e); }
    });
  }

  tick() {
    const eventos = this.sim.passo(TICK);
    const foto = this.sim.foto();
    let fotoJson = null;
    let perto = null; // área de interesse: preparada uma vez por passo, só se alguém pediu
    for (const c of this.clients) {
      if (c.userData?.aoi) {
        perto ??= this.visao.preparar(foto, eventos);
        c.send('mundoJ', this.visao.paraJogador(perto, c.sessionId));
        continue;
      }
      // avisos pessoais vão só para quem precisa
      const meus = eventos.filter((e) => !e.para || e.para === c.sessionId);
      // o app Godot pede em JSON (lá ler JSON é bem mais rápido que MessagePack); o site continua igual
      if (c.userData?.json) c.send('mundoJ', `{"foto":${fotoJson ??= JSON.stringify(foto)},"eventos":${JSON.stringify(meus)}}`);
      else c.send('mundo', { foto, eventos: meus });
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
    if (opcoes?.json === true) (client.userData ||= {}).json = true;
    if (opcoes?.json === true && opcoes?.aoi === true) client.userData.aoi = true; // só o que está perto (server/visao.js)
    const conta = contas ? client.auth : null;
    if (conta) {
      // a mesma conta abriu o jogo em outro aparelho ou aba: o antigo sai
      for (const outro of this.clients) if (outro !== client && outro.auth?.id === conta.id) {
        const vj = this.sim.jogadores.get(outro.sessionId);
        if (vj) { this.sim.guardarPosicao(vj); conta.progresso = vj.prog; } // o mais novo vale (com o lugar onde ele estava)
        (outro.userData ||= {}).substituido = true; outro.leave(4001);
      }
    }
    const nome = conta?.nome || String(opcoes?.nome || '').slice(0, 20) || `Andarilho ${this.clients.length}`;
    // com conta: o criador abre uma vez só, enquanto a conta não tem personagem; sem contas, o aparelho é quem sabe
    const podeCriar = conta ? !conta.visual : opcoes?.criando === true;
    this.sim.adicionarJogador(client.sessionId, nome, conta?.visual || opcoes?.visual, { podeCriar, aparencia: conta?.aparencia || opcoes?.aparencia, progresso: conta?.progresso, testador: !!conta?.testador, conta: conta?.id ?? null });
    if (conta) { const l = contas.loteDoDono('c' + conta.id); this.sim.esquecerLotesDe('c' + conta.id, l?.id); if (l) this.sim.carregarLotes([l]); } // o lote dele como está no banco
    this.sim.enviarLotes(client.sessionId); // Vila dos Lotes: todos os lotes e qual é o dele
    if (conta) (this.contaDe ||= new Map()).set(client.sessionId, conta);
    if (conta?.build) this.sim.definirBuild(client.sessionId, conta.build);
    if (conta) this.sim.definirAmigos(client.sessionId, contas.amigos(conta.id).map((a) => ({ c: 'c' + a.id, nome: a.nome })));
    this.sim.historicoChat(client.sessionId, historicoChat.geral, historicoChat.amigos, historicoChat.pm); // as últimas mensagens do chat
    if (podeCriar) this.sim.definirCriando(client.sessionId, true); // primeira vez: entra já no palco do criador
  }

  onDispose() { this.salvarProgressos(); salas.delete(this); }

  async onLeave(client, consentiu) {
    // Celular perde conexão o tempo todo: segura o personagem por 20 s para o jogador voltar
    if (!consentiu && !client.userData?.substituido) {
      try { await this.allowReconnection(client, 20); return; } catch { /* não voltou a tempo */ }
    }
    { const jj = this.sim.jogadores.get(client.sessionId); if (jj) this.sim.saiuComVeiculo(jj); } // dirigindo: o veículo fica onde ele parou
    this.salvarProgressos(); // grava antes de tirar o herói do mundo
    this.sim.removerJogador(client.sessionId);
    this.visao.esquecer(client.sessionId);
    this.contaDe?.delete(client.sessionId);
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
// Na Oracle: chave pública em /chave-do-servidor e atualização pelo pacote trancado (server/atualizar.js)
ligarAtualizacaoTrancada(app, path.dirname(fileURLToPath(import.meta.url)));

// ---------- conta (login com Google) ----------
app.use('/conta', (_req, res, next) => (contas ? next() : res.status(404).json({ erro: 'contas desligadas' })), express.json({ limit: '8kb' }));
const sessaoDe = (req) => (req.headers.authorization || '').replace(/^Bearer /, '');
app.post('/conta/entrar', async (req, res) => {
  const modo = ['criar', 'entrar'].includes(req.body?.modo) ? req.body.modo : undefined;
  try { res.json(await contas.entrar(req.body?.credencial, modo)); }
  catch (e) {
    if (e.semConta) return res.status(404).json({ erro: 'Essa conta Google ainda não tem personagem.', semConta: true });
    console.warn('Login recusado:', e.message); res.status(401).json({ erro: 'Não foi possível confirmar a conta Google.' }); }
});
app.get('/conta/eu', (req, res) => {
  const conta = contas.porSessao(sessaoDe(req));
  conta ? res.json({ conta }) : res.status(401).json({ erro: 'login' });
});
app.post('/conta/sair', (req, res) => { contas.sair(sessaoDe(req)); res.json({ ok: true }); });
// Ligar o app (APK) à conta: o app abre o site com ?vincular=CODIGO; quem fez login no site manda o código aqui
// e o app busca a sessão nova pelo mesmo código (vale 5 minutos e só uma vez). A senha do Google nunca passa pelo app.
const vinculos = new Map(); // codigo -> { sessao, ate }
const CODIGO = /^[A-Za-z0-9]{16,64}$/;
const limparVinculos = () => { const agora = Date.now(); for (const [k, v] of vinculos) if (v.ate < agora) vinculos.delete(k); };
app.post('/conta/vincular', (req, res) => {
  const conta = contas.porSessao(sessaoDe(req));
  if (!conta) return res.status(401).json({ erro: 'login' });
  const codigo = String(req.body?.codigo || '');
  if (!CODIGO.test(codigo)) return res.status(400).json({ erro: 'código inválido' });
  limparVinculos();
  if (vinculos.size > 500) return res.status(503).json({ erro: 'tente de novo' });
  vinculos.set(codigo, { sessao: contas.novaSessaoPara(conta.id), ate: Date.now() + 5 * 60 * 1000 });
  res.json({ ok: true });
});
app.get('/conta/vinculo/:codigo', (req, res) => {
  limparVinculos();
  const v = vinculos.get(String(req.params.codigo));
  if (!v) return res.status(404).json({ erro: 'ainda não' });
  vinculos.delete(String(req.params.codigo));
  res.json({ sessao: v.sessao });
});
// Apaga a conta de vez (personagem, build e sessões). Quem estiver jogando com ela sai da sala.
app.post('/conta/apagar', (req, res) => {
  const conta = contas.porSessao(sessaoDe(req));
  if (!conta) return res.status(401).json({ erro: 'login' });
  contas.apagar(conta.id);
  for (const sala of salas) for (const c of sala.clients) if (c.auth?.id === conta.id) { (c.userData ||= {}).substituido = true; c.leave(4002); }
  console.log(`Conta apagada: ${conta.id}`);
  res.json({ ok: true });
});

const servidor = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: servidor, pingInterval: 5000, pingMaxRetries: 4 }) });
gameServer.define('clareira', SalaClareira);
gameServer.listen(PORTA).then(() => console.log(`Servidor do RPG no ar: http://localhost:${PORTA}`));
