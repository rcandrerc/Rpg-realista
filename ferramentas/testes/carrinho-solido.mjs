// Carrinho sólido (André 2026-11-13): em cima do carrinho conta como chão no servidor (ataca, pula, usa magia lá de cima)
import { caixasCarrinho, topoCarrinho } from '../../shared/transporte.js';
let falhou = 0;
const ok = (c, t) => { console.log((c ? 'ok ' : 'FALHOU ') + t); if (!c) falhou++; };
const cx = caixasCarrinho(2);
ok(cx.trator.length >= 5 && cx.carreta.length === 4, 'nível 2: trator e carreta (lança, rodas, 2 fileiras)');
ok(Math.max(...caixasCarrinho(4).carreta.map((b) => b[4])) > Math.max(...cx.carreta.map((b) => b[4])), 'nível 4: engradados de 2 andares são mais altos');
const c = [{ x: 10, z: 10, ry: 0, y: 0, lv: 2 }];
ok(Math.abs(topoCarrinho(c, 10, 10.7) - 1.37) < 0.01, 'em cima do motor: 1,37 m');
ok(Math.abs(topoCarrinho(c, 10, 8.2) - 1.2) < 0.01, 'em cima dos engradados da carreta: 1,2 m');
ok(topoCarrinho(c, 12, 10) === -Infinity, 'do lado do carrinho: chão normal');
const g = [{ x: 0, z: 0, ry: Math.PI / 2, y: 0, lv: 2 }];
ok(Math.abs(topoCarrinho(g, 0.7, 0) - 1.37) < 0.01, 'carrinho virado: o motor fica para +x');
process.exit(falhou ? 1 : 0);
