# Monstros do Bestiário (Quaternius)

Os inimigos Puglin e Imp vêm da versão grátis do *Bestiary - Dungeon Monsters Kit* (New-Game-Anime-fontes,
`pacotes_livres/quaternius_bestiary-dungeon-monsters`). O kit não traz animações: ele usa o mesmo esqueleto da
Universal Animation Library (UAL), então as animações são da UAL, corrigidas pela pose de descanso de cada osso
(rotação = descanso do monstro × inverso do descanso da UAL × rotação da UAL; o quadril anda na proporção da altura).

Arquivos do jogo: `client/public/assets/monstros/bestiario/` (`Puglin.glb`, `Imp.glb`, `anims_<Nome>.json.gz`).
Quais animações cada um usa: `ESCOLHA_ANIMS` em `client/src/bestiario.js`.

## Refazer as animações

1. Copiar `quaternius/UAL1_Standard.glb` e `UAL2_Standard.glb` do repositório de fontes para `client/public/tmp-bestiario/`
   (não vão para o Git).
2. `npx vite` em `client/` e abrir `/converter-bestiario.html` num Chromium. O resultado fica em `window.resultado`
   (um JSON por monstro); gravar cada um com gzip em `client/public/assets/monstros/bestiario/anims_<Nome>.json.gz`.
   Os `.json.gz` precisam ser servidos sem `Content-Encoding` (no Playwright, `page.route` entregando o arquivo cru).

## Godot

`/exportar-bestiario-godot.html` gera `puglin.glb` e `imp.glb` (base64 em `window.resultado`) com as animações
gravadas nos nomes do Godot: `parada`, `andar`, `corrida`, `espada_parada`, `golpe1`, `golpe2`, `apanhar`, `morrer`.
O Imp sai na altura do ombro da Ruiva (1,36 m) e as texturas 25% menos saturadas. Copiar para `godot-prototipo/modelos/`.
