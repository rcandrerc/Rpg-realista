#!/bin/bash
# Roda no Oracle Cloud Shell (já logado na conta). Instala o PC na nuvem na VM builds-runner
# passando por um Bastion temporário (a VM não tem chave SSH e o Run command não tem sudo).
# NUNCA toca na VM do jogo. No fim apaga o Bastion.
# Uso: PC_HASH='<hash de chaves/pc-nuvem.txt>' bash cloudshell-bastion.sh
# Com RDP: PC_HASH='...' PC_RDP=1 bash cloudshell-bastion.sh  (a senha da tela nasce na VM)
set -euo pipefail
: "${PC_HASH:?falta PC_HASH}"
PC_VNC="${PC_VNC:-}"
PC_RDP="${PC_RDP:-}"   # PC_RDP=1: RDP com senha criada na própria VM (linha sem senha)
REF="${REF:-claude/project-thread-pw8cm4}"   # commit ou ramo do instalador (commit evita cache do GitHub)
REG=sa-saopaulo-1
TEN="${OCI_TENANCY:?Cloud Shell sem OCI_TENANCY}"
INST=ocid1.instance.oc1.sa-saopaulo-1.antxeljr2cr4ewicm2bln2bbiavknvzgz76ebxwnfuvlkjv357w665b2t5za  # builds-runner
NOME=$(oci compute instance get --instance-id "$INST" --query 'data."display-name"' --raw-output)
[ "$NOME" = builds-runner ] || { echo "ERRO: instância não é a builds-runner ($NOME)"; exit 1; }
SUB=$(oci compute instance list-vnics --instance-id "$INST" --query 'data[0]."subnet-id"' --raw-output)
IPVM=$(oci compute instance list-vnics --instance-id "$INST" --query 'data[0]."private-ip"' --raw-output)
MEUIP=$(curl -fsS https://api.ipify.org)
echo "== builds-runner $IPVM, Cloud Shell $MEUIP"

if [ -n "$PC_VNC" ] || [ -n "$PC_RDP" ]; then
  # RDP: a porta 3389 abre num grupo de segurança (NSG) preso SÓ na placa de rede da builds-runner.
  # A Security List da sub-rede (que a VM do jogo também usa) não muda.
  echo "== 0/4 Porta 3389 só para a builds-runner (NSG pc-nuvem-rdp)"
  VNIC=$(oci compute instance list-vnics --instance-id "$INST" --query 'data[0].id' --raw-output)
  VCN=$(oci network subnet get --subnet-id "$SUB" --query 'data."vcn-id"' --raw-output)
  NSG=$(oci network nsg list -c "$TEN" --vcn-id "$VCN" --display-name pc-nuvem-rdp \
    --query 'data[0].id' --raw-output 2>/dev/null || true)
  if [ -z "$NSG" ] || [ "$NSG" = null ]; then
    NSG=$(oci network nsg create -c "$TEN" --vcn-id "$VCN" --display-name pc-nuvem-rdp \
      --wait-for-state AVAILABLE --query 'data.id' --raw-output)
    oci network nsg rules add --nsg-id "$NSG" --security-rules \
      '[{"direction":"INGRESS","protocol":"6","source":"0.0.0.0/0","sourceType":"CIDR_BLOCK","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":3389,"max":3389}},"description":"RDP do PC na nuvem"}]' >/dev/null
  fi
  ATUAIS=$(oci network vnic get --vnic-id "$VNIC" --query 'data."nsg-ids"' 2>/dev/null || echo '[]')
  [ -n "$ATUAIS" ] && [ "$ATUAIS" != null ] || ATUAIS='[]'
  if ! echo "$ATUAIS" | grep -q "$NSG"; then
    NOVOS=$(echo "$ATUAIS" | jq -c --arg n "$NSG" '. + [$n]')   # mantém os que já existiam
    oci network vnic update --vnic-id "$VNIC" --nsg-ids "$NOVOS" --force >/dev/null
  fi
  echo "nsg $NSG na builds-runner"
fi

# O Cloud Shell sai por outro IP no SSH, então a ponte temporária aceita qualquer origem
# (só entra quem tem a chave gerada aqui; a ponte é apagada no fim). OK do André 2026-11-18.
CIDR="${CIDR:-0.0.0.0/0}"
echo "== 1/4 Bastion temporário (aceita $CIDR, apagado no fim)"
BID=$(oci bastion bastion create --bastion-type standard --compartment-id "$TEN" --target-subnet-id "$SUB" \
  --client-cidr-list "[\"$CIDR\"]" --name pcnuvemtemp --wait-for-state SUCCEEDED \
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

echo "== 3/4 Instalando (uns 10 min)"
ssh "${SSHOPT[@]}" "ubuntu@$IPVM" \
  "F=\$(mktemp) && curl -fsSL https://raw.githubusercontent.com/rcandrerc/Rpg-realista/$REF/ferramentas/pc-nuvem/instalar-pc-nuvem.sh -o \$F && sudo PC_HASH='$PC_HASH' PC_VNC='$PC_VNC' PC_RDP='$PC_RDP' bash \$F 2>&1 | tail -25"
# (arquivo novo com mktemp: /tmp/pc.sh já existe, de outro usuário, de uma tentativa pelo Run command)
rm -f ~/.ssh/pcn ~/.ssh/pcn.pub
echo "== FIM"
