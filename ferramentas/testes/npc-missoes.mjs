// Cecília e Dario fazem a história e as diárias (André 2026-11-16): "Pra liberar o mapa ele tem que fazer missão,
// igual a gente. E fazer as missões diárias também".
// Uso: node ferramentas/testes/npc-missoes.mjs
import { Simulacao, MAPA_CLAREIRA, DARIO, NPC_VIDA, HISTORIA, DIARIAS } from '../../shared/index.js';
import { missaoAtual, zonaFechadaEm } from '../../shared/historia.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true);
s.passo(0.05);
const dario = s.amigoIaDe(DARIO.id), b = dario.amiga;
ok(b.semTeto, 'Dario é NPC sem teto (faz a própria história)');
ok(NPC_VIDA.missao.segPorDia === 3600 && NPC_VIDA.missao.porEtapa === 120, 'missão: até 1 h por dia, uns 2 min por etapa');
b.prog.dia = { h: 10, t: Date.now() };
b.prog.hist = null; b.prog.nivel = 1;
const M0 = missaoAtual(b.prog);
ok(M0?.id === HISTORIA[0].id, `começa pela primeira missão (${M0?.nome})`);
// campo em região fechada: não caça lá enquanto a história não abre
const fechados = s.cacas.map((c) => c.def).filter((c) => zonaFechadaEm(b.prog, c.x, c.z));
b.prog.nivel = 200;
const campos = new Set(); for (let i = 0; i < 60; i++) { const c = dario.campoAmiga(b); if (c) campos.add(c.id); }
ok(!fechados.some((c) => campos.has(c.id)), `não caça em região fechada (${fechados.length} campos fechados, foi em ${campos.size})`);
b.prog.nivel = 1;
// querer a missão: só com missão do nível dele e tempo do dia sobrando
const rr = Math.random; Math.random = () => 0;
ok(dario.querMissaoAmiga(b), 'quer fazer a missão');
dario.missaoHojeAmiga(b); b.missaoDia.seg = 3600;
ok(!dario.querMissaoAmiga(b), 'passou de 1 h hoje: não faz mais');
b.missaoDia = { dia: '2000-01-01', seg: 99999 };
ok(dario.missaoHojeAmiga(b) === 0, 'dia novo: zera');
Math.random = rr;
// rodar a missão: vai até o lugar (aqui teleporta), aceita, trabalha cada etapa e entrega
const porEtapa = NPC_VIDA.missao.porEtapa; NPC_VIDA.missao.porEtapa = 2; NPC_VIDA.missao.segPorDia = 1e9;
const av = { fase: 'missao' }; let voltou = 0; const voltar = () => { voltou++; };
const p0 = b.prog.hist?.p | 0;
for (let i = 0; i < 4000 && (b.prog.hist?.p | 0) < p0 + 2; i++) {
  s.tempo += 0.1;
  const alvo = !b.prog.hist?.ac ? (s.mapa.npcs || []).find((o) => o.id === missaoAtual(b.prog).npc) : av.alvo;
  if (alvo) { b.x = alvo.x; b.z = alvo.z; }
  dario.missaoSozinhoAmiga(b, av, false, voltar, 0.1);
}
ok((b.prog.hist?.p | 0) >= p0 + 2, `entregou duas missões sozinho (agora: ${missaoAtual(b.prog)?.nome})`);
ok(b.missaoDia.seg > 0, 'o tempo de missão do dia conta');
const antes = b.prog.hist.p; b.prog.nivel = 1;
const proxima = missaoAtual(b.prog);
if (proxima && proxima.nv > 1) { const v0 = voltou; dario.missaoSozinhoAmiga(b, av, false, voltar, 0.1); ok(voltou > v0 && b.prog.hist.p === antes, 'missão acima do nível dele: volta e espera'); }
dario.missaoSozinhoAmiga(b, av, true, voltar, 0.1); ok(voltou > 0, 'de noite: volta para a vila');
NPC_VIDA.missao.porEtapa = porEtapa; NPC_VIDA.missao.segPorDia = 3600;
// diárias: com o nível delas, o que ele terminou recebe sozinho na vila
b.prog.nivel = Math.max(DIARIAS.nivel || 1, 10);
ok(dario.temDiarias(b), 'Dario tem diárias');
const st = dario.diariasDe(b), D = DIARIAS.lista[0];
st.n[D.id] = D.n; const ouro0 = b.prog.ouro;
const n = dario.diariasAmiga(b);
ok(n >= 1 && dario.diariasDe(b).r.includes(D.id), `recebeu a diária "${D.nome || D.id}" sozinho`);
ok(b.prog.ouro >= ouro0, 'prêmio entrou');
ok(dario.diariasAmiga(b) === 0, 'não recebe duas vezes');
// saberAmiga leva a missão dele para a IA
ok(typeof dario.saberAmiga(b, s.jogadores.get('andre')).missaoDela === 'string', 'a IA sabe a missão dele');
