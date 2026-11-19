#!/usr/bin/env bash
# Volta as contas dos jogadores para uma cópia (plano de lançamento v3, frente 2: "script de volta das contas" até 26/11;
# portão 17/12: "volta das contas no servidor real em até 1 h").
#
# Roda NA MÁQUINA DO SERVIDOR, como root (ou com sudo):
#   sudo bash voltar-contas.sh --listar                       mostra as cópias que existem
#   sudo bash voltar-contas.sh 2026-11-25                     volta para a cópia diária desse dia (copias/contas-2026-11-25.db)
#   sudo bash voltar-contas.sh marco-2026-11-19-antes-do-presidente
#   sudo bash voltar-contas.sh /caminho/qualquer.db           volta para um arquivo .db
#   sudo bash voltar-contas.sh copia.tar --chave priv.pem     volta para a cópia cifrada de fora da máquina
#        Só abre se a assinatura Ed25519 do servidor conferir com a pública FIXADA no repositório
#        (ferramentas/servidor/copia-assinatura*.pub.pem, ao lado deste script). Outra chave só com --pub <arquivo>:
#        o script mostra a impressão digital e pede para digitar SIM (confira a impressão por outro caminho antes).
#   ... --sim                                                 só confere a cópia e mostra o que faria (não para nada)
#
# O que faz: confere a cópia (integridade do SQLite e quantas contas), para o servidor, guarda o banco de agora em
# copias/antes-da-volta-<hora>.db (NADA se perde: dá para desfazer voltando para ele), põe a cópia no lugar, liga o
# servidor e espera o /saude responder. No fim mostra quanto tempo levou.
#
# Variáveis (os padrões são os da Oracle, ver oracle-cloud-init.sh):
#   PASTA=/opt/rpg/dados  SERVICO=rpg  DONO=rpg  PORTA=2567    (SERVICO= vazio: não mexe no systemd; é o que o teste usa)
set -euo pipefail

PASTA="${PASTA:-/opt/rpg/dados}"
SERVICO="${SERVICO-rpg}"
DONO="${DONO-rpg}"
PORTA="${PORTA:-2567}"
COPIAS="$PASTA/copias"
inicio=$(date +%s)

erro() { echo "ERRO: $*" >&2; exit 1; }

# Confere um .db com o SQLite do próprio Node (o mesmo do servidor): integridade e números para comparar
conferir() {
  node -e '
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(process.argv[1], { readOnly: true });
    const ok = db.prepare("PRAGMA integrity_check").get();
    const v = Object.values(ok)[0];
    if (v !== "ok") { console.error("integridade: " + v); process.exit(2); }
    const n = (t) => { try { return db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n; } catch { return "-"; } };
    let ult = "-"; try { const r = db.prepare("SELECT MAX(ultimo_acesso) t FROM contas").get().t; if (r) ult = new Date(r).toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch {}
    console.log(`${n("contas")} contas, ${n("lotes")} terrenos, último acesso ${ult}`);
  ' "$1"
}

listar() {
  [ -d "$COPIAS" ] || erro "não achei $COPIAS"
  echo "Cópias em $COPIAS:"
  for f in $(ls -1 "$COPIAS" | grep -E '\.db$' | sort); do
    printf '  %-48s %s\n' "$f" "$(conferir "$COPIAS/$f" 2>&1 || true)"
  done
  echo "Banco de agora: $(conferir "$PASTA/contas.db" 2>&1 || true)"
}

ORIGEM="" CHAVE="" PUB="" SIM=0
while [ $# -gt 0 ]; do
  case "$1" in
    --listar) listar; exit 0 ;;
    --sim) SIM=1 ;;
    --chave) CHAVE="${2:-}"; shift ;;
    --pub) PUB="${2:-}"; shift ;;
    -h|--help) sed -n 2,20p "$0"; exit 0 ;;
    *) [ -z "$ORIGEM" ] || erro "só uma cópia por vez ($ORIGEM e $1)"; ORIGEM="$1" ;;
  esac
  shift
done
[ -n "$ORIGEM" ] || { sed -n 2,20p "$0"; exit 1; }

TMP=$(mktemp -d); chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT

# Acha o arquivo da cópia
if [[ "$ORIGEM" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then ARQ="$COPIAS/contas-$ORIGEM.db"
elif [[ "$ORIGEM" == marco-* && ! -e "$ORIGEM" ]]; then ARQ="$COPIAS/${ORIGEM%.db}.db"
else ARQ="$ORIGEM"; fi
[ -f "$ARQ" ] || erro "não achei a cópia $ARQ (veja --listar)"

# Cópia cifrada de fora da máquina: tar com chave.bin (chave AES cifrada com RSA-OAEP), contas.bin (AES-256-CBC,
# pbkdf2) e contas.sha256 (do .db aberto). Mesmo formato das conversas da ronda.
if [[ "$ARQ" == *.tar ]]; then
  [ -n "$CHAVE" ] && [ -f "$CHAVE" ] || erro "cópia cifrada precisa de --chave <chave privada .pem>"
  # só arquivos comuns, com os nomes certos (extrai como root: nada de link, pasta ou dono de fora)
  lista=$(tar -tvf "$ARQ") || erro "o .tar não abre"
  [ "$(printf '%s\n' "$lista" | awk '{print substr($1,1,1)}' | sort -u | tr -d '\n')" = "-" ] || erro "o .tar tem algo que não é arquivo comum: recusado"
  [ "$(tar -tf "$ARQ" | sort | tr '\n' ' ')" = "assinatura.bin chave.bin contas.bin contas.sha256 quando.txt " ] || erro "o .tar não tem exatamente assinatura.bin, chave.bin, contas.bin, contas.sha256 e quando.txt"
  tar -xf "$ARQ" -C "$TMP" --no-same-owner --no-same-permissions || erro "não consegui abrir o .tar"
  # a cópia veio mesmo do servidor? (revisão da frente 3: sem isso, um banco forjado no balde voltaria como root)
  { printf '%s\n%s\n' "$(sha256sum "$TMP/chave.bin" | cut -d' ' -f1)" "$(sha256sum "$TMP/contas.bin" | cut -d' ' -f1)"; cat "$TMP/contas.sha256" "$TMP/quando.txt"; } > "$TMP/msg"
  confere=""
  confiaveis=("$(cd "$(dirname "$0")" && pwd)"/copia-assinatura*.pub.pem)
  if [ -n "$PUB" ]; then
    [ -f "$PUB" ] || erro "não achei $PUB"
    impressao=$(openssl pkey -pubin -in "$PUB" -outform DER 2>/dev/null | sha256sum | cut -d' ' -f1) || erro "$PUB não é uma chave pública"
    echo "Chave de fora da lista fixada: $PUB"
    echo "  impressão digital (sha256 do DER): $impressao"
    echo "  Confira essa impressão por outro caminho (repositório, Drive) antes. Digite SIM para confiar nela:"
    read -r resposta || resposta=""
    [ "$resposta" = "SIM" ] || erro "chave não confirmada: nada foi mexido"
    confiaveis=("$PUB")
  fi
  for p in "${confiaveis[@]}"; do
    [ -f "$p" ] || continue
    if openssl pkeyutl -verify -pubin -inkey "$p" -rawin -in "$TMP/msg" -sigfile "$TMP/assinatura.bin" > /dev/null 2>&1; then confere="$p"; break; fi
  done
  [ -n "$confere" ] || erro "a assinatura não confere com a chave fixada do servidor: cópia recusada"
  echo "Assinatura do servidor confere ($confere). Cópia feita em $(tr -d '\n' < "$TMP/quando.txt") (confira se é a que você quer)"
  openssl pkeyutl -decrypt -inkey "$CHAVE" -pkeyopt rsa_padding_mode:oaep -in "$TMP/chave.bin" -out "$TMP/k.bin" || erro "essa chave não abre esta cópia"
  openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$TMP/k.bin" -in "$TMP/contas.bin" -out "$TMP/contas.db"
  [ "$(sha256sum "$TMP/contas.db" | cut -d' ' -f1)" = "$(tr -d ' \n' < "$TMP/contas.sha256")" ] || erro "a cópia aberta não bate com o resumo sha256"
  ARQ="$TMP/contas.db"
fi

echo "Cópia: $ORIGEM"
r=$(conferir "$ARQ") || erro "a cópia está estragada; nada foi mexido"
echo "  $r"
if [ -f "$PASTA/contas.db" ]; then echo "Agora: $(conferir "$PASTA/contas.db" 2>&1 || echo 'banco de agora não abre')"; fi
if [ "$SIM" = 1 ]; then echo "(--sim: nada foi mexido)"; exit 0; fi

# Para o servidor, guarda o de agora, põe a cópia, liga de novo
[ -n "$SERVICO" ] && systemctl stop "$SERVICO"
mkdir -p "$COPIAS"
hora=$(date -u +%Y-%m-%dT%H-%M-%SZ)
guardado="$COPIAS/antes-da-volta-$hora.db"; n=1
while [ -e "$guardado" ]; do n=$((n+1)); guardado="$COPIAS/antes-da-volta-$hora-$n.db"; done # nunca por cima de outra cópia
if [ -f "$PASTA/contas.db" ]; then
  # o servidor parado deixa o WAL completo; os três arquivos juntos são o banco inteiro
  mv "$PASTA/contas.db" "$guardado"
  for x in wal shm; do [ -f "$PASTA/contas.db-$x" ] && mv "$PASTA/contas.db-$x" "$guardado-$x"; done
fi
cp "$ARQ" "$PASTA/contas.db.novo" && mv "$PASTA/contas.db.novo" "$PASTA/contas.db"
[ -n "$DONO" ] && chown "$DONO:$DONO" "$PASTA/contas.db" "$COPIAS" 2>/dev/null || true
echo "Banco de antes guardado em $guardado (para desfazer: voltar-contas.sh $guardado)"
[[ "$ORIGEM" == *.tar ]] && echo "Atenção: a cópia de fora da máquina vem sem sessões e sem as chaves de IA: todos entram de novo com o Google e põem a chave de IA de novo."

if [ -n "$SERVICO" ]; then
  systemctl start "$SERVICO"
  for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:$PORTA/saude" > /dev/null 2>&1 && break; sleep 2; done
  curl -fsS "http://127.0.0.1:$PORTA/saude" > /dev/null || erro "o servidor não respondeu em 2 min: veja journalctl -u $SERVICO"
  echo "Servidor de pé."
fi
echo "Pronto em $(( $(date +%s) - inicio )) s."
