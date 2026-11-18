#!/bin/bash
# Roda no Oracle Cloud Shell (já logado na conta). Instala o PC na nuvem na VM builds-runner
# passando por um Bastion temporário (a VM não tem chave SSH e o Run command não tem sudo).
# NUNCA toca na VM do jogo. No fim apaga o Bastion.
# Uso: PC_HASH='<hash de chaves/pc-nuvem.txt>' bash cloudshell-bastion.sh
set -euo pipefail
: "${PC_HASH:?falta PC_HASH}"
REG=sa-saopaulo-1
TEN="${OCI_TENANCY:?Cloud Shell sem OCI_TENANCY}"
INST=ocid1.instance.oc1.sa-saopaulo-1.antxeljr2cr4ewicm2bln2bbiavknvzgz76ebxwnfuvlkjv357w665b2t5za  # builds-runner
NOME=$(oci compute instance get --instance-id "$INST" --query 'data."display-name"' --raw-output)
[ "$NOME" = builds-runner ] || { echo "ERRO: instância não é a builds-runner ($NOME)"; exit 1; }
SUB=$(oci compute instance list-vnics --instance-id "$INST" --query 'data[0]."subnet-id"' --raw-output)
IPVM=$(oci compute instance list-vnics --instance-id "$INST" --query 'data[0]."private-ip"' --raw-output)
MEUIP=$(curl -fsS https://api.ipify.org)
echo "== builds-runner $IPVM, Cloud Shell $MEUIP"

echo "== 1/4 Bastion temporário (só aceita o IP deste Cloud Shell)"
BID=$(oci bastion bastion create --bastion-type standard --compartment-id "$TEN" --target-subnet-id "$SUB" \
  --client-cidr-list "[\"$MEUIP/32\"]" --name pcnuvemtemp --wait-for-state SUCCEEDED \
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

echo "== 3/4 Instalando (uns 10 min)"
ssh -i ~/.ssh/pcn -o StrictHostKeyChecking=no -o ProxyCommand="$PROXY" "ubuntu@$IPVM" \
  "curl -fsSL https://raw.githubusercontent.com/rcandrerc/Rpg-realista/claude/project-thread-pw8cm4/ferramentas/pc-nuvem/instalar-pc-nuvem.sh -o /tmp/pc.sh && sudo PC_HASH='$PC_HASH' bash /tmp/pc.sh 2>&1 | tail -25"
rm -f ~/.ssh/pcn ~/.ssh/pcn.pub
echo "== FIM"
