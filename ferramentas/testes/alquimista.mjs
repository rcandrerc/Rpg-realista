// Alquimista (André 2026-11-09): junta catalisadores de uma raridade + ouro e faz 1 da raridade de cima. Só até Lendário.
// Uso: node ferramentas/testes/alquimista.mjs
import { Simulacao, MAPA_CLAREIRA, CATALISADOR, contar } from '../../shared/index.js';
import './_tudo-aberto.mjs'; // progressão (2026-11-10): este teste não é sobre a névoa nem a trava de nível
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const S = CATALISADOR.sintese, npc = MAPA_CLAREIRA.npcs.find((n) => n.id === S.npc);
ok(npc && npc.acoes.includes('alquimia'), 'a alquimista está na vila com a ação alquimia');
ok(!S.custo[4] && S.ate === 3, 'Mítico não tem receita');
const nova = (perto = true) => {
  const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('C', 'Cris');
  j.criando = false; j.morto = false;
  if (perto) { j.x = npc.x + 1; j.z = npc.z; }
  const ev = []; const e0 = s.evento.bind(s); s.evento = (e) => { ev.push(e); e0(e); };
  return { s, j, M: j.prog.mochila, p: j.prog, ev };
};
const E = S.custo[2], L = S.custo[3];
{ // Selo Épico com Selos Raros
  const { s, M, p } = nova();
  M.fill(null); M[0] = { k: 'selo_raro', n: E.n * 2 + 1 }; p.ouro = E.ouro * 2 + 5;
  s.item('C', { acao: 'sintetizar', k: 'selo_epico' });
  ok(contar(M, 'selo_epico') === 1 && contar(M, 'selo_raro') === E.n + 1 && p.ouro === E.ouro + 5, '1 Selo Épico gasta os Raros e o ouro');
  s.item('C', { acao: 'sintetizar', k: 'selo_epico', n: 20 });
  ok(contar(M, 'selo_epico') === 2 && contar(M, 'selo_raro') === 1 && p.ouro === 5, 'máximo: para quando acaba catalisador/ouro');
  s.item('C', { acao: 'sintetizar', k: 'selo_epico' });
  ok(contar(M, 'selo_epico') === 2, 'sem material não faz nada');
}
{ // Runa Lendária com Runas Épicas; Runa não vira Selo
  const { s, M, p } = nova();
  M.fill(null); M[0] = { k: 'runa_epica', n: L.n }; M[1] = { k: 'selo_epico', n: L.n }; p.ouro = L.ouro;
  s.item('C', { acao: 'sintetizar', k: 'runa_lendaria' });
  ok(contar(M, 'runa_lendaria') === 1 && contar(M, 'runa_epica') === 0 && contar(M, 'selo_epico') === L.n && p.ouro === 0, 'Runa Lendária usa só Runas Épicas');
}
{ // Mítico nunca; Raro não tem receita; longe dela não faz
  const { s, M, p, ev } = nova();
  M.fill(null); M[0] = { k: 'selo_lendario', n: 50 }; M[1] = { k: 'runa_lendaria', n: 50 }; p.ouro = 1e7;
  s.item('C', { acao: 'sintetizar', k: 'selo_mitico', n: 5 }); s.item('C', { acao: 'sintetizar', k: 'runa_mitica' });
  ok(contar(M, 'selo_mitico') === 0 && contar(M, 'runa_mitica') === 0 && p.ouro === 1e7, 'Mítico nunca sai da alquimista');
  ok(ev.some((e) => e.t === 'aviso' && /Mítico/.test(e.texto)), 'avisa que Mítico não dá');
  s.item('C', { acao: 'sintetizar', k: 'selo_raro' });
  ok(contar(M, 'selo_raro') === 0, 'Raro não se sintetiza');
}
{
  const { s, M, p, j } = nova(false);
  j.x = npc.x + 30; j.z = npc.z;
  M.fill(null); M[0] = { k: 'selo_raro', n: 10 }; p.ouro = 1e5;
  s.item('C', { acao: 'sintetizar', k: 'selo_epico' });
  ok(contar(M, 'selo_epico') === 0, 'longe da alquimista não faz');
}
