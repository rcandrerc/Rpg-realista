// Mochila cheia na coleta (André 2026-11-07): não começa, avisa o motivo e não gasta vigor nem a carga do veio.
// Uso: node ferramentas/testes/mochila-cheia.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { vigorAgora } from '../../shared/progresso.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const no = [...s.coletaveis.values()].find((c) => c.tipo === 'pedra');
const j = s.adicionarJogador('A', 'Ana');
const mo = j.prog.mochila;
mo[mo.indexOf(null)] = { k: 'picareta', n: 1 };
for (let i = 0; i < mo.length; i++) if (!mo[i]) mo[i] = { k: 'pocao', n: 999 }; // tudo cheio com outra coisa
const vigor = vigorAgora(j.prog.vigor);
j.x = no.x + no.r + 1; j.z = no.z; j.chao = true; j.trava = 0; s.eventos = [];
s.coletar('A', { no: no.id });
const av = s.eventos.filter((e) => e.t === 'aviso').map((e) => e.texto);
ok(!j.coleta, 'não começa a minerar');
ok(av.some((t) => /Mochila cheia/.test(t)), 'avisa: ' + av.join(' | '));
ok(vigorAgora(j.prog.vigor) >= vigor, 'não gastou vigor');
// libera um espaço: aí minera
mo[mo.length - 1] = null; s.eventos = [];
s.coletar('A', { no: no.id });
ok(!!j.coleta, 'com espaço, minera');
