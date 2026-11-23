// Bots atravessando o mar (André 2026-11-21: "eles estavam me seguindo; quando cheguei no cais pra pôr o navio eles
// voltaram pra cidade"; "podem ir pra ilha e pro outro continente... de barquinho, claro"; "quando eu estiver no leme do
// navio em time com eles, eles sobem no navio"). shared/amiga.js travessiaAmiga + shared/transporte.js bordoBot.
// Uso: node ferramentas/testes/bot-travessia.mjs
import { Simulacao, MAPA_CLAREIRA, DARIO } from '../../shared/index.js';
import { AGUA } from '../../shared/relevo.js';
import { terraId } from '../../shared/rota.js';
import { contar } from '../../shared/progresso.js';
import { fundoAgua } from '../../shared/transporte.js';
import './_amizade-antiga.mjs'; // o time com a Cecília e o Dario é do jeito antigo (antes do soldado de 2026-11-22)
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const d = s.adicionarJogador('andre', 'André', 'ruiva', {});
const dario = s.amigoIaDe(DARIO.id);
for (const x of s.amigosIa) x.amigaEntrar('andre');
const b = dario.amiga;
Object.assign(d, { x: b.x + 1, z: b.z });
const rnd = Math.random; Math.random = () => 0; dario.conversaAmiga('andre', { acao: 'time' }); Math.random = rnd;
ok(b.time && b.time === d.time, 'Dario no time');
const por = (o, x, z) => { o.x = x; o.z = z; o.y = fundoAgua(x, z) > 0.05 ? AGUA.nivel : s.terreno.altura(x, z); o.vy = 0; o.chao = true; o.montado = null; o.veiculo = null; o.bordo = null; };
const dist = () => Math.hypot(b.x - d.x, b.z - d.z);

// 1) no Cais de Vael: o dono no fim do cais e o Dario 35 m atrás, em terra. Ele vai reto até o cais (não volta pela cidade)
const cais = { x: 101.3, z: 454 };
ok(terraId(cais.x, cais.z) === 0 || fundoAgua(cais.x, cais.z) > 0.05, 'o fim do cais fica sobre a água');
por(d, cais.x, cais.z); d.y = 0.6;
let ini = null;
for (let r = 30; r < 60 && !ini; r += 2) for (let i = 0; i < 24 && !ini; i++) {
  const a = i / 24 * Math.PI * 2, x = cais.x + Math.sin(a) * r, z = cais.z + Math.cos(a) * r;
  if (terraId(x, z) > 0 && fundoAgua(x, z) <= 0.05) ini = { x, z };
}
por(b, ini.x, ini.z);
const d0 = dist();
let maisLonge = 0;
for (let i = 0; i < 20 * 20; i++) { s.passo(0.05); maisLonge = Math.max(maisLonge, dist()); }
ok(maisLonge < d0 + 3 && dist() < d0 - 10, `foi para o cais, não para a cidade (de ${d0.toFixed(0)} m para ${dist().toFixed(0)} m; o mais longe ${maisLonge.toFixed(0)} m)`);

// 2) o dono põe o navio e pega o leme: o Dario sobe a bordo e vai junto
d.prog.mochila[d.prog.mochila.indexOf(null)] = { k: 'navio', n: 1 };
s.veiculo('andre', { acao: 'colocar', k: 'navio' });
ok(d.prog.navio?.chao, 'navio na água no cais');
s.veiculo('andre', { acao: 'subir', k: 'navio' });
ok(d.veiculo === 'navio', 'André no leme');
b.prog.mochila[b.prog.mochila.indexOf(null)] = { k: 'barquinho', n: 1 }; // tem barquinho, mas no navio vem a bordo
por(b, ini.x, ini.z);
let usouBarco = false;
for (let i = 0; i < 20 * 30 && !b.bordo; i++) { s.passo(0.05); if (b.veiculo === 'barquinho') usouBarco = true; }
ok(!!b.bordo, `Dario subiu no navio (${dist().toFixed(1)} m do leme)`);
ok(!usouBarco && contar(b.prog.mochila, 'barquinho') === 1, 'com o dono no navio ele não usa o barquinho: sobe no navio');
for (let i = 0; i < 40; i++) { d.x += 0.3; d.z += 0.3; s.passo(0.05); }
ok(!!b.bordo && dist() < 12, `navegando, ele vai junto no convés (${dist().toFixed(1)} m)`);

// 3) o dono já está na Ilha do Meio e o Dario em Vael com o barquinho na mochila: vai de barquinho e desce na ilha
s.veiculo('andre', { acao: 'largar_leme' }); d.prog.navio.chao = null; d.veiculo = null; s.passo(0.05);
por(d, 241, 624);
por(b, ini.x, ini.z);
ok(terraId(d.x, d.z) > 0 && terraId(b.x, b.z) > 0 && terraId(d.x, d.z) !== terraId(b.x, b.z), 'em terras diferentes');
let remou = false;
const dIni = dist();
for (let i = 0; i < 20 * 400 && !(remou && !b.veiculo && terraId(b.x, b.z) === terraId(d.x, d.z)); i++) { s.passo(0.05); if (b.veiculo === 'barquinho') remou = true; }
ok(remou, 'entrou no barquinho para atravessar');
ok(!b.veiculo && terraId(b.x, b.z) === terraId(d.x, d.z) && contar(b.prog.mochila, 'barquinho') === 1, `chegou na ilha e guardou o barquinho (de ${dIni.toFixed(0)} m para ${dist().toFixed(0)} m)`);
for (let i = 0; i < 20 * 120 && dist() > 6; i++) s.passo(0.05);
ok(dist() < 8, `na ilha, veio a pé até o dono (${dist().toFixed(1)} m)`);
