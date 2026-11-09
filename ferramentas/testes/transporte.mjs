// FASE 1 (André 2026-11-09): packs, carrinho, barquinho e navio mercante, cópia do Quimera (shared/transporte.js).
// Uso: node ferramentas/testes/transporte.mjs
import { Simulacao, MAPA_CLAREIRA, LAGOS } from '../../shared/index.js';
import { PACKS, PACK_REGRAS, VEICULOS, MERCADORES_PACK, ITENS, FERRAMENTAS_FAZENDA } from '../../shared/dados.js';
import { noLago } from '../../shared/relevo.js';
import { progressoValido } from '../../shared/progresso.js';
import { fatorDistancia, precoPack, capacidadeCarrinho, velCarrinho } from '../../shared/transporte.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('P', 'Pia');
j.criando = false; j.morto = false;
const avisos = () => s.eventos.filter((e) => e.t === 'aviso' && e.para === 'P').map((e) => e.texto);
const dar = (k, n) => { const i = j.prog.mochila.indexOf(null); j.prog.mochila[i] = { k, n }; };
const npc = (id) => MAPA_CLAREIRA.npcs.find((n) => n.id === id);
const ir = (x, z) => { j.x = x; j.z = z; j.y = 0; };

// conta do Quimera
ok(Object.keys(PACKS).length === 12 && PACKS.brasa.base === 220 && PACKS.lenha.base === 45, '12 packs com a base do Quimera');
ok(Math.abs(fatorDistancia(0) - 0.3) < 1e-9 && Math.abs(fatorDistancia(462) - 3.6) < 0.01 && Math.abs(fatorDistancia(140) - 1.3) < 1e-9 && fatorDistancia(5000) === 6, 'distância: 0,3 + d/140 até 462 m, máximo 6');
ok(MERCADORES_PACK.every((m) => npc(m.id)?.funcao === 'pack'), 'mercadores de pack estão no mapa');
for (const P of Object.values(PACKS)) for (const k of Object.keys(P.custo)) if (!ITENS[k]) ok(false, 'material existe: ' + k);

// fazer pack no Seu Joca (lenha)
const joca = npc('m_lenha'), pedrao = npc('m_pedra');
ir(joca.x + 1, joca.z);
s.eventos = []; s.pack('P', { acao: 'fazer', npc: 'm_lenha' });
ok(avisos().some((t) => /Falta material/.test(t)) && !j.prog.pack, 'sem material não faz');
dar('lenha', 50);
s.eventos = []; s.pack('P', { acao: 'fazer', npc: 'm_lenha' });
ok(j.prog.pack?.k === 'lenha' && j.prog.pack.mo === 'm_lenha', 'fez o pack de lenha nas costas');
s.eventos = []; s.pack('P', { acao: 'fazer', npc: 'm_lenha' });
ok(avisos().some((t) => /costas já têm/.test(t)), 'costas ocupadas: não faz outro sem carrinho');
s.eventos = []; s.pack('P', { acao: 'entregar', npc: 'm_lenha', de: 'costas' });
ok(j.prog.pack && avisos().some((t) => /feito aqui/.test(t)), 'não vende onde fez');
// costas: devagar, sem montar, sem voltar para a vila
s.eventos = []; s.montar('P'); ok(!j.montado && avisos().some((t) => /pack/.test(t)), 'com pack não monta');
s.eventos = []; s.voltarVila('P'); ok(!j.vila && avisos().some((t) => /pack/.test(t)), 'com pack não volta para a vila');
// entrega no Mestre Pedrão
ir(pedrao.x + 1, pedrao.z);
const d = Math.hypot(pedrao.x - joca.x, pedrao.z - joca.z), esperado = precoPack(j.prog.pack, pedrao, 0);
const ouro0 = j.prog.ouro || 0;
s.eventos = []; s.pack('P', { acao: 'entregar', npc: 'm_pedra', de: 'costas' });
ok(!j.prog.pack && j.prog.ouro - ouro0 === esperado && esperado > 45, `entregou a ${d.toFixed(0)} m por ${esperado} de ouro`);
// mercado cheio: depois de 4 entregas cai 3% cada
for (let i = 0; i < 6; i++) { j.prog.pack = { k: 'lenha', ox: joca.x, oz: joca.z, mo: 'm_lenha' }; s.pack('P', { acao: 'entregar', npc: 'm_pedra', de: 'costas' }); }
s.eventos = []; j.prog.pack = { k: 'lenha', ox: joca.x, oz: joca.z, mo: 'm_lenha' }; const o1 = j.prog.ouro; s.pack('P', { acao: 'entregar', npc: 'm_pedra', de: 'costas' });
ok(j.prog.ouro - o1 < esperado && avisos().some((t) => /mercado cheio/.test(t)), 'mercado cheio paga menos: ' + (j.prog.ouro - o1));

// pack largado e pego
j.prog.pack = { k: 'pedra', ox: 0, oz: 0 };
s.pack('P', { acao: 'largar' });
ok(!j.prog.pack && s.packsChao.length === 1 && s.foto().carga.packs.length === 1, 'largou no chão (aparece na foto)');
s.pack('P', { acao: 'pegar', g: s.packsChao[0].g });
ok(j.prog.pack?.k === 'pedra' && !s.packsChao.length, 'pegou de volta');
// morrer com pack: cai no chão
s.morrer(j); ok(!j.prog.pack && s.packsChao.length === 1, 'morreu: o pack caiu');
j.morto = false; j.trava = 0; s.packsChao = [];

// carrinho
ok(FERRAMENTAS_FAZENDA.carrinho && FERRAMENTAS_FAZENDA.galao.varios, 'receitas do carrinho e do galão');
dar('carrinho', 1); s.carrinhoPerto; j.prog.carrinho = undefined;
ir(joca.x + 3, joca.z + 3);
const ic = j.prog.mochila.findIndex((o) => o?.k === 'carrinho');
s.eventos = []; s.item('P', { acao: 'usar', i: ic });
ok(j.prog.carrinho?.chao && j.prog.mochila.some((o) => o?.k === 'carrinho'), 'carrinho no chão e continua na mochila (travado): ' + avisos().join(' | '));
s.eventos = []; s.item('P', { acao: 'apagar', i: ic });
ok(j.prog.mochila[ic]?.k === 'carrinho' && avisos().some((t) => /no mundo/.test(t)), 'carrinho no mundo: não joga fora');
// recolher de longe: tocar no da mochila traz de volta
ir(joca.x + 40, joca.z + 3);
s.item('P', { acao: 'usar', i: ic });
ok(!j.prog.carrinho.chao && j.prog.mochila.filter((o) => o?.k === 'carrinho').length === 1, 'tocar na mochila recolhe de longe');
ir(joca.x + 3, joca.z + 3);
s.item('P', { acao: 'usar', i: ic });
ok(j.prog.carrinho.chao, 'colocou de novo');
ok(capacidadeCarrinho(j.prog.carrinho) === 2, 'Nv 1 leva 2 packs');
s.veiculo('P', { acao: 'subir', k: 'carrinho' });
ok(j.veiculo === 'carrinho', 'subiu no carrinho');
// sem combustível: quase não anda
j.orc = 0; j.orcT = s.tempo; s.tempo += 1;
ok(!s.posicaoCliente('P', { x: j.x + 2.5, y: 0, z: j.z, ry: 0 }), 'sem combustível não anda');
s.veiculo('P', { acao: 'descer' });
dar('galao', 3);
s.veiculo('P', { acao: 'abastecer' });
ok(j.prog.carrinho.comb === 160, 'abasteceu 1 galão = 160 m');
s.veiculo('P', { acao: 'abastecer', n: 8 });
ok(j.prog.carrinho.comb === 480 && !j.prog.mochila.some((o) => o?.k === 'galao'), 'encher: põe os galões que tem (até 8)');
j.prog.carrinho.comb = 160;
s.veiculo('P', { acao: 'subir', k: 'carrinho' });
j.orc = 0; j.orcT = s.tempo; s.tempo += 1;
ok(s.posicaoCliente('P', { x: j.x + 2.5, y: 0, z: j.z, ry: 0 }) && Math.abs(j.prog.carrinho.comb - 157.5) < 0.01, 'anda 2,5 m e gasta 2,5 de combustível');
j.orc = 0; j.orcT = s.tempo; s.tempo += 1;
ok(!s.posicaoCliente('P', { x: j.x + 6, y: 0, z: j.z, ry: 0 }), 'mais rápido que o carrinho não vale');
// carregar packs: 2 no carrinho + 1 nas costas
s.veiculo('P', { acao: 'descer' });
const c = j.prog.carrinho;
for (let i = 0; i < 3; i++) { j.prog.pack = { k: 'lenha', ox: joca.x, oz: joca.z, mo: 'm_lenha' }; s.pack('P', { acao: 'por_carrinho' }); }
ok(c.packs.length === 2 && j.prog.pack, 'carrinho Nv 1 cheio com 2; o terceiro fica nas costas');
ok(Math.abs(velCarrinho(c) - 2.8) < 1e-9, 'até 2 packs: 2,8 m/s');
// melhorar precisa de bancada
s.eventos = []; s.veiculo('P', { acao: 'melhorar' });
ok(c.lv === 1 && avisos().some((t) => /bancada/.test(t)), 'melhorar só na bancada');
s.bancadaPerto = () => ({});
dar('lenha', 50); dar('barra_ferro', 10); dar('barra_cobre', 10); dar('couro', 10); j.prog.ouro = 3000;
s.veiculo('P', { acao: 'melhorar' });
ok(c.lv === 2 && capacidadeCarrinho(c) === 4 && j.prog.ouro === 1000, 'Nv 2: 4 packs por 2.000 de ouro + material');
s.pack('P', { acao: 'por_carrinho' }); j.prog.pack = { k: 'metal', ox: 0, oz: 0 }; s.pack('P', { acao: 'por_carrinho' });
ok(Math.abs(velCarrinho(c) - 2.7) < 1e-9, '4 packs: 2,8 - 2 x 0,05 = 2,7 m/s');
// apanhar dentro do carrinho
s.veiculo('P', { acao: 'subir', k: 'carrinho' });
const v0 = j.vida; c.vida = 50;
s.ferir(j, 100, null);
ok(c.quebrado && !j.veiculo && s.packsChao.length === 4 && j.vida > v0 - 30, 'carrinho quebrou e os packs caíram; o herói levou só 20%');
dar('lenha', 10); dar('barra_ferro', 1);
s.veiculo('P', { acao: 'consertar' });
ok(!c.quebrado && c.vida === 400, 'consertou (8 lenha + 1 barra de ferro)');
// entregar do carrinho perto do mercador
s.packsChao = []; c.packs = [{ k: 'lenha', ox: joca.x, oz: joca.z, mo: 'm_lenha' }];
c.chao = { x: pedrao.x + 3, z: pedrao.z, ry: 0 }; ir(pedrao.x + 1, pedrao.z);
const o2 = j.prog.ouro; s.pack('P', { acao: 'entregar', npc: 'm_pedra', de: 'carrinho', i: 0 });
ok(!c.packs.length && j.prog.ouro > o2, 'entregou do carrinho');

// barquinho e navio no Lago Grande
const L = LAGOS.find((l) => l.id === 'lago_grande');
const fundo = (x, z) => noLago(x, z)?.fundo || 0;
let bx = L.x, bz = L.z; while (fundo(bx, bz) > 2) bz -= 0.5; // perto da margem sul, ainda funda
ir(bx, bz - 1);
dar('barquinho', 1);
s.eventos = []; j.ry = 0; s.veiculo('P', { acao: 'colocar', k: 'barquinho' }); // acha a água sozinho
ok(j.veiculo === 'barquinho', 'subiu no barquinho: ' + avisos().join(' | '));
j.orc = 0; j.orcT = s.tempo; s.tempo += 1;
ok(s.posicaoCliente('P', { x: j.x, y: j.y, z: j.z + 3, ry: 0 }), 'barquinho rema 3 m/s (2026-11-09: 3,2 m/s, mais lento)');
let tx = j.x, tz = j.z; while (fundo(tx, tz) > 0.05) tz -= 0.5;
j.z = tz + 2; // remou até perto da margem
s.eventos = []; s.veiculo('P', { acao: 'descer' }); // acha a margem sozinho
ok(!j.veiculo && j.prog.mochila.some((o) => o?.k === 'barquinho'), 'desceu na margem e o barquinho voltou para a mochila: ' + avisos().join(' | '));
// navio: Nv 60 e 40.000 de ouro
s.eventos = []; j.prog.nivel = 10; j.prog.ouro = 50000;
ok(/Nv 60/.test(s.motivoFabricar(j, 'navio')), 'navio pede Nv 60');
j.prog.nivel = 60; j.prog.ouro = 100;
ok(/40.000/.test(s.motivoFabricar(j, 'navio')), 'navio pede 40.000 de ouro');
j.prog.ouro = 50000; dar('lenha', 50); for (let i = 0; i < 8; i++) dar('lenha', 50); dar('barra_ferro', 40); dar('barra_cobre', 30); dar('couro', 40);
s.fabricarUm('P', 'navio');
ok(j.prog.mochila.some((o) => o?.k === 'navio') && j.prog.ouro === 10000, 'fez o navio (40.000 de ouro)');
ir(bx, bz - 1);
s.eventos = []; s.veiculo('P', { acao: 'colocar', k: 'navio', x: bx, z: bz, ry: 0 });
ok(j.prog.navio?.chao, 'navio na água: ' + avisos().join(' | '));
for (let i = 0; i < 17; i++) { j.prog.pack = { k: 'lenha', ox: joca.x, oz: joca.z, mo: 'm_lenha' }; s.pack('P', { acao: 'por_porao' }); }
ok(j.prog.navio.porao.length === VEICULOS.navio.porao && j.prog.pack, 'porão leva 16 packs (+1 nas costas)');
s.veiculo('P', { acao: 'subir', k: 'navio' });
ok(j.veiculo === 'navio', 'no leme');
for (let i = 0; i < 12; i++) { j.orc = 0; j.orcT = s.tempo; s.tempo += 1; s.posicaoCliente('P', { x: j.x, y: j.y, z: j.z + (i % 4 < 2 ? 3.9 : -3.9), ry: 0 }); }
ok(j.prog.navio.porao.every((pk) => pk.nav >= PACK_REGRAS.navioMin), 'packs do porão contam a travessia: ' + j.prog.navio.porao[0].nav);
const viaNavio = precoPack(j.prog.navio.porao[0], pedrao, 0), porTerra = precoPack({ ...j.prog.navio.porao[0], nav: 0 }, pedrao, 0);
ok(viaNavio === Math.round(porTerra * PACK_REGRAS.navio) || Math.abs(viaNavio - porTerra * 1.5) <= 1, `entrega de navio paga mais (${viaNavio} x ${porTerra})`);
// salvar e voltar
const salvo = progressoValido(JSON.parse(JSON.stringify(j.prog)));
ok(salvo.navio.porao.length === 16 && salvo.carrinho.lv === 2 && salvo.pack?.k === 'lenha', 'pack, carrinho e navio ficam na conta');
s.saiuComVeiculo(j);
ok(!j.veiculo && j.prog.navio.chao, 'saiu do jogo no leme: o navio fica ancorado onde estava');
ok(s.foto().carga.veic.some((v) => v[0] === 'n') && s.foto().carga.veic.some((v) => v[0] === 'c'), 'navio e carrinho aparecem na foto');
