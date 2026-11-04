#!/usr/bin/env bash
# Rodar antes de mandar um APK para o André. Falha se o ramo atual não tem a main mais nova.
# Um APK feito de ramo velho apaga o que entrou depois.
set -e
cd "$(git rev-parse --show-toplevel)"
git fetch -q origin main
if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "PARE: este ramo não tem a main mais nova. Junte a main antes de gerar o APK."
  echo "Faltam estes commits da main:"; git log --oneline --format='%h %an: %s' HEAD..origin/main | head -20
  exit 1
fi
echo "Pode gerar o APK."
