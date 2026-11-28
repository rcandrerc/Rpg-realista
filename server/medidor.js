// Medidor de grind dos jogadores (André 2026-11-28: "Eu quero que você mapeie aí o tempo que eu vou gastar de grind em
// cada nível... Do mesmo jeito que você fez aí [no robô], tempo que eu tô grindando, o tempo que eu tô parado"; "Quero que
// meça Yukimei e quero que meça Luísa"; "eu só vou fazer upgrade quando realmente estiver muito ruim"). SÓ LÊ: a cada
// segundo olha o herói de cada conta de gente (nem bot, nem robô) e soma o tempo do estado dele no nível em que está:
//   caca  = em luta ou dentro de um campo de caça (até MEDIDOR.margem m da borda, onde se puxa bicho)
//   anda  = andando ou montado fora do campo (inclui voltar ao campo depois de morrer e trocar de campo)
//   morto = caído, esperando renascer
//   para  = parado fora do campo (vila, menus, ferreiro, baú)
//   fora  = sem conexão no meio do jogo (queda ou reinício do servidor, até MEDIDOR.pausaS); mais que isso é pausa e não conta
// Ao subir de nível fecha a linha do nível (minutos por estado, mortes, abates, campos e o equipamento) e marca cada
// upgrade (reforço, raridade ou peça nova) com o nível e a hora. Nada muda na conta nem no jogo. Os números saem só com o
// crachá da ronda, no /npcs.json (campo jogadores); o /saude mostra só quantas contas estão sendo medidas.
import fs from 'node:fs';
import { CACA } from '@rpg/shared';

export const MEDIDOR = { margem: 10, andouM: 0.5, maxDt: 5, pausaS: 600, maxNiveis: 120, maxUps: 80, salvarS: 60 };
const ESTADOS = ['caca', 'anda', 'morto', 'para', 'fora'];
const tNovo = () => Object.fromEntries(ESTADOS.map((k) => [k, 0]));
const um = (s) => Math.round(s / 6) / 10; // segundos -> minutos com 1 casa
const CAMPOS = CACA.filter((c) => Number.isFinite(c.x) && Number.isFinite(c.z) && c.r > 0);

// o campo de caça em que o herói está (o mais perto que o contém), ou null
export function campoEm(x, z) {
  let melhor = null, dm = Infinity;
  for (const c of CAMPOS) { const d = Math.hypot(x - c.x, z - c.z); if (d <= c.r + MEDIDOR.margem && d < dm) { dm = d; melhor = c; } }
  return melhor;
}
// "cabeca C+0 · corpo R+2": a foto do equipamento (sem durabilidade) e o que mudou de uma foto para a outra
const fotoEquip = (eq) => Object.fromEntries(Object.entries(eq || {}).filter(([, it]) => it?.k).map(([l, it]) => [l, { k: it.k, r: it.r | 0, e: it.e | 0 }]));
const txtEquip = (f) => Object.entries(f).map(([l, o]) => `${l} ${'CREÉLM'[o.r] || '?'}+${o.e}`).join(' · ');
export function mudouEquip(a, b) {
  const l = [];
  for (const [lugar, B] of Object.entries(b)) {
    const A = a[lugar], r = (o) => 'CREÉLM'[o.r] || '?';
    if (!A) l.push(`${lugar} nova (${B.k} ${r(B)}+${B.e})`);
    else if (A.k !== B.k) l.push(`${lugar} trocou (${A.k} ${r(A)}+${A.e} → ${B.k} ${r(B)}+${B.e})`);
    else if (A.r !== B.r) l.push(`${lugar} raridade ${r(A)}→${r(B)}`);
    else if (B.e > A.e) l.push(`${lugar} reforço +${A.e}→+${B.e}`);
    else if (B.e < A.e) l.push(`${lugar} reforço caiu +${A.e}→+${B.e}`);
  }
  for (const lugar of Object.keys(a)) if (!b[lugar]) l.push(`${lugar} saiu`);
  return l;
}
const novoNivel = (nv, agora, eq) => ({ nv, ini: agora, t: tNovo(), mortes: 0, abates: 0, reforco: { n: 0, ouro: 0 }, campos: {}, eq: txtEquip(eq), up: [], pausas: 0 });

export class Medidor {
  constructor(arquivo = null) {
    this.arquivo = arquivo; this.contas = {}; this.sujo = false; this.salvoT = 0;
    if (arquivo) try { this.contas = JSON.parse(fs.readFileSync(arquivo, 'utf8')) || {}; } catch { /* ainda não tem */ }
  }
  // um herói de gente: conta, prog e corpo no mundo (nem bot, nem robô, nem criando o personagem)
  static medivel(j) { return !!(j && !j.bot && !j.robo && !j.ia && j.conta != null && j.prog && !j.criando); }
  // o livro-caixa (sim.aoCaixa): o monstro que ele matou (soltarDrops manda { conta, abates: 1 }) e o ouro de cada
  // tentativa de reforço (fonte 'reforco'), que pode falhar e aí não muda o equipamento
  caixa(l) {
    const R = l && this.contas[String(l.conta)];
    if (!R?.atual || !R.vivo) return;
    if (l.abates) R.atual.abates += l.abates;
    if (l.fonte === 'reforco' && l.v < 0) { R.atual.reforco.n++; R.atual.reforco.ouro += -l.v; }
    this.sujo = true;
  }
  // um passo: sims = as simulações das salas abertas; agora em ms
  passo(sims, agora = Date.now()) {
    const vistos = new Set();
    for (const sim of sims) for (const j of sim.jogadores.values()) {
      if (!Medidor.medivel(j) || vistos.has(String(j.conta))) continue;
      vistos.add(String(j.conta));
      this.olhar(sim, j, agora);
    }
    for (const [conta, R] of Object.entries(this.contas)) if (R.vivo && !vistos.has(conta)) R.vivo = false; // saiu (ou caiu)
    if (this.arquivo && this.sujo && agora - this.salvoT > MEDIDOR.salvarS * 1000) this.salvar(agora);
  }
  olhar(sim, j, agora) {
    const nv = j.prog.nivel | 0, eq = fotoEquip(j.prog.equip), k = String(j.conta);
    let R = this.contas[k];
    // primeira vez, ou a conta voltou de nível (reset): uma série nova, do nível de agora
    if (!R || !R.atual || nv < R.atual.nv) {
      const velha = R?.atual ? { inicio: R.inicio, ate: R.ultimo, niveis: R.niveis, ups: R.ups } : null;
      R = this.contas[k] = { nome: String(j.nome || ''), inicio: agora, ultimo: agora, niveis: [], ups: [], atual: novoNivel(nv, agora, eq), eq, x: j.x, z: j.z, morto: !!j.morto, vivo: true,
        ...(velha ? { antes: [...(R.antes || []), velha].slice(-3) } : R?.antes ? { antes: R.antes } : {}) };
      this.sujo = true;
      return;
    }
    R.nome = String(j.nome || R.nome);
    // tempo desde o último passo: no jogo direto, o passo; voltando de uma queda curta, conta como "fora"; longa = pausa
    const gap = (agora - R.ultimo) / 1000;
    let dt = Math.min(MEDIDOR.maxDt, Math.max(0, gap));
    if (!R.vivo || gap > MEDIDOR.maxDt) {
      if (gap <= MEDIDOR.pausaS) R.atual.t.fora += gap; else R.atual.pausas++;
      dt = 0; R.x = j.x; R.z = j.z;
    }
    R.vivo = true; R.ultimo = agora;
    const campo = !j.morto && campoEm(j.x, j.z);
    const estado = j.morto ? 'morto' : sim.emCombate?.(j) || campo ? 'caca' : Math.hypot(j.x - R.x, j.z - R.z) > MEDIDOR.andouM * Math.max(1, dt) ? 'anda' : 'para';
    R.atual.t[estado] += dt;
    if (estado === 'caca' && campo) { const k = `${campo.nome} (Nv ${campo.nivel || 1})`; R.atual.campos[k] = (R.atual.campos[k] || 0) + dt; }
    if (j.morto && !R.morto) R.atual.mortes++;
    R.morto = !!j.morto; R.x = j.x; R.z = j.z;
    // upgrade: reforço, raridade ou peça nova (a durabilidade não conta)
    const mud = mudouEquip(R.eq || {}, eq);
    if (mud.length) {
      for (const txt of mud) { R.atual.up.push(txt); R.ups.push({ t: agora, nv, txt }); }
      if (R.ups.length > MEDIDOR.maxUps) R.ups.splice(0, R.ups.length - MEDIDOR.maxUps);
      R.eq = eq;
    }
    // subiu: fecha a linha do nível (se pulou mais de um, os do meio ficam sem tempo)
    if (nv > R.atual.nv) {
      R.niveis.push({ ...R.atual, fim: agora });
      for (let v = R.atual.nv + 1; v < nv; v++) R.niveis.push({ ...novoNivel(v, agora, eq), fim: agora, pulou: true });
      if (R.niveis.length > MEDIDOR.maxNiveis) R.niveis.splice(0, R.niveis.length - MEDIDOR.maxNiveis);
      R.atual = novoNivel(nv, agora, eq);
      if (this.arquivo) this.salvar(agora);
    }
    this.sujo = true;
  }
  salvar(agora = Date.now()) {
    this.salvoT = agora; this.sujo = false;
    try { fs.writeFileSync(this.arquivo, JSON.stringify(this.contas)); } catch (e) { console.error('Medidor: não gravou', e.message); }
  }
  // para o /npcs.json (só com crachá): cada conta, nível a nível, em minutos
  relatorio() {
    const linha = (L, parcial) => {
      const t = Object.fromEntries(ESTADOS.map((k) => [k, um(L.t[k] || 0)])), soma = ESTADOS.reduce((a, k) => a + (L.t[k] || 0), 0);
      return { nv: L.nv, ini: L.ini, ...(L.fim ? { fim: L.fim } : {}), min: um(soma), t, mortes: L.mortes, abates: L.abates, ...(L.reforco?.n ? { reforco: L.reforco } : {}),
        campos: Object.fromEntries(Object.entries(L.campos).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, s]) => [k, um(s)])),
        eq: L.eq, ...(L.up.length ? { up: L.up } : {}), ...(L.pausas ? { pausas: L.pausas } : {}), ...(L.pulou ? { pulou: true } : {}), ...(parcial ? { jogando: true } : {}) };
    };
    return Object.entries(this.contas).map(([conta, R]) => ({ conta, nome: R.nome, online: !!R.vivo, inicio: R.inicio, nivel: R.atual?.nv ?? null,
      niveis: [...R.niveis.map((L) => linha(L)), ...(R.atual ? [linha(R.atual, true)] : [])], ups: R.ups,
      ...(R.antes ? { seriesAntes: R.antes.map((S) => ({ inicio: S.inicio, ate: S.ate, niveis: S.niveis.length })) } : {}) }));
  }
  saude() { const l = Object.values(this.contas); return { contas: l.length, online: l.filter((R) => R.vivo).length }; }
}
