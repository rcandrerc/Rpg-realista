#!/usr/bin/env bash
# Nome da conta na tela de entrada (André 2026-11-13): servidor local + proxy que falha as 2 primeiras /conta/eu.
# Uso: GODOT_BIN=/caminho/do/godot ferramentas/motor/conta_nome.sh
set -euo pipefail
raiz="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"; srv="$tmp/srv"; proj="$tmp/proj"; mkdir -p "$srv" "$proj"
porta=$((2600 + RANDOM % 300)); pporta=$((porta + 400))
SESSAO=$(node "$raiz/ferramentas/motor/sessao.mjs" "$srv" 2>/dev/null | tail -n1)
(cd "$raiz/server" && DADOS="$srv" PORT=$porta node index.js > "$srv/log.txt" 2>&1) & pid=$!
trap 'kill $pid $ppid 2>/dev/null; rm -rf "$tmp"' EXIT
srvurl=""
for i in $(seq 1 40); do
  for h in 127.0.0.1 '[::1]'; do curl -s -m 2 "http://$h:$porta/saude" > /dev/null && srvurl="http://$h:$porta" && break 2; done
  sleep 0.5
done
node "$raiz/ferramentas/motor/conta_nome_proxy.mjs" $pporta "$srvurl" 2 > "$tmp/proxy.txt" 2>&1 & ppid=$!
sleep 1
printf 'config_version=5\n[application]\nconfig/name="conta_nome_teste"\n' > "$proj/project.godot"
cp "$raiz/godot-prototipo/rede.gd" "$raiz/godot-prototipo/msgpack.gd" "$raiz/ferramentas/motor/conta_nome_teste.gd" "$proj/"
RPG_SERVIDOR="http://127.0.0.1:$pporta" RPG_SESSAO="$SESSAO" timeout 90 "${GODOT_BIN:-godot}" --headless --path "$proj" -s conta_nome_teste.gd 2>&1 | tee "$tmp/godot.log" | grep -E "^NOME|SCRIPT ERROR|Parse Error" || true
if grep -q "NOME FALHOU\|SCRIPT ERROR\|Parse Error" "$tmp/godot.log" || ! grep -q "NOME FIM falhas=0" "$tmp/godot.log"; then
  echo "--- servidor ---"; tail -20 "$srv/log.txt"; exit 1
fi
