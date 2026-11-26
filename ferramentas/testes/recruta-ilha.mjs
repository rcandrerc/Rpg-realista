// Recruta com ordem de caçar num campo da outra terra (André 2026-11-26: "atravessou o mar inteiro nadando, deu 2 hits no
// monstro e voltou"; "qualquer um que precisasse atravessar o oceano já faria o barquinho automático"): faz o barquinho
// com o material da mochila, atravessa de barco, não é jogado de volta ao continente na praia da ilha e caça o tempo
// inteiro depois de chegar (o tempo da caçada conta da chegada).
// Uso: node ferramentas/testes/recruta-ilha.mjs
import { Simulacao, MAPA_CLAREIRA, contar, NPC_VIDA } from '../../shared/index.js';
import { terraId } from '../../shared/rota.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.prog.ouro = 90000; a.prog.nivel = 60;
s.cla('A', { acao: 'fundar', nome: 'Ilha' }); a.prog.cla.nv = 6;
const r = s.mapa.npcs.find((n) => n.funcao === 'recrutador'); a.x = r.x + 1; a.z = r.z;
s.cla('A', { acao: 'recrutar', tier: 'recruta' });
const m = a.prog.cla.m[0], x = s.recrutasNoMundo(a).find((o) => o.AMIGA.id === m.id), b = x.amiga;
b.prog.nivel = 60; b.prog.mochila.fill(null);
b.prog.mochila[0] = { k: 'pocao', n: 20 }; b.prog.mochila[1] = { k: 'lenha', n: 30 }; b.prog.mochila[2] = { k: 'couro', n: 4 };
s.cla('A', { acao: 'funcao', id: m.id, fn: { k: 'recurso', r: 'carne' } });
let chegou = null, cacando = 0, pulo = 0, naIlha = false, barco = false;
for (let i = 0; i < 4 * 700; i++) {
  const px = b.x, pz = b.z; s.passo(0.25);
  if (Math.hypot(b.x - px, b.z - pz) > 20) pulo++;
  if (b.veiculo === 'barquinho') barco = true;
  if (terraId(b.x, b.z) === 2) naIlha = true;
  if (b.ia.av?.fase === 'cacar') { cacando += 0.25; chegou ??= i / 4; }
  if (chegou !== null && b.ia.av?.fase !== 'cacar') break;
}
ok(barco, 'fez o barquinho com o material e atravessou de barco');
ok(naIlha && b.ia.av?.c?.nome?.includes('Ilha') !== false, 'chegou na Ilha do Meio (campo da carne no nível dele)');
ok(pulo === 0, `não foi jogado de volta ao continente na praia (${pulo} pulos)`);
ok(chegou !== null && cacando >= NPC_VIDA.aventura.cacar[0] * 0.5, `caçou ${cacando} s depois de chegar (antes a viagem gastava o tempo)`);

// sem o material (André 2026-11-26: "ele vai e coleta os itens para fazer o barquinho e depois vai para a ilha... não vai
// mais para a ilha nadando"): com machado e vigor, corta a lenha perto, faz o barquinho e só então atravessa
{
  const m2 = (s.cla('A', { acao: 'recrutar', tier: 'recruta' }), a.prog.cla.m[1]), x2 = s.recrutasNoMundo(a).find((o) => o.AMIGA.id === m2.id), c = x2.amiga;
  c.prog.nivel = 60; c.prog.mochila.fill(null); c.x = -10; c.z = -6;
  c.prog.mochila[0] = { k: 'pocao', n: 20 }; c.prog.mochila[1] = { k: 'machado', n: 1 }; c.prog.mochila[2] = { k: 'couro', n: 4 }; c.prog.vigor = { v: 500, t: Date.now() };
  s.cla('A', { acao: 'funcao', id: m2.id, fn: { k: 'recurso', r: 'carne' } });
  let nadou = 0, cortando = false, fez = false;
  for (let i = 0; i < 4 * 600 && !fez; i++) {
    s.passo(0.25);
    if (c.ia.av?.barcoK === 'lenha') cortando = true;
    if (terraId(c.x, c.z) === 0 && c.veiculo !== 'barquinho') nadou++;
    if (contar(c.prog.mochila, 'barquinho') > 0 || c.veiculo === 'barquinho') fez = true;
  }
  ok(cortando, 'sem lenha: foi cortar lenha para o barquinho');
  ok(fez, 'juntou a lenha e fez o barquinho');
  ok(nadou === 0, 'não foi nadando para a ilha');
  ok(s.fazendoRecruta(c, a) === 'A caminho do spot' || c.ia.av?.fase === 'ir', `status: "${s.fazendoRecruta(c, a)}"`);
}
