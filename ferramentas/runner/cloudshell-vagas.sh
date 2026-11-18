#!/bin/bash
# Roda no Oracle Cloud Shell (já logado na conta). Abre as vagas de testes e robôs (ferramentas/runner/instalar-vagas.sh)
# na VM builds-runner passando por um Bastion temporário, como o PC na nuvem (ferramentas/pc-nuvem/cloudshell-bastion.sh).
# NUNCA toca na VM do jogo. No fim apaga o Bastion.
# Uso: TOKEN='<código de registro do GitHub>' REF=<commit> bash cloudshell-vagas.sh
# Repositório PRIVADO (o raw.githubusercontent.com não abre sem login): passe o instalador junto, em base64:
#   TOKEN=... VAGAS=atualizacao INSTALADOR_B64=$(base64 -w0 instalar-vagas.sh) bash cloudshell-vagas.sh
set -euo pipefail
: "${TOKEN:?falta TOKEN (código de registro do GitHub, vale 1 hora)}"
REF="${REF:-main}"
VAGAS="${VAGAS:-testes robo atualizacao}"
INSTALADOR_B64="${INSTALADOR_B64:-}"
REG=sa-saopaulo-1
TEN="${OCI_TENANCY:?Cloud Shell sem OCI_TENANCY}"
INST=ocid1.instance.oc1.sa-saopaulo-1.antxeljr2cr4ewicm2bln2bbiavknvzgz76ebxwnfuvlkjv357w665b2t5za  # builds-runner
NOME=$(oci compute instance get --instance-id "$INST" --query 'data."display-name"' --raw-output)
[ "$NOME" = builds-runner ] || { echo "ERRO: instância não é a builds-runner ($NOME)"; exit 1; }
SUB=$(oci compute instance list-vnics --instance-id "$INST" --query 'data[0]."subnet-id"' --raw-output)
IPVM=$(oci compute instance list-vnics --instance-id "$INST" --query 'data[0]."private-ip"' --raw-output)
MEUIP=$(curl -fsS https://api.ipify.org)
echo "== builds-runner $IPVM, Cloud Shell $MEUIP"

# O Cloud Shell sai por outro IP no SSH, então a ponte temporária aceita qualquer origem
# (só entra quem tem a chave gerada aqui; a ponte é apagada no fim). OK do André 2026-11-18.
CIDR="${CIDR:-0.0.0.0/0}"
echo "== 1/4 Bastion temporário (aceita $CIDR, apagado no fim)"
BID=$(oci bastion bastion create --bastion-type standard --compartment-id "$TEN" --target-subnet-id "$SUB" \
  --client-cidr-list "[\"$CIDR\"]" --name vagastemp --wait-for-state SUCCEEDED \
  --query 'data.resources[0].identifier' --raw-output)
echo "bastion $BID"
limpar() { echo "== 4/4 Apagando o Bastion"; oci bastion bastion delete --bastion-id "$BID" --force >/dev/null || true; }
trap limpar EXIT

echo "== 2/4 Sessão SSH de 1 hora como ubuntu"
rm -f ~/.ssh/pcn ~/.ssh/pcn.pub; ssh-keygen -q -t rsa -b 4096 -N '' -f ~/.ssh/pcn  # RSA: o Cloud Shell (FIPS) recusa ED25519
SID=$(oci bastion session create-managed-ssh --bastion-id "$BID" --target-resource-id "$INST" \
  --target-os-username ubuntu --ssh-public-key-file ~/.ssh/pcn.pub --session-ttl 3600 \
  --wait-for-state SUCCEEDED --query 'data.resources[0].identifier' --raw-output)
echo "sessao $SID"
PROXY="ssh -i ~/.ssh/pcn -o StrictHostKeyChecking=no -W %h:%p -p 22 $SID@host.bastion.$REG.oci.oraclecloud.com"

# a sessão leva um tempo para valer de verdade depois de criada: espera ACTIVE e tenta algumas vezes
for _ in $(seq 30); do
  [ "$(oci bastion session get --session-id "$SID" --query 'data."lifecycle-state"' --raw-output)" = ACTIVE ] && break; sleep 5
done
SSHOPT=(-i ~/.ssh/pcn -o StrictHostKeyChecking=no -o ConnectTimeout=20 -o ServerAliveInterval=30 -o ProxyCommand="$PROXY")
ok=0
for t in 1 2 3 4 5 6 7 8; do
  sleep 20
  if ssh "${SSHOPT[@]}" "ubuntu@$IPVM" true; then ok=1; break; fi
  echo "(tentativa $t: a ponte ainda não deixou entrar, tentando de novo)"
done
[ "$ok" = 1 ] || { echo "ERRO: não entrou pela ponte depois de 8 tentativas"; exit 1; }

echo "== 3/4 Abrindo as vagas (uns 3 min)"
if [ -n "$INSTALADOR_B64" ]; then
  PEGA="echo '$INSTALADOR_B64' | base64 -d > \$F"
else
  PEGA="curl -fsSL https://raw.githubusercontent.com/rcandrerc/Rpg-realista/$REF/ferramentas/runner/instalar-vagas.sh -o \$F"
fi
ssh "${SSHOPT[@]}" "ubuntu@$IPVM" \
  "F=\$(mktemp) && $PEGA && sudo TOKEN='$TOKEN' VAGAS='$VAGAS' bash \$F 2>&1 | tail -30"
rm -f ~/.ssh/pcn ~/.ssh/pcn.pub
echo "== FIM"
