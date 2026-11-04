// Confere a área de interesse (server/visao.js): um "celular de mentira" junta as fotos pela metade do jeito que o
// online.gd faz (_juntar) e, a cada passo, o que ele sabe tem que ser igual à foto inteira para tudo que está perto.
// Uso: node ferramentas/carga/conferir-visao.mjs   (sai com 1 se achar diferença)
// Com --gravar <arquivo>: grava as mensagens de um jogador andando (para o teste do Godot).
import fs from 'node:fs';
import { Simulacao, MAPA_CLAREIRA } from '@rpg/shared';
import { Visao, VISAO } from '../../server/visao.js';

const sim = new Simulacao(MAPA_CLAREIRA);
const N = 12;
for (let i = 0; i < N; i++) sim.adicionarJogador('j' + i, 'Teste ' + i, 'ruiva', {});
const visao = new Visao();
const sabe = new Map(); // jogador -> Map(id -> objeto juntado)
const gravar = process.argv.includes('--gravar') ? process.argv[process.argv.indexOf('--gravar') + 1] : null;
const gravadas = [];
const caminho = (MAPA_CLAREIRA.caca || []).map((c) => ({ x: c.x, z: c.z }));
let erros = 0, maxEnt = 0;
for (let p = 0; p < 1200; p++) {
  // j0 anda pela estrada de campo em campo; os outros andam ao acaso perto da vila ou atrás do j0
  const alvo = caminho[Math.floor(p / 120) % caminho.length] || { x: 0, z: 0 };
  for (const [id, j] of sim.jogadores) {
    if (id === 'j0') { const dx = alvo.x - j.x, dz = alvo.z - j.z, d = Math.hypot(dx, dz) || 1; j.x += (dx / d) * Math.min(d, 1.5); j.z += (dz / d) * Math.min(d, 1.5); }
    else if (Number(id.slice(1)) % 3 === 0) { const a = sim.jogadores.get('j0'); j.x = a.x + Math.sin(p / 10 + Number(id.slice(1))) * 30; j.z = a.z + 5; }
    else { j.x += (Math.random() - 0.5); j.z += (Math.random() - 0.5); }
  }
  const eventos = sim.passo(1 / 20);
  const foto = sim.foto();
  const ctx = visao.preparar(foto, eventos);
  for (let i = 0; i < N; i++) {
    const id = 'j' + i;
    const txt = visao.paraJogador(ctx, id);
    if (gravar && id === 'j0') gravadas.push(txt);
    const msg = JSON.parse(txt);
    let s = sabe.get(id); if (!s) sabe.set(id, (s = new Map()));
    const agora = new Set();
    for (const c of [...msg.foto.jogadores.filter((j) => j.id !== id), ...msg.foto.inimigos]) {
      const t = s.get(c.id) || {}; Object.assign(t, c); s.set(c.id, t); agora.add(c.id);
    }
    for (const k of [...s.keys()]) if (!agora.has(k)) s.delete(k);
    maxEnt = Math.max(maxEnt, agora.size);
    // compara com a foto inteira (as chaves que o celular usa)
    const eu = foto.jogadores.find((j) => j.id === id);
    const longe = (o) => Math.hypot(o.x - eu.x, o.z - eu.z) > VISAO.meiaVelocidade / 2; // meia velocidade: posição pode atrasar 1 foto
    for (const o of [...foto.jogadores.filter((j) => j.id !== id && !j.criando), ...foto.inimigos]) {
      const t = s.get(o.id);
      const d = Math.hypot(o.x - eu.x, o.z - eu.z);
      const raio = o.tipo ? VISAO.inimigoEntra : VISAO.jogadorEntra;
      if (!t) { if (d < raio - 1 && (o.tipo || agora.size < VISAO.maxJogadores)) { erros++; if (erros < 5) console.log('faltou', id, o.id, d.toFixed(1)); } continue; }
      for (const k of ['vida', 'morto', 'anim', 'acaoSeq', 'nome', 'vidaMax', 'nivel', 'v', 'tipo', 'roupa', 'visual', 'modo']) {
        if (o[k] !== undefined && JSON.stringify(o[k]) !== JSON.stringify(t[k]) && !(longe(o) && p % 2 === 0)) { erros++; if (erros < 5) console.log('diferente', id, o.id, k, o[k], t[k]); }
      }
      if (!(longe(o) && p % 2 === 0) && (t.x !== o.x || t.z !== o.z)) { erros++; if (erros < 5) console.log('posição', id, o.id, t.x, o.x); }
    }
  }
}
if (gravar) fs.writeFileSync(gravar, JSON.stringify(gravadas));
console.log(erros ? `ERRO: ${erros} diferenças` : `ok: 1200 passos, ${N} jogadores, até ${maxEnt} corpos por foto, nada faltou`);
process.exit(erros ? 1 : 0);
