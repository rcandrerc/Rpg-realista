#!/bin/bash
# Empacota o servidor (server/ + shared/ num arquivo só) dentro de client/dist/servidor/.
# Assim ele sai junto no GitHub Pages e a máquina da Oracle baixa a versão nova sozinha (veja oracle-cloud-init.sh).
# As regras do jogo já vão no navegador (modo solo), então o pacote não expõe nada novo.
set -e
cd "$(dirname "$0")/../.."
saida=client/dist/servidor
mkdir -p "$saida"
npx esbuild server/index.js --bundle --platform=node --format=esm --target=node20 --outfile="$saida/servidor.mjs" \
  --external:colyseus --external:@colyseus/ws-transport --external:express --external:jose
cp ferramentas/servidor/package.json "$saida/package.json"
cp ferramentas/servidor/oracle-cloud-init.sh "$saida/instalar.sh" # a Oracle pode rodar só: curl -fsSL .../servidor/instalar.sh | bash
# Versão = impressão digital do que o servidor realmente roda (código + package.json + segredos), não o commit.
# André 2026-11-11: antes cada merge na main (mesmo só de tela/cliente) trocava a versão e a máquina reiniciava
# o servidor, derrubando todo mundo (6 merges seguidos = várias quedas). Agora só reinicia quando o servidor mudou.
versao=$(
  {
    sha256sum "$saida/servidor.mjs" "$saida/package.json" | cut -d' ' -f1
    printf '%s|%s' "${GEMINI_CHAVE:-}" "${GROQ_CHAVE:-}" | sha256sum | cut -d' ' -f1
  } | sha256sum | cut -c1-40
)
echo "$versao" > "$saida/versao.txt"
echo "Servidor empacotado em $saida ($(cat "$saida/versao.txt"))"

# André 2026-11-03: o código do servidor não fica mais aberto no site.
# Se o servidor no ar entrega a chave pública, o pacote vai trancado com ela (só a máquina da Oracle abre)
# e os arquivos abertos saem do site. Fica público só o instalar.sh (não tem código do jogo).
# Servidor antigo no ar (responde 404 na chave) ou ABRIR_SERVIDOR=1: publica aberto uma vez para ele pegar a versão nova.
SERVIDOR_URL=${SERVIDOR_URL:-https://163-176-80-126.sslip.io}
chave=$(mktemp)
codigo=$(curl -sS -m 20 -o "$chave" -w '%{http_code}' "$SERVIDOR_URL/chave-do-servidor" ) || true
if [ "${ABRIR_SERVIDOR:-0}" = 1 ] || [ "$codigo" = 404 ]; then
  echo "Servidor sem chave ainda (HTTP $codigo): pacote aberto desta vez, para a máquina pegar a versão nova."
elif [ "$codigo" = 200 ] && grep -q 'BEGIN PUBLIC KEY' "$chave"; then
  node ferramentas/servidor/trancar.mjs "$chave" "$(cat "$saida/versao.txt")" "$saida/servidor.mjs" "$saida/package.json" "$saida/pacote.json"
  cp "$saida/versao.txt" "$saida/pacote-versao.txt"
  rm -f "$saida/servidor.mjs" "$saida/package.json" "$saida/versao.txt"
  echo "Pacote trancado; código do servidor fora do site."
else
  echo "::warning::Servidor fora do ar (HTTP $codigo): o site sai sem pacote do servidor desta vez."
  rm -f "$saida/servidor.mjs" "$saida/package.json" "$saida/versao.txt"
fi
rm -f "$chave"
ls -la "$saida"
