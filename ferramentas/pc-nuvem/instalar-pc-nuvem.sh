#!/bin/bash
# PC NA NUVEM: área de trabalho leve com Google Chrome (e a extensão Claude in Chrome) na VM
# builds-runner do Oracle. O André abre um link no celular (sem app) e vê a tela; as threads
# do Claude usam esse Chrome pela extensão. NÃO é para a VM do jogo.
#
# Uso (Oracle Console > builds-runner > Run command, roda como ocarun com sudo):
#   curl -fsSL <url deste arquivo> -o /tmp/pc.sh && sudo PC_HASH='<hash bcrypt>' bash /tmp/pc.sh
# O hash e a senha ficam no repositório de fontes, em chaves/pc-nuvem.txt. Nunca a senha aqui.
#
# Convivência com os builds (o build sempre vem primeiro):
#   - tudo do PC na nuvem roda na fatia pc-nuvem.slice: memória até 3 GB, CPUWeight 2
#     (o runner tem CPUWeight 20 = 10x mais prioridade), disco com prioridade baixa;
#   - swap de 4 GB se a máquina não tiver, para nenhum dos dois cair por falta de memória.
# Segurança: a tela (VNC) e o noVNC só escutam em 127.0.0.1, e o firewall só deixa o Caddy
# falar com o noVNC e só o usuário pc falar com o VNC (o runner não vê o Chrome logado).
# Para fora só sai HTTPS (Caddy, certificado grátis no IP.sslip.io) com usuário e senha.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "ERRO: rode com sudo" >&2; exit 1; }
: "${PC_HASH:?ERRO: falta PC_HASH (hash bcrypt de chaves/pc-nuvem.txt no repositório de fontes)}"
USUARIO=pc
export DEBIAN_FRONTEND=noninteractive

echo "== 1/7 Pacotes (área de trabalho leve, VNC, noVNC, Caddy) =="
apt-get update -y
apt-get install -y --no-install-recommends \
  tigervnc-standalone-server tigervnc-tools openbox tint2 xterm dbus-x11 \
  novnc python3-websockify fonts-noto-core fonts-noto-color-emoji fonts-liberation \
  xdg-utils caddy iptables-persistent curl ca-certificates

echo "== 2/7 Google Chrome =="
if ! command -v google-chrome >/dev/null; then
  ARQ=$(dpkg --print-architecture)   # arm64 na A1 (Chrome ARM oficial desde 2026)
  curl -fsSL "https://dl.google.com/linux/direct/google-chrome-stable_current_${ARQ}.deb" -o /tmp/chrome.deb
  apt-get install -y /tmp/chrome.deb
  rm -f /tmp/chrome.deb
fi
# Claude in Chrome já instalado; o resto é só deixar o Chrome quieto
mkdir -p /etc/opt/chrome/policies/managed
cat > /etc/opt/chrome/policies/managed/pc-nuvem.json <<'JSON'
{
  "ExtensionInstallForcelist": ["fcoeoabgfenejglbffodgkkbkcdhcgfn;https://clients2.google.com/service/update2/crx"],
  "BackgroundModeEnabled": false,
  "MetricsReportingEnabled": false,
  "DefaultBrowserSettingEnabled": false,
  "RestoreOnStartup": 1,
  "PromotionalTabsEnabled": false
}
JSON

echo "== 3/7 Usuário 'pc' (sem sudo) =="
id "$USUARIO" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$USUARIO"

echo "== 4/7 Swap e freios =="
if [ "$(swapon --show --noheadings | wc -l)" = 0 ]; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
cat > /etc/systemd/system/pc-nuvem.slice <<'UNIT'
[Unit]
Description=PC na nuvem (sempre abaixo dos builds)
[Slice]
CPUWeight=2
IOWeight=10
MemoryHigh=2560M
MemoryMax=3G
MemorySwapMax=2G
UNIT

echo "== 5/7 Sessão gráfica e noVNC =="
mkdir -p /opt/pc-nuvem
cat > /opt/pc-nuvem/sessao.sh <<'SH'
#!/bin/bash
# Tela 1280x800 só local; openbox + barra; Chrome sempre aberto (volta sozinho se fechar),
# porque as threads precisam dele aberto para usar a extensão.
export DISPLAY=:1
rm -f /tmp/.X1-lock /tmp/.X11-unix/X1
Xvnc :1 -geometry 1280x800 -depth 24 -rfbport 5901 -localhost -SecurityTypes None \
  -AlwaysShared -AcceptSetDesktopSize=0 &
XPID=$!
for _ in $(seq 100); do [ -e /tmp/.X11-unix/X1 ] && break; sleep 0.1; done
openbox &
tint2 &
while kill -0 "$XPID" 2>/dev/null; do
  google-chrome --lang=pt-BR --no-first-run --no-default-browser-check \
    --password-store=basic --start-maximized --disable-features=Translate \
    --ignore-gpu-blocklist --enable-unsafe-swiftshader || true
  # (sem placa de vídeo: WebGL pelo processador, para o Mixamo abrir)
  sleep 3
done
SH
chmod 755 /opt/pc-nuvem/sessao.sh
cat > /etc/systemd/system/pc-desktop.service <<UNIT
[Unit]
Description=PC na nuvem: tela e Chrome
After=network-online.target
[Service]
User=$USUARIO
Slice=pc-nuvem.slice
Nice=10
WorkingDirectory=/home/$USUARIO
ExecStart=/opt/pc-nuvem/sessao.sh
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/systemd/system/pc-novnc.service <<UNIT
[Unit]
Description=PC na nuvem: noVNC (tela no navegador)
After=pc-desktop.service
[Service]
User=$USUARIO
Slice=pc-nuvem.slice
ExecStart=/usr/bin/websockify --web /usr/share/novnc 127.0.0.1:6080 127.0.0.1:5901
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT

echo "== 6/7 Firewall e HTTPS com senha =="
# por fora: só 80 (certificado) e 443
iptables -C INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT 2>/dev/null || \
  iptables -I INPUT 1 -p tcp -m multiport --dports 80,443 -j ACCEPT
# por dentro: só o Caddy fala com o noVNC, só o usuário pc fala com a tela
for regra in "--dport 6080 -m owner ! --uid-owner caddy" "--dport 5901 -m owner ! --uid-owner $USUARIO"; do
  # shellcheck disable=SC2086
  iptables -C OUTPUT -o lo -p tcp $regra -j REJECT 2>/dev/null || iptables -I OUTPUT 1 -o lo -p tcp $regra -j REJECT
done
netfilter-persistent save || iptables-save > /etc/iptables/rules.v4
IP=$(curl -fsS https://api.ipify.org)
DOM="${IP//./-}.sslip.io"
if [ -s /etc/caddy/Caddyfile ] && ! grep -q 'pc-nuvem' /etc/caddy/Caddyfile && grep -qv '^\s*#' /etc/caddy/Caddyfile; then
  cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.antes-pc-nuvem.$(date +%s)"   # nada some
fi
cat > /etc/caddy/Caddyfile <<CADDY
# pc-nuvem
$DOM {
	# route: a senha vem ANTES de tudo (sem route o Caddy faria o redir antes da senha)
	route {
		basicauth {
			andre $PC_HASH
		}
		redir / /vnc.html?autoconnect=1&resize=scale&reconnect=1&path=websockify
		reverse_proxy 127.0.0.1:6080
	}
}
CADDY

echo "== 7/7 Ligando =="
systemctl daemon-reload
systemctl enable pc-desktop.service pc-novnc.service
systemctl restart pc-desktop.service pc-novnc.service   # pega mudanças ao rodar de novo (logins ficam salvos)
systemctl enable caddy
systemctl restart caddy
sleep 15
echo
for s in pc-desktop pc-novnc caddy; do echo "$s: $(systemctl is-active $s)"; done
pgrep -u "$USUARIO" -f 'chrome' >/dev/null && echo "chrome: aberto" || echo "chrome: AINDA NÃO"
echo "https (esperado 401 = pede senha): $(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$DOM/" || echo falhou)"
echo
echo "PRONTO. Endereço: https://$DOM/"
echo "Usuário andre, senha em chaves/pc-nuvem.txt no repositório de fontes."
echo "Se o https falhar: libere a entrada TCP 80 e 443 na Security List da sub-rede desta VM."
