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
