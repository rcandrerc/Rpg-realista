// Servidor do jogo: Node.js + Colyseus.
// Roda a simulação compartilhada 20 vezes por segundo e manda uma "foto" do mundo para todos.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import colyseus from 'colyseus';
import wsTransport from '@colyseus/ws-transport';
import { Simulacao, MAPA_CLAREIRA, GOOGLE_CLIENT_ID, retTerreno, LOTES_ANTIGOS, AMIGOS, CHAT, AMIGOS_VIRTUAIS, RIVAIS, npcNoMundo, xpOfflineNpc, nomeValido, REINICIO, Leilao, LEILAO, LEILAO_BOT, CAIXA, lancarCaixa, resumoCaixa } from '@rpg/shared';
import { Contas, verificadorGoogle, roboCel, roboCarga, ROBO } from './contas.js';
import { Visao } from './visao.js';
import { gerarCopia, limparSobrasCopia, chaveAssinaturaCopia, CHAVE_COPIA } from './copia-contas.js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { iaEsgotada, iaVoltaEm, podeIaJogador, puxarAssunto, pensarAmiga, testarChaveGroq, escreverDiario, dicaParaRegra } from './ia-amiga.js';
import { ligarAtualizacaoTrancada, proximoReinicio } from './atualizar.js';
import { reserva, vigiarReserva } from './caddy-reserva.js'; // caminho reserva pelo IP (André 2026-11-16, sslip.io bloqueado no celular)

const { Server, Room, ServerError } = colyseus;
const { WebSocketTransport } = wsTransport;

const PORTA = Number(process.env.PORT || 2567);
const TICK = 1 / 20;
// Limite de mensagens por jogador (balde que enche 90 por segundo, guarda até 150; a posição sozinha usa 20).
// O jogo normal manda bem menos; quem passa disso tem o excesso ignorado. O que grava na conta custa mais.
const LIMITE = { porSeg: 90, max: 150, custo: { amiga: 3, build: 20, visual: 20, aparencia: 10, mudarAparencia: 30, mudarVisual: 30, pronto: 20, barra: 10, atributo: 5, atributos: 5, item: 5, coletar: 5, criar: 5, lote: 10, construir: 5, desmontar: 5, horta: 3, plantarArvore: 3, diaria: 3, troca: 3, fabricar: 5, bau: 3, forno: 3, amigo: 3, time: 3, chat: 10, leilao: 5, lentidao: 5 } };
// O robô de testes (ferramentas/robo/robo.mjs, André 2026-11-14) joga como um jogador, mas nunca negocia, nunca compra
// terreno, não conversa e não convida ninguém: assim não estraga a economia nem o jogo de quem joga de verdade
const ROBO_NAO = new Set(['troca', 'chat', 'amigo', 'time', 'amiga', 'chaveIa', 'trocarNome', 'lote', 'construir', 'desmontar', 'nivelTeste', 'verEquip', 'duelo', 'comando', 'pvp']);
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
// quem caiu (conta -> { mont, semGuerra }): a folga da queda vale na velocidade que ele tinha (a montaria), e o "sem ponto
// de guerra" que faltava passa para a sessão nova (abrir outra aba não zera; Segurança 2026-11-19)
const montSaida = new Map();
const infoSaida = (sim, j) => ({ mont: j.montado || null, semGuerra: Math.max(0, (j.semGuerraAte ?? 0) - sim.tempo) });
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
    if (ctx) ctx.idioma = c.userData?.idioma || 'pt'; // English no jogo (André 2026-11-14): a IA responde em inglês
    if (ctx && viaTime) ctx.time = this.sim.amigosIaNoTime(id).filter((x) => x !== amg).map((x) => x.AMIGA.nome); // conversa em grupo
    amg.ouvirAmiga(id, msg.texto);
    amg.amiga.ia.viaTime = viaTime ? this.sim.tempo + CHAT.respostaTime : 0; // do time: responde no time; do privado: no privado
    // dica de combate (André 2026-11-11): a IA é chamada uma vez e devolve a regra; esquecer/listar dicas vai pelas regras
    const tipoDica = amg.tipoDicaAmiga(msg.texto), chaveDe = conta && contas ? contas.chaveIa(conta.id) : '';
    if (tipoDica === 'esquecer' || tipoDica === 'listar') { amg.comandoDicaAmiga(id, tipoDica, msg.texto); return; }
    // André 2026-11-14: todo mundo conversa com eles, mas a resposta da IA é só de quem tem a chave (iaAmiga); o resto, as regras
    if (!amg.iaAmiga(id)) return amg.respostaAmiga(id, { assunto: amg.assuntoAmiga(msg.texto) });
    // a IA dele acabou hoje (André 2026-11-17): ela está "ocupada" e nem gasta pedido
    if (amg.semIaAmiga(amg.amiga, this.sim.jogadores.get(id))) return amg.cansouIaAmiga(id, amg.assuntoAmiga(msg.texto));
    if (!chaveDe && !podeIaJogador(conta ? 'c' + conta.id : 's' + id)) return amg.respostaAmiga(id, { assunto: amg.assuntoAmiga(msg.texto) }); // passou da cota dele: só ele recebe falas prontas
    // a chave Groq de quem escreveu paga a resposta (André 2026-11-10); as contas de teste usam a do servidor
    const conversar = () => pensarAmiga(ctx, msg.texto, chaveDe).then((r) => {
      if (amg.amiga) amg.amiga.ia.fonte = { ia: r?.ia || 'regras', t: amg.tempo }; // o registro do dia anota quem respondeu (André 2026-11-19)
      const regra = amg.assuntoAmiga(msg.texto);
      if (!r && chaveDe && iaEsgotada(chaveDe)) return amg.cansouIaAmiga(id, regra); // a chave dele acabou hoje
      if (!r && !chaveDe && (this.sim.iaAcabouAte = iaVoltaEm())) return amg.respostaAmiga(id, { assunto: regra }); // acabaram Gemini e Groq: responde pelas regras e já já desloga (André 2026-11-19)
      // a IA não achou ação: vale a das regras (ex.: "vem cá" que a IA tratou como conversa)
      if (['presente', 'pedirItem'].includes(regra)) return amg.respostaAmiga(id, { assunto: regra }); // troca aberta: quem decide são as regras (fase 3)
      // pedido claro de ação (time, sair, vir) vale sempre pelas regras, para a fala e a ação baterem (André 2026-11-09)
      let acao = ['time', 'sairTime', 'vir', 'pescar', 'minerar', 'lenha', 'pararAtividade', 'naoAcao', 'liderar', 'barco', 'ajudarMissao', 'encomenda', 'pack'].includes(regra) ? regra : r?.assunto === 'conversa' && ['sim', 'nao'].includes(regra) ? regra : r?.assunto;
      // André 2026-11-12: a regra só passa por cima da IA em pedido de verdade (curto e que muda algo); senão vale a fala da IA
      if (r && acao === regra && regra !== r.assunto && !amg.regraValeSobreIaAmiga(id, regra, msg.texto, r.assunto)) acao = amg.acaoSemEfeitoAmiga(id, r.assunto) ? 'conversa' : r.assunto;
      if (r && acao === r.assunto && amg.acaoSemEfeitoAmiga(id, acao)) acao = 'conversa';
      if (r && ['vir', 'time'].includes(acao) && amg.apelidoAmiga(msg.texto)) acao = 'conversa';
      // André 2026-11-17 ("vamos fazer alguma coisa, escolhe aí"): ela respondeu PROPONDO algo (sugere); o "vamos" dele não é
      // aceite ainda. Vira o chamado dela e o próximo "bora" aceita (respostaAmiga)
      if (r?.sugere && r.assunto === 'conversa' && ['time', 'vir', 'pescar', 'minerar', 'lenha'].includes(acao) && !amg.chamouAmiga(r.sugere)) acao = 'conversa'; // "me chama de fofinha": apelido, não chamado // "bora!" de quem já está no time: só conversa, com a fala da IA
      amg.respostaAmiga(id, r ? { assunto: acao, iaAssunto: r.assunto, lugar: r.lugar, sugere: r.sugere, fala: acao === r.assunto || acao === 'conversa' || r.assunto === 'conversa' || r.assunto === 'nao' ? r.fala : '' } : { assunto: regra });
    }).catch((e) => console.error('amigo IA: resposta deu erro', e));
    // parecia dica mas a IA não montou regra (ou era só conversa com "se"/"perto"): responde como conversa normal
    if (tipoDica === 'dica') dicaParaRegra(msg.texto, amg.AMIGA.nome, chaveDe).then((regra) => { if (!regra || !amg.aprenderDicaAmiga(id, regra, msg.texto)) conversar(); }).catch((e) => console.error('amigo IA: dica deu erro', e));
    else conversar();
  }
  // tira o herói do mundo na hora, sem gravar (o progresso dele já foi para a sessão nova)
  tirarDoMundo(id) {
    for (const ctx of this.sim.amigosIa) ctx.amigaSair(id);
    this.sim.removerJogador(id); this.visao.esquecer(id); this.contaDe?.delete(id);
  }
  onCreate() {
    salas.add(this);
    // revisão de segurança 2026-11-19: mensagem do tipo '__proto__' achava o Object.prototype na tabela do Colyseus e
    // derrubava o servidor inteiro (TypeError fora de qualquer try). Sem protótipo, tipo desconhecido é só ignorado
    Object.setPrototypeOf(this.onMessageHandlers, null);
    // 2026-11-16 (ronda dos robôs): o robô 2 com placa lenta caiu na primeira entrada com "seat reservation expired"
    // (15 s do Colyseus). Celular fraco montando o mundo atrás da capa pode passar disso; 45 s não muda nada para quem entra rápido.
    this.setSeatReservationTime(45);
    this.sim = new Simulacao(MAPA_CLAREIRA);
    this.sim.aoCaixa = (l) => { lancarCaixa(livroCaixa, l); caixaSujo = true; }; // livro-caixa: todas as salas no mesmo livro
    this.visao = new Visao((id) => this.sim.coletaveis.get(id)); // veios e árvores: só os de perto (onde está cada um); cada app Godot novo recebe só o que está perto do herói dele (server/visao.js)
    // Vila dos Lotes: dono, peças e horta guardados no servidor; a compra confere no banco (vale entre salas)
    if (contas) {
      this.sim.carregarLotes(contas.lotes());
      this.sim.aoComprarLote = (id, dono, nome, ret) => contas.reservarLote(id, dono, nome, ret, (o) => retTerreno(o.dados?.ret) || LOTES_ANTIGOS[o.id] || null);
      this.sim.iaPorChave = true;
      // memória da Cecília: o diário de cada conversa é escrito com a chave de quem conversou (as contas de teste: a do servidor)
      this.sim.aoDiarioAmiga = (d) => escreverDiario(d, /^c\d+$/.test(d.conta) ? contas.chaveIa(Number(d.conta.slice(1))) : '').then((r) => {
        const ctx = this.sim.amigoIaDe(d.amigo) || this.sim; // Cecília ou Dario (André 2026-11-11)
        if (!r || ctx.amiga) return r;
        ctx.anotarAmiga(d.conta, r); // ela já saiu (a sala pode até ter fechado): grava direto no banco
        for (const l of this.sim.lotesParaSalvar()) contas.salvarLote(l);
        return null;
      }); // a Cecília aparece na lista para todos; quem não tem chave vê "Ativar conversa com IA"
      // ela puxa assunto pela IA (André 2026-11-17), com a chave de quem vai ouvir; a fala chega como uma mensagem dela
      this.sim.aoPuxarAmiga = (id, evento, amg) => {
        amg ||= this.sim;
        const ctx = amg.contextoAmiga(id), c = this.clients.find((x) => x.sessionId === id), conta = this.contaDe?.get(id);
        if (!ctx) return null;
        ctx.idioma = c?.userData?.idioma || 'pt';
        return pensarAmiga(ctx, puxarAssunto(ctx, evento), conta ? contas.chaveIa(conta.id) : '').then((r) => {
          if (r?.fala && amg.amiga) amg.amiga.ia.fonte = { ia: r.ia || '', t: amg.tempo };
          if (r?.fala) amg.respostaAmiga(id, { assunto: 'conversa', fala: r.fala });
          else if (!r) { const ch = conta ? contas.chaveIa(conta.id) : ''; if (ch && iaEsgotada(ch)) amg.cansouIaAmiga(id); else if (!ch) this.sim.iaAcabouAte = iaVoltaEm(); } // acabou: a dele avisa; a do servidor desloga
        }).catch((e) => console.error('amigo IA: puxar assunto deu erro', e));
      };
    }
    // bosses de mundo (André 2026-11-11): a hora de voltar de cada um fica no banco (vale para todas as salas e depois de
    // reiniciar); nasceu, caiu ou soltou Mítico: aviso no chat geral de todo mundo online
    if (contas) this.sim.nivelTetoNpc = contas.nivelMaisAlto(); // NPCs nunca passam do jogador mais alto (André 2026-11-11)
    if (contas && salas.size === 1) this.npcsForaDoMundo(true); // primeira sala aberta: os aventureiros fora do mundo evoluem pelo tempo vazio
    if (contas) { this.sim.carregarBosses(contas.lerMundo('bosses')); this.sim.aoBosses = (est) => contas.gravarMundo('bosses', est); }
    if (contas) { this.sim.carregarClasNpc(contas.lerMundo('clas_npc')); this.sim.aoClasNpc = (est) => contas.gravarMundo('clas_npc', est); } // clãs bot: os recrutas do Gael (shared/cla.js)
    // bases dos clãs (André 2026-11-22, shared/base.js): todas as salas no mesmo registro; terreno novo só na base
    if (contas) { this.sim.carregarBases(contas.lerMundo('bases_cla')); this.sim.aoBases = (est) => contas.gravarMundo('bases_cla', est); this.sim.soBaseCla = true;
      // as casas de antes voltam para o dono, uma vez só (André 2026-11-22: "Tudo pode remover as casas")
      this.sim.carregarDevolucoes(contas.lerMundo('devolucoes')); this.sim.aoDevolucoes = (est) => contas.gravarMundo('devolucoes', est);
      if (!contas.lerMundo('reset_terrenos_v1')) { const n = this.sim.resetTerrenos(); for (const l of this.sim.lotesParaSalvar()) contas.salvarLote(l); contas.gravarMundo('reset_terrenos_v1', { t: Date.now(), n }); console.log(`base do clã: ${n} terrenos devolvidos`); }
      // as casas dos bots também saem (André 2026-11-22: "Não vai existir mais casa de bot nenhum")
      if (!contas.lerMundo('reset_terrenos_bots_v1')) { const n = this.sim.resetTerrenos(); for (const l of this.sim.lotesParaSalvar()) contas.salvarLote(l); for (const o of this.sim.npcsParaSalvar()) contas.gravarMundo('npc:' + o.id, o.dados); contas.gravarMundo('reset_terrenos_bots_v1', { t: Date.now(), n }); console.log(`base do clã: ${n} casas de bot tiradas`); }
      // 6 mudanças de lugar grátis, uma vez só, para o André testar o chão nivelado (André 2026-11-23: "me dá algumas
      // mudanças free para eu fazer testes... Mas é só dessa vez"); a regra continua 1 grátis e depois paga
      if (!contas.lerMundo('base_mudancas_teste_v1')) { let n = 0; for (const B of Object.values(this.sim.basesCla || {})) if (B.k[0] === 'j' && B.nomeDono === 'Yukmei') { B.livres = 6; n++; } if (n) this.sim.salvarBases(); contas.gravarMundo('base_mudancas_teste_v1', { t: Date.now(), n }); console.log(`base do clã: ${n} base(s) com 6 mudanças grátis`); }
    }
    if (contas) this.sim.carregarPlantio(contas.lerMundo('plantadas')); // árvores plantadas pelos jogadores (shared/plantio.js)
    if (contas) this.sim.carregarPacksBase(contas.lerMundo('packs_base')); // packs guardados na terra do clã (André 2026-11-23: não somem)
    if (contas) this.sim.carregarVeios(contas.lerMundo('veios')); // árvores cortadas e veios batidos: o tempo de voltar continua depois do reinício
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
    this.ouvir('barra_vista', (c) => this.sim.verBarra(c.sessionId)); // abriu a aba Habilidades (missão "Confira sua barra")
    this.ouvir('diaria', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 12 && (m.id == null || (typeof m.id === 'string' && m.id.length < 16))) this.sim.diaria(c.sessionId, { acao: m.acao, id: m.id }); }); // missões diárias (aba Diárias)
    this.ouvir('guilda', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 12 && (m.id == null || (typeof m.id === 'string' && m.id.length < 8))) this.sim.guilda(c.sessionId, { acao: m.acao, id: m.id }); }); // Guilda dos Aventureiros (mural e aba Guilda)
    // clã e recrutas (André 2026-11-22, shared/cla.js): fundar, recrutar, dispensar, cofre
    this.ouvir('cla', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 12) this.sim.cla(c.sessionId, { acao: m.acao, nome: typeof m.nome === 'string' ? m.nome.slice(0, 40) : null, tier: typeof m.tier === 'string' ? m.tier.slice(0, 12) : null, id: typeof m.id === 'string' ? m.id.slice(0, 20) : null, ouro: Number(m.ouro) || 0, ...(Number.isFinite(+m.x) && Number.isFinite(+m.z) && m.x != null && m.z != null ? { x: +m.x, z: +m.z } : {}), mudar: m.mudar === true, fn: m.fn && typeof m.fn === 'object' ? { k: String(m.fn.k || '').slice(0, 12), r: String(m.fn.r || '').slice(0, 12), p: String(m.fn.p || '').slice(0, 20), s: String(m.fn.s || '').slice(0, 16) } : null }); });
    this.ouvir('item', (c, m) => this.sim.item(c.sessionId, m)); // mochila: equipar, tirar, usar, comprar, vender
    this.ouvir('leilao', (c, m) => { // Casa do Comércio (Otávio, Rio Claro)
      // robô de testes (André 2026-11-16: "conserta os dois robôs"): faz a missão do leilão sem mexer na economia de
      // ninguém. Anuncia só pelo preço máximo (e cancela logo depois) e compra só os anúncios da casa.
      if (c.auth?.robo) {
        if (!m || typeof m !== 'object' || !['ver', 'anunciar', 'cancelar', 'retirar', 'comprar'].includes(m.acao)) return;
        if (m.acao === 'comprar' && !/^casa\d+$/.test(String(m.id))) return;
        if (m.acao === 'anunciar') m = { ...m, preco: LEILAO.precoMax }; // ninguém compra o anúncio de teste
      }
      this.sim.leilaoMsg(c.sessionId, m, { robo: !!c.auth?.robo });
    });
    // troca entre jogadores com cadeado (shared/simulacao.js troca): pedir, aceitar, pôr item e ouro, trancar e confirmar
    this.ouvir('troca', (c, m) => {
      if (!m || typeof m.acao !== 'string' || m.acao.length > 12) return;
      const int = (v) => (Number.isInteger(v) && v >= 0 && v < 1e9 ? v : undefined);
      this.sim.troca(c.sessionId, { acao: m.acao, com: typeof m.com === 'string' ? m.com.slice(0, 32) : undefined, i: int(m.i), n: int(m.n), o: int(m.o), v: m.v === true });
    });
    // amigos (até 20, ficam na conta) e time (shared/simulacao.js amigo/time): pedir, aceitar, recusar, remover, convidar, sair
    const texto = (v) => (typeof v === 'string' ? v.slice(0, 32) : undefined);
    this.ouvir('verEquip', (c, m) => { if (m && typeof m.com === 'string' && m.com.length < 40) this.sim.verEquip(c.sessionId, { com: m.com }); }); // ver o equipamento de quem está perto
    this.ouvir('amigo', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 10) this.sim.amigo(c.sessionId, { acao: m.acao, com: texto(m.com), c: texto(m.c), nome: texto(m.nome) }); });
    this.ouvir('comando', (c, m) => { if (m && typeof m.c === 'string' && m.c.length < 10) this.sim.comandoTime(c.sessionId, { c: m.c, para: texto(m.para) }); }); // comando rápido do time (André 2026-11-19)
    this.ouvir('time', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 10) this.sim.time(c.sessionId, { acao: m.acao, com: texto(m.com) }); });
    this.ouvir('pvp', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 10) this.sim.arenaPvp(c.sessionId, { acao: m.acao, id: texto(m.id) }); }); // Arena PvP 3x3 (shared/arena.js, André 2026-11-21)
    this.ouvir('duelo', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 10) this.sim.duelo(c.sessionId, { acao: m.acao, com: texto(m.com) }); }); // duelo (shared/duelo.js, André 2026-11-17)
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
    // adicionar amigo a distância (André 2026-11-15): busca o nome no banco, guarda o pedido e acha a pessoa em qualquer sala
    this.sim.todasSims = () => [...salas].map((s) => s.sim);
    this.sim.buscarContas = (termo, conta) => (contas ? contas.buscarNomes(termo, idConta(conta), AMIGOS.buscaMax).map((r) => ({ c: 'c' + r.id, nome: r.nome })) : null);
    this.sim.aoPedidoAmizade = (de, para, grava) => {
      const a = idConta(de), b = idConta(para);
      if (!contas || a == null || b == null) return true;
      if (!grava) { contas.tirarPedido(a, b); return true; }
      if (contas.nAmigos(b) >= AMIGOS.max) return 'cheia';
      contas.gravarPedido(a, b);
      return true;
    };
    // o amigo está jogando em outra sala (a lista mostra "online")
    this.sim.onlineFora = (k) => { for (const s of salas) if (s !== this && s.sim.porConta(k)) return true; return false; };
    // chat geral (todo mundo online, em qualquer sala), de amigos e pm com um amigo (shared/simulacao.js chat): m = { canal, texto, para? }
    this.ouvir('chat', (c, m) => {
      if (!m || typeof m.canal !== 'string' || typeof m.texto !== 'string' || m.texto.length > 400) return;
      const msg = this.sim.chat(c.sessionId, { canal: m.canal, texto: m.texto, para: typeof m.para === 'string' ? m.para : undefined });
      if (!msg) return;
      // Local (André 2026-11-18, Chama x Geada): só quem está perto nesta sala; não fica no histórico. Os NPCs de guerra da
      // outra raça que estão perto respondem com as falas prontas (shared/guerra.js ouvirLocal)
      if (msg.canal === 'local') { this.sim.receberChat(msg); this.sim.ouvirLocal(c.sessionId, msg.texto); return; }
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
    // Idioma do jogo (André 2026-11-14, Configurações > Idioma / Language): só muda a língua da IA dos NPCs amigos
    this.ouvir('idioma', (c, m) => { (c.userData ||= {}).idioma = m?.codigo === 'en' ? 'en' : 'pt'; });
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
    this.ouvir('bau', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 10) this.sim.bau(c.sessionId, { acao: m.acao, i: Number.isInteger(m.i) ? m.i : -1, n: Number.isInteger(m.n) && m.n > 0 ? Math.min(m.n, 9999) : undefined, cla: m.cla === true || m.cla === 1 }); });
    this.ouvir('forno', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 10) this.sim.forno(c.sessionId, { acao: m.acao, p: String(m.p || '').slice(0, 20), lugar: String(m.lugar || '').slice(0, 6), i: Number.isInteger(m.i) ? m.i : -1, r: String(m.r || '').slice(0, 20), n: Number.isInteger(m.n) ? Math.max(1, Math.min(m.n, 9999)) : undefined }); });
    // árvores plantadas (André 2026-11-16): semente da Rosa numa área de plantio ou no terreno (shared/plantio.js)
    this.ouvir('plantarArvore', (c, m) => { if (m && typeof m.s === 'string' && m.s.length < 16) this.sim.plantarArvore(c.sessionId, { s: m.s, x: Number(m.x), z: Number(m.z) }); });
    this.ouvir('horta', (c, m) => { if (m && typeof m.acao === 'string' && typeof m.c === 'string' && m.c.length < 12) this.sim.horta(c.sessionId, { acao: m.acao, c: m.c, s: typeof m.s === 'string' ? m.s.slice(0, 16) : '' }); });
    this.ouvir('atributo', (c, k) => { if (typeof k === 'string') this.sim.distribuirAtributo(c.sessionId, k); });
    this.ouvir('atributos', (c, m) => this.sim.distribuirAtributos(c.sessionId, m)); // + e − no menu, aplica no Confirmar
    this.ouvir('missaoTeste', (c, m) => this.sim.missaoTeste(c.sessionId, m?.acao)); // só a conta do André (o sim confere; CONTA_TESTE.missoes)
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
    this.ouvir('amiga', (c, m) => { if (m && typeof m.acao === 'string' && m.acao.length < 12) (this.sim.amigoIaDe(typeof m.id === 'string' ? m.id : '') || this.sim).conversaAmiga(c.sessionId, { acao: m.acao, op: typeof m.op === 'string' ? m.op.slice(0, 20) : undefined, menu: typeof m.menu === 'string' ? m.menu.slice(0, 20) : undefined }); }); // op/menu: conversa por opções (André 2026-11-19) // m.id: qual amigo (Cecília ou Dario); sem id, a Cecília // m opcional: { npc, conversa } (menu do NPC no app)
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
    this.clock.setInterval(() => this.salvarProgressos(), 15000);
    this.clock.setInterval(() => { this.sim.iaAcabouAte = iaVoltaEm(); }, 20000); // IA do dia acabou? Cecília e Dario deslogam até voltar (André 2026-11-19) // nível, XP e skills vão para a conta
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
    { const v = this.sim.veiosParaSalvar(); if (v) contas.gravarMundo('veios', v); } // árvores cortadas e veios batidos (só quando mudou)
    { const v = this.sim.plantioParaSalvar(); if (v) contas.gravarMundo('plantadas', v); } // árvores plantadas (só quando mudou)
    { const v = this.sim.packsBaseParaSalvar(); if (v) contas.gravarMundo('packs_base', v); } // packs na terra do clã (só quando mudou)
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
      if (c.userData.substituido) return; // a conta entrou por outro aparelho: o antigo não mexe em mais nada (revisão 2026-11-19)
      if (c.auth?.robo && ROBO_NAO.has(tipo) && !(tipo === 'time' && m?.acao === 'sozinho')) return; // robô de testes: não mexe na economia nem fala com ninguém (seguir sozinho na etapa de time pode)
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
      if (c.userData?.substituido) continue; // já saiu do mundo (onJoin): só falta o socket fechar
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
        if (vj) { this.sim.saiuComVeiculo(vj); this.sim.guardarPosicao(vj); conta.progresso = vj.prog; saidas.set(conta.id, ultimaNoticia(this.sim, vj)); montSaida.set(conta.id, infoSaida(this.sim, vj)); velhos.push(vj.id); fantasmas.push(vj.id); } // o mais novo vale (com o lugar onde ele estava)
        // revisão de segurança 2026-11-19: o herói antigo sai do mundo já (fantasmas, logo abaixo) e as mensagens do aparelho
        // antigo são ignoradas (ouvir). Antes ele seguia jogando até o socket fechar (até ~30 s) com uma cópia da mochila: duplicava
        (outro.userData ||= {}).substituido = true; outro.leave(4001);
      }
      // a mesma conta numa outra sala (salas cheias abrem outra): também sai, e o progresso dela vem junto
      for (const s of salas) if (s !== this) for (const outro of s.clients) if (outro.auth?.id === conta.id) {
        const vj = s.sim.jogadores.get(outro.sessionId);
        if (vj) { s.sim.saiuComVeiculo(vj); s.sim.guardarPosicao(vj); conta.progresso = vj.prog; s.tirarDoMundo(vj.id); }
        (outro.userData ||= {}).substituido = true; outro.leave(4001);
      }
      // a mesma conta esperando reconexão (queda, 20 s) numa OUTRA sala: o herói de lá sai já, com o progresso vindo para cá.
      // Antes ficava lá e, acabando a espera, gravava a mochila velha por cima (duplicava o que foi dado ou vendido aqui)
      for (const s of salas) if (s !== this) {
        const vivosLa = new Set(s.clients.map((o) => o.sessionId));
        for (const vj of [...s.sim.jogadores.values()]) if (!vj.bot && vj.conta === 'c' + conta.id && !vivosLa.has(vj.id)) {
          s.sim.saiuComVeiculo(vj); s.sim.guardarPosicao(vj); conta.progresso = vj.prog; saidas.set(conta.id, ultimaNoticia(s.sim, vj)); montSaida.set(conta.id, infoSaida(s.sim, vj));
          const espera = s.esperas?.get(vj.id); if (espera) { s.esperas.delete(vj.id); espera.reject(new Error('substituido')); }
          s.tirarDoMundo(vj.id);
        }
      }
      // o servidor já tinha visto a queda: o herói antigo está no mundo esperando reconexão (allowReconnection, 20 s) e
      // o jogo entrou de novo como sessão nova. O novo herda o progresso e o lugar dele (antes vinham do banco, de até
      // 15 s atrás, e o antigo ficava 20 s no mundo como fantasma)
      const vivos = new Set(this.clients.map((o) => o.sessionId));
      for (const vj of [...this.sim.jogadores.values()]) if (!vj.bot && vj.conta === 'c' + conta.id && vj.id !== client.sessionId && !vivos.has(vj.id)) {
        this.sim.saiuComVeiculo(vj); this.sim.guardarPosicao(vj); conta.progresso = vj.prog; saidas.set(conta.id, ultimaNoticia(this.sim, vj)); montSaida.set(conta.id, infoSaida(this.sim, vj));
        velhos.push(vj.id); fantasmas.push(vj.id); // sai do mundo logo abaixo, depois de passar o time e os amigos para o novo
        // o aparelho antigo não pode mais voltar como esse herói (André 2026-11-13): sem isso ele religava num herói que
        // já saiu do mundo; agora a volta falha, ele tenta entrar de novo (volta: true) e o onAuth recusa
        const espera = this.esperas?.get(vj.id); if (espera) { this.esperas.delete(vj.id); espera.reject(new Error('substituido')); }
      }
    }
    const nome = conta?.nome || String(opcoes?.nome || '').slice(0, 20) || `Andarilho ${this.clients.length}`;
    // com conta: o criador abre uma vez só, enquanto a conta não tem personagem; sem contas, o aparelho é quem sabe
    const podeCriar = conta ? !conta.visual : opcoes?.criando === true;
    this.sim.adicionarJogador(client.sessionId, nome, conta?.visual || opcoes?.visual, { podeCriar, aparencia: conta?.aparencia || opcoes?.aparencia, progresso: conta?.progresso, testador: !!conta?.testador, conta: conta?.id ?? null, robo: !!conta?.robo });
    // voltou de uma queda (a conta saiu há pouco): o caminho que andou sem internet vale
    if (conta && saidas.has(conta.id)) { const seg = (Date.now() - saidas.get(conta.id)) / 1000; saidas.delete(conta.id); const info = montSaida.get(conta.id); montSaida.delete(conta.id); this.sim.folgaDaQueda(client.sessionId, seg < 120 ? seg : 0, info?.mont, info?.semGuerra); }
    if (conta) { const l = contas.loteDoDono('c' + conta.id); this.sim.esquecerLotesDe('c' + conta.id, l?.id); if (l) this.sim.carregarLotes([l]); } // o lote dele como está no banco
    this.sim.enviarLotes(client.sessionId); // Vila dos Lotes: todos os lotes e qual é o dele
    if (conta) (this.contaDe ||= new Map()).set(client.sessionId, conta);
    if (conta?.build) this.sim.definirBuild(client.sessionId, conta.build);
    if (conta) this.sim.definirAmigos(client.sessionId, contas.amigos(conta.id).map((a) => ({ c: 'c' + a.id, nome: a.nome })), contas.pedidos(conta.id, AMIGOS.pedidoDias));
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
        if (ctx.AMIGA.terreno) { const l = contas.loteDoDono(ctx.AMIGA.conta); if (l) this.sim.carregarLotes([l]); } // o lote dele na base do clã
        if (!this.sim.npcSalvos?.has(ctx.AMIGA.id)) this.sim.carregarNpc(ctx.AMIGA.id, contas.lerMundo('npc:' + ctx.AMIGA.id)); // o save fica na tabela mundo (todos, desde 2026-11-22)
      }
      ctx.amigaEntrar(client.sessionId, fala);
    }
    // os recrutas do clã de quem entrou (shared/cla.js): o save fica na tabela mundo, como o dos aventureiros
    if (contas) this.sim.lerNpc ||= (id) => contas.lerMundo('npc:' + id);
    { const j = this.sim.jogadores.get(client.sessionId); if (j && !j.bot) { this.sim.cobrarCla(j); this.sim.entrarRecrutas(j); } }
    // os recrutas dos clãs de quem está fora: no mundo enquanto tiver jogador online (André 2026-11-23: "sempre, sem exceção")
    if (contas) { try { this.sim.entrarRecrutasSemLider(contas.clasDasContas(), client.sessionId); } catch (e) { console.warn('recrutas sem líder:', e.message); } }
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
    { const jj = this.sim.jogadores.get(client.sessionId); if (jj && client.auth?.id != null && !client.userData?.substituido) { saidas.set(client.auth.id, ultimaNoticia(this.sim, jj)); montSaida.set(client.auth.id, infoSaida(this.sim, jj)); } } // queda: a hora da última notícia
    this.salvarProgressos(); // grava antes de tirar o herói do mundo
    { const jj = this.sim.jogadores.get(client.sessionId); if (jj) this.sim.sairRecrutas(jj); } // os recrutas do clã saem junto com o líder (shared/cla.js)
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
// 2026-11-15: 300 linhas (de todos os celulares) só cobriam um dia; para comparar com os dias em que estava liso,
// guarda mais (cada linha ~0,6 KB: 2000 linhas ~1,2 MB)
const LENTIDAO_MAX = 2000;
const LENTIDAO_ARQ = path.resolve(process.env.DADOS || 'dados', 'lentidao.jsonl');
// min..nos (2026-11-14): minutos de jogo, memória (MB), ms da placa/processador no último quadro, calor do Android
// (term 0-6, folga, bat °C) e nós na cena; dnos/dres = nós e recursos que entraram ou saíram no segundo ruim
const COMUM_CAMPOS = ['min', 'mem', 'vmem', 'livre', 'gpu', 'cpu', 'term', 'folga', 'bat', 'nos', 'auto', 'alto', 'hz'];
const LENTIDAO_CAMPOS = ['quando', 'fps', 'pior', 'relogio', 'escala', 'pedido', 'andou', 'andou_lobo', 'mov', 'bloq', 'corr', 'corr_m', 'foto_ms', 'ping', 'x', 'z', 'grafico', 'limite', 'paralelo', 'proc', 'cham', 'tri', 'obj', 'rumo', 'pip', ...COMUM_CAMPOS, 'dnos', 'dres', 'qms', 'q70', 'lenta'];
const lentidoes = [];
let lentidaoLinhas = 0; // linhas no arquivo desde a última reescrita (passou de 2x o máximo: reescreve só as últimas)
try { for (const l of fs.readFileSync(LENTIDAO_ARQ, 'utf8').trim().split('\n').slice(-LENTIDAO_MAX)) if (l) lentidoes.push(JSON.parse(l)); } catch { /* ainda não tem */ }
const ENTRADA_CAMPOS = ['ini', 'pronto', 'escolha', 'toque', 'conectado', 'foto', 'fila', 'aquecer', 'capa', 'grafico', 'toques', 'voltas', 'sala', 'sala_erro',
  'pso0', 'pso1', 'pip', 'vtex', 'vbuf', 'fundo', 'ws']; // toques/voltas/sala: ronda 2026-11-16 (Entrar que falha no 1º toque); pso/pip/vtex/vbuf: voltar do fundo (2026-11-17, retomada.gd)
const MENU_CAMPOS = ['abrir', 'quadro', 'quadro2', 'itens', 'limite', 'grafico', 'pip', 'espera'];
const RESUMO_CAMPOS = ['fps', 'pior', 'proc', 'lentas', 'q50', 'q70', 'lenta', 'x', 'z', 'grafico', 'limite', 'cham', 'tri', 'obj', ...COMUM_CAMPOS];
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
const RESUMO_MAX = 3000; // uma linha por minuto de jogo: ~50 horas
const RESUMO_ARQ = path.resolve(process.env.DADOS || 'dados', 'lentidao-resumo.jsonl');
const resumos = [];
let resumoLinhas = 0;
try { for (const l of fs.readFileSync(RESUMO_ARQ, 'utf8').trim().split('\n').slice(-RESUMO_MAX)) if (l) resumos.push(JSON.parse(l)); } catch { /* ainda não tem */ }
// de qual celular veio (lentidao.gd _aparelho): modelo do aparelho e código sorteado no app, sem nome nem conta
function aparelhoLentidao(e, r) {
  if (typeof e.ap === 'string' && e.ap.length <= 40) r.ap = e.ap;
  if (typeof e.inst === 'string' && /^[0-9a-f]{8}$/.test(e.inst)) r.inst = e.inst;
  // placa de vídeo e motor de desenho (vulkan / opengl3): qual celular caiu no OpenGL e qual placa dá problema
  if (typeof e.placa === 'string' && e.placa.length <= 40 && /^[\w .()+\-/]*$/.test(e.placa)) r.placa = e.placa;
  if (typeof e.drv === 'string' && /^[a-z0-9_]{1,16}$/.test(e.drv)) r.drv = e.drv;
  // pele rosa no Mali-G72 (2026-11-18): de onde o jogo leu as texturas (imagem_cpu.gd) e a cor média da pele
  if (e.img && typeof e.img === 'object' && !Array.isArray(e.img)) {
    const p = {};
    for (const k of ['arq', 'gpu', 'nulo']) if (Number.isFinite(e.img[k])) p[k] = e.img[k];
    if (Object.keys(p).length) r.img = p;
  }
  if (e.pele && typeof e.pele === 'object' && !Array.isArray(e.pele)) {
    const p = {};
    for (const [k, v] of Object.entries(e.pele).slice(0, 6)) if (/^[\w.\-:]{1,40}$/.test(k) && /^[0-9a-f]{6}$/.test(v)) p[k] = v;
    if (Object.keys(p).length) r.pele = p;
  }
  return r;
}
function guardarLentidao(c, e, sala) {
  if (!e || typeof e !== 'object') return;
  if (e.tipo === 'entrada') { // linha do tempo da entrada (ms desde que o app abriu), uma por abertura
    const r = { servidor: Date.now(), tipo: 'entrada' };
    for (const k of ENTRADA_CAMPOS) if (Number.isFinite(e[k])) r[k] = e[k];
    if (typeof e.versao === 'string' && e.versao.length < 16) r.versao = e.versao;
    if (typeof e.motivo === 'string' && /^[a-z_]{1,16}$/.test(e.motivo)) r.motivo = e.motivo; // por que voltou para a tela inicial
    // quanto cada parte da abertura levou (main.gd _passo, ms): só números, nomes curtos, no máximo 40
    if (e.partes && typeof e.partes === 'object' && !Array.isArray(e.partes)) {
      const p = {};
      for (const [k, v] of Object.entries(e.partes).slice(0, 40)) if (/^[a-z_:0-9]{1,24}$/.test(k) && Number.isFinite(v)) p[k] = Math.round(v);
      if (Object.keys(p).length) r.partes = p;
    }
    // voltar do segundo plano (retomada.gd, 2026-11-17): por que o Android fechou o app da última vez e as partes do
    // preparo dos efeitos (aquecer.gd tempos). Só números, mais a descrição curta do Android
    const numeros = (o, max) => {
      if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
      const p = {};
      for (const [k, v] of Object.entries(o).slice(0, max)) if (/^[a-z_0-9]{1,16}$/.test(k) && Number.isFinite(v)) p[k] = v;
      return Object.keys(p).length ? p : null;
    };
    const saida = numeros(e.saida, 8);
    if (saida) {
      if (typeof e.saida.desc === 'string') saida.desc = e.saida.desc.slice(0, 60).replace(/[^\w .,:;()=\-/]/g, '');
      r.saida = saida;
    }
    const aq = numeros(e.aq, 8);
    if (aq) r.aq = aq;
    return guardarLinha(aparelhoLentidao(e, r));
  }
  if (e.tipo === 'resumo') {
    const r = { servidor: Date.now(), tipo: 'resumo' };
    for (const k of RESUMO_CAMPOS) if (Number.isFinite(e[k])) r[k] = e[k];
    r.montado = e.montado === true;
    if (typeof e.versao === 'string' && e.versao.length < 16) r.versao = e.versao;
    aparelhoLentidao(e, r);
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
    return guardarLinha(aparelhoLentidao(e, r));
  }
  const r = { servidor: Date.now(), tickPico: Math.round(carga.picoPing), posGap: c.userData?.gapJan ?? null, relogioSrv: sala?.relogio != null ? +sala.relogio.toFixed(3) : null };
  for (const k of LENTIDAO_CAMPOS) if (Number.isFinite(e[k])) r[k] = e[k];
  r.montado = e.montado === true;
  for (const k of ['ev', 'ev0']) {
    const v = eventosLentidao(e[k]);
    if (v) r[k] = v;
  }
  // quadro lento (lentidao.gd parte): {parte: ms} do pior quadro do segundo
  if (e.qev && typeof e.qev === 'object' && !Array.isArray(e.qev)) {
    const q = {};
    for (const [k, v] of Object.entries(e.qev).slice(0, 8)) if (typeof k === 'string' && k.length < 20 && Number.isFinite(v)) q[k] = v;
    if (Object.keys(q).length) r.qev = q;
  }
  if (typeof e.versao === 'string' && e.versao.length < 16) r.versao = e.versao;
  guardarLinha(aparelhoLentidao(e, r));
}
function guardarLinha(r) {
  lentidoes.push(r);
  if (lentidoes.length > LENTIDAO_MAX) lentidoes.splice(0, lentidoes.length - LENTIDAO_MAX);
  if (++lentidaoLinhas > 2 * LENTIDAO_MAX) {
    lentidaoLinhas = 0;
    fs.writeFile(LENTIDAO_ARQ, lentidoes.map((x) => JSON.stringify(x)).join('\n') + '\n', () => {});
  } else fs.appendFile(LENTIDAO_ARQ, JSON.stringify(r) + '\n', () => {});
}
// ?inst=código (ou ?ap=modelo) mostra só as de um celular (até as últimas LENTIDAO_MAX); sem filtro, as últimas 100.
// Segurança 2026-11-19 (Presidente): aberta, só os números gerais (sem o código do aparelho nem a posição x/z, e sem o
// filtro por código); o detalhe só com o crachá OIDC da ronda e dos robôs (diagVale), como em /npcs/conversas.json
// sem crachá também sai o que junto vira impressão digital de um celular raro (placa, motor, cor da pele medida) e a hora
// exata (vai arredondada para a hora cheia); revisão independente 2026-11-19
const SEM_CRACHA = new Set(['inst', 'x', 'z', 'placa', 'drv', 'pele']);
const geral = (x) => { const r = Object.fromEntries(Object.entries(x).filter(([k]) => !SEM_CRACHA.has(k))); if (Number.isFinite(r.servidor)) r.servidor = Math.floor(r.servidor / 3600e3) * 3600e3; return r; };
async function diagVale(req) {
  if (!sessaoDe(req) && !req.query.teste) return false;
  try { return await roboConfere({ cracha: sessaoDe(req), teste: req.query.teste }, [CONVERSAS_WORKFLOW, ROBO_WORKFLOW, ROBO_CELULAR, ROBO_REAL]); } catch { return false; }
}
const doCelular = (lista, q, n, cracha) => {
  const inst = cracha && typeof q.inst === 'string' ? q.inst : '', ap = cracha && typeof q.ap === 'string' ? q.ap : ''; // filtros só com crachá
  const f = lista.filter((x) => (!inst || x.inst === inst) && (!ap || x.ap === ap)).slice(inst || ap ? -lista.length : -n);
  return cracha ? f : f.map(geral);
};
app.get('/lentidao', async (req, res) => res.json(doCelular(lentidoes, req.query, 100, await diagVale(req))));
app.get('/lentidao/resumo', async (req, res) => res.json(doCelular(resumos, req.query, 200, await diagVale(req))));
// quais celulares mandaram: modelo, código, quantas linhas e a última versão (sem crachá: por modelo, sem o código)
app.get('/lentidao/celulares', async (req, res) => {
  const cracha = await diagVale(req), m = {};
  for (const x of [...lentidoes, ...resumos]) {
    if (!x.inst) continue;
    const k = cracha ? x.inst : x.ap || '?';
    const c = (m[k] ||= cracha ? { inst: x.inst, ap: x.ap, linhas: 0, versao: x.versao, ultima: 0 } : { ap: x.ap, linhas: 0, versao: x.versao, ultima: 0 });
    c.linhas++;
    if (x.placa) c.placa = x.placa;
    if (x.drv) c.drv = x.drv;
    if (x.servidor > c.ultima) { c.ultima = x.servidor; c.versao = x.versao; }
  }
  res.json(Object.values(m).sort((a, b) => b.ultima - a.ultima).map((c) => (cracha ? c : { ap: c.ap, linhas: c.linhas, versao: c.versao })));
});

// carga (André 2026-11-11, ping alto): quanto o servidor gasta por passo (de 50 ms), quanto tempo está ligado e quantos jogam
// relogio (2026-11-13, "slow motion" no lobo): segundos do jogo no servidor por segundo de verdade desde a última leitura.
// Abaixo de 1, o servidor anda devagar (passos atrasando) e a folga de velocidade do herói enche mais devagar que ele corre.
// Segurança 2026-11-19 (Presidente): ler /saude não zera mais nada (antes qualquer um apagava o pico lendo a página). Os
// números valem para a janela de SAUDE_JANELA ms: a cada janela o servidor guarda a que acabou e começa outra; a página
// mostra a última janela fechada junto com a atual (pico = o maior; contagens = a soma).
const SAUDE_JANELA = 60e3;
const relogioSrv = { sim: null, t: 0 };
let saudeAnterior = { pico: 0, silencioMs: 0, engasgos: 0, correcoes: 0, relogio: null };
setInterval(() => {
  let correcoes = 0; for (const s of salas) { correcoes += s.sim.correcoes || 0; s.sim.correcoes = 0; }
  const s0 = [...salas][0], agoraR = Date.now(); let relogio = null;
  if (s0) { if (relogioSrv.sim != null && agoraR > relogioSrv.t) relogio = +((s0.sim.tempo - relogioSrv.sim) / ((agoraR - relogioSrv.t) / 1000)).toFixed(3); relogioSrv.sim = s0.sim.tempo; relogioSrv.t = agoraR; }
  else relogioSrv.sim = null;
  saudeAnterior = { pico: carga.pico, silencioMs: carga.silencioMs, engasgos: carga.engasgos, correcoes, relogio };
  carga.pico = 0; carga.silencioMs = 0; carga.engasgos = 0;
}, SAUDE_JANELA).unref();
app.get('/saude', (_req, res) => {
  let jogadores = 0, agora = 0; for (const s of salas) { jogadores += s.clients.length; agora += s.sim.correcoes || 0; }
  const A = saudeAnterior;
  // correcoes = "corrigir" mandados (rollback), silencioMaxMs = maior tempo sem posição de um celular, engasgos = silêncios
  // de mais de 1 s; todos da última janela fechada mais a atual (1 a 2 min)
  res.json({ ok: true, contas: !!contas, ligadoMin: Math.round(process.uptime() / 60), salas: salas.size, jogadores, tickMs: +carga.ms.toFixed(2), tickPicoMs: +Math.max(carga.pico, A.pico).toFixed(1), memMb: Math.round(process.memoryUsage().rss / 1048576), correcoes: A.correcoes + agora, silencioMaxMs: Math.max(carga.silencioMs, A.silencioMs), engasgos: A.engasgos + carga.engasgos, relogio: A.relogio, janelaS: SAUDE_JANELA / 1000, reserva: reserva.estado });
});
// Reinício com aviso na tela (André 2026-11-12): faixa "o servidor reinicia em 1 minuto" e depois a contagem grande de
// REINICIO.contagem s (godot-prototipo/reinicio.gd). O servidor manda {t:'reinicio', s} a cada 10 s (quem entra no meio também vê)
// e no começo da contagem; o celular conta sozinho entre um e outro. No fim grava o progresso de todos e sai (o systemd liga de novo).
// Com ninguém online, sai na hora. Serve ao servidor novo do merge (server/atualizar.js) e ao reinício programado.
let reiniciando = null;
const alguemOnline = () => [...salas].some((s) => s.clients.some((c) => !c.auth?.robo)); // o robô de testes não segura o reinício
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

// Reinício programado (REINICIO em shared/dados.js): só na máquina instalada, FIXO às 05h e 14h de Brasília. Avisa no
// chat geral, depois a faixa na tela com a contagem, grava todo mundo e sai; o systemd (Restart=always) liga de novo. Com a
// sala vazia, reinicia sem aviso. Antes, pergunta ao atualizador se há servidor novo esperando: se houver, ele instala e
// esse já é o reinício (um só). Desde 2026-11-21 (André) só este reinício instala pacote comum; publicar não reinicia. REINICIO_TESTE=N (minutos): reinicia N minutos depois de ligar (teste local).
if (naOracle || process.env.REINICIO_TESTE) {
  const teste = Number(process.env.REINICIO_TESTE) || 0;
  const alvo = teste ? Date.now() + teste * 60e3 : proximoReinicio(Date.now(), REINICIO.horarios);
  console.log(`Próximo reinício programado: ${new Date(alvo).toISOString()}`);
  const avisados = new Set();
  setInterval(async () => {
    const falta = (alvo - Date.now()) / 1000, alguem = alguemOnline();
    for (const min of REINICIO.avisos) if (alguem && falta <= min * 60 && falta > 0 && !avisados.has(min)) {
      avisados.add(min);
      const sala = [...salas][0];
      sala?.sim.anunciar(`O servidor vai reiniciar em ${min} minuto${min > 1 ? 's' : ''} para ficar mais leve. Seu progresso fica salvo; é só entrar de novo.`);
    }
    if (falta <= REINICIO.aviso && !avisados.has('fim')) {
      avisados.add('fim');
      try { await naOracle?.conferir?.({ adiantar: (Math.max(0, falta) + 5) * 1000, doReinicio: true }); } catch { /* sem pacote: só reinicia */ }
      reiniciarComAviso('programado', Math.max(0, Math.round((alvo - Date.now()) / 1000)));
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

// ---------- robô de testes (ferramentas/robo/robo.mjs, André 2026-11-14) ----------
// Quem pode ser o robô: só o workflow .github/workflows/robo.yml deste repositório, na main. O GitHub assina um crachá
// (OIDC) para aquele workflow e aqui a assinatura é conferida com as chaves públicas do GitHub: nenhuma senha ou segredo
// fica guardado em lugar nenhum. ROBO_TESTE (só na máquina de quem testa, nunca na Oracle) troca o crachá por um texto.
const chavesGithub = createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const ROBO_REPO = 'rcandrerc/rpg-realista', ROBO_WORKFLOW = `${ROBO_REPO}/.github/workflows/robo.yml@refs/heads/main`;
// o robô 2 (o app como no Poco X7, robo-celular.yml) só manda relatório: não pega sessão (a conta é do robô 1)
const ROBO_CELULAR = `${ROBO_REPO}/.github/workflows/robo-celular.yml@refs/heads/main`;
// celulares de verdade (Firebase Test Lab, robo-celular-real.yml): conta própria por celular, 'robo:celular1'..5 (o robô 1 segue jogando)
const ROBO_REAL = `${ROBO_REPO}/.github/workflows/robo-celular-real.yml@refs/heads/main`;
async function roboConfere(body, workflows = [ROBO_WORKFLOW]) {
  if (process.env.ROBO_TESTE && body?.teste === process.env.ROBO_TESTE) return true;
  const { payload } = await jwtVerify(String(body?.cracha || ''), chavesGithub, { issuer: 'https://token.actions.githubusercontent.com', audience: 'age-of-embers-robo' });
  // o nome no GitHub é 'Rpg-realista' (maiúscula): a conferência não liga para maiúscula
  return String(payload.repository).toLowerCase() === ROBO_REPO && workflows.includes(String(payload.job_workflow_ref).toLowerCase());
}
// Segurança 2026-11-19 (Presidente): a trava de 5 s é por conta de robô (antes era uma só para todos: os 50 robôs do teste
// de carga não entravam).
// carga (QA, teste dos 50 robôs): o robo.yml pede { carga: 1..ROBO_CARGA } e cada robô tem conta própria ('robo:carga7')
// Sem trava na porta (revisão independente 2026-11-19: uma trava global deixava qualquer um barrar o robô mandando lixo,
// e atrás do proxy todos têm o mesmo endereço): conferir o crachá custa ~50 µs e as chaves do GitHub ficam guardadas
// (busca nova no máximo a cada 30 s). Crachá certo nunca espera por culpa de outro.
const ROBO_CARGA = 50;
const roboT = new Map(); // conta do robô -> hora do último login (antes um número só, para todos)
app.post('/conta/robo', async (req, res) => {
  const agora = Date.now();
  try {
    let R = null;
    if (await roboConfere(req.body)) { const k = req.body?.carga | 0; R = k >= 1 && k <= ROBO_CARGA ? roboCarga(k) : ROBO; }
    else if (await roboConfere(req.body, [ROBO_REAL])) R = roboCel(Math.min(5, Math.max(1, req.body?.n | 0)));
    if (!R) return res.status(401).json({ erro: 'não é o robô' });
    if (agora - (roboT.get(R.google) || 0) < 5000) return res.status(429).json({ erro: 'devagar' });
    roboT.set(R.google, agora);
    return res.json(contas.entrarRobo(R));
  } catch (e) { console.warn('robô recusado:', e.message); res.status(401).json({ erro: 'crachá do robô inválido' }); }
});
// relatórios: o robô manda o turno de tempos em tempos (o mesmo turno é trocado pelo mais novo); ficam os últimos ROBO_MAX
const ROBO_MAX = 120, ROBO_ARQ = path.resolve(process.env.DADOS || 'dados', 'robo.jsonl');
const roboTurnos = [];
try { for (const l of fs.readFileSync(ROBO_ARQ, 'utf8').trim().split('\n').slice(-ROBO_MAX)) if (l) roboTurnos.push(JSON.parse(l)); } catch { /* ainda não tem */ }
app.post('/robo/relatorio', express.json({ limit: '64kb' }), async (req, res) => {
  const conta = contas?.porSessao(sessaoDe(req));
  // robô 1 manda com a sessão dele; o robô 2 manda com o crachá OIDC do GitHub no lugar da sessão
  let vale = !!conta?.robo;
  if (!vale && sessaoDe(req).split('.').length === 3) { try { vale = await roboConfere({ cracha: sessaoDe(req) }, [ROBO_WORKFLOW, ROBO_CELULAR, ROBO_REAL]); } catch { vale = false; } }
  if (!vale) return res.status(401).json({ erro: 'só o robô' });
  const r = req.body;
  if (!r || typeof r !== 'object' || typeof r.turno !== 'string' || r.turno.length > 40) return res.status(400).json({ erro: 'relatório inválido' });
  r.recebido = Date.now();
  const i = roboTurnos.findIndex((x) => x.turno === r.turno);
  // celulares de verdade da mesma rodada mandam o mesmo turno, um aparelho cada: junta os aparelhos num cartão só
  if (i >= 0 && r.fisico && roboTurnos[i].fisico) {
    const a = roboTurnos[i];
    r.modos = { ...(a.modos || {}), ...(r.modos || {}) };
    r.problemas = [...(a.problemas || []), ...(r.problemas || [])].slice(-40);
    r.inicio = Math.min(a.inicio || r.inicio, r.inicio || a.inicio);
  }
  if (i >= 0) roboTurnos[i] = r; else roboTurnos.push(r);
  if (roboTurnos.length > ROBO_MAX) roboTurnos.splice(0, roboTurnos.length - ROBO_MAX);
  fs.writeFile(ROBO_ARQ, roboTurnos.map((x) => JSON.stringify(x)).join('\n') + '\n', () => {});
  res.json({ ok: true });
});
// Livro-caixa da economia (André 2026-11-16, shared/economia.js): o ouro que entra e sai por fonte, faixa de nível e dia,
// de todas as salas juntas. Grava a cada minuto (o servidor reinicia com as atualizações) e guarda CAIXA.dias dias.
const CAIXA_ARQ = path.resolve(process.env.DADOS || 'dados', 'economia.json');
let livroCaixa = {}, caixaSujo = false;
try { livroCaixa = JSON.parse(fs.readFileSync(CAIXA_ARQ, 'utf8')) || {}; } catch { /* ainda não tem */ }
setInterval(() => {
  if (!caixaSujo) return;
  caixaSujo = false;
  const dias = Object.keys(livroCaixa).sort();
  for (const d of dias.slice(0, Math.max(0, dias.length - CAIXA.dias))) delete livroCaixa[d];
  fs.writeFile(CAIXA_ARQ, JSON.stringify(livroCaixa), () => {});
}, 60e3).unref();
app.get('/economia.json', (_req, res) => res.json(resumoCaixa(livroCaixa)));
app.get('/economia', (_req, res) => res.type('html').send(paginaEconomia(resumoCaixa(livroCaixa))));
function paginaEconomia(r) {
  const n = (x) => (x == null ? '–' : Number(x).toLocaleString('pt-BR'));
  const lista = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} ${n(v)}`).join(' · ') || '–';
  const dias = Object.keys(r).sort().reverse().map((dia) => Object.entries(r[dia]).map(([quem, F]) => `<h2>${esc(dia)} · ${quem === 'robo' ? 'robô' : 'jogadores'}</h2>
<table><tr><th>Nível</th><th>Jogadores</th><th>Horas</th><th>Abates/h</th><th>Entrou/h</th><th>Saiu/h</th><th>Guardado médio</th><th>De onde veio</th><th>Para onde foi</th></tr>
${Object.entries(F).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([fx, f]) => `<tr><td>${esc(fx)}</td><td>${f.jogadores}</td><td>${f.horas}</td><td>${n(f.abatesHora)}</td><td>${n(f.entrouHora)}</td><td>${n(f.saiuHora)}</td><td>${n(f.guardadoMedio)}</td><td>${lista(f.entradas)}</td><td>${lista(f.saidas)}</td></tr>`).join('\n')}</table>`).join('')).join('');
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Economia</title>
<style>body{font:14px system-ui;margin:16px;background:#14110e;color:#eee}table{border-collapse:collapse;width:100%;margin-bottom:18px}td,th{border:1px solid #444;padding:4px 6px;text-align:left;vertical-align:top}th{background:#2a241d}h2{font-size:16px;margin:18px 0 6px}</style>
<h1>Livro-caixa do ouro</h1><p>Ouro que entrou e saiu por faixa de nível, por dia (horário de Brasília). Sem nome de jogador.</p>${dias || '<p>Ainda sem dados.</p>'}</html>`;
}
// NPCs com IA (André 2026-11-16: "relatórios de Dário e de Cecília" na ronda diária): o que cada um fez hoje, só números
// do jogo (nível, ouro, missão, minutos de caça e de missão). Nada de conversa, memória ou de quem é amigo deles.
// evolucao (André 2026-11-17): cada nível, missão entregue, queda, etapa travada, reforço e evolução, com a hora.
// Segurança 2026-11-19 (Presidente): a posição (x, z), morto, preso, a missão e o diário de evolução (que tem a etapa e a
// hora da morte) só com o crachá da ronda (diagVale): com a guerra, saber onde a Geada está vira vantagem. Sem crachá,
// só os números do dia.
app.get('/npcs.json', async (req, res) => {
  const cracha = await diagVale(req);
  const dia = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10), vivos = new Map();
  for (const s of salas) for (const ctx of s.sim.amigosIa) if (ctx.amiga) vivos.set(ctx.AMIGA.id, { a: ctx.amiga, ctx });
  const l = [];
  // a Geada (Kira, Rufo e Lis) também (plano de lançamento, 2026-11-19: "evoluem como a Cecília e entram no relatório das 10h")
  for (const D of [...AMIGOS_VIRTUAIS, ...RIVAIS]) {
    const v = vivos.get(D.id);
    let d = v?.a;
    if (!d && contas) try { d = D.terreno ? contas.loteDoDono(D.conta)?.dados?.amiga : contas.lerMundo('npc:' + D.id); } catch { d = null; }
    if (!d) { l.push({ nome: D.nome, id: D.id, salvo: false }); continue; }
    const p = d.prog || {}, h = p.hist || {};
    l.push({ nome: D.nome, id: D.id, ...(D.raca ? { raca: D.raca } : {}), noMundo: !!v, nivel: p.nivel | 0, ouro: p.ouro | 0, ...(cracha ? { missao: h.p ?? null, etapa: h.e ?? null } : {}),
      cacaMinHoje: d.grind?.dia === dia ? Math.round((d.grind.seg || 0) / 60) : 0, missaoMinHoje: d.missaoDia?.dia === dia ? Math.round((d.missaoDia.seg || 0) / 60) : 0,
      salvoHa: d.t ? Math.round((Date.now() - d.t) / 60000) : null,
      // leilão (André 2026-11-21: "se eu pedir um relatório, vou conseguir saber de cada personagem"): jeito, meta e poupança
      leilao: { jeito: { ...LEILAO_BOT.jeitos.padrao, ...(LEILAO_BOT.jeitos[D.id] || {}) }, meta: (d.leilao || d.leilaoBot)?.meta || null, poupado: (d.leilao || d.leilaoBot)?.poupado | 0, negocios: Array.isArray((d.leilao || d.leilaoBot)?.log) ? (d.leilao || d.leilaoBot).log.slice(-12) : [] },
      ...(cracha ? { evolucao: Array.isArray(d.evolucao) ? d.evolucao.slice(-40) : [] } : {}), ...(v && cracha ? { x: Math.round(v.a.x), z: Math.round(v.a.z), morto: !!v.a.morto, preso: !!v.a.ia?.viagem?.bloqueio } : {}) });
  }
  res.json({ dia, npcs: l });
});
// Cópia cifrada das contas para fora da máquina (plano v3, frente 2; desenho aprovado pelo Presidente 19/11). Só o
// workflow contas-copia.yml da main deste repositório (crachá OIDC do GitHub: repositório, ramo main e nome do workflow
// conferidos) e no máximo uma vez por hora. O servidor cifra com a chave PÚBLICA (server/copia-contas.js): nem quem
// baixa vê o banco aberto. Sem a variável ROBO_TESTE de atalho: aqui só vale o crachá de verdade. A cópia sai sem as
// chaves de IA e sem sessões, assinada com a chave Ed25519 do servidor, e é feita num processo filho (revisão da frente 3).
limparSobrasCopia();
const COPIA_CAMINHO = '/.github/workflows/contas-copia.yml@refs/heads/main';
let copiaT = 0;
app.get('/contas/copia-cifrada', async (req, res) => {
  let vale = false;
  try {
    const { payload } = await jwtVerify(sessaoDe(req), chavesGithub, { issuer: 'https://token.actions.githubusercontent.com', audience: 'age-of-embers-robo' });
    const ref = String(payload.job_workflow_ref), i = ref.indexOf('/.github/');
    // o dono/nome do repositório não liga para maiúscula (o GitHub manda 'Rpg-realista'); o caminho do workflow, sim
    vale = String(payload.repository).toLowerCase() === ROBO_REPO && payload.ref === 'refs/heads/main' && i > 0 && ref.slice(0, i).toLowerCase() === ROBO_REPO && ref.slice(i) === COPIA_CAMINHO;
  } catch { vale = false; }
  if (!vale) return res.status(401).json({ erro: 'só o workflow da cópia' });
  if (!contas) return res.status(503).json({ erro: 'sem contas' });
  if (!CHAVE_COPIA.trim()) return res.status(503).json({ erro: 'sem chave da cópia' });
  if (Date.now() - copiaT < 3600e3) return res.status(429).json({ erro: 'uma por hora' });
  copiaT = Date.now();
  try {
    const { arquivo, apagar } = await gerarCopia({ banco: path.join(contas.pasta, 'contas.db'), pastaDados: contas.pasta });
    res.set('Content-Type', 'application/x-tar').set('Cache-Control', 'no-store');
    res.sendFile(arquivo, (e) => { apagar(); if (e) { copiaT = 0; console.error('Falha ao mandar a cópia cifrada:', e.message); } });
  } catch (e) { copiaT = 0; console.error('Falha na cópia cifrada:', e.message); res.status(500).json({ erro: 'falhou' }); } // falhou: pode tentar de novo
});
// A pública Ed25519 que assina as cópias (o voltar-contas.sh confere com ela; fixe-a em ferramentas/servidor/).
app.get('/contas/copia-assinatura.pub.pem', (_req, res) => {
  if (!contas) return res.status(503).json({ erro: 'sem contas' });
  const k = chaveAssinaturaCopia(contas.pasta, false); // só mostra; quem cria é a 1ª cópia
  if (!k) return res.status(404).json({ erro: 'ainda sem cópia' });
  res.type('text/plain').send(k.pub);
});

// Conversas da Cecília e do Dário para a ronda diária (André 2026-11-17: "a mesma coisa que você faz com os erros do jogo,
// fazer com o chat dela"). São conversas de jogadores: só o workflow cecilia-conversas.yml (crachá OIDC do GitHub, na main)
// lê, e ele cifra tudo com a chave pública de quem pediu antes de guardar. Nada de chave de IA de ninguém.
const CONVERSAS_WORKFLOW = `${ROBO_REPO}/.github/workflows/cecilia-conversas.yml@refs/heads/main`;
app.get('/npcs/conversas.json', async (req, res) => {
  let vale = false;
  try { vale = await roboConfere({ cracha: sessaoDe(req), teste: req.query.teste }, [CONVERSAS_WORKFLOW]); } catch { vale = false; }
  if (!vale) return res.status(401).json({ erro: 'só a ronda' });
  const vivos = new Map(), l = [];
  for (const s of salas) for (const ctx of s.sim.amigosIa) if (ctx.amiga) vivos.set(ctx.AMIGA.id, ctx.amiga);
  for (const D of AMIGOS_VIRTUAIS) {
    let d = vivos.get(D.id);
    const vivo = !!d;
    if (!d && contas) try { d = D.terreno ? contas.loteDoDono(D.conta)?.dados?.amiga : contas.lerMundo('npc:' + D.id); } catch { d = null; }
    if (!d) { l.push({ nome: D.nome, id: D.id, salvo: false }); continue; }
    const conversas = { ...(d.conversasSalvas || d.conversas || {}) };
    for (const [k, c] of Object.entries(d.ia?.conversas || {})) if (Array.isArray(c) && c.length) conversas[k] = c.map((m) => ({ de: m.de, texto: String(m.texto).slice(0, 300), ...(m.nome ? { nome: m.nome } : {}) }));
    l.push({ nome: D.nome, id: D.id, noMundo: vivo, conversas, registro: d.registro || {}, fatos: d.fatos || {}, memorias: d.memorias || {} }); // registro: o dia inteiro (André 2026-11-18)
  }
  res.json({ t: Date.now(), npcs: l });
});
app.get('/robo.json', (req, res) => res.json(roboTurnos.slice(-(Number(req.query.n) || 20))));
app.get('/robo', (_req, res) => res.type('html').send(paginaRobo(roboTurnos.slice(-30).reverse())));
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function paginaRobo(lista) {
  const hora = (ms) => (ms ? new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-');
  const n = (v, u = '') => (v == null ? '-' : `${v}${u}`);
  const celular = (r) => { // robô 2: o app de verdade como no Poco X7 (ferramentas/robo/celular.gd)
    const probs = (r.problemas || []).slice(0, 15).map((x) => `<li>${esc(x)}</li>`).join('');
    const modos = Object.entries(r.modos || {}).map(([nome, M]) => `<h3>${esc(nome)} · ${esc(M.placa)}</h3>
${M.missoes ? `<p><b>Missões</b> ${n(M.missoes.feitas)} feitas, ${n(M.missoes.puladas)} puladas (travou) · nível ${n(M.missoes.nivel_de)} → ${n(M.missoes.nivel_ate)} · ${n(M.missoes.toques)} toques na tela · agora: ${esc(M.missoes.agora)}</p>` : ''}
<p><b>FPS</b> ${n(M.fps)} · <b>Travadas</b> ${n(M.travadas?.acima100)} acima de 100 ms, ${n(M.travadas?.acima250)} acima de 250 ms, ${n(M.travadas?.acima1000)} acima de 1 s · <b>Memória</b> ${n(M.mem_max, ' MB')}</p>
<ul>${Object.entries(M.trechos || {}).map(([t, T]) => `<li><b>${esc(t)}</b>: ${n(T.fps)} FPS, quadro ${n(T.p50, ' ms')} (5% piores ${n(T.p95, ' ms')}, pior ${n(T.pior, ' ms')}), scripts ${n(T.proc, ' ms')}, ${n(T.cham)} chamadas, ${n(T.tri)} mil triângulos</li>`).join('')}</ul>`).join('');
    const real = r.real ? `<p><b>Celulares de verdade (Alta, últimos minutos)</b>: ${n(r.real.fps)} FPS, scripts ${n(r.real.proc, ' ms')}, placa ${n(r.real.gpu, ' ms')}, pior quadro ${n(r.real.pior, ' ms')}</p>` : '';
    return `<section><h2>📱 ${r.fisico ? 'Celular de verdade (Firebase Test Lab)' : 'Robô 2 (app como no Poco X7)'} · ${hora(r.inicio)} até ${hora(r.ultimo)}</h2>${modos}${real}
${r.fisico ? '' : '<p style="opacity:.75">Sem placa de vídeo de celular: "sem tela" mede o processador; o Vulkan por software desenha bem mais devagar que o celular.</p>'}
${probs ? `<h3>Achados</h3><ul>${probs}</ul>` : '<p>Nenhum problema achado.</p>'}</section>`;
  };
  const cartao = (r) => {
    if (r.tipo === 'celular') return celular(r);
    const p = r.ping || {}, s = r.servidor || {}, m = r.missoes || {};
    const probs = (r.problemas || []).slice(0, 15).map((x) => `<li>${esc(x)}</li>`).join('');
    return `<section><h2>${r.ativo ? '🟢 Jogando' : '⚪ Terminou'} · ${hora(r.inicio)} até ${hora(r.ultimo)}</h2>
<p><b>Nível</b> ${n(r.nivel?.de)} → ${n(r.nivel?.ate)} · <b>Missões</b> ${n(m.feitas, '')} feitas, ${n(m.puladas, '')} puladas, agora ${esc(m.agora || '-')}</p>
<p><b>Ping</b> médio ${n(p.p50, ' ms')} · pior 5% ${n(p.p95, ' ms')} · pior ${n(p.max, ' ms')} · <b>Quedas</b> ${n(r.quedas)} (reinícios do servidor ${n(r.reinicios)})</p>
<p><b>Servidor</b> passo ${n(s.tickMs, ' ms')}, pico ${n(s.tickPicoMs, ' ms')}, memória ${n(s.memMb, ' MB')} · <b>Fotos atrasadas</b> ${n(r.fotos?.atrasadas)} (pior ${n(r.fotos?.pior, ' ms')}) · <b>Correções de posição</b> ${n(r.correcoes)}</p>
<p><b>Mortes</b> ${n(r.mortes)} · <b>Monstros</b> ${n(r.abates)} · <b>Coletas</b> ${n(r.coletas)} · <b>Resposta das ações</b> ${n(r.resposta?.p50, ' ms')} (pior ${n(r.resposta?.max, ' ms')})</p>
${probs ? `<h3>Achados</h3><ul>${probs}</ul>` : '<p>Nenhum problema achado.</p>'}</section>`;
  };
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Robô de testes</title>
<style>body{font:15px system-ui,sans-serif;background:#16130f;color:#eee4d2;margin:0;padding:16px;max-width:760px}h1{font-size:20px}h2{font-size:16px;margin:0 0 6px}h3{font-size:14px;margin:8px 0 2px}section{background:#241f18;border:1px solid #4a3d2c;border-radius:10px;padding:12px;margin:12px 0}p{margin:4px 0}ul{margin:4px 0;padding-left:20px}b{color:#f0b35a}</style>
<h1>Robô de testes · Age of Embers</h1><p>Robô 1: turnos de até 6 h jogando no servidor de verdade. Robô 2 (📱): o app de verdade como no Poco X7. Horário de Brasília.</p>
${lista.length ? lista.map(cartao).join('') : '<p>O robô ainda não jogou.</p>'}</html>`;
}

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
// ---------- porta de entrada das salas (revisão de segurança 2026-11-19) ----------
// O Colyseus só confere o login quando o socket liga (onAuth da sala). Antes disso qualquer um, sem conta, abria sala vazia
// (POST /matchmake/create, ~27 ms de CPU e 45 s viva cada uma: dava para travar o jogo de todos), guardava lugar nas salas
// de verdade e via a lista delas. Agora: só joinOrCreate (o que o app e o site usam) e reconnect (volta da queda);
// joinOrCreate só com sessão válida e no máximo MATCH.porConta pedidos por conta a cada MATCH.janela ms; sem lista de salas.
const MATCH = { porConta: 20, janela: 60000, corpoMax: 8192 }; // 20 por minuto: sobra para o app tentar de novo na internet ruim
const pedidosSala = new Map(); // conta -> horas (ms) dos últimos joinOrCreate
const ctrl = colyseus.matchMaker.controller;
ctrl.exposedMethods = ['joinOrCreate', 'reconnect'];
ctrl.getAvailableRooms = async () => [];
const chamarOriginal = ctrl.invokeMethod.bind(ctrl);
ctrl.invokeMethod = async (metodo, sala, opcoes = {}, auth) => {
  if (contas && metodo === 'joinOrCreate') {
    const conta = contas.porSessao(opcoes?.sessao);
    if (!conta) throw new ServerError(401, 'login');
    const agora = Date.now(), l = (pedidosSala.get(conta.id) || []).filter((t) => agora - t < MATCH.janela);
    if (l.length >= MATCH.porConta) throw new ServerError(429, 'muitas tentativas, espere um pouco');
    l.push(agora); pedidosSala.set(conta.id, l);
    if (pedidosSala.size > 5000) for (const [k, v] of pedidosSala) if (!v.some((t) => agora - t < MATCH.janela)) pedidosSala.delete(k);
  }
  return chamarOriginal(metodo, sala, opcoes, auth);
};
gameServer.listen(PORTA).then(() => {
  // corpo do pedido de sala: o Colyseus junta tudo sem limite (dava para mandar GB e acabar a memória)
  servidor.prependListener('request', (req) => {
    if (!String(req.url).includes('/matchmake')) return; // o mesmo teste que o Colyseus usa para pegar o pedido
    if (Number(req.headers['content-length'] || 0) > MATCH.corpoMax) { req.destroy(); return; }
    let n = 0; req.on('data', (c) => { n += c.length; if (n > MATCH.corpoMax) req.destroy(); });
  });
  console.log(`Servidor do RPG no ar: http://localhost:${PORTA}`); vigiarReserva();
});
