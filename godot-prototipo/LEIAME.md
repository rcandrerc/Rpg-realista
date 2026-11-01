# Protótipo Godot

Mesma vila e personagens anime do jogo HTML, para comparar FPS no celular (botão **Teste**).

1. `client/exportar-godot/`: com `npx vite` rodando em `client/`, abrir `/exportar-godot/index.html` num Chromium
   (o `anims.json.gz` precisa ser servido sem Content-Encoding). Gera `vila.glb` e um GLB por personagem com
   `parada`, `andar` e `corrida` já gravados nos ossos do VRM. Copiar para `godot-prototipo/modelos/`
   junto com `client/public/assets/ceu/kloofendal_48d_partly_cloudy_puresky_1k.hdr` como `ceu.hdr`.
2. Godot 4.5: `godot --headless --import` e depois `godot --headless --export-release Android saida.apk`
   (keystore de release e caminho do Android SDK nas configurações do editor, fora do repositório).
