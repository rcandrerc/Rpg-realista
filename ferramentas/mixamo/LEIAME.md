# Monstros do Mixamo

Pedido do André (2026-11-03): a heroína anime continua, e personagens do Mixamo viram inimigos com o visual anime do jogo.
Licença: personagens e animações do Mixamo são livres de royalty, inclusive em jogo comercial (FAQ da Adobe). Só não se
pode distribuir os arquivos crus soltos, por isso os FBX ficam no repositório de fontes, e não neste.

1. O André baixa no celular (Chrome com "Site para computador", logado na conta Adobe dele) usando o favorito
   `baixar-mixamo-favorito.txt` (pasta mixamo dos arquivos do projeto). Formato FBX Binary, With Skin, T-pose.
2. Copiar o FBX para `client/public/tmp-mixamo/<Nome>.fbx` (fora do Git), rodar `npx vite` em `client/` e abrir
   `/converter-mixamo.html?nomes=<Nome>`. O GLB leve (texturas em 1024) sai em `window.resultado` e vai para
   `client/public/assets/monstros/mixamo/<Nome>.glb`.
3. Registrar em `MIXAMO` no `client/exportar-bestiario-godot.html` (altura e quais animações do jogo usar). As
   animações Mixamo do jogo (`assets/personagens/anims.json.gz`) entram direto no esqueleto mixamorig.
4. Fotos: `foto.gd` (SceneTree). Com o Godot 4.5 e `mesa-vulkan-drivers` (lavapipe):
   `FOTO_SAIDA=/pasta FOTO_TIPO=warrok xvfb-run -a godot --rendering-driver vulkan --path godot-prototipo -s ferramentas/mixamo/foto.gd`.
   No lavapipe a Ruiva sai branca (MToon), no celular não.

## Animações de monstro (2026-11-04)

1. O André baixa com o favorito `baixar-golpes-favorito.txt` (e `baixar-golpes-faltaram-favorito.txt`) da pasta do projeto, já no esqueleto do Warrok, sem pele.
2. Os .fbx vão para `client/public/tmp-mixamo/anims/` (fora do git; o original fica no repositório de fontes, `mixamo/animacoes_monstros`).
3. Com o vite rodando, abra `converter-golpes-mixamo.html?nomes=Arquivo1,Arquivo2,...` e grave `window.resultado` em
   `client/public/assets/monstros/mixamo/golpes.json.gz` (gzip do JSON). Os nomes viram `mx_<arquivo em minúsculas>`.
4. Em `exportar-bestiario-godot.html`, a tabela `GOLPES` diz qual animação cada monstro usa. `[clipe, início, fim]` recorta:
   o impacto do golpe tem que cair em 45% do pedaço (`COMBATE.acerto`).
