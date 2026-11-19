# Servidor na Oracle Cloud

O GitHub Pages publica, junto com o jogo, o pacote do servidor em
`https://rcandrerc.github.io/Rpg-realista/servidor/` (feito por `empacotar.sh`).
O servidor da Oracle confere esse endereço (e o balde) a cada 5 minutos e, se a versão mudou, abre o pacote trancado e
assinado e reinicia sozinho (`server/atualizar.js`). O antigo timer `rpg-atualizar`, que baixava o servidor aberto como
root, saiu (remoção aprovada pelo Presidente em 2026-11-19); numa máquina antiga, desligue com
`sudo systemctl disable --now rpg-atualizar.timer`.
Ou seja: depois de instalada, todo merge na `main` chega no servidor em poucos minutos, sem mexer na máquina.

## Código do servidor trancado (André 2026-11-03)

O site do GitHub Pages é público, então o código do servidor não fica mais aberto lá.
Na máquina da Oracle o servidor cria um par de chaves na primeira vez (`/opt/rpg/chave-privada.pem`, nunca sai de lá)
e mostra a chave pública em `/chave-do-servidor`. A cada merge, o CI pega essa chave, tranca o pacote
(`trancar.mjs`) e publica só `servidor/pacote.json` + `servidor/pacote-versao.txt`. O próprio servidor confere a cada
5 minutos, abre o pacote, troca os arquivos e reinicia (`server/atualizar.js`). O `instalar.sh` continua público (não tem código do jogo).

Máquina nova (ainda sem chave): rode o workflow "Publicar no GitHub Pages" à mão com **abrir_servidor** marcado.
O pacote sai aberto só nessa vez; depois que a máquina subir, rode de novo sem marcar para fechar.

## Criar a máquina

1. Compute → Instances → Create instance, região Brazil East (São Paulo).
2. Shape: Ampere `VM.Standard.A1.Flex`, 2 OCPUs e 12 GB (Always Free). Image: `Canonical Ubuntu 24.04 Minimal aarch64`.
3. Networking: rede nova, com "Automatically assign public IPv4 address" ligado.
4. SSH keys: "Generate a key pair" e **Save private key** (só para emergência).
5. Advanced options → Management → **Paste cloud-init script**: cole o arquivo `oracle-cloud-init.sh` inteiro.
6. Create.

## Liberar as portas na rede da Oracle

Instance → Networking → Subnet → Security → Default Security List → **Add Ingress Rules**:
Source CIDR `0.0.0.0/0`, IP Protocol TCP, Destination Port Range `80,443`.

## Endereço

O servidor fica em `wss://IP-COM-TRACOS.sslip.io` (ex.: IP 1.2.3.4 vira `wss://1-2-3-4.sslip.io`).
Teste em `https://IP-COM-TRACOS.sslip.io/saude` (responde `{"ok":true}`).
Esse endereço vai em `SERVIDOR_PARA_PAGES` (`client/src/rede.js`).

## Login com Google (ID do cliente OAuth)

1. Abra [console.cloud.google.com](https://console.cloud.google.com) com a sua conta Google e crie um projeto (nome: `RPG Realista`).
2. Menu → **APIs e serviços → Tela de consentimento OAuth** (ou **Google Auth Platform → Branding**): nome do app `RPG Realista`, e-mail de suporte = o seu, tipo de usuário **Externo**. Salve.
3. Em **Branding**, preencha: página inicial `https://rcandrerc.github.io/Rpg-realista/`, política de privacidade `https://rcandrerc.github.io/Rpg-realista/privacidade.html` e domínio autorizado `rcandrerc.github.io`. Depois, em **Público-alvo**, clique em **Publicar app** (enquanto estiver em "Testando", só os usuários de teste conseguem entrar). Como o jogo só pede nome e e-mail, o Google não exige verificação.
4. **Credenciais (ou Clientes) → Criar credenciais → ID do cliente OAuth**, tipo **Aplicativo da Web**.
5. Em **Origens JavaScript autorizadas**, adicione:
   - `https://rcandrerc.github.io`
   - `https://IP-COM-TRACOS.sslip.io` (o endereço do servidor)
   - `http://localhost:5173` e `http://localhost` (para testes)
6. Não precisa de URI de redirecionamento. Clique em **Criar** e copie o **ID do cliente** (termina em `.apps.googleusercontent.com`).
7. Esse ID vai em `GOOGLE_CLIENT_ID` (`shared/conta.js`). Ele é público; o segredo do cliente não é usado.

## Chave selada (André 2026-11-19)

Quando não dá para criar o segredo no GitHub, a chave vai selada no repositório: `node ferramentas/servidor/selar-segredo.mjs GEMINI_CHAVE arquivo.txt`
baixa a chave pública da máquina (`/chave-do-servidor`), tranca a chave com ela e grava em `server/segredos-selados.json`.
Só a máquina da Oracle (que guarda `chave-privada.pem`) abre. Segredo do GitHub com o mesmo nome continua valendo e vem antes.
Se a máquina for reinstalada (chave nova), sele de novo.
O selador confere a chave pública com `ferramentas/servidor/impressao-chave.txt` e não sela se for outra. Máquina reinstalada: confira a impressão na própria máquina e rode com `NOVA_CHAVE=1`.
Mudança em `server/segredos-selados.json` ou `impressao-chave.txt` é mudança de segurança: revisão independente antes do merge.
Se a `chave-privada.pem` vazar, tudo o que já foi selado fica legível para sempre no histórico do git: revogue a chave no Google AI Studio (selar de novo não resolve).

## Janela de instalação (plano de lançamento v3)

O servidor novo só instala em hora marcada (Brasília): 05h–07h e 14h–15h. Na 1ª semana depois do lançamento
(19/12 20h a 26/12 20h), só 05h–07h. De 19/12 18h a 20/12 02h nada instala. Fora da janela o servidor espera e
instala o pacote mais novo quando a janela abrir (`podeInstalar` em `server/atualizar.js`).
Conserto urgente: ponha `[servidor urgente]` no título do PR; o pacote sai marcado (campo assinado) e instala na hora,
menos no bloqueio do lançamento. Servidor de teste (reserva, robôs): `JANELA_LIVRE=1` no ambiente instala sempre.
