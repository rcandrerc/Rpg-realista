// Teste do nome da conta (André 2026-11-13): na frente do servidor local, as primeiras FALHAS respostas de
// GET /conta/eu voltam 503 (como o celular que não recebe a resposta na abertura). O resto passa direto.
// Uso: node conta_nome_proxy.mjs PORTA_PROXY URL_DO_SERVIDOR FALHAS
import http from 'node:http';
const [porta, alvo, falhas] = [Number(process.argv[2]), new URL(process.argv[3]), Number(process.argv[4] || 2)];
let falhou = 0;
http.createServer((req, res) => {
  if (req.url === '/conta/eu' && falhou < falhas) { falhou++; res.writeHead(503); res.end('{}'); return; }
  const p = http.request({ hostname: alvo.hostname.replace(/^\[|\]$/g, ''), port: alvo.port, path: req.url, method: req.method, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode, r.headers); r.pipe(res);
  });
  p.on('error', () => { res.writeHead(502); res.end('{}'); });
  req.pipe(p);
}).listen(porta, '127.0.0.1', () => console.log('proxy ' + porta));
