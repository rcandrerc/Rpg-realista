// Rara do chefe e do Warrok (André 2026-11-27, "cortar para todos os jogadores pra 25%"; "os bosses principais... pode até
// deixar garantido"): os que nascem no campo de caça dão a peça Rara em ~25% das vezes; chefe da história, elite da
// Guilda (hc), sala da caverna e emboscada seguem com a Rara garantida (DROPS.raridadeCampo em shared/dados.js).
// Uso: node ferramentas/testes/drop-chefe.mjs
import { Simulacao, MAPA_CLAREIRA, DROPS } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

ok(['chefe', 'warrok'].every((t) => DROPS[t].raridadeCampo && DROPS[t].raridadeCampo[1] === 0.25 && DROPS[t].raridadeCampo[0] === 0.75), 'chefe e Warrok do campo: Rara 25%, Comum 75%');
ok(['chefe', 'warrok'].every((t) => DROPS[t].raridade[1] === 1 && DROPS[t].equip === 1), 'fora do campo segue garantido: sempre uma peça, sempre Rara');
ok(Object.values(DROPS).every((d) => !d.raridadeCampo || d.raridadeCampo.slice(2).every((x) => x === 0)), 'no campo também só Comum ou Rara');

// na simulação: 2000 chefes de cada jeito, conta as peças Raras que caíram
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('a', 'A', 'ruiva', {});
j.prog.nivel = 1; const vazia = structuredClone(j.prog.mochila);
const raras = (c, n = 2000) => {
  let r = 0, pecas = 0;
  for (let i = 0; i < n; i++) {
    j.prog.mochila = structuredClone(vazia); s.eventos = [];
    s.soltarDrops({ nivel: 1, x: 0, z: 0, ...c }, j);
    for (const e of s.eventos) if (e.t === 'drop') for (const it of e.itens) if (it.r >= 0) { pecas++; if (it.r === 1) r++; }
  }
  return { r, pecas, f: r / Math.max(1, pecas) };
};
const campo = raras({ tipo: 'chefe', sp: { caca: 0, vaga: 0 } }), warrok = raras({ tipo: 'warrok', sp: { caca: 3, vaga: 10 } });
ok(campo.pecas === 2000 && campo.f > 0.21 && campo.f < 0.29, `chefe do campo: ${campo.r} Raras em ${campo.pecas} peças (${(campo.f * 100).toFixed(1)}%)`);
ok(warrok.pecas === 2000 && warrok.f > 0.21 && warrok.f < 0.29, `Warrok do campo: ${warrok.r} Raras em ${warrok.pecas} peças (${(warrok.f * 100).toFixed(1)}%)`);
const historia = raras({ tipo: 'warrok', sp: { caca: 3, vaga: 10 }, hc: 'arauto' }, 300);
const caverna = raras({ tipo: 'warrok', sp: { caverna: 'sala3' } }, 300), emboscada = raras({ tipo: 'warrok', sp: { missao: 1 } }, 300);
ok(historia.f === 1 && caverna.f === 1 && emboscada.f === 1, `chefe da história, sala da caverna e emboscada: sempre Rara (${historia.r}, ${caverna.r}, ${emboscada.r} de 300)`);
