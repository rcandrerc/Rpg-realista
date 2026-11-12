#!/bin/bash
# Atualização dentro do app (roda no apk.yml, em cada push na main). Detalhes: ferramentas/atualizacao/LEIAME.md
#
# 1) Guarda o pacote completo desta versão (base-CODIGO.pck) no release "pacotes" (privado), para virar base no futuro.
# 2) Descobre qual APK é a base atual: a etiqueta ou ramo git apk-base-CODIGO mais alto (quem entrega o APK ao André cria).
# 3) Gera o pacote só com o que mudou desde essa base (godot --export-patch) e o manifesto.json.
# 4) Põe os dois no release "atualizacao" e chama o pages.yml, que copia para o site:
#    https://rcandrerc.github.io/Rpg-realista/atualizacao/manifesto.json  (o app lê daqui: godot-prototipo/inicio.gd)
#
# Uso: publicar.sh CODIGO   (CODIGO = version/code do APK desta execução; o base-CODIGO.pck já está na raiz)
set -euo pipefail
cd "$(dirname "$0")/../.."
CODIGO="$1"
LIMITE=$((90 * 1024 * 1024)) # o site do GitHub Pages aceita até 1 GB no total; pacote maior pede APK novo
RAIZ=$(pwd)
# Modo antigo (APK com o jogo dentro) só existe no Godot 4.5: pacote de outro motor não abre nesses APKs.
# Desde a troca para o 4.7 (2026-11-12) o manifesto fica parado na última versão do 4.5; o app de hoje é o APK casca.
MOTOR=$("$GODOT_BIN" --version | head -n1 | cut -d. -f1,2)
if [ "$MOTOR" != 4.5 ]; then
  echo "Godot $MOTOR: modo antigo (manifesto.json) fica parado no 4.5; nada a publicar aqui."
  exit 0
fi

# 1) pacote completo desta versão
gh release view pacotes > /dev/null 2>&1 || gh release create pacotes --target main --prerelease --title "Pacotes base (uso interno)" \
  --notes "Pacote completo de cada build da main. O CI usa o da base atual (etiqueta apk-base-N) para gerar a atualização. Não é para baixar."
gh release upload pacotes "base-$CODIGO.pck" --clobber

# 2) base atual
# vale etiqueta (refs/tags/apk-base-N) ou ramo (refs/heads/apk-base-N): a sessão do Claude só consegue criar ramo
BASE=$(git ls-remote origin 'refs/tags/apk-base-*' 'refs/heads/apk-base-*' | sed -E 's#.*refs/(tags|heads)/apk-base-##; s#\^\{\}##' | grep -E '^[0-9]+$' | sort -n | tail -1 || true)
if [ -z "$BASE" ]; then
  echo "::warning::Nenhuma etiqueta apk-base-N ainda: sem atualização dentro do app até alguém marcar o APK entregue."
  exit 0
fi
echo "APK base: $BASE (este build: $CODIGO)"

mkdir -p /tmp/atualizacao && rm -f /tmp/atualizacao/*
if [ "$BASE" = "$CODIGO" ]; then
  # este build É a base: nada para baixar
  printf '{"base":"%s","versao":"%s","pacote":"","commit":"%s"}\n' "$BASE" "$CODIGO" "${GITHUB_SHA::7}" > /tmp/atualizacao/manifesto.json
else
  if ! gh release download pacotes -p "base-$BASE.pck" -D /tmp/base --clobber; then
    echo "::error::base-$BASE.pck não está no release pacotes: a etiqueta apk-base-$BASE aponta para um build sem pacote guardado."
    exit 1
  fi
  (cd godot-prototipo && $GODOT_BIN --headless --export-patch Android "/tmp/atualizacao/pacote-$CODIGO.pck" --patches "/tmp/base/base-$BASE.pck")
  TAM=$(stat -c%s "/tmp/atualizacao/pacote-$CODIGO.pck")
  echo "Pacote de atualização: $((TAM / 1024)) KB"
  if [ "$TAM" -gt "$LIMITE" ]; then
    echo "::warning::Atualização com $((TAM / 1048576)) MB: grande demais para o site. Hora de entregar um APK novo (e criar a etiqueta apk-base)."
    rm "/tmp/atualizacao/pacote-$CODIGO.pck"
    printf '{"base":"%s","versao":"%s","pacote":"","commit":"%s","precisa_apk":true}\n' "$BASE" "$BASE" "${GITHUB_SHA::7}" > /tmp/atualizacao/manifesto.json
  else
    SHA=$(sha256sum "/tmp/atualizacao/pacote-$CODIGO.pck" | cut -d' ' -f1)
    printf '{"base":"%s","versao":"%s","pacote":"pacote-%s.pck","tamanho":%s,"sha256":"%s","commit":"%s"}\n' \
      "$BASE" "$CODIGO" "$CODIGO" "$TAM" "$SHA" "${GITHUB_SHA::7}" > /tmp/atualizacao/manifesto.json
  fi
fi
cat /tmp/atualizacao/manifesto.json

# 3) release "atualizacao": só a versão mais nova (o pages.yml copia tudo que está lá)
gh release view atualizacao > /dev/null 2>&1 || gh release create atualizacao --target main --prerelease --title "Atualização dentro do app" \
  --notes "Manifesto e pacote que o app baixa ao abrir. O site do GitHub Pages copia daqui (pages.yml)."
for velho in $(gh release view atualizacao --json assets -q '.assets[].name'); do
  case "$velho" in manifesto.json|"pacote-$CODIGO.pck") ;; *) gh release delete-asset atualizacao "$velho" -y ;; esac
done
gh release upload atualizacao /tmp/atualizacao/* --clobber

# pacotes base antigos: fica a base atual e os 5 mais novos (cada um tem ~160 MB)
for velho in $(gh release view pacotes --json assets -q '.assets[].name' | grep -E '^base-[0-9]+\.pck$' | sed 's/base-//; s/\.pck//' | sort -n | head -n -5); do
  [ "$velho" = "$BASE" ] || gh release delete-asset pacotes "base-$velho.pck" -y
done

# 4) site
gh workflow run pages.yml --ref main
cd "$RAIZ"
