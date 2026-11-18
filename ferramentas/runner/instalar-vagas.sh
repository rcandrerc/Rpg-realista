#!/bin/bash
# Abre mais 2 "vagas" (runners) na máquina de builds da Oracle (builds-runner), ao lado do runner dos builds:
#   - aethra-testes: testes de PR e da main (testes, scripts do Godot, idioma, rede, conversas da Cecília);
#   - aethra-robo:   robôs de teste (robô 1 joga horas, robô 2 com Vulkan por software, celulares do Test Lab);
#   - aethra-atualizacao: só a atualização do jogo na main (modelos-chave, pacote), para ela não ficar na fila
#     atrás da versão de Windows nem de APK de teste (2026-11-18). Variável RUNNER_ATUALIZACAO=aethra-atualizacao.
# VAGAS escolhe quais instalar (padrão: as três). Ex.: VAGAS=atualizacao só abre a nova, sem reiniciar as outras.
# Assim, com o repositório PRIVADO, nada disso gasta a cota do GitHub e nada fica na fila atrás do APK.
# NÃO mexe no runner dos builds (aethra-build), no PC na nuvem nem na máquina do jogo.
#
# Precisa de root (sudo): rode pelo Cloud Shell + Bastion como o PC na nuvem (ferramentas/pc-nuvem/cloudshell-bastion.sh),
# com TOKEN = código de registro do GitHub (Settings → Actions → Runners → New self-hosted runner, vale 1 hora;
# o mesmo código registra as duas vagas). Pode rodar de novo: só conserta o que faltar.
#
# Depois, no GitHub (Settings → Secrets and variables → Actions → Variables): RUNNER_TESTES=aethra-testes e
# RUNNER_ROBO=aethra-robo. Sem RUNNER_TESTES os testes usam o runner dos builds; sem RUNNER_ROBO os robôs não rodam
# com o repositório privado (para não gastar cota).
#
# FREIOS: CPUWeight atualização 40 > build 20 > testes 10 > robôs 5 > PC na nuvem 2;
# memória máxima de 3 GB por vaga de teste/robô e 4 GB na da atualização (a máquina tem 12 GB + 4 GB de swap).
set -euo pipefail

REPO="${REPO:-rcandrerc/Rpg-realista}"
TOKEN="${TOKEN:-COLE_O_CODIGO_AQUI}"
USUARIO="${USUARIO:-runner}"   # o mesmo usuário do runner dos builds (aproveita Android SDK, npm e Godot guardados)
RUNNER_VERSION="${RUNNER_VERSION:-}"
VAGAS="${VAGAS:-testes robo atualizacao}"

if [ "$TOKEN" = "COLE_O_CODIGO_AQUI" ]; then
  echo "ERRO: falta o TOKEN (código de registro do GitHub)." >&2; exit 1
fi
[ "$(id -u)" = 0 ] || { echo "ERRO: precisa rodar como root (sudo)." >&2; exit 1; }
id "$USUARIO" >/dev/null 2>&1 || { echo "ERRO: usuário $USUARIO não existe (o runner dos builds não está instalado aqui?)." >&2; exit 1; }

echo "== 1/3 Pacotes que os testes e robôs pedem (sem sudo no runner) =="
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y xvfb mesa-vulkan-drivers jq curl unzip zip  # zip: versão de Windows (pc.yml)

case "$(uname -m)" in aarch64|arm64) RARCH=arm64;; *) RARCH=x64;; esac
[ -n "$RUNNER_VERSION" ] || RUNNER_VERSION=$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | jq -r .tag_name | sed 's/^v//')
ENV_BUILD=/opt/actions-runner/.env

vaga() {  # nome etiqueta cpuweight [nice] [memoria-max] [manter-godot]
  local NOME="$1" ETIQUETA="$2" PESO="$3" NICE="${4:-19}" MEMMAX="${5:-3G}" GODOT="${6:-}" DIR="/opt/actions-runner-$1"
  case " $VAGAS " in *" $NOME "*) ;; *) echo "== vaga $NOME: pulada (VAGAS=$VAGAS) =="; return 0;; esac
  local MEMHIGH=2560M; [ "$MEMMAX" = 3G ] || MEMHIGH=3584M
  local FILTRO='^GODOT_BIN='; [ -n "$GODOT" ] && FILTRO='^$'
  echo "== vaga $NOME ($ETIQUETA) em $DIR =="
  mkdir -p "$DIR" && chown "$USUARIO:$USUARIO" "$DIR"
  sudo -H -u "$USUARIO" bash <<SH
set -e
cd "$DIR"
if [ ! -f config.sh ]; then
  curl -fsSL -o runner.tar.gz "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-${RARCH}-${RUNNER_VERSION}.tar.gz"
  tar xzf runner.tar.gz && rm -f runner.tar.gz
fi
# mesmas ferramentas do runner dos builds; testes e robôs sem o GODOT_BIN (baixam a versão que pedem), a atualização com ele
[ -f "$ENV_BUILD" ] && grep -v '$FILTRO' "$ENV_BUILD" > .env || true
if [ ! -f .runner ]; then
  ./config.sh --unattended --replace --url "https://github.com/$REPO" --token "$TOKEN" \
    --name "oracle-$NOME" --labels "$ETIQUETA" --work _work
fi
SH
  if ! ls /etc/systemd/system/actions.runner.*oracle-"$NOME".service >/dev/null 2>&1; then
    (cd "$DIR" && ./svc.sh install "$USUARIO")
  fi
  local SVC; SVC=$(basename "$(ls /etc/systemd/system/actions.runner.*oracle-"$NOME".service | head -1)")
  mkdir -p "/etc/systemd/system/$SVC.d"
  cat > "/etc/systemd/system/$SVC.d/freios.conf" <<CONF
[Service]
CPUWeight=$PESO
IOWeight=$PESO
Nice=$NICE
MemoryHigh=$MEMHIGH
MemoryMax=$MEMMAX
CONF
  systemctl daemon-reload
  systemctl enable --now "$SVC"
  systemctl restart "$SVC"
  systemctl --no-pager --lines=0 status "$SVC" | head -3
}

echo "== 2/3 Vagas =="
vaga testes aethra-testes 10
vaga robo aethra-robo 5
vaga atualizacao aethra-atualizacao 40 0 4G godot

echo "== 3/3 Pronto =="
echo "No GitHub, crie as variáveis RUNNER_TESTES=aethra-testes, RUNNER_ROBO=aethra-robo e RUNNER_ATUALIZACAO=aethra-atualizacao."
free -m
