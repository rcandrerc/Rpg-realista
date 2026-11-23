// "Proteger carrinho" e "Proteger mercante" (André 2026-11-23, shared/amiga.js protegerVeiculoAmiga): o recruta acha o
// carrinho/navio do líder, ataca o que chega a 12 m sem esperar apanhar, larga o que passa de 15 m (não persegue) e
// volta para a roda. No mercante sobe no convés e não sai do navio enquanto ele anda.
// Uso: node ferramentas/testes/cla-proteger-veiculo.mjs
import { Simulacao, MAPA_CLAREIRA, CLA, VEICULOS, progressoValido } from '../../shared/index.js';
import { carrinhoNovo } from '../../shared/transporte.js';
import './_tudo-aberto.mjs';
import './_relogio-fixo.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const PV = CLA.protegeVeiculo;

const s = new Simulacao(MAPA_CLAREIRA);
const L = s.adicionarJogador('L', 'Lia Líder', undefined, { conta: 30 }); L.criando = false; L.ciente = true;
L.prog.nivel = 30; L.prog.ouro = 50000;
const rec = s.mapa.npcs.find((n) => n.funcao === 'recrutador'); L.x = rec.x + 1; L.z = rec.z;
s.cla('L', { acao: 'fundar', nome: 'Guarda Carga' }); L.prog.cla.nv = 6;
s.cla('L', { acao: 'recrutar', tier: 'veterano' }); s.cla('L', { acao: 'recrutar', tier: 'veterano' });
const c = L.prog.cla, [m1, m2] = c.m, ctx = (id) => s.recrutasNoMundo(L).find((x) => x.AMIGA.id === id);
const a1 = ctx(m1.id).amiga, a2 = ctx(m2.id).amiga;
const avisos = () => s.eventos.filter((e) => e.t === 'aviso' && e.para === 'L').map((e) => e.texto);

// sem carrinho no mundo: botão apagado e o servidor recusa
ok(s.claInfo(L).veic?.carrinho === 0 && s.claInfo(L).veic?.mercante === 0, 'painel: carrinho e mercante apagados');
s.eventos = []; s.cla('L', { acao: 'funcao', id: m1.id, fn: { k: 'proteger', p: 'carrinho' } });
ok(!m1.fn && avisos().some((t) => t.includes('carrinho')), 'sem carrinho no mundo: não aceita');

// carrinho no chão
const cx = L.x + 6, cz = L.z + 6;
L.prog.carrinho = carrinhoNovo(); L.prog.carrinho.chao = { x: cx, z: cz, ry: 0 };
ok(s.claInfo(L).veic.carrinho === 1, 'painel: carrinho aceso');
s.cla('L', { acao: 'funcao', id: m1.id, fn: { k: 'proteger', p: 'carrinho' } });
ok(m1.fn?.p === 'carrinho' && a1.ia.funcao?.p === 'carrinho', 'Proteger carrinho escolhido');
ok(progressoValido(JSON.parse(JSON.stringify(L.prog))).cla.m[0].fn?.p === 'carrinho', 'a conta guarda Proteger carrinho');
for (let i = 0; i < 80; i++) s.passo(0.1);
const dc = () => Math.hypot(a1.x - cx, a1.z - cz);
ok(dc() < PV.roda + 1.5, `fica na roda do carrinho (${dc().toFixed(1)} m)`);
ok(s.claInfo(L).m[0].fz === 'Protegendo o carrinho', `painel: ${s.claInfo(L).m[0].fz}`);

// monstro chega a 8 m do carrinho: ataca sem esperar apanhar
const e = s.criarInimigo({ tipo: 'puglin', x: cx + 8, z: cz, nivel: 1 }); e.vidaMax = e.vida = 1e6; e.alvo = null;
const parado = () => { e.x = e.px; e.z = e.pz; e.alvo = null; };
e.px = cx + 8; e.pz = cz;
for (let i = 0; i < 30; i++) { parado(); s.passo(0.1); }
ok(a1.ia.pv?.alvo === e.id, 'inimigo a 8 m do carrinho: vai nele');
ok(e.vida < e.vidaMax || Math.hypot(a1.x - e.x, a1.z - e.z) < 9, `chega no alcance e bate (vida ${e.vida | 0})`);
// o inimigo se afasta para 25 m: larga e volta, não persegue
e.px = cx + 25; e.pz = cz;
let longe = 0;
for (let i = 0; i < 100; i++) { parado(); s.passo(0.1); longe = Math.max(longe, dc()); }
ok(a1.ia.pv?.alvo == null, 'passou de 15 m: largou');
ok(dc() < PV.roda + 1.5, `voltou para o carrinho (${dc().toFixed(1)} m; no máximo foi a ${longe.toFixed(1)} m)`);
ok(Math.hypot(a1.x - e.x, a1.z - e.z) > 12, 'não correu atrás');
e.morto = true; s.inimigos.splice(s.inimigos.indexOf(e), 1);

// o carrinho anda (o líder dirige): ele vai junto
L.veiculo = 'carrinho'; L.prog.carrinho.chao = null; L.x = cx + 10; L.z = cz; L.ry = 0;
for (let i = 0; i < 60; i++) s.passo(0.1);
ok(Math.hypot(a1.x - L.x, a1.z - L.z) < PV.roda + 1.5, `carrinho dirigido: ele acompanha (${Math.hypot(a1.x - L.x, a1.z - L.z).toFixed(1)} m)`);
L.veiculo = null; L.prog.carrinho.chao = null; // guardou na mochila
for (let i = 0; i < 5; i++) s.passo(0.1);
ok(s.claInfo(L).m[0].fz === 'Esperando o carrinho', `carrinho guardado: ${s.claInfo(L).m[0].fz}`);

// mercante
const nx = L.x + 20, nz = L.z;
L.prog.navio = { porao: [], chao: { x: nx, z: nz, ry: 0 }, vida: VEICULOS.navio.vida, quebrado: false };
ok(s.claInfo(L).veic.mercante === 1, 'painel: mercante aceso');
s.passo(0.1); // o navio posto em terra vai para a água mais perto (transporte.js)
a2.x = L.prog.navio.chao.x + 30; a2.z = L.prog.navio.chao.z; // o recruta está a 30 m dele (sobe de até solido.pertoTime)
s.cla('L', { acao: 'funcao', id: m2.id, fn: { k: 'proteger', p: 'mercante' } });
for (let i = 0; i < 10; i++) s.passo(0.1);
const dn = (x, z) => Math.hypot(a2.x - x, a2.z - z);
const N0 = L.prog.navio.chao;
ok(a2.bordo?.pv && dn(N0.x, N0.z) < 7, `subiu no convés do mercante (${dn(N0.x, N0.z).toFixed(1)} m do meio)`);
// o navio viaja: ele vai junto, sem cair na água; um monstro longe não tira ele do navio
const e2 = s.criarInimigo({ tipo: 'puglin', x: N0.x + 11, z: N0.z, nivel: 1 }); e2.vidaMax = e2.vida = 1e6;
let fora = 0;
L.prog.navio.chao = null; L.veiculo = 'navio'; L.ry = 0;
for (let i = 0; i < 100; i++) {
  L.x = N0.x + i * 0.4; L.z = N0.z + VEICULOS.navio.leme; e2.x = N0.x + 11; e2.z = N0.z;
  s.passo(0.1);
  const q = s.naviosNoMundo()[0]; if (!a2.bordo?.pv || dn(q.x, q.z) > 7) fora++;
}
ok(fora === 0, `navio andou ${(99 * 0.4).toFixed(0)} m: ele ficou no convés o tempo todo`);
// André 2026-11-23 (tremor no mercante andando): a foto leva o lugar dele NO navio, e esse lugar bate com o mundo
{
  const fj = s.foto().jogadores.find((o) => o.id === a2.id), bd = fj?.bd, q = s.naviosNoMundo()[0];
  ok(Array.isArray(bd) && bd[0] === L.id, `foto: lugar no navio do líder (${JSON.stringify(bd)})`);
  const sn = Math.sin(q.ry || 0), cs = Math.cos(q.ry || 0), wx = q.x + bd[1] * cs + bd[2] * sn, wz = q.z - bd[1] * sn + bd[2] * cs;
  ok(Math.hypot(wx - a2.x, wz - a2.z) < 0.05, `foto: navio + lugar = onde ele está (${Math.hypot(wx - a2.x, wz - a2.z).toFixed(3)} m)`);
  const fl = s.foto().jogadores.find((o) => o.id === L.id);
  ok(fl && fl.bd === undefined, 'foto: quem está no leme não leva lugar no convés');
}
// guardou o navio: desce do lado do líder
L.veiculo = null; L.prog.navio.chao = null; L.x = nx; L.z = nz - 10; L.y = s.terreno.altura(L.x, L.z);
for (let i = 0; i < 5; i++) s.passo(0.1);
ok(!a2.bordo && dn(L.x, L.z) < 14, `navio guardado: desceu e protege o líder (${dn(L.x, L.z).toFixed(1)} m)`);
// trocou de função: Livre
s.cla('L', { acao: 'funcao', id: m1.id, fn: { k: 'livre' } });
for (let i = 0; i < 3; i++) s.passo(0.1);
ok(!a1.ia.pv, 'Livre: larga o carrinho');
