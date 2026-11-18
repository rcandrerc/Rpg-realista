// André 2026-11-18: "parece que está travada com informações antigas" (pedia capacete com a bota comum sendo a pior,
// dizia que não usa cajado) e "usa pouca gíria e errada" (DM em vez de DG). Sem rede.
// Uso: node ferramentas/testes/cecilia-memoria-velha.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { lembrancaBoa } from '../../shared/amiga.js';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s === '@rpg/shared' ? { url: ${JSON.stringify(new URL('../../shared/index.js', import.meta.url).href)}, shortCircuit: true } : n(s, c); }`));
const { mensagensConversa } = await import('../../server/ia-amiga.js');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true); s.passo(0.05);
const c = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia'), a = c.amiga;
// 1) lembrança de estado do jogo não vai para a IA (fica guardada no banco)
for (const t of ['preciso de 2 couros e um capacete melhor para upgrades', 'estou na porta da casa cuidando da horta', 'combinamos caçar goblins juntos amanhã cedo', 'ele gosta de trocar equipamentos, especialmente capacetes', 'ele está no level 47 e eu resetei para o level 4'])
  ok(!lembrancaBoa(t), `não lê: "${t}"`);
for (const t of ['ele prefere que eu chame de Ceci', 'ele disse que me ama no chat', 'ele ama desafios e ação nas aventuras'])
  ok(lembrancaBoa(t), `lê: "${t}"`);
a.memorias = { [j.conta]: ['ele prefere que eu chame de Ceci', 'preciso de 2 couros e um capacete melhor para upgrades'] };
a.fatos = { [j.conta]: ['ele está na missão desgrama', 'ele trabalha num restaurante'] };
const ctx = c.contextoAmiga('andre');
ok(ctx.memoria.length === 1 && a.memorias[j.conta].length === 2, 'memória velha some do contexto, mas fica guardada');
ok(ctx.fatos.length === 1 && ctx.fatos[0].includes('restaurante'), 'fato de missão inventada não vai para a IA');
// 2) ela usa espada E cajado; o cajado está na lista
ok(/espada e cajado/.test(ctx.arma) && /Cajado/i.test(ctx.equip), 'ficha diz que ela usa espada e cajado');
// 3) peça mais fraca: a pior que ela veste, sempre dita, e a ficha vale mais que a conversa velha
a.prog.equip.cabeca = { k: 'capacete', r: 2 }; a.prog.equip.pes = { k: 'botas', r: 0 };
for (const l of ['corpo', 'pernas', 'capa']) if (a.prog.equip[l]) a.prog.equip[l].r = 1;
const ctx2 = c.contextoAmiga('andre'); ctx2.conversa = [{ de: 'ela', texto: 'minhas botas tão feias' }];
const sis = mensagensConversa(ctx2, 'quer algum equipamento?')[0].content;
ok(/Botas/.test(ctx2.pecaFraca) && /peça mais fraca é Botas[^:]*: se falar de peça para melhorar, é ESSA/.test(sis), 'peça mais fraca (bota) sempre na ficha, mesmo já falada');
ok(/Esta ficha é a verdade AGORA/.test(sis), 'ficha vale mais que conversa e memória antigas');
ok(/NÃO está precisando de material nenhum/.test(sis), 'sem pedido: esquece couro/capacete da conversa velha');
// 4) gíria certa
ok(/"DG" \(nunca "DM"/.test(sis) && /"pt"/.test(sis) && /"mob"/.test(sis) && /"farmar"/.test(sis), 'gírias: DG, pt, mob, farmar');
