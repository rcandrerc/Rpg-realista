#!/bin/bash
# Copia para o balde da Oracle os arquivos pequenos que dizem "qual é a versão nova" (André 2026-11-18: o jogo não
# pode depender do GitHub para atualizar; com o repositório privado a cota de artefatos estourou e o site não saiu):
#   - servidor/pacote.json e servidor/pacote-versao.txt (o servidor do jogo lê daqui; server/atualizar.js)
#   - conteudo*.json (o "cardápio" do app; o app lê daqui depois que o jogo grava o endereço no user://motor.cfg,
#     ver godot-prototipo/balde_cardapio.gd). Os pedaços pesados já estão no balde (publicar-conteudo.sh).
# Roda ANTES de publicar no Pages: se o Pages falhar, o balde já tem a versão nova.
# Ordem: servidor primeiro (pacote antes da versão), cardápio do app por último.
# Uso: espelhar-balde.sh client/dist
set -euo pipefail
DIST="${1:-client/dist}"
ARQ_PAR="$(dirname "$0")/oracle-par-envio.txt"
[ -z "${ORACLE_PAR:-}" ] && [ -f "$ARQ_PAR" ] && ORACLE_PAR="$(head -n1 "$ARQ_PAR")"
ORACLE_URL="${ORACLE_URL:-https://objectstorage.sa-saopaulo-1.oraclecloud.com/n/gri0v6lf72rz/b/Aethra-jofo/o/}"
if [ -z "${ORACLE_PAR:-}" ]; then
  echo "::warning::Sem ORACLE_PAR: o balde não recebeu o cardápio desta versão (o Pages continua servindo)."
  exit 0
fi
sobe() { # arquivo nome-no-balde
  curl -fsS --retry 4 --retry-all-errors -X PUT --data-binary @"$1" "${ORACLE_PAR%/}/$2" > /dev/null
  echo "balde: $2"
}
if [ -f "$DIST/servidor/pacote.json" ] && [ -f "$DIST/servidor/pacote-versao.txt" ]; then
  sobe "$DIST/servidor/pacote.json" servidor/pacote.json
  sobe "$DIST/servidor/pacote-versao.txt" servidor/pacote-versao.txt
fi
for j in "$DIST"/atualizacao/conteudo*.json; do
  [ -f "$j" ] || continue
  # só cardápio que manda baixar do balde (url_base); os outros continuam só no Pages
  [ "$(jq -r '.url_base // ""' "$j")" = "${ORACLE_URL%/}/" ] || continue
  sobe "$j" "$(basename "$j")"
done
