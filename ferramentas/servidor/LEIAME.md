# Servidor na Oracle Cloud

O GitHub Pages publica, junto com o jogo, o pacote do servidor em
`https://rcandrerc.github.io/Rpg-realista/servidor/` (feito por `empacotar.sh`).
A máquina da Oracle confere esse endereço a cada 5 minutos e, se a versão mudou, baixa e reinicia sozinha.
Ou seja: depois de instalada, todo merge na `main` chega no servidor em poucos minutos, sem mexer na máquina.

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
