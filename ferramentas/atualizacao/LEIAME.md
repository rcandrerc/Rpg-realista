# Atualização dentro do app (sem baixar APK novo)

## APK casca (pedido do André, 2026-11-03): o APK não traz o jogo

Como nos MMOs: o APK (preset **Android casca**, artefato `rpg-realista-casca-apk`) só tem o motor, a tela de abertura
(`inicio.tscn`), a capa e as fontes. Ao abrir, `inicio.gd` lê `atualizacao/conteudo.json` no site e baixa:

- **completo**: o jogo inteiro de uma versão, em partes de 45 MB (`completo-ID.parteNN`). Baixa uma parte, confere o
  sha256, junta e apaga a parte (retoma de onde parou se a internet cair);
- **deltas**: só o que mudou depois do completo, um por versão (`delta-VERSAO.pck`), carregados em ordem por cima.

`ferramentas/atualizacao/publicar-conteudo.sh` roda em cada push na main: cada build vira um delta novo
(`godot --export-patch` contra o completo e os deltas anteriores). Quando os deltas somam mais de 60 MB, o build vira
o completo novo e a corrente zera (o celular baixa o completo de novo uma vez). **Nunca precisa de APK novo por
tamanho.** APK novo só para mudar `inicio.gd`, `project.godot`, plugins Android ou a versão do Godot.

Onde fica: release **conteudo** (privado, fonte da verdade) e cópia no site pelo `pages.yml`. Com o secret
`ORACLE_PAR` (link pré-autenticado de escrita do balde) e a variável `ORACLE_URL` (endereço público do balde
`Aethra-jofo`, Oracle Object Storage grátis: 20 GB e 10 TB de download por mês), os arquivos sobem também para a
Oracle e o `conteudo.json` (campo `url_base`) manda o app baixar de lá. O `conteudo.json` continua no site.
O endereço público já vem como padrão no script (`https://objectstorage.sa-saopaulo-1.oraclecloud.com/n/gri0v6lf72rz/b/Aethra-jofo/o/`),
então basta o link de escrita: vem do secret `ORACLE_PAR` ou, sem ele, de `ferramentas/atualizacao/oracle-par-envio.txt` (André autorizou guardar no repositório privado em 2026-11-03; se o repositório um dia for aberto, troque o link na Oracle antes). O link de escrita (só grava, vence em 2030-11-03) está em New-Game-Anime-fontes
`chaves/oracle-par-envio.txt`.

Sem internet na primeira abertura: tela "Sem internet" com **Tentar de novo**. Depois disso, abre com o que já baixou.

O modo antigo abaixo (APK com o jogo dentro + um pacote só) continua funcionando para quem tem o APK antigo.


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

Se o push de etiqueta for recusado (a sessão do Claude não pode criar etiquetas), crie um **ramo** `apk-base-N` no
mesmo commit (`git push origin <commit>:refs/heads/apk-base-N`): o `publicar.sh` aceita os dois.

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
