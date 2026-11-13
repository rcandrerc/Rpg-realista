#!/usr/bin/env bash
# Último login vale (André 2026-11-13): servidor local + dois rede.gd na mesma conta (trocado_teste.gd).
# Uso: GODOT_BIN=/caminho/do/godot ferramentas/motor/trocado.sh
set -euo pipefail
raiz="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"; srv="$tmp/srv"; proj="$tmp/proj"; mkdir -p "$srv" "$proj"
porta=$((2600 + RANDOM % 300))
SESSAO=$(node "$raiz/ferramentas/motor/sessao.mjs" "$srv" 2>/dev/null | tail -n1)
SESSAO2=$(node "$raiz/ferramentas/motor/sessao.mjs" "$srv" 2>/dev/null | tail -n1) # mesma conta, outra sessão (outro aparelho)
(cd "$raiz/server" && DADOS="$srv" PORT=$porta node index.js > "$srv/log.txt" 2>&1) & pid=$!
trap 'kill $pid 2>/dev/null; rm -rf "$tmp"' EXIT
# o servidor pode ouvir só no IPv6 (::1), como na máquina do GitHub: usa o endereço que responde
srvurl=""
for i in $(seq 1 40); do
  for h in 127.0.0.1 '[::1]'; do curl -s -m 2 "http://$h:$porta/saude" > /dev/null && srvurl="http://$h:$porta" && break 2; done
  sleep 0.5
done
printf 'config_version=5\n' > "$proj/project.godot"
cp "$raiz/godot-prototipo/rede.gd" "$raiz/godot-prototipo/msgpack.gd" "$raiz/ferramentas/motor/trocado_teste.gd" "$proj/"
RPG_SERVIDOR="$srvurl" RPG_SESSAO="$SESSAO" RPG_SESSAO2="$SESSAO2" timeout 90 "${GODOT_BIN:-godot}" --headless --path "$proj" -s trocado_teste.gd 2>&1 | tee "$tmp/godot.log" | grep -E "^TROCA|SCRIPT ERROR|Parse Error" || true
if grep -q "TROCA FALHOU" "$tmp/godot.log" || ! grep -q "TROCA ok Entrar no PC" "$tmp/godot.log"; then
  echo "--- servidor ---"; tail -20 "$srv/log.txt"; exit 1
fi
