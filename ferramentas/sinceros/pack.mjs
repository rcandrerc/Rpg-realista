// Pack com o bot (André 2026-11-21): pega do chão, carrinho, navio, entrega (ouro pra ele), passa, larga.
// Uso: node ferramentas/sinceros/pack.mjs
const R = new URL('../../', import.meta.url).href;
const { Simulacao, MAPA_CLAREIRA, PACKS } = await import(R + 'shared/index.js');
let falhou = 0; const ok = (c, m) => { console.log(c ? 'ok ' : 'ERRO', m); if (!c) falhou++; };
const s = new Simulacao(MAPA_CLAREIRA); const eu = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true); s.passo(0.05);
const c = s.amigosIa.find((x) => x.AMIGA.id === 'dario'), a = c.amiga; a.amigosDe = { 7: 1 };
const falar = (t) => { a.ia.chatFila = []; c.ouvirAmiga('andre', t); c.respostaAmiga('andre', { assunto: c.assuntoAmiga(t) }); return a.ia.chatFila.map((f) => f.texto).join(' | '); };
const rodar = (seg, ate) => { for (let k = 0; k < seg * 20 && !ate(); k++) s.passo(0.05); };
const merc = MAPA_CLAREIRA.npcs.filter((n) => n.funcao === 'pack'); const m0 = merc[0];
let f = falar('pega o pack pra mim'); ok(/pt/.test(f), 'fora da pt pede pt: ' + f);
c.combinarAmiga(a); c.entrarTimeAmiga(a, eu); s.passo(0.05);
// André perto do mercador 0, larga um pack feito no mercador 1 (longe)
Object.assign(eu, { x: m0.x + 2, z: m0.z + 2 }); Object.assign(a, { x: m0.x + 4, z: m0.z + 4 });
const k = Object.keys(PACKS)[0]; c.packNoChao({ k, ox: Math.round(merc[1].x), oz: Math.round(merc[1].z), mo: merc[1].id }, eu.x + 1, eu.z);
f = falar('pega o pack pra mim'); ok(!!a.ia.packTarefa, 'vai pegar: ' + f);
rodar(60, () => !a.ia.packTarefa); ok(!!a.prog.pack, 'pegou: ' + a.ia.chatFila.map((x) => x.texto).join(' | '));
f = falar('faz um pack'); ok(/não faço/.test(f), 'fazer pack: honesto: ' + f);
f = falar('pode me passar o pack'); rodar(60, () => !a.ia.packTarefa); ok(!!eu.prog.pack && !a.prog.pack, 'passou pra mim: ' + a.ia.chatFila.map((x) => x.texto).join(' | '));
// devolve pro bot pelo chão e entrega
c.packNoChao(eu.prog.pack, eu.x + 1, eu.z); eu.prog.pack = null; falar('pega o pack'); rodar(60, () => !a.ia.packTarefa);
const ouro0 = eu.prog.ouro || 0, ouroBot = a.prog.ouro || 0;
f = falar('entrega o pack'); ok(!!a.ia.packTarefa, 'vai entregar: ' + f);
rodar(60, () => !a.ia.packTarefa); ok((eu.prog.ouro || 0) > ouro0 && (a.prog.ouro || 0) === ouroBot && !a.prog.pack, `entregou, ouro pra mim: ${ouro0} -> ${eu.prog.ouro} | ` + a.ia.chatFila.map((x) => x.texto).join(' | '));
// carrinho
c.packNoChao({ k, ox: Math.round(merc[1].x), oz: Math.round(merc[1].z) }, eu.x + 1, eu.z); falar('pega o pack'); rodar(60, () => !a.ia.packTarefa);
f = falar('põe o pack no carrinho'); ok(/carrinho não tá/.test(f), 'sem carrinho no chão: ' + f);
eu.prog.carrinho = { lv: 1, comb: 0, vida: 400, quebrado: false, packs: [], chao: { x: eu.x + 5, z: eu.z, ry: 0 } };
f = falar('põe o pack no carrinho'); rodar(60, () => !a.ia.packTarefa); ok(eu.prog.carrinho.packs.length === 1 && !a.prog.pack, 'no carrinho: ' + a.ia.chatFila.map((x) => x.texto).join(' | '));
if (falhou) { console.log(falhou, 'falha(s)'); process.exit(1); } else console.log('tudo certo');
