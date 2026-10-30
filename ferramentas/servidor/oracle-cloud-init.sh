#!/bin/bash
# Instala o servidor do RPG numa máquina Ubuntu da Oracle Cloud.
# Cole este arquivo inteiro em: Create instance → Advanced options → Management → "Paste cloud-init script".
# Ele instala Node.js e Caddy (https automático), libera as portas 80 e 443, e deixa o servidor
# rodando e se atualizando sozinho a cada 5 minutos a partir do GitHub Pages.
set -eux
export DEBIAN_FRONTEND=noninteractive
PAGINA=https://rcandrerc.github.io/Rpg-realista/servidor

apt-get update
apt-get install -y curl ca-certificates gnupg iptables-persistent caddy
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# portas 80 e 443 (a imagem da Oracle bloqueia tudo menos o SSH)
iptables -I INPUT 1 -p tcp -m multiport --dports 80,443 -j ACCEPT
netfilter-persistent save || iptables-save > /etc/iptables/rules.v4

# servidor do jogo
useradd --system --home /opt/rpg --shell /usr/sbin/nologin rpg || true
mkdir -p /opt/rpg && chown rpg:rpg /opt/rpg
cat > /usr/local/bin/rpg-atualizar <<SCRIPT
#!/bin/bash
# Baixa o servidor publicado no GitHub Pages quando a versão muda e reinicia o jogo.
set -e
nova=\$(curl -fsS $PAGINA/versao.txt) || exit 0
[ "\$nova" = "\$(cat /opt/rpg/versao.txt 2>/dev/null)" ] && exit 0
tmp=\$(mktemp -d)
curl -fsS -o \$tmp/servidor.mjs $PAGINA/servidor.mjs
curl -fsS -o \$tmp/package.json $PAGINA/package.json
cp \$tmp/servidor.mjs \$tmp/package.json /opt/rpg/
cd /opt/rpg && npm install --omit=dev --no-audit --no-fund
echo "\$nova" > /opt/rpg/versao.txt
chown -R rpg:rpg /opt/rpg
systemctl restart rpg
SCRIPT
chmod +x /usr/local/bin/rpg-atualizar

cat > /etc/systemd/system/rpg.service <<UNIT
[Unit]
Description=Servidor do RPG
After=network-online.target
[Service]
User=rpg
WorkingDirectory=/opt/rpg
Environment=PORT=2567 NODE_ENV=production
ExecStart=/usr/bin/node servidor.mjs
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/systemd/system/rpg-atualizar.service <<UNIT
[Unit]
Description=Atualiza o servidor do RPG
[Service]
Type=oneshot
ExecStart=/usr/local/bin/rpg-atualizar
UNIT
cat > /etc/systemd/system/rpg-atualizar.timer <<UNIT
[Unit]
Description=Confere versão nova do servidor do RPG a cada 5 minutos
[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable rpg rpg-atualizar.timer
/usr/local/bin/rpg-atualizar
systemctl start rpg-atualizar.timer

# https: endereço grátis IP.sslip.io com certificado automático (Let's Encrypt) pelo Caddy
IP=$(curl -fsS https://ifconfig.me || curl -fsS https://api.ipify.org)
cat > /etc/caddy/Caddyfile <<CADDY
${IP//./-}.sslip.io {
  reverse_proxy localhost:2567
}
CADDY
systemctl restart caddy
echo "Servidor do RPG: wss://${IP//./-}.sslip.io" > /opt/rpg/ENDERECO.txt
