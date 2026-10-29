# Assar animações

Converte os `.fbx` do Mixamo num único `anims.json` pequeno: guarda só as rotações dos ossos e a posição do quadril, a 30 quadros por segundo.

1. Copie os `.fbx` que o jogo usa (do repositório New-Game-Anime-fontes, pasta `mixamo/`) para `ferramentas/assar-animacoes/fbx/`.
2. Instale `three@0.147.0` e o Playwright nesta pasta e rode `node bake.js`.
3. Compacte: `gzip -9 anims.json` e copie para `client/public/assets/personagens/anims.json.gz`.
4. Se a animação nova tiver nome novo, adicione a duração em `shared/dados.js` (`DURACAO`).
