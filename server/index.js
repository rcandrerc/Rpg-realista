// Servidor do jogo: Node.js + Colyseus.
// Roda a simulação compartilhada 20 vezes por segundo e manda uma "foto" do mundo para todos.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import colyseus from 'colyseus';
import wsTransport from '@colyseus/ws-transport';
import { Simulacao, MAPA_CLAREIRA, GOOGLE_CLIENT_ID, retTerreno, LOTES_ANTIGOS, AMIGOS, CHAT, AMIGOS_VIRTUAIS, npcNoMundo, xpOfflineNpc, nomeValido, REINICIO, Leilao } from '@rpg/shared';
import { Contas, verificadorGoogle } from './contas.js';
import { Visao } from './visao.js';
import { pensarAmiga, testarChaveGroq, escreverDiario, dicaParaRegra } from './ia-amiga.js';
import { ligarAtualizacaoTrancada } from './atualizar.js';

const { Server, Room, ServerError } = colyseus;
const { WebSocketTransport } = wsTransport;

const PORTA = Number(process.env.PORT || 2567);
const TICK = 1 / 20;
// Limite de mensagens por jogador (balde que enche 90 por segundo, guarda até 150; a posição sozinha usa 20).
// O jogo normal manda bem menos; quem passa disso tem o excesso ignorado. O que grava na conta custa mais.
const LIMITE = { porSeg: 90, max: 150, custo: { amiga: 3, build: 20, visual: 20, aparencia: 10, mudarAparencia: 30, mudarVisual: 30, pronto: 20, barra: 10, atributo: 5, atributos: 5, item: 5, coletar: 5, criar: 5, lote: 10, venderLote: 10, mudarLote: 10, pagarTaxa: 5, construir: 5, desmontar: 5, horta: 3, troca: 3, fabricar: 5, bau: 3, forno: 3, amigo: 3, time: 3, chat: 10, leilao: 5, lentidao: 5 } };
const carga = { ms: 0, pico: 0, silencioMs: 0, engasgos: 0, picoPing: 0, picoPingT: 0 }; // tempo de cada passo da sala (média e pico) e o medidor de engasgo, aparecem em /saude
const salas = new Set(); // salas abertas (para tirar da sala quem apagou a conta)
// a conta já está jogando (ligada agora) em alguma sala, por outro aparelho (outra sessão de login: cada aparelho tem a
// sua). O próprio aparelho com um socket velho que o servidor ainda não viu cair não conta: esse sai como sempre saiu
const contaLigadaEmOutro = (id, sessao) => [...salas].some((s) => s.clients.some((c) => c.auth?.id === id && c.userData?.sessao !== sessao));
// '__proto__', 'constructor' e 'prototype' como texto ou chave numa mensagem do cliente: nunca é dado de jogo e serve para
// mexer no Object.prototype (auditoria 2026-11-13). A mensagem inteira é descartada.
const PROIBIDO = new Set(['__proto__', 'constructor', 'prototype']);
function temChavePerigosa(m, d = 0) {
  if (typeof m === 'string') return PROIBIDO.has(m);
  if (!m || typeof m !== 'object' || d > 5) return false;
  for (const k in m) if (PROIBIDO.has(k) || temChavePerigosa(m[k], d + 1)) return true;
  return false;
}
// queda (André 2026-11-12): conta -> hora (ms) da última posição que o servidor recebeu dela antes de cair. Entrando de novo,
// o caminho andado sem internet vale (Simulacao.folgaDaQueda), em vez de puxar o herói de volta
const saidas = new Map();
const ultimaNoticia = (sim, j) => Date.now() - Math.max(0, sim.tempo - (j.vivoT ?? sim.tempo)) * 1000;
// chat (André 2026-11-06): as últimas mensagens de cada canal ficam na memória para quem acabou de entrar (não vão para o disco)
const historicoChat = { geral: [], amigos: [], pm: [], time: [] }; // pm: mensagens privadas entre amigos (de todos juntos)

// Contas só com Google. Sem Client ID o servidor aceita qualquer um sem conta (como antes).
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;
const contas = CLIENT_ID ? new Contas({ pasta: path.resolve(process.env.DADOS || 'dados'), verificar: verificadorGoogle(CLIENT_ID) }) : null;
// a Casa do Comércio (shared/leilao.js; história v2, Entrega 3): um leilão só para todas as salas, guardado no banco
const leilao = new Leilao(contas?.lerMundo('leilao'));
// Páginas que podem pedir login a este servidor (o jogo no GitHub Pages e o "npm run dev")
const ORIGENS = [/^https:\/\/rcandrerc\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/];

class SalaClareira extends Room {
  maxClients = 16;

  // a mensagem chegou a um NPC amigo (Cecília, Dario, aventureiros): a IA grátis pensa a resposta; sem IA, as regras (shared/amiga.js).
  // viaTime: veio do chat de time, então a resposta dele também vai para o time
  falarComAmigoIa(c, amg, msg, viaTime) {
    const id = c.sessionId, ctx = amg.contextoAmiga(id), conta = this.contaDe?.get(id);
    if (ctx && viaTime) ctx.time = this.sim.amigosIaNoTime(id).filter((x) => x !== amg).map((x) => x.AMIGA.nome); // conversa em grupo
    amg.ouvirAmiga(id, msg.texto);
    amg.amiga.ia.viaTime = viaTime ? this.sim.tempo + CHAT.respostaTime : 0; // do time: responde no time; do privado: no privado
    // dica de combate (André 2026-11-11): a IA é chamada uma vez e devolve a regra; esquecer/listar dicas vai pelas regras
    const tipoDica = amg.tipoDicaAmiga(msg.texto), chaveDe = conta && contas ? contas.chaveIa(conta.id) : '';
    if (tipoDica === 'esquecer' || tipoDica === 'listar') { amg.comandoDicaAmiga(id, tipoDica, msg.texto); return; }
    // a chave Groq de quem escreveu paga a resposta (André 2026-11-10); as contas de teste usam a do servidor
    const conversar = () => pensarAmiga(ctx, msg.texto, chaveDe).then((r) => {
      const regra = amg.assuntoAmiga(msg.texto);
      // a IA não achou ação: vale a das regras (ex.: "vem cá" que a IA tratou como conversa)
      if (['presente', 'pedirItem'].includes(regra)) return amg.respostaAmiga(id, { assunto: regra }); // troca aberta: quem decide são as regras (fase 3)
      // pedido claro de ação (time, sair, vir) vale sempre pelas regras, para a fala e a ação baterem (André 2026-11-09)
      let acao = ['time', 'sairTime', 'vir', 'pescar', 'minerar', 'lenha', 'pararAtividade', 'naoAcao'].includes(regra) ? regra : r?.assunto === 'conversa' && ['sim', 'nao'].includes(regra) ? regra : r?.assunto;
      // André 2026-11-12: a regra só passa por cima da IA em pedido de verdade (curto e que muda algo); senão vale a fala da IA
      if (r && acao === regra && regra !== r.assunto && !amg.regraValeSobreIaAmiga(id, regra, msg.texto, r.assunto)) acao = amg.acaoSemEfeitoAmiga(id, r.assunto) ? 'conversa' : r.assunto;
      if (r && acao === r.assunto && amg.acaoSemEfeitoAmiga(id, acao)) acao = 'conversa';
      if (r && ['vir', 'time'].includes(acao) && amg.apelidoAmiga(msg.texto)) acao = 'conversa'; // "me chama de fofinha": apelido, não chamado // "bora!" de quem já está no time: só conversa, com a fala da IA
      amg.respostaAmiga(id, r ? { assunto: acao, iaAssunto: r.assunto, fala: acao === r.assunto || acao === 'conversa' || r.assunto === 'conversa' || r.assunto === 'nao' ? r.fala : '' } : { assunto: regra });
    }).catch((e) => console.error('amigo IA: resposta deu erro', e));
    // parecia dica mas a IA não montou regra (ou era só conversa com "se"/"perto"): responde como conversa normal
    if (tipoDica === 'dica') dicaParaRegra(msg.texto, amg.AMIGA.nome, chaveDe).then((regra) => { if (!regra || !amg.aprenderDicaAmiga(id, regra, msg.texto)) conversar(); }).catch((e) => console.error('amigo IA: dica deu erro', e));
    else conversar();
  }
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
      this.sim.iaPorChave = true;
      // memória da Cecília: o diário de cada conversa é escrito com a chave de quem conversou (as contas de teste: a do servidor)
      this.sim.aoDiarioAmiga = (d) => escreverDiario(d, /^c\d+$/.test(d.conta) ? contas.chaveIa(Number(d.conta.slice(1))) : '').then((r) => {
        const ctx = this.sim.amigoIaDe(d.amigo) || this.sim; // Cecília ou Dario (André 2026-11-11)
        if (!r || ctx.amiga) return r;
        ctx.anotarAmiga(d.conta, r); // ela já saiu (a sala pode até ter fechado): grava direto no banco
        for (const l of this.sim.lotesParaSalvar()) contas.salvarLote(l);
        return null;
      }); // a Cecília aparece na lista para todos; quem não tem chave vê "Ativar conversa com IA"
    }
    // bosses de mundo (André 2026-11-11): a hora de voltar de cada um fica no banco (vale para todas as salas e depois de
    // reiniciar); nasceu, caiu ou soltou Mítico: aviso no chat geral de todo mundo online
    if (contas) this.sim.nivelTetoNpc = contas.nivelMaisAlto(); // NPCs nunca passam do jogador mais alto (André 2026-11-11)
    if (contas && salas.size === 1) this.npcsForaDoMundo(true); // primeira sala aberta: os aventureiros fora do mundo evoluem pelo tempo vazio
    if (contas) { this.sim.carregarBosses(contas.lerMundo('bosses')); this.sim.aoBosses = (est) => contas.gravarMundo('bosses', est); }
    // leilão: o mesmo em todas as salas; mudou, grava. Vendeu: avisa o dono, esteja em que sala estiver
    this.sim.leilao = leilao;
    if (contas) this.sim.aoLeilao = (L) => contas.gravarMundo('leilao', L.estado());
    this.sim.aoVendaLeilao = (conta, texto) => { for (const s of salas) { const v = s.sim.porConta(conta); if (v) s.sim.evento({ t: 'aviso', para: v.id, texto }); } };
    this.sim.aoAnuncio = (msg) => {
      const h = historicoChat.geral; h.push(msg); if (h.length > CHAT.historico) h.shift();
      for (const s of salas) s.sim.receberChat(msg);
    };
    this.sim.aoAnuncioTela = (ev) => { for (const s of salas) s.sim.evento({ ...ev }); }; // bosses de mundo: faixa na tela, fora do chat
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
    this.ouvir('leilao', (c, m) => this.sim.leilaoMsg(c.sessionId, m)); // Casa do Comércio (Otávio, Rio Claro)
    // troca entre jogadores com cadeado (shared/simulacao.js troca): pedir, aceitar, pôr item e ouro, trancar e confirmar
    this.ouvir('troca', (c, m) => {
      if (!m || typeof m.acao !== 'string' || m.acao.length > 12) return;
      const int = (v) => (Number.isInteger(v) && v >= 0 && v < 1e9 ? v : undefined);
      this.sim.troca(c.sessionId, { acao: m.acao, com: typeof m.com === 'string' ? m.com.slice(0, 32) : undefined, i: int(m.i), n: int(m.n), o: int(m.o), v: m.v === true });
    });
    // amigos (até 20, ficam na conta) e time (shared/simulacao.js amigo/time): pedir, aceitar, recusar, remover, convidar, sair
    const texto = (v) => (typeof v === 'string' ? v.slice(0, 32) : undefined);
    this.ouvir('verEquip', (c, m) => { if (m && typeof m.com === 'string' && m.com.length < 40) this.sim.verEquip(c.sessionId, { com: m.com }); }); // ver o equipamento de quem está perto
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
      // mensagem para a Cecília (amiga virtual do dono): a IA grátis pensa a resposta; sem IA, as regras (shared/amiga.js)
      const amg = msg.canal === 'pm' ? this.sim.amigoIaDe(msg.alvo) : null; // Cecília ou Dario (André 2026-11-11), cada um com a sua cabeça
      if (amg && amg.amiga) this.falarComAmigoIa(c, amg, msg, false);
      // chat de time (André 2026-11-11): cada NPC do time (Cecília, Dario, aventureiros) ouve como se fosse no privado (dicas e comandos valem para todos)
      if (msg.canal === 'time') {
        const chamados = this.sim.amigosIaChamados(c.sessionId, msg.texto);
        for (const ctx of this.sim.amigosIaNoTime(c.sessionId)) if (chamados.includes(ctx)) this.falarComAmigoIa(c, ctx, msg, true); else ctx.ouvirAmiga(c.sessionId, msg.texto);
      }
    });
    // "Ativar conversa com IA" (André 2026-11-10): o jogador cria a chave grátis no Groq e cola no jogo uma vez só.
    // O servidor testa e guarda na conta dele (server/contas.js); ninguém precisa mandar chave para o André.
    this.ouvir('chaveIa', async (c, m) => {
      const conta = this.contaDe?.get(c.sessionId), aviso = (texto) => this.sim.evento({ t: 'aviso', para: c.sessionId, texto });
      if (!contas || !conta || typeof m?.chave !== 'string' || m.chave.length > 200 || c.userData?.testandoChave) return;
      const chave = m.chave.trim();
      (c.userData ||= {}).testandoChave = true;
      const ok = await testarChaveGroq(chave).finally(() => { c.userData.testandoChave = false; });
      if (!this.sim.jogadores.has(c.sessionId)) return;
      if (!ok) return aviso('Essa chave não funcionou. Copie de novo em console.groq.com/keys (começa com gsk_)');
      contas.salvarChaveIa(conta.id, chave);
      conta.ia = true;
      this.entrarAmiga(c);
      aviso(`Pronto! Agora você pode conversar com ${AMIGOS_VIRTUAIS.filter(npcNoMundo).map((d) => d.nome).join(' e ')}`);
    });
    // as falas da Cecília no chat entram no histórico (quem volta ao jogo vê a conversa) e vão para o dono
    this.sim.aoChatAmiga = (msg) => { const h = historicoChat[msg.canal] || historicoChat.pm; h.push(msg); if (h.length > (msg.canal === 'pm' ? CHAT.historicoPm : CHAT.historico)) h.shift(); this.sim.receberChat(msg); }; // no privado ou no time
    // profissões (Parte 3): coletar num veio ou árvore e criar pela receita (o servidor confere distância, vigor e materiais)
    this.ouvir('coletar', (c, m) => { if (m && typeof m.no === 'string' && m.no.length < 8) this.sim.coletar(c.sessionId, { no: m.no, parar: m.parar === true }); });
    this.ouvir('criar', (c, m) => { if (m && typeof m.r === 'string' && m.r.length < 32) this.sim.criar(c.sessionId, Number.isInteger(m.n) ? { r: m.r, n: m.n } : { r: m.r }); });
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
    this.ouvir('falar', (c, m) => this.sim.falar(c.sessionId, m));
    // Cecília (shared/amiga.js): só o dono recebe resposta; os outros não conversam com ela
    this.ouvir('amiga', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 12) (this.sim.amigoIaDe(typeof m.id === 'string' ? m.id : '') || this.sim).conversaAmiga(c.sessionId, { acao: m.acao }); }); // m.id: qual amigo (Cecília ou Dario); sem id, a Cecília // m opcional: { npc, conversa } (menu do NPC no app)
    this.ouvir('montar', (c) => this.sim.montar(c.sessionId));
    this.ouvir('vila', (c) => this.sim.voltarVila(c.sessionId)); // botão da casinha: canaliza e volta para a vila (recarga de 10 min)
    this.ouvir('totem', (c, m) => { if (m && typeof m.para === 'string' && m.para.length < 24) this.sim.irTotem(c.sessionId, m.para); }); // totem de teleporte: vai para outro já descoberto (paga a taxa)
    // posição que o celular decidiu (o servidor confere velocidade, altura e limite do mapa: Simulacao.posicaoCliente)
    // medidor (André 2026-11-12, ping de 20000): o maior silêncio entre duas posições e quantos engasgos de mais de 1 s
    // (aparecem em /saude: se o servidor está folgado e o silêncio é grande, o atraso está na internet ou no celular)
    this.ouvir('pos', (c, p) => {
      const agora = Date.now(), u = (c.userData ||= {});
      if (u.posT) {
        const gap = agora - u.posT; if (gap > carga.silencioMs) carga.silencioMs = gap; if (gap > 1000) carga.engasgos++;
        if (gap > (u.gapJan || 0) || agora - (u.gapJanT || 0) > 3000) { u.gapJan = gap; u.gapJanT = agora; } // maior silêncio dos últimos ~3 s (/lentidao)
      }
      u.posT = agora;
      this.sim.posicaoCliente(c.sessionId, p);
    });
    // lentidão (André 2026-11-13, "slow motion correndo com lobo"): o app anota sozinho o segundo ruim (godot-prototipo/
    // lentidao.gd) e manda; aqui junta o que o servidor sabia na hora (pior passo dos últimos ~3 s, maior silêncio de
    // posição desse celular) e guarda para ver em /lentidao. Só números, sem nome nem conta.
    this.ouvir('lentidao', (c, e) => guardarLentidao(c, e, this));
    // medidor de ping: devolve na hora o número que o jogo mandou (o jogo mede quanto tempo levou a volta)
    // e o pior passo do servidor nos últimos ~3 s (app Godot: aviso "Servidor lento" no lugar do ping; André 2026-11-12)
    this.ouvir('ping', (c, t) => { if (Number.isFinite(t)) { c.send('pong', t); if (c.userData?.json) c.send('carga', { pico: Math.round(carga.picoPing) }); } });
    this.ouvir('visual', (c, v) => this.sim.trocarVisual(c.sessionId, String(v))); // só vale no criador
    // "Pronto" no criador: nome, corpo e aparência ficam gravados na conta e o criador não abre mais
    this.ouvir('pronto', (c, p) => {
      // nome único (André 2026-11-10): se já é de outra conta, o criador abre de novo com o aviso
      const n = nomeValido(p?.nome);
      if (n && contas && c.auth && !contas.nomeLivre(n, c.auth.id)) return this.sim.evento({ t: 'nomeUsado', para: c.sessionId, nome: n, texto: `O nome ${n} já é de outro jogador. Escolha outro.` });
      const r = this.sim.concluirCriacao(c.sessionId, p);
      if (r && contas && c.auth) contas.salvarPersonagem(c.auth.id, r);
    });
    // Mudar a aparência depois de criado (botão Aparência no menu do personagem do app): cores, altura e rosto; nome e corpo ficam
    this.ouvir('mudarAparencia', (c, a) => {
      const r = this.sim.mudarAparencia(c.sessionId, a);
      if (r && contas && c.auth) contas.salvarAparencia(c.auth.id, r);
    });
    // Trocar o nome depois de criado, pagando NOME.troca de ouro (André 2026-11-10); só com conta (o nome fica nela)
    this.ouvir('trocarNome', (c, n) => {
      if (!contas || !c.auth) return this.sim.evento({ t: 'aviso', para: c.sessionId, texto: 'Trocar o nome só com conta, jogando online' });
      const r = this.sim.trocarNome(c.sessionId, n, (nome) => contas.nomeLivre(nome, c.auth.id));
      if (r) { contas.salvarNome(c.auth.id, r); this.salvarProgressos(); } // o ouro gasto grava junto
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
    for (const ctx of this.sim.amigosIa) ctx.guardarAmiga(); // Cecília e Dario: bolsa, ouro e amizade vão junto com o terreno de cada um
    const porSessao = new Map(this.clients.map((c) => [c.sessionId, c.auth]));
    for (const { id, prog } of this.sim.progressosParaSalvar()) {
      const conta = porSessao.get(id) || this.contaDe?.get(id);
      if (conta) contas.salvarProgresso(conta.id, prog);
    }
    for (const l of this.sim.lotesParaSalvar()) contas.salvarLote(l); // lotes que mudaram (compra, peça, horta)
    for (const n of this.sim.npcsParaSalvar()) contas.gravarMundo('npc:' + n.id, n.dados); // aventureiros sem casa
  }

  // Igual a onMessage, mas descarta o que passar do limite (cliente alterado inundando o servidor)
  ouvir(tipo, fn) {
    const custo = LIMITE.custo[tipo] || 1;
    this.onMessage(tipo, (c, m) => {
      const agora = Date.now(), b = (c.userData ||= {}).balde ||= { n: LIMITE.max, t: agora };
      b.n = Math.min(LIMITE.max, b.n + ((agora - b.t) / 1000) * LIMITE.porSeg); b.t = agora;
      if (b.n < custo) return;
      b.n -= custo;
      if (temChavePerigosa(m)) return; // '__proto__' e companhia nunca são dado de jogo (auditoria 2026-11-13)
      // mensagem que dá erro não derruba a sala nem desconecta ninguém (André 2026-11-07: "Usar" na bancada desconectava)
      try { const r = fn(c, m); if (r && typeof r.catch === 'function') r.catch((e) => console.error(`mensagem ${tipo} deu erro:`, e)); } catch (e) { console.error(`mensagem ${tipo} deu erro:`, e); }
    });
  }

  tick() {
    const t0 = performance.now();
    // um erro no passo não derruba o servidor inteiro (auditoria 2026-11-13): registra (no máximo 1 vez a cada 5 s) e segue
    try { this.tickDeVerdade(); } catch (e) { if (Date.now() - (this.erroTickT || 0) > 5000) { this.erroTickT = Date.now(); console.error('passo da sala deu erro:', e); } } finally {
      const ms = performance.now() - t0, agora = Date.now(); carga.ms = carga.ms * 0.98 + ms * 0.02; if (ms > carga.pico) carga.pico = ms;
      // segundos do jogo por segundo de verdade nos últimos ~5 s (vai junto em /lentidao)
      if (!this.relT) { this.relT = agora; this.relSim = this.sim.tempo; } else if (agora - this.relT >= 5000) { this.relogio = (this.sim.tempo - this.relSim) / ((agora - this.relT) / 1000); this.relT = agora; this.relSim = this.sim.tempo; }
      if (ms > carga.picoPing || agora - carga.picoPingT > 3000) { carga.picoPing = ms; carga.picoPingT = agora; } // janela de ~3 s para o aviso no app
    }
  }

  tickDeVerdade() {
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
    // André 2026-11-13 (PC e celular na mesma conta ficavam se derrubando): o último login vale. Entrada automática
    // (o app tentando voltar sozinho depois de uma queda, volta: true) não derruba o aparelho que entrou depois: é recusada
    // e o app mostra "Sua conta entrou em outro aparelho" sem tentar de novo. Entrar tocando no botão continua derrubando
    if (opcoes?.volta === true && contaLigadaEmOutro(conta.id, opcoes.sessao)) throw new ServerError(4001, 'outro_aparelho');
    return conta;
  }

  onJoin(client, opcoes) {
    if (opcoes?.json === true) (client.userData ||= {}).json = true;
    if (typeof opcoes?.sessao === 'string') (client.userData ||= {}).sessao = opcoes.sessao; // de qual aparelho (contaLigadaEmOutro)
    if (opcoes?.json === true && opcoes?.aoi === true) client.userData.aoi = true; // só o que está perto (server/visao.js)
    const conta = contas ? client.auth : null;
    const velhos = [], fantasmas = []; // sessões antigas da mesma conta: o herói novo fica com o time e os amigos delas (trocarSessao)
    if (conta) {
      // a mesma conta abriu o jogo em outro aparelho ou aba: o antigo sai
      for (const outro of this.clients) if (outro !== client && outro.auth?.id === conta.id) {
        const vj = this.sim.jogadores.get(outro.sessionId);
        if (vj) { this.sim.saiuComVeiculo(vj); this.sim.guardarPosicao(vj); conta.progresso = vj.prog; saidas.set(conta.id, ultimaNoticia(this.sim, vj)); velhos.push(vj.id); } // o mais novo vale (com o lugar onde ele estava)
        (outro.userData ||= {}).substituido = true; outro.leave(4001);
      }
      // a mesma conta numa outra sala (salas cheias abrem outra): também sai, e o progresso dela vem junto
      for (const s of salas) if (s !== this) for (const outro of s.clients) if (outro.auth?.id === conta.id) {
        const vj = s.sim.jogadores.get(outro.sessionId);
        if (vj) { s.sim.saiuComVeiculo(vj); s.sim.guardarPosicao(vj); conta.progresso = vj.prog; }
        (outro.userData ||= {}).substituido = true; outro.leave(4001);
      }
      // o servidor já tinha visto a queda: o herói antigo está no mundo esperando reconexão (allowReconnection, 20 s) e
      // o jogo entrou de novo como sessão nova. O novo herda o progresso e o lugar dele (antes vinham do banco, de até
      // 15 s atrás, e o antigo ficava 20 s no mundo como fantasma)
      const vivos = new Set(this.clients.map((o) => o.sessionId));
      for (const vj of [...this.sim.jogadores.values()]) if (!vj.bot && vj.conta === 'c' + conta.id && vj.id !== client.sessionId && !vivos.has(vj.id)) {
        this.sim.saiuComVeiculo(vj); this.sim.guardarPosicao(vj); conta.progresso = vj.prog; saidas.set(conta.id, ultimaNoticia(this.sim, vj));
        velhos.push(vj.id); fantasmas.push(vj.id); // sai do mundo logo abaixo, depois de passar o time e os amigos para o novo
        // o aparelho antigo não pode mais voltar como esse herói (André 2026-11-13): sem isso ele religava num herói que
        // já saiu do mundo; agora a volta falha, ele tenta entrar de novo (volta: true) e o onAuth recusa
        const espera = this.esperas?.get(vj.id); if (espera) { this.esperas.delete(vj.id); espera.reject(new Error('substituido')); }
      }
    }
    const nome = conta?.nome || String(opcoes?.nome || '').slice(0, 20) || `Andarilho ${this.clients.length}`;
    // com conta: o criador abre uma vez só, enquanto a conta não tem personagem; sem contas, o aparelho é quem sabe
    const podeCriar = conta ? !conta.visual : opcoes?.criando === true;
    this.sim.adicionarJogador(client.sessionId, nome, conta?.visual || opcoes?.visual, { podeCriar, aparencia: conta?.aparencia || opcoes?.aparencia, progresso: conta?.progresso, testador: !!conta?.testador, conta: conta?.id ?? null });
    // voltou de uma queda (a conta saiu há pouco): o caminho que andou sem internet vale
    if (conta && saidas.has(conta.id)) { const seg = (Date.now() - saidas.get(conta.id)) / 1000; saidas.delete(conta.id); if (seg < 120) this.sim.folgaDaQueda(client.sessionId, seg); }
    if (conta) { const l = contas.loteDoDono('c' + conta.id); this.sim.esquecerLotesDe('c' + conta.id, l?.id); if (l) this.sim.carregarLotes([l]); } // o lote dele como está no banco
    this.sim.enviarLotes(client.sessionId); // Vila dos Lotes: todos os lotes e qual é o dele
    if (conta) (this.contaDe ||= new Map()).set(client.sessionId, conta);
    if (conta?.build) this.sim.definirBuild(client.sessionId, conta.build);
    if (conta) this.sim.definirAmigos(client.sessionId, contas.amigos(conta.id).map((a) => ({ c: 'c' + a.id, nome: a.nome })));
    this.sim.historicoChat(client.sessionId, historicoChat.geral, historicoChat.amigos, historicoChat.pm, historicoChat.time); // as últimas mensagens do chat
    if (podeCriar) this.sim.definirCriando(client.sessionId, true);
    // Cecília (André 2026-11-09): entra na sala junto com o dono (as contas de teste do André; sem contas, o primeiro
    // que entra) e sai quando ele sai. O terreno dela vem do banco do jeito que está (outra sala pode ter mexido).
    // 2026-11-10: e também quem ativou a conversa com IA (a chave Groq dele); ela fica enquanto tiver um deles na sala
    // André 2026-11-11 ("quero que eles andem sozinhos"): os NPCs vivem no mundo para todos da sala; conversar, só com chave
    this.entrarAmiga(client, conta ? !!(conta.testador || conta.ia) : !this.sim.amiga); // primeira vez: entra já no palco do criador
    // queda curta (André 2026-11-12): o time e a Cecília/Dario continuam com ele, nada se desfaz
    for (const id of velhos) this.sim.trocarSessao(id, client.sessionId);
    for (const id of fantasmas) { this.sim.removerJogador(id); this.visao.esquecer(id); }
  }

  // Religou na mesma sessão (o app guarda o token de reconexão; André 2026-11-12, internet caindo): o herói ficou no
  // mundo do jeito que estava (buffs, recargas, time, amigos). Durante a queda os eventos se perderam e o app limpou
  // o que é da sala: manda de novo o progresso, o time, os amigos e os lotes, e a área de interesse recomeça (todos os
  // corpos perto vêm inteiros). O caminho andado sem internet vale (folgaDaQueda), como na sessão nova. A troca é
  // desfeita, como sempre foi numa queda (o app já fechou a janela dela).
  voltouNaMesmaSessao(client) {
    const id = client.sessionId, j = this.sim.jogadores.get(id); if (!j) return;
    if (j.troca) this.sim.fecharTroca(j.troca, `${j.nome} perdeu a conexão: a troca foi desfeita`);
    this.sim.folgaDaQueda(id, (Date.now() - ultimaNoticia(this.sim, j)) / 1000);
    this.visao.esquecer(id);
    this.sim.avisarProg(j);
    if (j.time) this.sim.enviarTime(j.time);
    this.sim.enviarAmigos(j);
    this.sim.enviarLotes(id);
  }

  // Cecília na sala para quem pode conversar com ela (shared/amiga.js amigaEntrar)
  entrarAmiga(client, fala = true) {
    for (const ctx of this.sim.amigosIa) { // a Cecília, o Dario e os 20 aventureiros (André 2026-11-11), cada um com o seu save
      if (contas && !ctx.amiga) {
        if (ctx.AMIGA.terreno) { const l = contas.loteDoDono(ctx.AMIGA.conta); if (l) this.sim.carregarLotes([l]); }
        else this.sim.carregarNpc(ctx.AMIGA.id, contas.lerMundo('npc:' + ctx.AMIGA.id)); // sem casa: o save fica na tabela mundo
      }
      ctx.amigaEntrar(client.sessionId, fala);
    }
    this.sim.enviarLotes(client.sessionId);
  }

  onDispose() { this.salvarProgressos(); salas.delete(this); if (contas && !salas.size) this.npcsForaDoMundo(false); }
  // Aventureiros fora do mundo (NPCS_NO_MUNDO, André 2026-11-12): sem corpo com gente jogando; só evoluem com a sala
  // vazia. Abrindo a primeira sala: ganha o XP do tempo vazio (xpOfflineNpc) e marca a hora. Fechando a última: só marca
  // a hora (o tempo com gente jogando não conta). Save sem progresso ainda: só a hora (ao entrar no mundo, começa no nível
  // da lista e o offlineAmiga conta dali).
  npcsForaDoMundo(abrindo) {
    try {
      for (const d of AMIGOS_VIRTUAIS) {
        if (npcNoMundo(d) || d.terreno) continue;
        const k = 'npc:' + d.id, salvo = contas.lerMundo(k) || {};
        if (abrindo && salvo.prog && Number.isFinite(salvo.t)) xpOfflineNpc(salvo.prog, salvo.t, this.sim.nivelTetoNpc);
        contas.gravarMundo(k, { ...salvo, t: Date.now() });
      }
    } catch (e) { console.warn('npcsForaDoMundo:', e.message); }
  }

  async onLeave(client, consentiu) {
    // Celular perde conexão o tempo todo: segura o personagem por 20 s para o jogador voltar
    if (!consentiu && !client.userData?.substituido) {
      const espera = this.allowReconnection(client, 20);
      (this.esperas ||= new Map()).set(client.sessionId, espera); // a conta entrou de novo por outro caminho: onJoin desiste da espera
      try { await espera; this.esperas.delete(client.sessionId); this.voltouNaMesmaSessao(client); return; } catch { this.esperas.delete(client.sessionId); /* não voltou a tempo, ou foi trocado */ }
    }
    { const jj = this.sim.jogadores.get(client.sessionId); if (jj) this.sim.saiuComVeiculo(jj); } // dirigindo: o veículo fica onde ele parou
    { const jj = this.sim.jogadores.get(client.sessionId); if (jj && client.auth?.id != null && !client.userData?.substituido) saidas.set(client.auth.id, ultimaNoticia(this.sim, jj)); } // queda: a hora da última notícia
    this.salvarProgressos(); // grava antes de tirar o herói do mundo
    for (const ctx of this.sim.amigosIa) ctx.amigaSair(client.sessionId); // NPCs: quem saiu deixa de ser acompanhado; o último da sala leva todos junto
    this.salvarProgressos();
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
// lentidões anotadas pelos apps (lentidao.gd): as últimas LENTIDAO_MAX na memória e num arquivo da pasta de dados
const LENTIDAO_MAX = 300;
const LENTIDAO_ARQ = path.resolve(process.env.DADOS || 'dados', 'lentidao.jsonl');
// min..nos (2026-11-14): minutos de jogo, memória (MB), ms da placa/processador no último quadro, calor do Android
// (term 0-6, folga, bat °C) e nós na cena; dnos/dres = nós e recursos que entraram ou saíram no segundo ruim
const COMUM_CAMPOS = ['min', 'mem', 'vmem', 'livre', 'gpu', 'cpu', 'term', 'folga', 'bat', 'nos'];
const LENTIDAO_CAMPOS = ['quando', 'fps', 'pior', 'relogio', 'escala', 'pedido', 'andou', 'andou_lobo', 'mov', 'bloq', 'corr', 'corr_m', 'foto_ms', 'ping', 'x', 'z', 'grafico', 'limite', 'paralelo', 'proc', 'cham', 'tri', 'obj', 'rumo', 'pip', ...COMUM_CAMPOS, 'dnos', 'dres'];
const lentidoes = [];
let lentidaoLinhas = 0; // linhas no arquivo desde a última reescrita (passou de 2x o máximo: reescreve só as últimas)
try { for (const l of fs.readFileSync(LENTIDAO_ARQ, 'utf8').trim().split('\n').slice(-LENTIDAO_MAX)) if (l) lentidoes.push(JSON.parse(l)); } catch { /* ainda não tem */ }
const ENTRADA_CAMPOS = ['ini', 'pronto', 'escolha', 'toque', 'conectado', 'foto', 'fila', 'aquecer', 'capa', 'grafico'];
const MENU_CAMPOS = ['abrir', 'quadro', 'quadro2', 'itens', 'limite', 'grafico', 'pip', 'espera'];
const RESUMO_CAMPOS = ['fps', 'pior', 'proc', 'lentas', 'x', 'z', 'grafico', 'limite', 'cham', 'tri', 'obj', ...COMUM_CAMPOS];
// o que pesou no segundo ruim (lentidao.gd ev): {nome: [vezes, ms]}, no máximo 8 nomes curtos
function eventosLentidao(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const r = {};
  let n = 0;
  for (const [k, a] of Object.entries(v)) {
    if (++n > 8) break;
    if (typeof k === 'string' && k.length < 20 && Array.isArray(a) && a.length === 2 && Number.isFinite(a[0]) && Number.isFinite(a[1])) r[k] = [a[0], a[1]];
  }
  return Object.keys(r).length ? r : null;
}
// resumo de cada minuto (lentidao.gd _resumo): fica numa lista só dele, para não empurrar as travadas para fora
const RESUMO_MAX = 600;
const RESUMO_ARQ = path.resolve(process.env.DADOS || 'dados', 'lentidao-resumo.jsonl');
const resumos = [];
let resumoLinhas = 0;
try { for (const l of fs.readFileSync(RESUMO_ARQ, 'utf8').trim().split('\n').slice(-RESUMO_MAX)) if (l) resumos.push(JSON.parse(l)); } catch { /* ainda não tem */ }
function guardarLentidao(c, e, sala) {
  if (!e || typeof e !== 'object') return;
  if (e.tipo === 'entrada') { // linha do tempo da entrada (ms desde que o app abriu), uma por abertura
    const r = { servidor: Date.now(), tipo: 'entrada' };
    for (const k of ENTRADA_CAMPOS) if (Number.isFinite(e[k])) r[k] = e[k];
    if (typeof e.versao === 'string' && e.versao.length < 16) r.versao = e.versao;
    return guardarLinha(r);
  }
  if (e.tipo === 'resumo') {
    const r = { servidor: Date.now(), tipo: 'resumo' };
    for (const k of RESUMO_CAMPOS) if (Number.isFinite(e[k])) r[k] = e[k];
    r.montado = e.montado === true;
    if (typeof e.versao === 'string' && e.versao.length < 16) r.versao = e.versao;
    resumos.push(r);
    if (resumos.length > RESUMO_MAX) resumos.splice(0, resumos.length - RESUMO_MAX);
    if (++resumoLinhas > 2 * RESUMO_MAX) {
      resumoLinhas = 0;
      fs.writeFile(RESUMO_ARQ, resumos.map((x) => JSON.stringify(x)).join('\n') + '\n', () => {});
    } else fs.appendFile(RESUMO_ARQ, JSON.stringify(r) + '\n', () => {});
    return;
  }
  if (e.tipo === 'menu') { // quanto um menu levou para abrir no app (lentidao.gd menu_aberto): ms de montar e dos 2 quadros seguintes
    const r = { servidor: Date.now(), tipo: 'menu' };
    for (const k of MENU_CAMPOS) if (Number.isFinite(e[k])) r[k] = e[k];
    if (typeof e.aba === 'string' && e.aba.length < 16) r.aba = e.aba;
    if (typeof e.versao === 'string' && e.versao.length < 16) r.versao = e.versao;
    return guardarLinha(r);
  }
  const r = { servidor: Date.now(), tickPico: Math.round(carga.picoPing), posGap: c.userData?.gapJan ?? null, relogioSrv: sala?.relogio != null ? +sala.relogio.toFixed(3) : null };
  for (const k of LENTIDAO_CAMPOS) if (Number.isFinite(e[k])) r[k] = e[k];
  r.montado = e.montado === true;
  for (const k of ['ev', 'ev0']) {
    const v = eventosLentidao(e[k]);
    if (v) r[k] = v;
  }
  if (typeof e.versao === 'string' && e.versao.length < 16) r.versao = e.versao;
  guardarLinha(r);
}
function guardarLinha(r) {
  lentidoes.push(r);
  if (lentidoes.length > LENTIDAO_MAX) lentidoes.splice(0, lentidoes.length - LENTIDAO_MAX);
  if (++lentidaoLinhas > 2 * LENTIDAO_MAX) {
    lentidaoLinhas = 0;
    fs.writeFile(LENTIDAO_ARQ, lentidoes.map((x) => JSON.stringify(x)).join('\n') + '\n', () => {});
  } else fs.appendFile(LENTIDAO_ARQ, JSON.stringify(r) + '\n', () => {});
}
app.get('/lentidao', (_req, res) => res.json(lentidoes.slice(-100)));
app.get('/lentidao/resumo', (_req, res) => res.json(resumos.slice(-200)));

// carga (André 2026-11-11, ping alto): quanto o servidor gasta por passo (de 50 ms), quanto tempo está ligado e quantos jogam
// relogio (2026-11-13, "slow motion" no lobo): segundos do jogo no servidor por segundo de verdade desde a última leitura.
// Abaixo de 1, o servidor anda devagar (passos atrasando) e a folga de velocidade do herói enche mais devagar que ele corre.
const relogioSrv = { sim: null, t: 0 };
app.get('/saude', (_req, res) => {
  let jogadores = 0, correcoes = 0; for (const s of salas) { jogadores += s.clients.length; correcoes += s.sim.correcoes || 0; s.sim.correcoes = 0; }
  const s0 = [...salas][0], agoraR = Date.now(); let relogio = null;
  if (s0) { if (relogioSrv.sim != null && agoraR > relogioSrv.t) relogio = +((s0.sim.tempo - relogioSrv.sim) / ((agoraR - relogioSrv.t) / 1000)).toFixed(3); relogioSrv.sim = s0.sim.tempo; relogioSrv.t = agoraR; }
  // desde a última leitura: correcoes = "corrigir" mandados (rollback), silencioMaxMs = maior tempo sem posição de um
  // celular, engasgos = silêncios de mais de 1 s
  res.json({ ok: true, contas: !!contas, ligadoMin: Math.round(process.uptime() / 60), salas: salas.size, jogadores, tickMs: +carga.ms.toFixed(2), tickPicoMs: +carga.pico.toFixed(1), memMb: Math.round(process.memoryUsage().rss / 1048576), correcoes, silencioMaxMs: carga.silencioMs, engasgos: carga.engasgos, relogio });
  carga.pico = 0; carga.silencioMs = 0; carga.engasgos = 0;
});
// Reinício com aviso na tela (André 2026-11-12): faixa "o servidor reinicia em 1 minuto" e depois a contagem grande de
// REINICIO.contagem s (godot-prototipo/reinicio.gd). O servidor manda {t:'reinicio', s} a cada 10 s (quem entra no meio também vê)
// e no começo da contagem; o celular conta sozinho entre um e outro. No fim grava o progresso de todos e sai (o systemd liga de novo).
// Com ninguém online, sai na hora. Serve ao servidor novo do merge (server/atualizar.js) e ao reinício programado.
let reiniciando = null;
const alguemOnline = () => [...salas].some((s) => s.clients.length);
function reiniciarComAviso(motivo, segundos = REINICIO.aviso) {
  if (reiniciando) return reiniciando;
  reiniciando = new Promise((pronto) => {
    const fim = Date.now() + (alguemOnline() ? segundos * 1000 : 0);
    const sair = () => {
      for (const s of salas) { try { s.salvarProgressos(); } catch (e) { console.error('reinício: gravar falhou', e); } }
      console.log(`Reiniciando (${motivo}) depois de ${Math.round(process.uptime() / 60)} min ligado.`);
      pronto();
      setTimeout(() => process.exit(0), 1500);
    };
    let ultimo = Infinity;
    const passo = () => {
      const falta = Math.ceil((fim - Date.now()) / 1000);
      if (falta <= 0) return sair();
      // a cada 10 s, e no começo da contagem grande
      if (falta <= ultimo - 10 || (falta <= REINICIO.contagem && ultimo > REINICIO.contagem)) {
        ultimo = falta;
        for (const s of salas) s.sim.evento({ t: 'reinicio', s: falta });
      }
      setTimeout(passo, 250);
    };
    passo();
  });
  return reiniciando;
}

// Na Oracle: chave pública em /chave-do-servidor e atualização pelo pacote trancado (server/atualizar.js)
const naOracle = ligarAtualizacaoTrancada(app, path.dirname(fileURLToPath(import.meta.url)), () => reiniciarComAviso('servidor novo'));

// Reinício programado (REINICIO em shared/dados.js): só na máquina instalada. Avisa no chat geral, depois a faixa na tela
// com a contagem, grava todo mundo e sai; o systemd (Restart=always) liga de novo. Com a sala vazia, reinicia sem aviso.
if (naOracle || process.env.REINICIO_TESTE) {
  const total = (Number(process.env.REINICIO_TESTE) || REINICIO.horas * 60) * 60; // segundos ligado até reiniciar
  const avisados = new Set();
  setInterval(() => {
    const falta = total - process.uptime(), alguem = alguemOnline();
    for (const min of REINICIO.avisos) if (alguem && falta <= min * 60 && falta > 0 && !avisados.has(min)) {
      avisados.add(min);
      const sala = [...salas][0];
      sala?.sim.anunciar(`O servidor vai reiniciar em ${min} minuto${min > 1 ? 's' : ''} para ficar mais leve. Seu progresso fica salvo; é só entrar de novo.`);
    }
    if (falta <= REINICIO.aviso && !avisados.has('fim')) {
      avisados.add('fim');
      reiniciarComAviso('programado', Math.max(0, Math.round(falta)));
    }
  }, 5000);
}

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
// o app vai voltar sozinho depois de uma queda (André 2026-11-13): antes pergunta se a conta já está jogando em outro
// aparelho. Se está, não entra (entrar derrubaria o outro): mostra "Sua conta entrou em outro aparelho"
app.get('/conta/ligada', (req, res) => {
  const s = sessaoDe(req), conta = contas.porSessao(s);
  conta ? res.json({ ligada: contaLigadaEmOutro(conta.id, s) }) : res.status(401).json({ erro: 'login' });
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

// rede de segurança (auditoria 2026-11-13): promessa rejeitada sem dono só registra; erro solto grava todo mundo antes de sair
// (o systemd sobe de novo). Antes, os dois derrubavam o processo sem gravar: até 15 s de progresso perdidos.
process.on('unhandledRejection', (e) => console.error('promessa sem catch:', e));
process.on('uncaughtException', (e) => {
  console.error('erro solto, gravando e saindo:', e);
  for (const s of salas) { try { s.salvarProgressos(); } catch (e2) { console.error('gravar falhou', e2); } }
  process.exit(1);
});
const servidor = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: servidor, pingInterval: 5000, pingMaxRetries: 4 }) });
gameServer.define('clareira', SalaClareira);
gameServer.listen(PORTA).then(() => console.log(`Servidor do RPG no ar: http://localhost:${PORTA}`));
