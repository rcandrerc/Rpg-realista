#!/bin/bash
# Instala um "runner próprio" do GitHub Actions na máquina da Oracle (a mesma do servidor do jogo).
# Com ele, os builds do APK e do site rodam AQUI, de graça, sem gastar a cota de minutos do GitHub.
#
# Como usar (console da Oracle, SEM senha nenhuma):
#   1) No GitHub, pegue um código de registro: repositório → Settings → Actions → Runners →
#      "New self-hosted runner" → copie o valo depois de  --token  (vale 1 hora).
#   2) Na Oracle: a instância → "Run command" (Criar comando) → cole este arquivo inteiro,
#      trocando o TOKEN abaixo pelo código copiado. Rode. Pronto: o runner aparece "Idle" no GitHub.
#
# Pode rodar de novo quando quiser (ex.: trocar o código): ele só conserta o que faltar.
#
# FREIOS: o runner roda com prioridade baixa de CPU, disco e memória limitada, então o servidor
# do jogo (serviço "rpg") SEMPRE vem na frente. Um build nunca derruba nem trava o jogo.
set -euo pipefail

REPO="${REPO:-rcandrerc/Rpg-realista}"      # dono/repositório
TOKEN="${TOKEN:-COLE_O_CODIGO_AQUI}"         # código de registro do passo 1 (vale 1 hora)
LABELS="${LABELS:-aethra-build}"             # etiqueta que os workflows procuram
RUNNER_VERSION="${RUNNER_VERSION:-}"  # versão do runner do GitHub
USUARIO="${USUARIO:-runner}"                 # usuário próprio do build (NÃO é root nem o 'rpg' do servidor)
HOME_RUNNER="/opt/actions-runner"
GODOT_VER="${GODOT_VER:-4.5-stable}"

if [ "$TOKEN" = "COLE_O_CODIGO_AQUI" ]; then
  echo "ERRO: troque TOKEN pelo código de registro do GitHub (Settings → Actions → Runners → New self-hosted runner)." >&2
  exit 1
fi
[ "$(id -u)" = 0 ] && SUDO="" || SUDO="sudo"
if [ -n "$SUDO" ] && ! sudo -n true 2>/dev/null; then
  echo "ERRO: o usuário $(id -un) não tem sudo sem senha nesta máquina (o Run command da Oracle roda como ocarun). Nada foi instalado." >&2
  exit 1
fi

echo "== 1/6 Dependências do build =="
export DEBIAN_FRONTEND=noninteractive
$SUDO apt-get update -y
# qemu-user-static + binfmt: deixa rodar o aapt2 (ferramenta da Google p/ montar o APK, só existe para PC comum)
# nesta máquina ARM, por emulação. É a única peça do Android que não tem versão ARM.
$SUDO apt-get install -y curl ca-certificates unzip git jq \
  openjdk-17-jdk-headless \
  qemu-user-static binfmt-support libicu-dev
# gh: os scripts de publicação usam (nas máquinas do GitHub ele já vem instalado)
if ! command -v gh >/dev/null; then
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | $SUDO tee /usr/share/keyrings/githubcli-archive-keyring.gpg >/dev/null
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | $SUDO tee /etc/apt/sources.list.d/github-cli.list >/dev/null
  $SUDO apt-get update -y
  $SUDO apt-get install -y gh
fi
# Node 22 (o servidor já usa; garante que existe para o runner)
command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO bash - && $SUDO apt-get install -y nodejs; }

echo "== 2/6 Usuário próprio do build =="
id "$USUARIO" >/dev/null 2>&1 || $SUDO useradd --create-home --shell /bin/bash "$USUARIO"
$SUDO mkdir -p "$HOME_RUNNER"
$SUDO chown -R "$USUARIO:$USUARIO" "$HOME_RUNNER"

ARCO=$(uname -m); case "$ARCO" in aarch64|arm64) RARCH=arm64; GARCH=linux.arm64;; *) RARCH=x64; GARCH=linux.x86_64;; esac

echo "== 3/6 Godot $GODOT_VER ($GARCH) + modelos de exportação =="
sudo -H -u "$USUARIO" bash <<SH
set -e
cd "$HOME_RUNNER"
if [ ! -x godot/godot ]; then
  mkdir -p godot && cd godot
  curl -fsSL -o godot.zip "https://github.com/godotengine/godot/releases/download/$GODOT_VER/Godot_v${GODOT_VER}_${GARCH}.zip"
  curl -fsSL -o tpl.tpz  "https://github.com/godotengine/godot/releases/download/$GODOT_VER/Godot_v${GODOT_VER}_export_templates.tpz"
  unzip -oq godot.zip && unzip -oq tpl.tpz
  mv Godot_v${GODOT_VER}_* godot
  V=${GODOT_VER%-*}; mkdir -p "\$HOME/.local/share/godot/export_templates/\${V}.stable"
  mv templates/* "\$HOME/.local/share/godot/export_templates/\${V}.stable/"
  rm -f godot.zip tpl.tpz
fi
SH

echo "== 4/6 Android SDK ($HOME_RUNNER/android-sdk) =="
sudo -H -u "$USUARIO" bash <<SH
set -e
cd "$HOME_RUNNER"
export ANDROID_HOME="$HOME_RUNNER/android-sdk"
if [ ! -d "\$ANDROID_HOME/cmdline-tools/latest" ]; then
  mkdir -p "\$ANDROID_HOME/cmdline-tools"
  curl -fsSL -o cmd.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  unzip -oq cmd.zip -d "\$ANDROID_HOME/cmdline-tools"
  mv "\$ANDROID_HOME/cmdline-tools/cmdline-tools" "\$ANDROID_HOME/cmdline-tools/latest"
  rm -f cmd.zip
fi
yes | "\$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses >/dev/null 2>&1 || true
"\$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "platform-tools" "build-tools;35.0.0" "platforms;android-35" >/dev/null
SH

echo "== 5/6 Baixar e registrar o runner =="
# versão mais nova: o GitHub recusa runner muito antigo
[ -n "$RUNNER_VERSION" ] || RUNNER_VERSION=$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | jq -r .tag_name | sed 's/^v//')
sudo -H -u "$USUARIO" bash <<SH
set -e
cd "$HOME_RUNNER"
if [ ! -f config.sh ]; then
  curl -fsSL -o runner.tar.gz "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-${RARCH}-${RUNNER_VERSION}.tar.gz"
  tar xzf runner.tar.gz && rm -f runner.tar.gz
fi
# arquivo .env: o runner injeta estas variáveis em TODO job, então os workflows acham Godot/SDK já prontos
cat > .env <<ENV
ANDROID_HOME=$HOME_RUNNER/android-sdk
ANDROID_SDK_ROOT=$HOME_RUNNER/android-sdk
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-$RARCH
GODOT_BIN=$HOME_RUNNER/godot/godot
PLAYWRIGHT_BROWSERS_PATH=$HOME_RUNNER/pw-browsers
ENV
./config.sh remove --token "$TOKEN" >/dev/null 2>&1 || true
./config.sh --unattended --replace --url "https://github.com/$REPO" --token "$TOKEN" \
  --name "oracle-\$(hostname)" --labels "$LABELS" --work _work
# Chromium do Playwright para exportar os modelos (uma vez; depois o workflow só confere)
export PLAYWRIGHT_BROWSERS_PATH=$HOME_RUNNER/pw-browsers
npm i -g playwright@1.48.2 >/dev/null 2>&1 || true
npx --yes playwright@1.48.2 install --with-deps chromium >/dev/null 2>&1 || npx --yes playwright@1.48.2 install chromium || true
SH

# bibliotecas do sistema para o Chromium (precisa de root; o usuário do build não tem sudo)
$SUDO npx --yes playwright@1.48.2 install-deps chromium || true

echo "== 6/6 Serviço com freios (o jogo sempre vem antes) =="
$SUDO bash -c "cd '$HOME_RUNNER' && ./svc.sh install '$USUARIO'"
SVC=$(basename "$(ls /etc/systemd/system/actions.runner.*.service | head -1)")
RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
LIM_MB=$(( RAM_MB - 2048 )); [ "$LIM_MB" -lt 2048 ] && LIM_MB=2048   # deixa 2 GB para o jogo + sistema
$SUDO mkdir -p "/etc/systemd/system/${SVC}.d"
$SUDO tee "/etc/systemd/system/${SVC}.d/freios.conf" >/dev/null <<CONF
[Service]
# Sob disputa, o jogo (CPUWeight padrão 100) ganha ~5x o build. Máquina ociosa: build usa tudo (ex.: de madrugada).
CPUWeight=20
IOWeight=20
Nice=19
MemoryMax=${LIM_MB}M
MemoryHigh=$(( LIM_MB - 512 ))M
CONF
# Garante prioridade alta para o servidor do jogo (não remove nada do serviço rpg)
if systemctl list-unit-files | grep -q '^rpg.service'; then
  $SUDO mkdir -p /etc/systemd/system/rpg.service.d
  $SUDO tee /etc/systemd/system/rpg.service.d/prioridade.conf >/dev/null <<'CONF'
[Service]
CPUWeight=1000
IOWeight=1000
CONF
fi
$SUDO systemctl daemon-reload
# aplica a prioridade na hora, SEM reiniciar o jogo (ninguém cai)
systemctl list-unit-files | grep -q '^rpg.service' && $SUDO systemctl set-property rpg.service CPUWeight=1000 IOWeight=1000 || true
$SUDO systemctl restart "$SVC"

echo
echo "PRONTO. O runner deve aparecer como 'Idle' em: https://github.com/$REPO/settings/actions/runners"
echo "Agora, no GitHub: Settings → Secrets and variables → Actions → Variables → New variable:"
echo "   nome RUNNER_BUILD   valor $LABELS"
echo "A partir daí os builds rodam aqui, sem gastar minuto do GitHub."
