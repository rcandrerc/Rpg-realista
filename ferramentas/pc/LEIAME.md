# Versão PC (Windows .exe)

Regra do André (2026-11-06): **nada da versão PC pode mudar o celular**. Por isso tudo fica aqui, fora de
`godot-prototipo/`, e só entra numa cópia descartável na hora de gerar o .exe:

- `preparar.sh`: liga as texturas de PC (S3TC/BPTC), põe o nome "Aethra" e a janela maximizada, registra o
  autoload dos controles e acrescenta o preset "Windows" ao `export_presets.cfg`. Não é commitado.
- `controles_pc.gd`: teclado e mouse. Só preenche o que o joystick e os botões da tela já preenchem
  (`hud.mover`, `hud.giro_cam`, sinais `apertou`/`soltou`/`tocou`), então não mexe no `hud.gd` nem na câmera.
  Mostra a tecla de cada botão num selinho no canto.
- `preset-windows.cfg`: preset de exportação (x86_64, `.exe` + `.pck` lado a lado, feature `aethra_pc`).
- `LEIA-ME.txt`: vai dentro do zip, com os controles.
- `Aethra-OpenGL.bat`: vai dentro do zip; abre com `--rendering-driver opengl3` para placas sem Vulkan/D3D12.
  O `preparar.sh` também liga o fallback automático para OpenGL 3 (e ANGLE) no projeto do PC.

## Gerar

Actions > **Versão PC (Windows)** > Run workflow (ramo main). Não roda sozinho em push. Na main publica em
`https://github.com/rcandrerc/Rpg-realista/releases/download/pc/Aethra-PC.zip`.
Também vai para o balde da Oracle (abre mesmo com o repositório privado, sem login):
`https://objectstorage.sa-saopaulo-1.oraclecloud.com/n/gri0v6lf72rz/b/Aethra-jofo/o/Aethra-PC.zip`.
O .exe se atualiza sozinho lendo `conteudo-pc.json` e `pc-Aethra.pck` do mesmo balde (nomes fixos, sobrescritos a
cada build). Os .exe gerados antes de 2026-11-13 ainda leem do release "pc", que continua recebendo tudo.

Testar no computador sem CI: rode `bash ferramentas/pc/preparar.sh` numa cópia do repositório (ele altera
`project.godot` e `export_presets.cfg`; não commite isso) e exporte o preset "Windows" no editor.

## O que fica diferente do celular

- Sem atualização dentro do app: os pacotes da Oracle têm textura de celular. Sem `atualizacao/base` o
  `inicio.gd` abre direto o jogo que vem no .pck. Versão nova = baixar o zip de novo.
- Login: sem o plugin do Google (só Android), o `rede.gd` já cai no login pelo navegador e busca a sessão sozinho.
- Tela: o jogo foi feito para 1280x576 com `stretch = expand`; num monitor 16:9 a tela fica 1280x720 e a HUD
  continua presa nos cantos.
