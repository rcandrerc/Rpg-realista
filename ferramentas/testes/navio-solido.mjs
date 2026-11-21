// Navio mercante novo (André 2026-11-21): escuna de 12,8 m, sólido, com passageiros e os bots do time a bordo.
// Uso: node ferramentas/testes/navio-solido.mjs
import { Simulacao, MAPA_CLAREIRA, LAGOS } from '../../shared/index.js';
import { VEICULOS } from '../../shared/dados.js';
import { noLago, AGUA } from '../../shared/relevo.js';
import { centroNavio, bocaNavio, noConves } from '../../shared/transporte.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const S = VEICULOS.navio.solido, CONVES = AGUA.nivel + S.conves;
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('P', 'Pia'), q = s.adicionarJogador('Q', 'Quim');
for (const o of [j, q]) { o.criando = false; o.morto = false; }
// o lugar mais fundo do Lago Grande
const L = LAGOS.find((l) => l.id === 'lago_grande');
const cx = L.x, cz = L.z;
ok((noLago(cx, cz)?.fundo || 0) > VEICULOS.navio.fundo, 'meio do Lago Grande é fundo');
j.prog.navio = { porao: [], chao: { x: cx, z: cz, ry: 0.5 } };

// a forma do convés
ok(bocaNavio(0) > 1.5 && bocaNavio(5.5) < 0.8 && bocaNavio(7) === -1 && bocaNavio(-7) === -1, 'convés largo no meio, fino na proa, nada fora');
ok(noConves([{ x: 0, z: 0, ry: Math.PI / 2 }], 3, 0) && !noConves([{ x: 0, z: 0, ry: Math.PI / 2 }], 0, 3), 'navio virado: o convés gira junto');

// no leme: quem pilota fica atrás da roda; ancorar guarda o meio do navio (não onde o herói está)
j.x = cx + 1; j.z = cz; j.y = CONVES;
s.veiculo('P', { acao: 'subir', k: 'navio' });
ok(j.veiculo === 'navio' && !j.prog.navio.chao, 'subiu no leme');
const leme = VEICULOS.navio.leme;
j.x = cx + Math.sin(0.5) * leme; j.z = cz + Math.cos(0.5) * leme; j.ry = 0.5; // o celular manda o herói na roda do leme
const c = centroNavio(j);
ok(Math.hypot(c.x - cx, c.z - cz) < 0.05, 'o meio do navio sai da posição do piloto');
ok(s.foto().carga.veic.some((v) => v[0] === 'n' && Math.hypot(v[2] - cx, v[3] - cz) < 0.05), 'a foto mostra o navio no meio, não no piloto');
s.veiculo('P', { acao: 'largar_leme' });
ok(!j.veiculo && j.prog.navio.chao && Math.hypot(j.prog.navio.chao.x - cx, j.prog.navio.chao.z - cz) < 0.05, 'largou o leme no meio do lago: o navio fica parado no mesmo lugar');
ok(Math.abs(j.y - CONVES) < 0.01 && s.aBordo(j.x, j.z, j.y), 'quem largou o leme está de pé no convés');

// passageiro: o navio é chão (y do convés aceito, j.chao) e a velocidade do navio soma na folga
q.x = cx; q.z = cz; q.y = CONVES; q.orc = 0; q.orcT = s.tempo; s.tempo += 1;
ok(s.posicaoCliente('Q', { x: cx + 0.5, y: CONVES, z: cz, ry: 0 }) && q.chao, 'passageiro em pé no convés: posição aceita e no chão');
{ const pt = (lz) => ({ x: cx + Math.sin(0.5) * lz, y: CONVES, z: cz + Math.cos(0.5) * lz, ry: 0.5 });
  Object.assign(q, pt(-4)); q.orc = 0; q.orcT = s.tempo; s.tempo += 1;
  ok(s.posicaoCliente('Q', pt(4.2)), 'correndo no convés com o navio andando (8,2 m em 1 s, mais que a corrida) não volta'); }

// bot do time: o dono no leme e o bot perto sobe; passeia no convés; o dono desce, ele desce junto
const b = s.adicionarJogador('B', 'Bot'); b.criando = false; b.morto = false; b.bot = true;
s.veiculo('P', { acao: 'subir', k: 'navio' });
ok(j.veiculo === 'navio', 'pegou o leme de novo');
j.x = cx + Math.sin(0.5) * leme; j.z = cz + Math.cos(0.5) * leme; j.ry = 0.5;
b.x = cx + 70; b.z = cz; b.y = 0;
ok(!s.bordoBot(b, j, 0.1) && !b.bordo, 'longe demais: não sobe');
b.x = cx + 8; b.z = cz + 3;
ok(s.bordoBot(b, j, 0.1) && b.bordo && Math.abs(b.y - CONVES) < 0.01 && s.aBordo(b.x, b.z, b.y), 'perto: o bot sobe e fica no convés');
s.passoJogador(b, 0.1);
ok(Math.abs(b.y - CONVES) < 0.01, 'a física não derruba o bot do convés');
// o navio anda: o bot vai junto
const antes = { x: b.x, z: b.z };
j.x += 4; s.tempo += 0.1; s.bordoBot(b, j, 0.1);
ok(Math.hypot(b.x - antes.x - 4, b.z - antes.z) < 0.2 && s.aBordo(b.x, b.z, b.y), 'o navio andou 4 m: o bot foi junto');
// passeia: troca de lugar
const lugar = b.bordo.i; s.tempo = b.bordo.troca + 0.1; s.bordoBot(b, j, 0.1);
ok(b.bordo.i !== lugar, 'depois de um tempo ele vai para outro lugar do convés');
let sempre = true; for (let i = 0; i < 80; i++) { s.tempo += 0.1; s.bordoBot(b, j, 0.1); sempre &&= !!s.aBordo(b.x, b.z, b.y); }
ok(sempre, 'passeando ele continua em cima do convés');
// o dono desceu em terra: o bot desce do lado dele
j.veiculo = null; j.prog.navio.chao = centroNavio(j); j.x = cx + 60; j.z = cz + 60; j.y = s.terreno.altura(j.x, j.z);
s.tempo += 0.1;
ok(!s.bordoBot(b, j, 0.1) && !b.bordo && Math.hypot(b.x - j.x, b.z - j.z) < 2, 'o dono desceu: o bot desce junto, do lado dele');
// bot a bordo que ninguém atualiza (saiu do time): solta no próximo passo
b.bordo = { dono: 'P', lx: 0, lz: 0, i: 0, troca: 0 }; b.bordoT = s.tempo - 1; s.passoJogador(b, 0.1);
ok(!b.bordo, 'bot esquecido a bordo é solto (a física volta)');
