// Só Cecília e Dario no mundo (André 2026-11-12: "reduz para 2 de volta, Dário e Cecília só... só deixa eles
// independentes quando eu estiver offline"). Os 20 aventureiros continuam na lista, sem corpo no servidor, e evoluem
// devagar só no tempo em que a sala fica vazia (xpOfflineNpc), sem passar do jogador mais alto.
// Uso: node ferramentas/testes/npcs-fora.mjs
import { Simulacao, MAPA_CLAREIRA, AVENTUREIROS, AMIGOS_VIRTUAIS, NPCS_NO_MUNDO, AV_PROMOVIDOS, npcNoMundo, xpOfflineNpc, xpProximo, PONTOS_POR_NIVEL } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

ok(AVENTUREIROS.length + AV_PROMOVIDOS.length === 20 && AMIGOS_VIRTUAIS.length === 21, 'os 20 continuam (18 aventureiros; Lia e Gael viraram bots, 2026-11-21)');
ok(Array.isArray(NPCS_NO_MUNDO.aventureiros) && NPCS_NO_MUNDO.aventureiros.length === 0, 'nenhum aventureiro no mundo com gente jogando');
const s = new Simulacao(MAPA_CLAREIRA);
{ const aqui = s.amigosIa.filter((x) => !x.AMIGA.rival); ok(aqui.length === 3 && aqui.map((x) => x.AMIGA.id).sort().join() === 'cecilia,dario,lia', 'na sala: só Cecília, Dario e Lia (e a Geada, Chama x Geada: guerra.mjs)'); }
ok(AMIGOS_VIRTUAIS.filter(npcNoMundo).length === 3, 'a lista de quem conversa também só tem os três');

// evolui com a sala vazia: 2 dias fora sobe devagar; nunca passa do teto
const p = { nivel: 3, xp: 0, pontos: 0 };
const sub = xpOfflineNpc(p, Date.now() - 2 * 24 * 3600 * 1000, 12);
ok(sub >= 1 && p.nivel <= 12 && p.pontos === sub * PONTOS_POR_NIVEL, `2 dias com a sala vazia: Nv 3 -> ${p.nivel}`);
const q = { nivel: 12, xp: 0, pontos: 0 };
xpOfflineNpc(q, Date.now() - 14 * 24 * 3600 * 1000, 12);
ok(q.nivel === 12 && q.xp < xpProximo(12), 'no teto (jogador mais alto) não sobe');
const r = { nivel: 5, xp: 10, pontos: 0 };
ok(xpOfflineNpc(r, Date.now(), 99) === 0 && r.xp === 10, 'sem tempo vazio, nada muda');
ok(xpOfflineNpc(null, 0, 10) === 0, 'save sem progresso não quebra');
