# Atualização dentro do app (sem baixar APK novo)

## APK casca (pedido do André, 2026-11-03): o APK não traz o jogo

Como nos MMOs: o APK (preset **Android casca**, artefato `rpg-realista-casca-apk`) só tem o motor, a tela de abertura
(`inicio.tscn`), a capa e as fontes. Ao abrir, `inicio.gd` lê `atualizacao/conteudo.json` no site e baixa:

- **completo**: o jogo inteiro de uma versão, em partes de 45 MB (`completo-ID.parteNN`). Baixa uma parte, confere o
  sha256, junta e apaga a parte (retoma de onde parou se a internet cair);
- **deltas**: só o que mudou depois do completo, um por versão (`delta-VERSAO.pck`), carregados em ordem por cima.

`ferramentas/atualizacao/publicar-conteudo.sh` roda em cada push na main: cada build vira um delta novo
(`godot --export-patch` contra o completo e os deltas anteriores). Quando os deltas somam mais de 150 MB (era 60 MB até 2026-11-16), o build vira
o completo novo e a corrente zera. **Nunca precisa de APK novo por tamanho.**

**Ponte** (André 2026-11-16, "por que não baixa só o que está faltando?"): no completo novo, o `conteudo.json` leva
`ponte` = `{completo: o velho, para: o novo, deltas: a corrente velha + o delta deste build}`. O celular com o
completo velho baixa só os deltas da ponte que faltam (`inicio.gd` `_casca_ponte`), guarda como `base` no
`estado.cfg` e passa a seguir a corrente nova por cima. Só baixa o jogo inteiro: instalação nova, celular que ficou
para trás de duas trocas de completo, ou base passando de 300 MB (`BASE_MAX`; aí troca pelo completo novo, que é
menor). Os arquivos da ponte ficam no release até o próximo completo. APK casca de antes de 2026-11-16 ignora a ponte
e baixa o jogo inteiro, como antes. APK novo só para mudar `inicio.gd`, `project.godot`, plugins Android ou a versão do Godot.

Onde fica: release **conteudo** (privado, fonte da verdade) e cópia no site pelo `pages.yml`. Com o secret
`ORACLE_PAR` (link pré-autenticado de escrita do balde) e a variável `ORACLE_URL` (endereço público do balde
`Aethra-jofo`, Oracle Object Storage grátis: 20 GB e 10 TB de download por mês), os arquivos sobem também para a
Oracle e o `conteudo.json` (campo `url_base`) manda o app baixar de lá. O `conteudo.json` continua no site.
O endereço público já vem como padrão no script (`https://objectstorage.sa-saopaulo-1.oraclecloud.com/n/gri0v6lf72rz/b/Aethra-jofo/o/`),
então basta o link de escrita: vem do secret `ORACLE_PAR` ou, sem ele, de `ferramentas/atualizacao/oracle-par-envio.txt` (André autorizou guardar no repositório privado em 2026-11-03; se o repositório um dia for aberto, troque o link na Oracle antes). O link de escrita (só grava, vence em 2030-11-03) está em New-Game-Anime-fontes
`chaves/oracle-par-envio.txt`.

Sem internet na primeira abertura: tela "Sem internet" com **Tentar de novo**. Depois disso, abre com o que já baixou.

**Uma corrente por motor (2026-11-12, Godot 4.5 → 4.7).** Pacote feito por um motor não abre no outro. O
`publicar-conteudo.sh` pergunta a versão ao `$GODOT_BIN` e grava a corrente com o nome do motor: o 4.5 continua em
`conteudo.json` (parado na última versão do 4.5, para o APK casca antigo ainda abrir) e o 4.7 em `conteudo-4.7.json`,
que é o que o `inicio.gd` do APK novo lê (`_conteudo_do_motor`). A primeira vez de um motor vira completo. Os arquivos
de todas as correntes ficam no release. Trocar de motor de novo: muda `GODOT` no `apk.yml` e entrega APK novo.
O modo antigo abaixo (`publicar.sh`, APK com o jogo dentro) só roda no 4.5 e ficou parado.

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

## Por que o delta às vezes vinha com o jogo inteiro (2026-11-04)

Quando o cache dos modelos não batia (qualquer mudança em `client/` ou `shared/`), o CI gerava os modelos numa pasta
vazia e reimportava todos. O pacote saía com ~165 MB diferentes, o delta estourava os 60 MB e o app baixava o
completo (~210 MB) de novo. Agora o `apk.yml` volta a pasta de modelos do último build, compara byte a byte e só
reimporta o modelo que mudou de verdade: o delta fica com o tamanho da mudança. O pacote e o `conteudo.json` também
são publicados antes de gerar os APKs, então a atualização chega alguns minutos antes (mesmo gasto de Actions).

## Balde compactado (2026-11-19)

`publicar-conteudo.sh` sobe para a Oracle as partes do completo e os deltas em gzip, com `Content-Encoding: gzip`
(as texturas ETC2 dos personagens compactam ~4x). O HTTPRequest do app abre sozinho e grava o arquivo igual ao de
antes (o sha256 do `conteudo.json` é o do arquivo aberto). Depois de subir, o script baixa como o app e confere o
sha256; se não bater, ou se o arquivo quase não compacta, sobe cru como antes. O release do GitHub e o Pages ficam
crus. Barra de progresso: APK casca a partir desta versão mede na medida do arquivo aberto (`_tam_atual`); o casca
antigo mostra a barra parando antes do fim e pulando para o próximo arquivo (só a barra; o download é o mesmo).

O completo e os deltas que já estavam no balde crus (o completo 2720 subiu antes do gzip: 415 MB) são recompactados
no próximo build sem trocar de completo: o script olha o cabeçalho de cada um e, sem `content-encoding: gzip`, sobe de
novo compactado (mesmo sha256, o `conteudo.json` não muda). O 2720 cai para ~190 MB de download.
