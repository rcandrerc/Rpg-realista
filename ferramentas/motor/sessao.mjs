// Conta de teste para o fumaca.gd: cria (ou reaproveita) uma conta no banco da pasta dada e imprime a sessão.
// Uso: node ferramentas/motor/sessao.mjs PASTA_DO_BANCO   (o mesmo DADOS do servidor local)
import { Contas } from '../../server/contas.js';
const c = new Contas({ pasta: process.argv[2], verificar: async () => ({ sub: 'teste-motor', email: 'teste@motor.invalid', given_name: 'Teste' }) });
const r = await c.entrar('x', 'criar');
c.salvarPersonagem(r.conta.id, { nome: 'Teste', visual: 'ruiva', aparencia: null });
console.log(r.sessao);
