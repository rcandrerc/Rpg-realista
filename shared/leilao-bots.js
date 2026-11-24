// Os bots no leilão (André 2026-11-21: "queria que eles participassem da Action House... preços competitivos, difíceis
// de comprar... flutuação de acordo com o mercado"). Plano aprovado no mesmo dia: vendem o que sobra, compram o que
// melhora o personagem (prioridade: material de evoluir/reforçar > peça melhor > Tomo > consumível), guardam poupança para a
// próxima grande peça e só gastam com genérico quando o ouro passa de 1,5x a meta. Números e personalidade em LEILAO_BOT
// (shared/dados.js); o preço de mercado e a inflação em shared/leilao.js.
// Estas funções entram na Simulacao (Object.assign em simulacao.js) e rodam no contexto de cada bot (contextoDeAmigo em
// shared/amiga.js): this.AMIGA é a definição dele, this.amiga o corpo. Tudo de verdade: o ouro sai e entra da mochila dele,
// o anúncio aparece para todos com o nome dele e quem vende para ele recebe o ouro com o Otávio.
import { LEILAO_BOT, ITENS, LOJA, precoLoja, DIA, RARIDADES, ENCOMENDA } from './dados.js';
import { Leilao, LEILAO, chaveMercado } from './leilao.js';
import { contar, tirar, guardar, ehEquip, itemValido, nomeItem, precoVenda, reforcoOk, materialReforco, vigorAgora, profNivel } from './progresso.js';
import { motivoLibera } from './historia.js';

export const jeitoLeilao = (id) => ({ ...LEILAO_BOT.jeitos.padrao, ...(LEILAO_BOT.jeitos[id] || {}) });
const nota = (it) => (it ? (it.r | 0) * 100 + (it.e | 0) * 10 - (it.d | 0) : -1);
const FARMAVEL = new Set(Object.values(ENCOMENDA.recursos).map((r) => r.item).filter((k) => ITENS[k]));
const espalha = (id) => { let h = 7; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

export const LeilaoBots = {
  // chamado na vila (arrumarMochilaAmiga): olha o leilão se já deu a hora (olhadasDia vezes por dia do jogo)
  leilaoTalvezAmiga(j) {
    if (!j?.bot || !j.prog || !j.ia || j.time || j.troca || j.morto || j.pvp || j.duelo) return false;
    const ia = j.ia, t = this.tempo;
    if (ia.leilaoT == null) { ia.leilaoT = t + 20 + (espalha(this.AMIGA.id) % 120); return false; } // cada um numa hora
    if (t < ia.leilaoT) return false;
    const [a, b] = LEILAO_BOT.olhadasDia, vezes = a + Math.floor(Math.random() * (b - a + 1));
    ia.leilaoT = t + (DIA.horaSeg * 24) / vezes;
    this.leilaoBotAmiga(j);
    return true;
  },
  // anota o que fez (relatório /npcs.json e a ficha do chat: ele só conta o que fez de verdade)
  anotarLeilaoAmiga(j, o, txt) {
    const lb = j.leilaoBot; (lb.log ||= []).push({ t: Date.now(), o, txt }); lb.log = lb.log.slice(-12);
    this.evolucaoAmiga?.(j, 'leilao', `${o}: ${txt}`);
  },
  // a meta: a peça mais fraca do corpo, uma raridade acima, pelo preço de mercado
  metaLeilaoAmiga(j, L, agora) {
    const p = j.prog; let fraca = null;
    for (const [l, it] of Object.entries(p.equip || {})) if (it && ehEquip(it.k) && (it.r | 0) < RARIDADES.length - 1 && (!fraca || nota(it) < nota(fraca.it))) fraca = { l, it };
    if (!fraca) return null;
    const alvo = { k: fraca.it.k, r: (fraca.it.r | 0) + 1 }, preco = Math.max(LEILAO_BOT.metaMin, L.precoMercado(alvo, agora));
    return { k: alvo.k, r: alvo.r, l: fraca.l, preco, nome: nomeItem(alvo), cara: preco > LEILAO_BOT.metaCara * Math.max(1, p.ouro | 0) };
  },
  // o que falta para evoluir a peça da meta (o caminho de "fabricar") e para reforçar as peças: { item: quantos }
  precisaLeilaoAmiga(j, meta) {
    const p = j.prog, quer = {};
    const it = meta && p.equip[meta.l], R = it && this.receitaEvoluir?.(it);
    if (R && profNivel(p.prof?.[R.prof]) >= R.nivel && !motivoLibera(p, 'forja') && !motivoLibera(p, 'evoluir', R.r)) for (const [k, n] of Object.entries(R.usa)) quer[k] = (quer[k] || 0) + n;
    for (const e of Object.values(p.equip || {})) { const m = e && ehEquip(e.k) && materialReforco(e); if (m) quer[m.k] = Math.max(quer[m.k] || 0, m.n * 2); }
    return quer;
  },
  // quanto custa farmar 1 unidade: o ouro que ganharia caçando no mesmo tempo, mais o vigor (vale o mesmo tempo)
  custoFarmarAmiga(j, J) {
    const F = LEILAO_BOT.farmar, porUnidade = (F.ouroHoraNivel * Math.max(1, j.prog.nivel | 0)) / F.unidadesHora;
    return (porUnidade * (1 + F.vigorUnidade)) / Math.max(0.2, J.farma);
  },
  leilaoBotAmiga(j) {
    const L = (this.leilao ||= new Leilao()), p = j.prog, J = jeitoLeilao(this.AMIGA.id), agora = Date.now();
    // primeira olhada: tudo o que ele tem (menos o essencial) começa como poupança
    const lb = (j.leilaoBot ||= { poupado: Math.round((p.ouro | 0) * (1 - LEILAO_BOT.essencial)), visto: p.ouro | 0, log: [] });
    let mudou = L.vencer(agora);
    // 1) retira com o Otávio o ouro das vendas e o que venceu
    const cx = L.caixaDe(j.conta);
    if (cx.ouro) { const o = cx.ouro; p.ouro += o; cx.ouro = 0; mudou = true; this.anotarLeilaoAmiga(j, 'recebeu', `${o} de ouro das vendas`); }
    while (cx.itens.length && guardar(p.mochila, cx.itens[0])) { cx.itens.shift(); mudou = true; }
    // 2) a parte da renda que vai para a poupança (caça, missão, venda: tudo o que entrou desde a última olhada)
    const renda = (p.ouro | 0) - (lb.visto | 0);
    if (renda > 0) lb.poupado += Math.round(renda * J.poupa);
    lb.poupado = Math.max(0, Math.min(lb.poupado | 0, p.ouro | 0));
    lb.meta = this.metaLeilaoAmiga(j, L, agora);
    // 3) compra e 4) vende
    const comprou = this.comprarLeilaoAmiga(j, L, J, lb, agora), anunciou = this.venderLeilaoAmiga(j, L, J, lb, agora);
    lb.poupado = Math.max(0, Math.min(lb.poupado | 0, p.ouro | 0));
    lb.visto = p.ouro | 0; lb.t = agora;
    L.verOuro(j.conta, p.ouro, agora);
    if (mudou || comprou || anunciou) this.aoLeilao?.(L);
    if (comprou) this.aplicarStatus?.(j);
    j.progSujo = true; this.guardarAmiga?.();
    return { comprou, anunciou };
  },
  // compra pela ordem de prioridade; devolve quantas compras fez
  comprarLeilaoAmiga(j, L, J, lb, agora) {
    const p = j.prog, B = LEILAO_BOT, ouro = () => p.ouro | 0;
    const essencial = () => Math.round(ouro() * B.essencial);
    const quer = this.precisaLeilaoAmiga(j, lb.meta), semVigor = vigorAgora(p.vigor) < B.farmar.semVigor;
    // presa: a poupança que cobre a meta (o que passa da meta pode ir para outras coisas); livre: o que passa de 1,5x a meta
    const presa = () => Math.min(lb.poupado, lb.meta ? lb.meta.preco : lb.poupado);
    const farmar = this.custoFarmarAmiga(j, J), livreDe = () => ouro() - Math.max(presa() + essencial(), Math.round(B.livre * (lb.meta?.preco || 0)));
    const pocaoLoja = precoLoja(LOJA.find((o) => o.k === 'pocao'), p.nivel) || ITENS.pocao?.preco || 15;
    const op = [];
    for (const a of [...L.anuncios, ...L.casaPara(j.conta, agora)]) { // a casa com o preço dele (sobe a cada compra)
      if (a.conta === j.conta || a.ate && a.ate <= agora) continue;
      const it = a.item, n = it.n || 1, unit = a.preco / n, merc = L.precoMercado(it, agora), caro = merc * B.caroDemais;
      if (ehEquip(it.k)) {
        const l = ITENS[it.k].lugar, cur = p.equip[l];
        if (!Object.hasOwn(p.equip, l) || !reforcoOk(it, p.atr) || nota(it) <= nota(cur) || unit > caro) continue;
        const grande = (it.r | 0) > (cur?.r | 0); // peça de raridade maior: pode usar a poupança
        op.push({ a, pri: 1, val: nota(it) - nota(cur), teto: () => ouro() - essencial() - (grande ? 0 : presa()), grande, por: grande ? 'melhoria (poupança)' : 'melhoria' });
      } else if (quer[it.k] && contar(p.mochila, it.k) < quer[it.k]) {
        const falta = quer[it.k] - contar(p.mochila, it.k); if (n > falta * 3 + 5) continue;
        const limite = FARMAVEL.has(it.k) ? farmar * J.compra * (semVigor ? B.farmar.semVigorX : 1) : caro * J.compra;
        if (unit > limite) continue; // farmar sai mais barato: vai farmar
        op.push({ a, pri: 0, val: -unit, teto: () => ouro() - presa(), por: 'para evoluir/reforçar' });
      } else if (it.k === 'tomo') {
        const s = p.habs?.[it.h] || { nv: 1 };
        if (s.nv !== it.nv - 1 || unit > caro) continue;
        op.push({ a, pri: 2, val: -unit, teto: () => ouro() - presa() - essencial(), por: 'Tomo' });
      } else if (it.k === 'pocao' && unit < pocaoLoja && contar(p.mochila, 'pocao') < (this.AMIGA.time?.pocoes || 10) * 2) {
        op.push({ a, pri: 3, val: -unit, teto: livreDe, por: 'consumível' });
      }
    }
    op.sort((x, y) => x.pri - y.pri || y.val - x.val);
    let n = 0;
    const avisa = this.aoVendaLeilao || ((c, t) => { const v = this.porConta?.(c); if (v) this.evento({ t: 'aviso', para: v.id, texto: t }); });
    for (const o of op) {
      if (n >= B.compraMax) break;
      const a = o.a;
      if (!L.achar(a.id, j.conta) || a.preco > o.teto() || a.preco > ouro()) continue;
      const prova = p.mochila.map((x) => (x ? { ...x } : null)); if (!guardar(prova, { ...a.item })) continue;
      const r = L.comprar(a.id, j.conta); if (typeof r === 'string') continue;
      p.ouro -= a.preco; guardar(p.mochila, { ...a.item }); n++;
      if (o.grande) lb.poupado = Math.max(0, lb.poupado - a.preco);
      this.anotarLeilaoAmiga(j, 'comprou', `${nomeItem(a.item)} de ${a.vendedor} por ${a.preco} (${o.por})`);
      if (!a.casa) avisa(a.conta, `Vendeu ${nomeItem(a.item)} no leilão para ${this.AMIGA.nome}: ${r.liquido} de ouro com o Otávio${r.taxa ? ` (taxa ${r.taxa})` : ''}`);
    }
    if (n) for (let i = 0; i < p.mochila.length; i++) { // veste na hora a peça que comprou
      const it = itemValido(p.mochila[i]); if (!it || !ehEquip(it.k)) continue;
      const l = ITENS[it.k].lugar;
      if (Object.hasOwn(p.equip, l) && reforcoOk(it, p.atr) && nota(it) > nota(p.equip[l])) this.item(j.id, { acao: 'equipar', i });
    }
    return n;
  },
  // o que não vende de jeito nenhum (o mesmo que a venda na loja guarda)
  naoVendeLeilaoAmiga(j, it) {
    const A = this.AMIGA, enc = j.ia?.encomenda;
    return !!(it.cad || it.k === 'pocao' || it.k.startsWith('semente_') || ITENS[it.k]?.comida || ITENS[it.k]?.usar?.veiculo || A.plantas?.includes(it.k) || (!ITENS[it.k]?.mat && A.pedidos?.some((o) => o.k === it.k)) // material pedido: a reserva já guarda
      || (enc && (enc.item === 'peixe' ? ITENS[it.k]?.peixe : it.k === enc.item)));
  },
  // vale guardar para o leilão (em vez de vender na loja entre uma olhada e outra)? Só com espaço na mochila
  guardaLeilaoAmiga(j, it, livres) {
    if (livres <= LEILAO_BOT.compraMax + 3 || this.naoVendeLeilaoAmiga(j, it)) return false;
    const quantos = (f) => j.prog.mochila.filter((o) => o && f(o)).length; // o que passa do teto vai para a loja
    if (ehEquip(it.k)) return (it.r | 0) >= 1 && quantos((o) => ehEquip(o.k) && (o.r | 0) >= 1) <= LEILAO_BOT.guardaEquip;
    if (it.k === 'tomo') return quantos((o) => o.k === 'tomo') <= LEILAO_BOT.guardaTomos;
    // material: só guarda para o leilão se lá tem pouco dele (André 2026-11-24: "se tiver muito, vende no NPC")
    return !!ITENS[it.k]?.mat && (this.leilao?.anunciosDe(it.k) ?? 0) < LEILAO_BOT.pouco;
  },
  // anuncia o que sobra: peça Rara ou melhor, Tomo que não serve e material acima da reserva. Devolve quantos anunciou
  venderLeilaoAmiga(j, L, J, lb, agora) {
    const p = j.prog, B = LEILAO_BOT;
    let vagas = Math.min(B.maxAnuncios, LEILAO.max) - L.meus(j.conta).length; if (vagas <= 0) return 0;
    const quer = this.precisaLeilaoAmiga(j, lb.meta), sobra = [], vistos = new Set();
    // poção e comida (vaga de consumível, André 2026-11-24): só o que passa de guardaConsumivel
    const GC = B.guardaConsumivel, consumivel = (k) => k === 'pocao' || k === 'pocao_mana' || !!ITENS[k]?.comida;
    for (let i = 0; i < p.mochila.length; i++) {
      const it = itemValido(p.mochila[i]); if (!it || it.cad || !consumivel(it.k) || vistos.has(it.k)) continue;
      vistos.add(it.k);
      const tem = contar(p.mochila, it.k), guarda = GC[it.k] ?? GC.comida;
      if (tem > guarda && L.anunciosDe(it.k, agora) < B.pouco) sobra.push({ k: it.k, n: Math.min(tem - guarda, ITENS[it.k].pilha || 50), it: { k: it.k, n: 1 }, cat: 'consumivel' });
    }
    for (let i = 0; i < p.mochila.length; i++) {
      const it = itemValido(p.mochila[i]); if (!it || this.naoVendeLeilaoAmiga(j, it)) continue;
      if (ehEquip(it.k)) { if ((it.r | 0) >= 1) sobra.push({ i, it }); continue; }
      // tomo: o que já não serve, ou repetido (fica 1 de cada habilidade que ainda pode ler: o arrumar já leu o que dava)
      if (it.k === 'tomo') {
        const n = it.n || 1, k = 'tomo:' + it.h;
        if ((p.habs?.[it.h]?.nv || 1) >= it.nv || vistos.has(k)) sobra.push({ i, it, tomo: true, parte: n });
        else { vistos.add(k); if (n > 1) sobra.push({ i, it, tomo: true, parte: n - 1 }); }
        continue;
      }
      if (!ITENS[it.k]?.mat || vistos.has(it.k)) continue;
      vistos.add(it.k);
      if (L.anunciosDe(it.k, agora) >= B.pouco) continue; // já tem muito no leilão: esse vai para a loja (arrumar)
      const tem = contar(p.mochila, it.k), guarda = (B.reserva[it.k] ?? B.reserva.padrao) + (quer[it.k] || 0);
      if (tem > guarda) sobra.push({ k: it.k, n: Math.min(tem - guarda, ITENS[it.k].pilha || 50), it: { k: it.k, n: 1 }, cat: B.recursos.includes(it.k) ? 'recurso' : undefined });
    }
    sobra.sort((a, b) => L.precoMercado(b.it, agora) * (b.n || 1) - L.precoMercado(a.it, agora) * (a.n || 1));
    // pelo menos um Tomo vai ao leilão por olhada (André 2026-11-24: "não existe tomo vendendo na Action House"): o mais caro
    // passa à frente das peças, que sempre valiam mais e ocupavam todas as vagas
    { const t = sobra.findIndex((o) => o.tomo); if (t > 0) sobra.unshift(...sobra.splice(t, 1)); }
    // as vagas (André 2026-11-24): recurso e consumível têm as deles; peça, Tomo e o resto ficam com as outras
    const V = B.vagas, catDe = (it) => (B.recursos.includes(it.k) ? 'recurso' : consumivel(it.k) ? 'consumivel' : 'outro');
    const lim = { recurso: V.recurso, consumivel: V.consumivel, outro: Math.max(0, Math.min(B.maxAnuncios, LEILAO.max) - V.recurso - V.consumivel) };
    const usadas = { recurso: 0, consumivel: 0, outro: 0 }; for (const a of L.meus(j.conta)) usadas[catDe(a.item)]++;
    let n = 0;
    for (const s of sobra) {
      if (vagas <= 0) break;
      const cat = s.cat || catDe(s.it); if (usadas[cat] >= lim[cat]) continue;
      const item = s.k ? { k: s.k, n: s.n } : s.parte ? { ...s.it, n: s.parte } : { ...s.it }, qtd = item.n || 1, merc = L.precoMercado(item, agora);
      const iguais = L.anuncios.filter((a) => chaveMercado(a.item) === chaveMercado(item)).length;
      const [a0, a1] = B.acima, frac = (iguais <= B.escasso ? a1 : a0 + Math.random() * (a1 - a0)) * J.ganancia; // pouca oferta: no topo
      // nunca a preço de NPC: no mínimo 1,5x o que a loja paga; o que a loja vende fica um pouco abaixo do preço dela
      // a loja da mesma raridade (2026-11-24: achava a Comum de 150 para qualquer peça e travava toda Rara em 143)
      const loja = LOJA.find((o) => o.k === item.k && (o.r == null || o.r === (item.r | 0))), piso = precoVenda({ ...item, n: 1 }) * 1.5, teto = loja ? (precoLoja(loja, p.nivel) || Infinity) * 0.95 : Infinity;
      const preco = Math.min(LEILAO.precoMax, Math.max(1, Math.round(Math.max(piso, Math.min(teto, merc * (1 + frac))) * qtd)));
      const taxa = L.taxaAnuncio(preco); if ((p.ouro | 0) < taxa) break;
      if (s.k) tirar(p.mochila, s.k, qtd); else if (s.parte && (p.mochila[s.i].n || 1) > qtd) p.mochila[s.i].n -= qtd; else p.mochila[s.i] = null;
      const r = L.anunciar(j.conta, this.AMIGA.nome, item, preco, B.horas, agora);
      if (typeof r === 'string') { guardar(p.mochila, item); break; }
      p.ouro -= taxa; vagas--; n++; usadas[cat]++;
      this.anotarLeilaoAmiga(j, 'anunciou', `${nomeItem(item)} por ${preco} (mercado ${merc * qtd})`);
    }
    return n;
  },
  // para a ficha do chat (server/ia-amiga.js): só o que ele fez de verdade
  fichaLeilaoAmiga(a) {
    const lb = a?.leilaoBot; if (!lb) return null;
    const ult = (lb.log || []).slice(-4).map((x) => `${x.o} ${x.txt}`).join('; ');
    const meta = lb.meta ? `juntando ouro para ${lb.meta.nome} (uns ${lb.meta.preco} de ouro no leilão; já poupou ${lb.poupado | 0})` : '';
    return [meta, ult ? `últimos negócios: ${ult}` : ''].filter(Boolean).join('. ') || null;
  },
};
