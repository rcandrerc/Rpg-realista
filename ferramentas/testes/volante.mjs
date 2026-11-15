// Volante dos veículos (André 2026-11-15: "dando 360 com barco carrinho o controle buga, parece que muda a direção";
// quer que gire sempre para o lado que está apertando). Na volta inteira o alvo do joystick passa por trás do veículo
// (perto de 180°) e o "lado mais curto" trocava de um quadro para o outro. Trava: carrinho, barquinho e navio usam
// _volante (andar.gd), a conta continua igual à daqui e uma volta inteira simulada não troca de lado.
// Uso: node ferramentas/testes/volante.mjs   (com GODOT=caminho roda também ferramentas/testes/volante-godot.gd)
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { VEICULOS } from '../../shared/dados.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const raiz = new URL('../../', import.meta.url).pathname;
const andar = readFileSync(raiz + 'godot-prototipo/andar.gd', 'utf8');

// ---------- o código do jogo ----------
const ini = andar.indexOf('func passo_veiculo(');
const fim = andar.indexOf('\nfunc ', ini + 10);
const pv = andar.slice(ini, fim);
ok(ini > 0 && (pv.match(/dif = _volante\(atan2\(mx, mz\)\)/g) || []).length === 3, 'carrinho, navio e barquinho viram pelo _volante');
ok(!/dif = ad\(atan2\(mx, mz\), ry\)/.test(pv), 'nenhum veículo vira mais pelo lado mais curto puro');
ok(/if mag <= 0\.12:[^\n]*\n\t\t_lado_giro = 0\.0/.test(pv), 'soltou o joystick: o lado é escolhido de novo');
const trasM = andar.match(/const VOLANTE_TRAS := ([0-9.]+)/);
ok(!!trasM, 'VOLANTE_TRAS no andar.gd');
const TRAS = trasM ? +trasM[1] : 2.5;
ok(andar.includes(`static func volante(dif: float, lado: float) -> float:
	if lado != 0.0 and signf(dif) != lado and absf(dif) > VOLANTE_TRAS:
		return dif + lado * TAU
	return dif`), 'a conta do volante é a mesma deste teste');

// ---------- a mesma conta, simulada ----------
const TAU = Math.PI * 2;
const sinal = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const volante = (dif, lado) => (lado !== 0 && sinal(dif) !== lado && Math.abs(dif) > TRAS ? dif + lado * TAU : dif);
const ad = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const lerpAng = (a, b, k) => a + ad(b, a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ruido = (t) => Math.sin(t * 7.3) * 0.18 + Math.sin(t * 2.1) * 0.12; // dedo tremendo no joystick
// trocas = vezes que a curva mudou de lado com o alvo ainda longe (o defeito); total = quanto virou
function simular(giro, segundos, joy, segue, novo) {
  let ry = 0, yaw = Math.PI, lado = 0, ultimo = 0, trocas = 0, total = 0;
  const dt = 1 / 30;
  for (let t = 0; t < segundos; t += dt) {
    let dif = ad(joy(t, ry, yaw), ry);
    if (novo) { dif = volante(dif, lado); if (Math.abs(dif) > 0.05) lado = sinal(dif); }
    const passo = clamp(dif, -giro * dt, giro * dt);
    ry += passo; total += passo;
    if (Math.abs(passo) > 1e-4 && Math.abs(dif) > 0.5) { if (ultimo !== 0 && sinal(passo) !== ultimo) trocas++; ultimo = sinal(passo); }
    if (segue) yaw = lerpAng(yaw, ry + Math.PI, Math.min(1, dt * 3));
  }
  return { trocas, total };
}
const giros = { carrinho: VEICULOS.carrinho.giro, barquinho: VEICULOS.barquinho.giro, navio: VEICULOS.navio.giro };
for (const [k, giro] of Object.entries(giros)) {
  // câmera atrás do veículo, joystick para trás e para a direita: o alvo fica sempre perto de 180°
  const r1 = simular(giro, 30, (t, ry, yaw) => yaw + Math.PI + 3.05 + ruido(t), true, true);
  ok(r1.trocas === 0 && Math.abs(r1.total) > TAU, `${k}: câmera atrás, joystick para trás, volta inteira sem trocar de lado (${r1.trocas} trocas, ${r1.total.toFixed(1)} rad)`);
  // câmera parada, o dedo roda o joystick em volta (até quase tão rápido quanto o veículo vira)
  for (const vel of [giro * 0.5, giro * 0.95]) {
    const r2 = simular(giro, (TAU * 2) / vel + 3, (t) => -t * vel + ruido(t), false, true);
    ok(r2.trocas === 0 && r2.total < -TAU, `${k}: joystick rodando ${vel.toFixed(2)} rad/s, volta inteira para o lado certo (${r2.trocas} trocas, ${r2.total.toFixed(1)} rad)`);
  }
}
const antigo = simular(giros.barquinho, 30, (t, ry, yaw) => yaw + Math.PI + 3.05 + ruido(t), true, false);
ok(antigo.trocas > 0, `o jeito antigo (lado mais curto) trocava de lado: o teste pega o defeito (${antigo.trocas} trocas)`);
ok(volante(-1.5, 1) === -1.5 && volante(-2.0, 1) === -2.0, 'joystick claramente do outro lado, na frente: troca na hora');
ok(volante(-3.0, 1) > Math.PI && volante(-3.0, 0) === -3.0, 'alvo lá atrás: continua pelo mesmo lado; sem lado ainda: o mais curto');

// ---------- motor no Godot (opcional) ----------
const godot = process.env.GODOT || '';
if (godot && existsSync(godot)) {
  let saida = '';
  try { saida = execFileSync(godot, ['--headless', '--path', 'godot-prototipo', '--script', '../ferramentas/testes/volante-godot.gd'], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }); } catch (e) { saida = String(e.stdout || '') + String(e.stderr || ''); }
  const r = saida.match(/volante: (\d+) ok, (\d+) falhas/);
  ok(r && +r[2] === 0 && +r[1] > 0 && !/SCRIPT ERROR/.test(saida), `volta inteira no Godot (${r ? r[0] : saida.slice(-300)})`);
} else console.log('(sem Godot: pulando a volta no motor; GODOT=caminho para rodar)');
