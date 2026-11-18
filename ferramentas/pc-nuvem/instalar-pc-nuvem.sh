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
# RDP (opcional, com PC_VNC='<8 letras/números>'): xrdp na porta 3389 mostra a MESMA tela do
# Chrome (app Windows App no celular). A tela passa a pedir essa senha (o noVNC já entra com ela).
# Segurança: a tela (VNC) e o noVNC só escutam em 127.0.0.1, e o firewall só deixa o Caddy
# falar com o noVNC e só o usuário pc falar com o VNC (o runner não vê o Chrome logado).
# Para fora só sai HTTPS (Caddy, certificado grátis no IP.sslip.io) com usuário e senha.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "ERRO: rode com sudo" >&2; exit 1; }
: "${PC_HASH:?ERRO: falta PC_HASH (hash bcrypt de chaves/pc-nuvem.txt no repositório de fontes)}"
PC_VNC="${PC_VNC:-}"
# PC_RDP=1 (ou PC_RDP=novo para trocar a senha): liga o RDP e a própria VM cria (ou reaproveita) a senha da tela, sem senha na linha.
# A senha fica em /etc/pc-nuvem/vnc.txt (só root) e em https://<endereço>/senha-rdp.txt (atrás do login).
if [ -n "${PC_RDP:-}" ] && [ -z "$PC_VNC" ]; then
  install -d -m 700 /etc/pc-nuvem
  if [ -s /etc/pc-nuvem/vnc.txt ] && [ "$PC_RDP" != novo ]; then
    PC_VNC=$(cat /etc/pc-nuvem/vnc.txt)
  else
    # só minúsculas e números, começando com número: o teclado do celular não põe maiúscula sozinho,
    # e no RDP do celular (teclas "unicode") maiúscula com shift falhava. Sem l/i/o/0/1 (confundem).
    # senha fácil de digitar no celular (pedido do André): palavra de 4 letras + 4 números, tudo minúsculo
    PC_VNC=$(python3 -c 'import secrets;w="bola casa gato lobo mesa pato rato sapo vaca faca dado lata mala pena rede roda sino taco tela vela fogo lago mapa nave ouro peixe".split();w=[x for x in w if len(x)==4];print(secrets.choice(w)+"".join(secrets.choice("23456789") for _ in range(4)))')
  fi
fi
if [ -n "$PC_VNC" ] && ! [[ "$PC_VNC" =~ ^[A-Za-z0-9]{8}$ ]]; then
  echo "ERRO: PC_VNC precisa ter 8 letras/números (limite do VNC)" >&2; exit 1
fi
USUARIO=pc
export DEBIAN_FRONTEND=noninteractive

if [ -n "${PC_RAPIDO:-}" ]; then echo "== modo rápido: pula pacotes e Chrome (já instalados) =="; else
echo "== 1/7 Pacotes (área de trabalho leve, VNC, noVNC, Caddy) =="
apt-get update -y
apt-get install -y --no-install-recommends \
  tigervnc-standalone-server tigervnc-tools openbox tint2 xterm dbus-x11 \
  novnc python3-websockify fonts-noto-core fonts-noto-color-emoji fonts-liberation \
  xdg-utils caddy iptables-persistent curl ca-certificates
if [ -n "$PC_VNC" ]; then apt-get install -y --no-install-recommends xrdp ssl-cert; fi

echo "== 2/7 Google Chrome =="
if ! command -v google-chrome >/dev/null; then
  ARQ=$(dpkg --print-architecture)   # arm64 na A1 (Chrome ARM oficial desde 2026)
  curl -fsSL "https://dl.google.com/linux/direct/google-chrome-stable_current_${ARQ}.deb" -o /tmp/chrome.deb
  apt-get install -y /tmp/chrome.deb
  rm -f /tmp/chrome.deb
fi
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
SEG=(-SecurityTypes None)
# com RDP ligado a tela pede a senha (o noVNC e o xrdp entram com ela)
[ -s "$HOME/.vnc/passwd" ] && SEG=(-SecurityTypes VncAuth -PasswordFile="$HOME/.vnc/passwd")
Xvnc :1 -geometry 1280x800 -depth 24 -rfbport 5901 -localhost "${SEG[@]}" \
  -AlwaysShared -AcceptSetDesktopSize=1 &
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
if [ -n "$PC_VNC" ]; then
  install -d -m 700 /etc/pc-nuvem
  printf '%s\n' "$PC_VNC" > /etc/pc-nuvem/vnc.txt; chmod 600 /etc/pc-nuvem/vnc.txt
  # senha da tela (só o usuário pc lê)
  install -d -o "$USUARIO" -g "$USUARIO" -m 700 "/home/$USUARIO/.vnc"
  printf '%s\n' "$PC_VNC" | vncpasswd -f > "/home/$USUARIO/.vnc/passwd"
  chown "$USUARIO:$USUARIO" "/home/$USUARIO/.vnc/passwd"; chmod 600 "/home/$USUARIO/.vnc/passwd"
  # xrdp: uma única opção, que liga direto na tela do Chrome (nada de login no Linux)
  if [ -f /etc/xrdp/xrdp.ini ] && ! grep -q 'pc-nuvem' /etc/xrdp/xrdp.ini; then
    cp /etc/xrdp/xrdp.ini "/etc/xrdp/xrdp.ini.antes-pc-nuvem.$(date +%s)"   # nada some
  fi
  cat > /etc/xrdp/xrdp.ini <<'INI'
; pc-nuvem: o RDP mostra a mesma tela do noVNC (Chrome com a extensão)
[Globals]
ini_version=1
port=3389
security_layer=tls
crypt_level=high
certificate=
key_file=
ssl_protocols=TLSv1.2, TLSv1.3
allow_channels=true
allow_multimon=false
max_bpp=24
new_cursors=true
use_fastpath=both
bitmap_cache=true
bitmap_compression=true
bulk_compression=true
tcp_nodelay=true
tcp_keepalive=true
[Logging]
LogFile=xrdp.log
LogLevel=INFO
EnableSyslog=true
[Channels]
rdpdr=false
rdpsnd=false
drdynvc=true
cliprdr=true
rail=false
xrdpvr=false
[PC]
name=PC na nuvem
lib=libvnc.so
ip=127.0.0.1
port=5901
username=na
password=ask
INI
  usermod -aG ssl-cert xrdp 2>/dev/null || true
  mkdir -p /etc/systemd/system/xrdp.service.d /etc/systemd/system/xrdp-sesman.service.d
  printf '[Service]\nSlice=pc-nuvem.slice\n' > /etc/systemd/system/xrdp.service.d/pc-nuvem.conf
  printf '[Service]\nSlice=pc-nuvem.slice\n' > /etc/systemd/system/xrdp-sesman.service.d/pc-nuvem.conf
  # o xrdp também pode falar com a tela (regra acima da que bloqueia)
  XU=$(systemctl show -p User --value xrdp 2>/dev/null || true); XU="${XU:-root}"
  iptables -C OUTPUT -o lo -p tcp --dport 5901 -m owner --uid-owner "$XU" -j ACCEPT 2>/dev/null || \
    iptables -I OUTPUT 1 -o lo -p tcp --dport 5901 -m owner --uid-owner "$XU" -j ACCEPT
  # por fora: 3389 aberta, mas no máximo 6 conexões novas por minuto por IP (contra chute de senha)
  iptables -C INPUT -p tcp --dport 3389 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 3389 -j ACCEPT
  REGRA_LIM=(-p tcp --dport 3389 -m conntrack --ctstate NEW -m hashlimit --hashlimit-above 6/min \
    --hashlimit-burst 6 --hashlimit-mode srcip --hashlimit-name pcrdp -j DROP)
  iptables -C INPUT "${REGRA_LIM[@]}" 2>/dev/null || iptables -I INPUT 1 "${REGRA_LIM[@]}"
fi
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
		${PC_VNC:+respond /senha-rdp.txt "$PC_VNC" 200}
		redir / /vnc.html?autoconnect=1&resize=remote&reconnect=1&show_dot=1&path=websockify${PC_VNC:+&password=$PC_VNC}
		reverse_proxy 127.0.0.1:6080
	}
}
CADDY
chmod 640 /etc/caddy/Caddyfile; chgrp caddy /etc/caddy/Caddyfile 2>/dev/null || true

echo "== 7/7 Ligando =="
systemctl daemon-reload
systemctl enable pc-desktop.service pc-novnc.service
systemctl restart pc-desktop.service pc-novnc.service   # pega mudanças ao rodar de novo (logins ficam salvos)
systemctl enable caddy
systemctl restart caddy
if [ -n "$PC_VNC" ]; then systemctl enable xrdp; systemctl restart xrdp; fi
sleep 15
echo
for s in pc-desktop pc-novnc caddy ${PC_VNC:+xrdp}; do echo "$s: $(systemctl is-active $s)"; done
pgrep -u "$USUARIO" -f 'chrome' >/dev/null && echo "chrome: aberto" || echo "chrome: AINDA NÃO"
echo "https (esperado 401 = pede senha): $(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$DOM/" || echo falhou)"
echo
echo "PRONTO. Endereço: https://$DOM/"
echo "Usuário andre, senha em chaves/pc-nuvem.txt no repositório de fontes."
if [ -n "$PC_VNC" ]; then echo "RDP: $IP porta 3389 (Windows App), senha da tela em chaves/pc-nuvem.txt; escutando: $(ss -ltn | grep -c ':3389 ')"; fi
echo "Se o https falhar: libere a entrada TCP 80 e 443 na Security List da sub-rede desta VM."
