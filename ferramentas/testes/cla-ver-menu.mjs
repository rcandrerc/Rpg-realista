// "Ver menu" do recruta (André 2026-11-24: "ter acesso a toda sua interface... não vou poder editar nada, somente
// visual"): o líder pede (cla fichaVer) e recebe o progresso inteiro do recruta, no mundo ou do save; nada muda nele.
// Uso: node ferramentas/testes/cla-ver-menu.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Ana', undefined, { conta: 9 });
j.criando = false; j.ciente = true;
const p = j.prog; p.nivel = 40; p.ouro = 20000;
const rec = s.mapa.npcs.find((n) => n.funcao === 'recrutador');
s.cla('A', { acao: 'fundar', nome: 'Lobos do Norte' }); p.cla.nv = 6;
j.x = rec.x + 1; j.z = rec.z;
s.cla('A', { acao: 'recrutar', tier: 'recruta' });
const r = p.cla.m[0], x = s.recrutasNoMundo(j).find((o) => o.AMIGA.id === r.id), a = x.amiga;
a.prog.prof = { ...(a.prog.prof || {}), fer: 1234 }; a.prog.ouro = 77;
const antes = JSON.stringify(a.prog);
s.eventos = []; s.cla('A', { acao: 'fichaVer', id: r.id });
const ev = s.eventos.find((e) => e.t === 'claFicha' && e.para === 'A');
ok(ev && ev.rid === r.id && ev.nome === r.nome && ev.mundo === true, 'no mundo: chega a ficha dele');
ok(ev?.prog?.prof?.fer === 1234 && ev.prog.ouro === 77 && Array.isArray(ev.prog.mochila) && ev.prog.equip && ev.prog.habs, 'progresso inteiro (profissões, mochila, equipamento, habilidades)');
ok(ev?.st?.vidaMax > 0 && ev.xpProx > 0 && ev.visual && ev.aparencia, 'números do herói, XP e corpo para o boneco');
ok(JSON.stringify(a.prog) === antes, 'nada mudou no recruta');
// outro jogador não vê o recruta dos outros
const b = s.adicionarJogador('B', 'Beto', undefined, { conta: 10 }); b.criando = false;
s.cla('B', { acao: 'fundar', nome: 'Outro Cla' });
s.eventos = []; s.cla('B', { acao: 'fichaVer', id: r.id });
ok(!s.eventos.some((e) => e.t === 'claFicha') && s.eventos.some((e) => e.t === 'aviso'), 'recruta de outro clã: não abre');
// fora do mundo: vem do save
s.npcSalvos = new Map([[r.id, { prog: { ...JSON.parse(antes), nivel: 9 } }]]);
s.amigosIa = s.amigosIa.filter((o) => o.AMIGA.id !== r.id);
s.eventos = []; s.cla('A', { acao: 'fichaVer', id: r.id });
const ev2 = s.eventos.find((e) => e.t === 'claFicha');
ok(ev2 && ev2.mundo === false && ev2.prog.nivel === 9 && ev2.st.vidaMax > 0 && ev2.aparencia, 'fora do mundo: a ficha do save');
