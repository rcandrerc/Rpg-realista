#!/bin/bash
# APK casca (roda no apk.yml, em cada push na main, depois do publicar.sh). Detalhes: ferramentas/atualizacao/LEIAME.md
#
# O APK casca não traz o jogo. O app lê atualizacao/conteudo.json e baixa:
#   - completo: o jogo inteiro de uma versão, em partes de 45 MB (completo-ID.parteNN);
#   - deltas: só o que mudou depois do completo, um por versão, em ordem (delta-VERSAO.pck).
# Cada build novo vira um delta (godot --export-patch contra o completo + os deltas anteriores). Quando os deltas
# passam de LIMITE_DELTAS, o build vira o completo novo e a corrente zera: o app baixa o completo de novo uma vez.
# Tudo fica no release "conteudo" (privado, fonte da verdade) e o pages.yml copia para o site.
# Com ORACLE_PAR (link pré-autenticado de escrita do balde) e ORACLE_URL (endereço público do balde), os arquivos
# também sobem para a Oracle e o conteudo.json manda o app baixar de lá (url_base).
#
# Uso: publicar-conteudo.sh CODIGO   (o base-CODIGO.pck completo já está na raiz)
set -euo pipefail
cd "$(dirname "$0")/../.."
CODIGO="$1"
LIMITE_DELTAS=$((60 * 1024 * 1024))
PARTE=45M
TMP=/tmp/conteudo
rm -rf "$TMP" && mkdir -p "$TMP/antigo" "$TMP/novo"

gh release view conteudo > /dev/null 2>&1 || gh release create conteudo --target main --prerelease --title "Conteúdo do APK casca" \
  --notes "Jogo completo em partes + mudanças. O app (APK casca) baixa daqui pelo site. Gerado pelo apk.yml; não mexer à mão."

sha() { sha256sum "$1" | cut -d' ' -f1; }
tam() { stat -c%s "$1"; }

rebase=0
if gh release download conteudo -p conteudo.json -D "$TMP/antigo" --clobber 2>/dev/null; then
  COMP_ID=$(jq -r '.completo.id' "$TMP/antigo/conteudo.json")
  echo "Completo atual: $COMP_ID; deltas: $(jq -r '[.deltas[].versao] | join(",")' "$TMP/antigo/conteudo.json")"
  for arq in $(jq -r '.completo.partes[].arq' "$TMP/antigo/conteudo.json"); do
    gh release download conteudo -p "$arq" -D "$TMP/antigo" --clobber
  done
  cat $(jq -r '.completo.partes[].arq' "$TMP/antigo/conteudo.json" | sed "s|^|$TMP/antigo/|") > "$TMP/antigo/completo.pck"
  PATCHES="$TMP/antigo/completo.pck"
  for arq in $(jq -r '.deltas[].arq' "$TMP/antigo/conteudo.json"); do
    gh release download conteudo -p "$arq" -D "$TMP/antigo" --clobber
    PATCHES="$PATCHES,$TMP/antigo/$arq"
  done
  (cd godot-prototipo && $GODOT_BIN --headless --export-patch Android "$TMP/novo/delta-$CODIGO.pck" --patches "$PATCHES")
  SOMA=$(( $(jq '[.deltas[].tamanho] | add // 0' "$TMP/antigo/conteudo.json") + $(tam "$TMP/novo/delta-$CODIGO.pck") ))
  echo "Delta $CODIGO: $(( $(tam "$TMP/novo/delta-$CODIGO.pck") / 1024 )) KB; corrente: $((SOMA / 1048576)) MB"
  [ "$SOMA" -gt "$LIMITE_DELTAS" ] && rebase=1
else
  rebase=1
fi

if [ "$rebase" = 1 ]; then
  echo "Completo novo: $CODIGO (o app baixa o jogo inteiro uma vez)"
  rm -f "$TMP/novo/"*
  split -b "$PARTE" -d -a 2 "base-$CODIGO.pck" "$TMP/novo/completo-$CODIGO.parte"
  partes=$(for f in "$TMP/novo/completo-$CODIGO.parte"*; do
    printf '{"arq":"%s","tamanho":%s,"sha256":"%s"}\n' "$(basename "$f")" "$(tam "$f")" "$(sha "$f")"; done | jq -s .)
  jq -n --arg v "$CODIGO" --argjson partes "$partes" --arg t "$(tam "base-$CODIGO.pck")" --arg c "${GITHUB_SHA::7}" \
    '{versao: $v, commit: $c, completo: {id: $v, tamanho: ($t|tonumber), partes: $partes}, deltas: []}' > "$TMP/novo/conteudo.json"
else
  d="$TMP/novo/delta-$CODIGO.pck"
  jq --arg v "$CODIGO" --arg arq "delta-$CODIGO.pck" --arg t "$(tam "$d")" --arg s "$(sha "$d")" --arg c "${GITHUB_SHA::7}" \
    '.versao = $v | .commit = $c | .deltas += [{versao: $v, arq: $arq, tamanho: ($t|tonumber), sha256: $s}]' \
    "$TMP/antigo/conteudo.json" > "$TMP/novo/conteudo.json"
fi

# Oracle (opcional): sobe os arquivos novos e aponta o app para lá
# Sem o secret, usa o link guardado no repositório privado (André autorizou, 2026-11-03). Cópia oficial: fontes chaves/oracle-par-envio.txt
ARQ_PAR="$(dirname "$0")/oracle-par-envio.txt"
[ -z "${ORACLE_PAR:-}" ] && [ -f "$ARQ_PAR" ] && ORACLE_PAR="$(head -n1 "$ARQ_PAR")"
ORACLE_URL="${ORACLE_URL:-https://objectstorage.sa-saopaulo-1.oraclecloud.com/n/gri0v6lf72rz/b/Aethra-jofo/o/}"
if [ -n "${ORACLE_PAR:-}" ] && [ -n "${ORACLE_URL:-}" ]; then
  for f in "$TMP/novo/"*; do
    [ "$(basename "$f")" = conteudo.json ] && continue
    curl -fsS -X PUT --data-binary @"$f" "${ORACLE_PAR%/}/$(basename "$f")" > /dev/null
  done
  if [ "$rebase" = 0 ]; then # garante que o completo e os deltas antigos também estão lá (primeira vez com Oracle)
    for arq in $(jq -r '.completo.partes[].arq, .deltas[].arq' "$TMP/antigo/conteudo.json"); do
      curl -fsS -o /dev/null -I "${ORACLE_URL%/}/$arq" || curl -fsS -X PUT --data-binary @"$TMP/antigo/$arq" "${ORACLE_PAR%/}/$arq" > /dev/null
    done
  fi
  jq --arg u "${ORACLE_URL%/}/" '.url_base = $u' "$TMP/novo/conteudo.json" > "$TMP/novo/c.json" && mv "$TMP/novo/c.json" "$TMP/novo/conteudo.json"
fi
cat "$TMP/novo/conteudo.json"

# release: sobe os novos e apaga o que saiu da corrente
gh release upload conteudo "$TMP/novo/"* --clobber
manter=$(jq -r '"conteudo.json", .completo.partes[].arq, .deltas[].arq' "$TMP/novo/conteudo.json")
for velho in $(gh release view conteudo --json assets -q '.assets[].name'); do
  echo "$manter" | grep -qx "$velho" || gh release delete-asset conteudo "$velho" -y
done

# site (o publicar.sh já chamou antes; esta chamada mais nova cancela a outra e leva o conteúdo novo junto)
gh workflow run pages.yml --ref main
