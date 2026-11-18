# PC na nuvem

Área de trabalho leve (openbox) com Google Chrome e a extensão Claude in Chrome, na VM
**builds-runner** do Oracle (nunca na VM do jogo). O André abre o endereço no navegador do
celular, entra com usuário e senha, e faz login nas contas (Google, Play Console, Firebase,
Oracle, ActorCore, Mixamo). Depois as threads usam esse Chrome pela extensão.

- Instalar: Oracle Console > Compute > builds-runner > Run command, colando a linha do topo de
  `instalar-pc-nuvem.sh` com o `PC_HASH` de `chaves/pc-nuvem.txt` (repositório de fontes).
- Endereço, usuário e senha: `chaves/pc-nuvem.txt` no repositório de fontes. Nunca no chat.
- Builds primeiro: fatia `pc-nuvem.slice` com até 3 GB de memória e CPUWeight 2 (o runner tem 20).
- Desligar: `sudo systemctl disable --now pc-desktop pc-novnc caddy`. Religar: `enable --now`.
- Só HTTPS sai para fora (Caddy + sslip.io). A tela e o noVNC escutam só em 127.0.0.1, e o
  firewall impede o usuário do runner de abrir a tela do Chrome logado.

## RDP (celular com o app Windows App)

- Opcional: rode `cloudshell-bastion.sh` com `PC_VNC='<senha da tela>'` além do `PC_HASH`
  (os dois em `chaves/pc-nuvem.txt`). O xrdp (porta 3389) mostra a MESMA tela do Chrome.
- A porta 3389 abre num NSG `pc-nuvem-rdp` preso só na placa de rede da builds-runner. A
  Security List da sub-rede (também da VM do jogo) não muda.
- Com o RDP ligado a tela pede a senha `PC_VNC` (8 caracteres, limite do VNC); o noVNC entra
  com ela sozinho. Contra chute de senha: no máximo 6 conexões novas por minuto por IP.
- Desligar o RDP: `sudo systemctl disable --now xrdp` e tirar o NSG da placa da builds-runner.
