// Caminho reserva (André 2026-11-16: o celular dele parou de abrir qualquer endereço *.sslip.io, no Wi-Fi e no 5G,
// com ERR_SSL_PROTOCOL_ERROR; o servidor abria normal no resto do mundo). O app, quando o nome falha, conecta direto
// no IP do servidor (rede.gd) mandando o nome no TLS, então o certificado continua o mesmo. Só falta o Caddy aceitar
// pedidos com "Host: IP": aqui o servidor pede isso ao próprio Caddy pela API local dele (127.0.0.1:2019, só a
// máquina enxerga), acrescentando o IP na lista de endereços do site. Nada sai da configuração: só entra o IP.
// O Caddy esquece isso se reiniciar (volta ao Caddyfile); por isso confere de novo de tempos em tempos.
const ADMIN = 'http://127.0.0.1:2019';
const NOME_SSLIP = /^(\d{1,3})-(\d{1,3})-(\d{1,3})-(\d{1,3})\.sslip\.io$/;

export const reserva = { estado: 'ainda não conferiu', ip: null };

async function pedir(caminho, opcoes = {}) {
  const r = await fetch(ADMIN + caminho, { ...opcoes, signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${(await r.text()).slice(0, 120)}`);
  return r;
}

export async function conferirReserva() {
  try {
    const servidores = await (await pedir('/config/apps/http/servers')).json();
    const faltam = [];
    let achou = false;
    for (const [nome, s] of Object.entries(servidores || {})) {
      (s?.routes || []).forEach((rota, i) => (rota?.match || []).forEach((m, j) => {
        const hosts = Array.isArray(m?.host) ? m.host : [];
        for (const h of hosts) {
          const g = NOME_SSLIP.exec(h);
          if (!g) continue;
          const ip = g.slice(1, 5).join('.');
          achou = true;
          reserva.ip = ip;
          if (!hosts.includes(ip)) faltam.push({ caminho: `/config/apps/http/servers/${encodeURIComponent(nome)}/routes/${i}/match/${j}/host`, ip });
        }
      }));
    }
    if (!achou) { reserva.estado = 'site sslip.io não encontrado no Caddy'; return reserva; }
    for (const f of faltam) await pedir(f.caminho, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f.ip) }); // POST num array acrescenta no fim
    reserva.estado = faltam.length ? 'ip acrescentado' : 'ok';
  } catch (e) {
    reserva.estado = 'erro: ' + String(e?.message || e).slice(0, 160);
  }
  return reserva;
}

// na subida e depois a cada 10 min (o Caddy pode ter reiniciado)
export function vigiarReserva() {
  if (process.env.SEM_RESERVA_CADDY) return;
  conferirReserva().then((r) => console.log('caminho reserva (IP no Caddy):', r.estado));
  setInterval(() => conferirReserva(), 10 * 60 * 1000).unref();
}
