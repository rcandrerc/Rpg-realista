# Protótipo Godot

Mesma vila e personagens anime do jogo HTML, para comparar FPS no celular (botão **Teste**).

O APK sai sozinho pelo GitHub Actions: veja `ferramentas/apk/LEIAME.md` (link para baixar no celular).

Para montar à mão:

1. `node client/exportar-godot/gerar-modelos.mjs` (com o vite rodando em `client/` e o pacote playwright) faz o passo abaixo
   sozinho e já copia tudo para `godot-prototipo/modelos/`. Ou, no navegador, `client/exportar-godot/`: com `npx vite` rodando em `client/`, abrir `/exportar-godot/index.html` num Chromium
   (o `anims.json.gz` precisa ser servido sem Content-Encoding). Gera `vila.glb` e um GLB por personagem com
   `parada`, `andar` e `corrida` já gravados nos ossos do VRM. Copiar para `godot-prototipo/modelos/`
   junto com `client/public/assets/ceu/kloofendal_48d_partly_cloudy_puresky_1k.hdr` como `ceu.hdr`.
2. Godot 4.5: `godot --headless --import` e depois `godot --headless --export-release Android saida.apk`
   (keystore de release e caminho do Android SDK nas configurações do editor, fora do repositório).

## Sensação de jogo (onde ajustar)

- Movimento (inércia, giro, coyote time, velocidade pelo joystick): constantes no começo de `passo()` em `andar.gd`.
- Animação (mistura parada/andar/corrida, ação só no tronco): `anim_heroi.gd`. Inclinar na curva e afundar no pouso: `inclinar.gd`.
- Câmera (mola, seguir por trás, campo de visão, tremida): constantes em `camera_heroi.gd`.
- Golpe (congelada, tremida, fila de botões): constantes `FILA_TEMPO`, `HITSTOP`, `TREME` em `main.gd`.
- Sons: `sons.gd` toca os arquivos de `sons/` (gerados por `ferramentas/sons/gerar.py`). Raio do joystick: `JOY_RAIO` em `hud.gd`.
