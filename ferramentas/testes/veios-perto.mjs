// Árvores cortadas e veios batidos só para quem está perto, uma vez, e gravados para depois do reinício
// (André 2026-11-16, árvores plantadas: a árvore nativa vai voltar só em 24 h, então a lista vai ficar comprida).
// Uso: node ferramentas/testes/veios-perto.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { Visao, VISAO } from '../../server/visao.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const s = new Simulacao(MAPA_CLAREIRA);
const eu = s.adicionarJogador('eu', 'Eu'), longe = s.adicionarJogador('longe', 'Longe');
const arvores = [...s.coletaveis.values()].filter((n) => n.tipo === 'arvore');
const alvo = arvores[0];
// 1.000 árvores cortadas pelo mundo (24 h para voltar)
for (const n of arvores.slice(0, 1000)) s.veiosComuns.set(n.id, { n: 0, volta: s.tempo + 86400 });
Object.assign(eu, { x: alvo.x + 2, z: alvo.z });
Object.assign(longe, { x: 1e5, z: 1e5 });
const perto = arvores.slice(0, 1000).filter((n) => Math.hypot(n.x - eu.x, n.z - eu.z) <= VISAO.veio).length;

// sem o "onde" (como antes): a lista inteira vai para todos
{
  const v = new Visao(), m = v.paraJogador(v.preparar(s.foto(), []), 'eu');
  ok(JSON.parse(m).foto.veios.length === 1000, 'sem o lugar dos veios: vai tudo (como antes)');
}
const v = new Visao((id) => s.coletaveis.get(id));
let ctx = v.preparar(s.foto(), []);
const m1 = v.paraJogador(ctx, 'eu'), l1 = JSON.parse(m1).foto.veios;
ok(l1.length === perto && l1.some((x) => x[0] === alvo.id), `perto: só as ${perto} árvores a menos de ${VISAO.veio} m (de 1.000 cortadas)`);
ok(JSON.parse(v.paraJogador(ctx, 'longe')).foto.veios.length === 0, 'longe de tudo: nenhuma');
// próxima foto: nada novo para mandar
ctx = v.preparar(s.foto(), []);
const m2 = v.paraJogador(ctx, 'eu');
ok(JSON.parse(m2).foto.veios.length === 0, 'na foto seguinte não vai de novo');
// tamanho: antes ia a lista toda em cada foto
const antes = JSON.stringify(s.foto().veios).length;
ok(m2.length < 2000 && antes > 15000, `foto com 1.000 cortadas: antes ${antes} bytes só de veios, agora a foto inteira tem ${m2.length}`);
// outro bateu num veio perto: vai de novo (mudou)
s.veiosComuns.set(alvo.id, { n: 0, volta: s.tempo + 50000 });
ctx = v.preparar(s.foto(), []);
ok(JSON.parse(v.paraJogador(ctx, 'eu')).foto.veios.some((x) => x[0] === alvo.id), 'mudou a hora de voltar: vai de novo');
// o longe chega perto: recebe as de lá
Object.assign(longe, { x: eu.x, z: eu.z });
ctx = v.preparar(s.foto(), []);
ok(JSON.parse(v.paraJogador(ctx, 'longe')).foto.veios.length === perto, 'quem chega perto recebe as árvores caídas dali');
// religou (esquecer): manda tudo de perto de novo
v.esquecer('eu');
ctx = v.preparar(s.foto(), []);
ok(JSON.parse(v.paraJogador(ctx, 'eu')).foto.veios.length === perto, 'depois de religar, vai tudo de perto de novo');
// voltou: sai da memória
s.veiosComuns.delete(alvo.id);
for (let i = 0; i < 20; i++) v.paraJogador(v.preparar(s.foto(), []), 'eu'); // a limpeza roda de 1 em 1 s
ok(!v.veiosVistos.get('eu').has(alvo.id), 'árvore que voltou sai da memória de quem viu');

// gravar e carregar (reinício do servidor): a hora de voltar continua
{
  let relogio = 1_000_000_000_000;
  const a = new Simulacao(MAPA_CLAREIRA); a.relogioMs = () => relogio;
  a.veiosComuns.set(arvores[1].id, { n: 0, volta: a.tempo + 3600 });
  a.veiosComuns.set(arvores[2].id, { n: 1, volta: a.tempo + 0.5 }); // quase voltando: não vale a pena gravar
  const salvo = a.veiosParaSalvar();
  ok(salvo && salvo[arvores[1].id] && !salvo[arvores[2].id], 'grava a árvore que falta 1 h para voltar');
  ok(a.veiosParaSalvar() === null, 'nada mudou: não grava de novo');
  relogio += 1800 * 1000; // o servidor ficou meia hora desligado
  const b = new Simulacao(MAPA_CLAREIRA); b.relogioMs = () => relogio;
  b.carregarVeios(JSON.parse(JSON.stringify(salvo)));
  const st = b.veiosComuns.get(arvores[1].id);
  ok(st && st.n === 0 && Math.abs(st.volta - b.tempo - 1800) < 2, 'depois do reinício: continua caída, falta meia hora');
  ok(b.cargas(eu, arvores[1]) === 0, 'ninguém corta a árvore caída depois do reinício');
  b.carregarVeios({ m999999: [0, relogio + 1000], [arvores[3].id]: [0, relogio - 1] });
  ok(!b.veiosComuns.has('m999999') && !b.veiosComuns.has(arvores[3].id), 'ignora id que não existe e árvore que já voltou');
}
