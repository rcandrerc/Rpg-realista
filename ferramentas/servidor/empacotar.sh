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
echo "${GITHUB_SHA:-$(git rev-parse HEAD)}" > "$saida/versao.txt"
echo "Servidor empacotado em $saida ($(cat "$saida/versao.txt"))"
