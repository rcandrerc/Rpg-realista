// Relógio e sorte de teste (2026-11-14): o teste dá o mesmo resultado em qualquer máquina, rápida ou lenta.
// - Date.now não segue o relógio de verdade: começa num instante fixo e só anda junto com a simulação (cada
//   s.passo(dt) anda dt segundos), como no servidor, onde um passo de 0,05 s leva 0,05 s. Antes, no GitHub (máquina
//   lenta), o relógio de verdade corria no meio do teste: o fogão acendia a lenha entre duas linhas, o dia virava
//   noite no meio da história, a horta da Cecília crescia mais.
// - Math.random vira um sorteio com semente: a mesma partida toda vez. SEMENTE=n troca a semente (para procurar casos).
// Uso: import './_relogio-fixo.mjs'; (antes de criar a Simulacao). relogio.andar(ms) anda o relógio na mão.
import { Simulacao } from '../../shared/index.js';

const INICIO = Date.UTC(2026, 10, 14, 15, 0, 0); // 12h de Brasília: dia claro e longe da virada do dia
let agora = INICIO;
Date.now = () => Math.floor(agora);
export const relogio = { andar: (ms) => { agora += Math.max(0, ms); }, agora: () => Math.floor(agora) };

const passo = Simulacao.prototype.passo;
Simulacao.prototype.passo = function (dt) { agora += Math.max(0, +dt || 0) * 1000; return passo.call(this, dt); };

// mulberry32: rápido e bom o bastante para jogo
let semente = (Number(process.env.SEMENTE ?? 1) >>> 0) || 1;
Math.random = () => {
  semente = (semente + 0x6d2b79f5) >>> 0;
  let t = semente;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
