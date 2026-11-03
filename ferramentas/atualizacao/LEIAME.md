# Atualização dentro do app (sem baixar APK novo)

O APK é a "casca": traz o jogo inteiro de uma versão **base**. A cada push na main, o CI gera um pacote `.pck` só com o
que mudou desde essa base e publica no site do GitHub Pages. Ao abrir, o app confere, baixa (com barra) e carrega.

Custo zero: o site do GitHub Pages é grátis e não passa pela Oracle.

## Como funciona

1. `apk.yml` grava a versão base no `project.godot` (`aethra/atualizacao/base` = version/code do APK) e exporta o APK
   e o pacote completo `base-CODIGO.pck` (mesmo conteúdo do APK).
2. `ferramentas/atualizacao/publicar.sh` (só na main):
   - guarda `base-CODIGO.pck` no release **pacotes** (privado; ficam a base atual e os 5 mais novos);
   - acha a base atual: a etiqueta git `apk-base-N` de número mais alto;
   - gera `pacote-CODIGO.pck` com `godot --export-patch ... --patches base-N.pck` e o `manifesto.json`
     (`base`, `versao`, `pacote`, `tamanho`, `sha256`) no release **atualizacao**;
   - chama o `pages.yml`, que copia o release para `https://rcandrerc.github.io/Rpg-realista/atualizacao/`.
3. No app, `godot-prototipo/inicio.gd` (cena inicial `inicio.tscn`):
   - lê o manifesto (espera até 6 s); se a `base` é a do APK e o pacote é novo, baixa para `user://atualizacao/`,
     confere o sha256 e carrega com `ProjectSettings.load_resource_pack()` antes de abrir `main.tscn`;
   - sem internet ou com erro: usa o último pacote baixado (se for desta base) ou a versão do próprio APK;
   - botão "Jogar sem atualizar" durante o download;
   - manifesto de uma base mais nova que a do APK: avisa que tem APK novo e abre a versão do APK.

## Ao entregar um APK novo ao André

Depois de assinar o APK do build N (versionCode N) com a chave oficial, crie a etiqueta da base e rode o apk.yml de novo
(Actions → APK do app Godot → Run workflow, na main) para o manifesto apontar para ela:

    git tag apk-base-N <commit do build N> && git push origin apk-base-N

Sem a etiqueta, o manifesto continua apontando para a base anterior (quem tem o APK antigo segue recebendo atualização).

## O que o pacote NÃO consegue mudar (precisa APK novo)

- `inicio.gd`, `inicio.tscn` e o `project.godot` (configurações, autoloads, ícone, nome, permissões);
- plugins Android (`addons/`, `plugin-android/`, AAR), versão do Godot, chave de assinatura;
- `class_name` novo (o cache de classes globais só é lido ao abrir o app).

Se o pacote passar de 90 MB, o CI não publica (avisa no log) e o manifesto fica sem pacote: hora de entregar APK novo.

Proteção: o pacote é o mesmo conteúdo que já vai dentro do APK (não leva código-fonte, chaves nem dados de jogador).
Só o CI deste repositório publica no site, e o app confere o sha256 do manifesto antes de usar.

## Antes de lançar na Google Play

A Play proíbe app que baixa código executável nativo (dex, .so, jar) por fora da loja. Código interpretado
(GDScript dentro do Godot) e conteúdo (modelos, texturas, sons) são permitidos, mas a regra de "o app não pode se
atualizar por fora da Play" precisa ser relida na época do lançamento (política "Abuso de dispositivo e rede").
Se der problema, dá para usar os mesmos pacotes só para conteúdo e deixar o código para a atualização da loja.
