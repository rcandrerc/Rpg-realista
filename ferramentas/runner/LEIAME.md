# Runner próprio na Oracle (builds de graça)

Com um "runner próprio" do GitHub Actions rodando na máquina da Oracle (a mesma do servidor do jogo),
os builds do APK e do site rodam **nela**, de graça, **sem gastar a cota de minutos do GitHub**.
Isso não depende da cota voltar no fim do mês.

## Por que não estoura nenhum limite

- **GitHub:** minuto gasto só conta quando o build roda nas máquinas do GitHub. No runner próprio, conta zero.
- **Oracle, tráfego:** o Always Free dá 10 TB de saída por mês. Baixar ferramentas é entrada (grátis); cada build
  manda ~400 MB de APK para o GitHub. Mesmo com 10 builds/dia dá ~120 GB/mês (~1% do limite).
- **Oracle, máquina:** o build roda com **freios** (ver abaixo), então o servidor do jogo sempre vem na frente.
  O tipo de máquina grátis (Ampere A1) permite até 4 OCPU / 24 GB sem pagar — vale subir para 2+ OCPU / 12+ GB.

## Freios (o jogo sempre vem antes)

O serviço do runner recebe um drop-in `freios.conf`:
- `CPUWeight=20` (o jogo tem 100 → sob disputa o jogo ganha ~5x; máquina ociosa, o build usa tudo),
- `IOWeight=20`, `Nice=19`, e `MemoryMax` deixando 2 GB livres para o jogo + sistema.
O serviço do jogo (`rpg`) recebe `CPUWeight=1000`/`IOWeight=1000` para garantir prioridade. Nada é removido dele.

## O único remendo do Android em ARM

A máquina da Oracle é ARM. O Godot tem versão ARM e os modelos de export também. A **única** peça do Android
sem versão ARM é o `aapt2` (ferramenta da Google que monta o APK). O script instala `qemu-user-static` +
`binfmt-support`, que fazem o `aapt2` de PC comum rodar aqui por emulação. É uma peça pequena do build.
> Esse ponto precisa de **um build de teste** depois que o runner subir, para confirmar que o APK sai ok em ARM.

## Instalar (sem senha nenhuma)

1. **Código de registro:** no GitHub, `rcandrerc/Rpg-realista` → **Settings → Actions → Runners →
   New self-hosted runner**. Copie o valor depois de `--token` (vale 1 hora).
2. **Rodar na Oracle:** console da Oracle → a instância do servidor → **Run command** (ou "Criar comando") →
   cole o conteúdo de `instalar-runner.sh`, trocando `COLE_O_CODIGO_AQUI` pelo código do passo 1. Rode.
   (Roda sem SSH; a máquina não tem senha nem chave de acesso.)
3. O runner aparece **Idle** em Settings → Actions → Runners.
4. **Ligar o uso:** GitHub → Settings → **Secrets and variables → Actions → Variables → New variable**:
   nome `RUNNER_BUILD`, valor `aethra-build`. A partir daí `apk.yml` e `pages.yml` rodam no runner.
   Para voltar a usar as máquinas do GitHub, é só apagar essa variável.

## Depois de ligar

Builds que ficaram parados na fila (cota zerada): reenvie em Actions → a execução → **Re-run**.
O runner roda uma de cada vez; os freios garantem que o jogo não trava enquanto isso.

## Modelos prontos (quando a máquina do GitHub não roda)

Exportar os modelos (Chromium com WebGL por software) no runner ARM não dá: passou de 50 min e derrubou o
runner por falta de memória (2026-11-05). O `apk.yml` exporta numa máquina do GitHub (job `modelos`). Se ela
não roda (cota ou limite de gasto do Actions), o job `modelos-prontos` pega os modelos do ramo
**`modelos-prontos`**, feito numa máquina comum (x86):

1. Exporte os modelos do commit da main e do commit do último build que deu certo (o que o cache tem), com
   `npx vite --port 5173` em `client/` e `node client/exportar-godot/gerar-modelos.mjs`.
2. No ramo `modelos-prontos` (sem histórico da main): `commit.txt` com o SHA da main, `modelos/` só com os
   arquivos que mudaram entre os dois e `modelos/mudaram.txt` com os nomes, um por linha.

Só vale enquanto `client/`, `shared/` e `package-lock.json` não mudarem depois do `commit.txt`.

## Velocidade (medido em 2026-11-18, runner 2 OCPU / 12 GB)

- O runner faz **um build por vez**. Por isso o `apk.yml` tem o job **`pacote`** (pacote do jogo + atualização
  do app) antes do job **`apk`** (os dois APKs, ~8 min no ARM porque o `aapt2` roda emulado). O site
  (`pages.yml`, que publica o `conteudo.json` novo) entra na fila entre os dois, então a atualização chega
  sem esperar os APKs.
- O Godot 4.7 fica guardado na pasta de ferramentas do runner (`$RUNNER_TOOL_CACHE/godot/`): antes o `.env`
  apontava o Godot 4.5 e cada build baixava 1,2 GB de novo (~70 s).
- Repositório privado: push que muda `client/`, `shared/` ou o `apk.yml` não publica o site na hora (job `fila`
  do `pages.yml`); o `apk.yml` publica depois do pacote, e o job `site-reserva` publica se o pacote falhar.
- Para medir à mão no runner com o repositório público: Actions → APK do app Godot → Run workflow →
  `maquina: oracle` num ramo (fora da main não publica nada).
## Testes e robôs na Oracle (repositório privado)

Com o repositório privado, os testes e os robôs gastariam ~1.000 min por dia da cota do GitHub (robô 1 ~700,
testes de PR/merge ~200, robô 2 ~60). Por isso eles também vão para a Oracle, em vagas próprias na mesma
máquina de builds (`instalar-vagas.sh`, precisa de root uma vez):

| Workflow | Repositório privado | Público |
|---|---|---|
| testes, scripts-godot, idioma, motor-teste, cecilia-conversas | vaga `aethra-testes` (`RUNNER_TESTES`); sem ela, o runner dos builds | GitHub |
| robo, robo-celular, robo-celular-real | vaga `aethra-robo` (`RUNNER_ROBO`); sem ela, **não roda** | GitHub |
| apk.yml job `modelos` (Chromium) | GitHub (no ARM passou de 50 min e derrubou o runner) | GitHub |

Mobs, Cecília e Dário rodam no servidor do jogo (outra máquina) e não usam o GitHub Actions.

## Site montado junto com o pacote (repositório privado, 2026-11-18)

- Repositório fechado em 2026-11-18 15:07 UTC. Primeiro build todo na Oracle: 4,9 min do merge até o jogo
  (pacote 2,8 + site no runner 2,1), contra 3,1 min no GitHub com o repositório aberto.
- Agora o job `site` do `apk.yml` monta o site (npm, build, pacote do servidor) na vaga de testes **ao mesmo tempo**
  que o pacote, espera o pacote sair, junta a atualização nova e publica. Os APKs só começam depois dele: na 1ª
  versão (#648, job `publicar-site` separado) os APKs disputaram a CPU, o envio do site levou 2 min e o total foi pior. O `publicar.sh` e o
  `publicar-conteudo.sh` não chamam o `pages.yml` nesse modo (`SITE_AQUI=1`). Se o site não sair por ali, o job
  `site-reserva` chama o `pages.yml` como antes.
- Vagas abertas com `ferramentas/runner/cloudshell-vagas.sh` no Cloud Shell da Oracle (código de registro do GitHub
  na linha; o André aperta Enter). A instalação pesa na máquina e o PC na nuvem pode cair um instante; se o Bastion
  `vagastemp` sobrar, apague: `oci bastion bastion list -c "$OCI_TENANCY" --all` e `oci bastion bastion delete`.

## Vaga só da atualização e fila por job (2026-11-18)

Medindo o #649 vimos dois gargalos do repositório privado:
1. A fila da main era da execução inteira: a atualização de um merge esperava os APKs do merge anterior (~15 min).
   Agora a fila da main é por job (`pacote` um de cada vez, `apk` um de cada vez); o site sai assim que o pacote sai.
2. Uma vaga de build só: a atualização esperava a versão de Windows e APKs de teste de PR. Agora existe a vaga
   `aethra-atualizacao` (2 runners: atualizacao e atualizacao2; CPUWeight 40, Nice 0, até 4 GB cada), usada pelos jobs
   modelos-chave, modelos-prontos, pacote e site da main quando a variável `RUNNER_ATUALIZACAO=aethra-atualizacao`
   existe. São 2 porque o site espera o pacote ocupando uma vaga. Sem a variável, tudo volta como era.

Instalar (uma vez, no Cloud Shell, como as outras vagas; o repositório privado não deixa baixar pelo raw):
`TOKEN=<código> VAGAS='atualizacao atualizacao2' INSTALADOR_B64=<instalar-vagas.sh em base64> bash <(echo <cloudshell-vagas.sh em base64> | base64 -d)`

## Chave que assina o pacote do servidor (plano de lançamento, portão 10/12)

O pacote do servidor (client/dist/servidor/pacote.json) sai assinado com uma chave Ed25519 que só existe na máquina
de builds: `~runner/.aethra/assinatura-pacote.pem` (permissão 600). O primeiro job de publicação na Oracle cria a
chave sozinho e mostra a pública no log ("Pública: ..."). Ela vai em `CHAVES_ASSINATURA` (server/atualizar.js); a
partir daí o servidor só instala pacote assinado por ela. Por isso o job `publicar` do pages.yml roda sempre na vaga
da atualização (numa máquina do GitHub o pacote sairia sem assinatura e o servidor não instalaria).

Se a máquina de builds morrer: a chave nova sai sozinha no primeiro build; ponha a pública numa linha de
`chaves-assinatura.txt` ao lado do servidor.mjs na máquina do jogo (ou use a cópia reserva da chave, que vai na
cópia cifrada fora da máquina).

**Se a vaga da atualização cair** (nada publica: o job `publicar` espera a Oracle): esvazie a variável
`RUNNER_ATUALIZACAO` em Settings > Secrets and variables > Actions > Variables (repositório público). O `publicar` volta
para a máquina do GitHub. Só que lá não existe a chave, então o pacote do servidor sai sem assinatura e, depois do
passo 2, o servidor não instala: o jogo (cliente) segue atualizando e o servidor fica na versão que tem até a vaga
voltar. Esvaziar a variável não move a execução que já está na fila esperando a Oracle: cancele essa execução
(Actions > a execução presa > Cancel workflow) e rode de novo o pages.yml (Actions > Publicar no GitHub Pages > Run
workflow). Use só em emergência e devolva a variável (`aethra-atualizacao`) assim que a Oracle voltar. O robô diário
avisa quando o Pages fica parado ou quando o servidor fica atrás do último pacote.

**Depois do passo 2** (CHAVES_ASSINATURA preenchida): na Oracle, se a chave sumiu ou não é a da lista, o job cai e
nada publica (uma chave nova sozinha faria o jogo atualizar e o servidor recusar). Para criar outra de propósito: rode
o pages.yml à mão marcando "Criar de propósito uma chave nova", ponha a pública nova PRIMEIRO em chaves-assinatura.txt na
máquina do jogo (o servidor no ar só lê a lista dele), depois na lista do código, e só então publique. Antes do passo 2, marcar a caixa com a chave ainda lá TROCA a chave: a nova entra no lugar e a
velha é apagada. Depois do passo 2 a troca é recusada (o job cai e a chave fica como estava), porque o servidor no ar
recusaria tudo que a nova assinasse. Para trocar depois do passo 2: primeiro a pública nova entra em chaves-assinatura.txt
na máquina do jogo, depois na lista do código, e só então a chave da Oracle é trocada à mão.

**Como o passo 2 entra:** (0) antes, o servidor no ar precisa ser um que grava a data de TODO pacote que instala
(emitido.txt), mesmo sem exigir; o `/saude` com o campo `servidor` mostra que é. (1) Rodar o pages.yml marcando a
caixa, que troca a chave de 19/11 (f1ef4ea7, criada antes da aprovação de forks) por uma nova e mostra a pública no
log. (2) PR pondo essa pública e a reserva em CHAVES_ASSINATURA (server/atualizar.js). O servidor instala esse pacote
ainda sem exigir (lista vazia no código dele), grava a data dele e, dali em diante, só instala pacote assinado por
uma chave da lista e mais novo que ele. Sem o passo 0, o primeiro servidor que exige aceitaria de volta um pacote
mais velho da mesma chave (sem a lista) e voltaria a não exigir (revisão independente).

**Nunca "Re-run" numa execução que trocou a chave:** a nova tentativa usa o código e as opções daquela vez (lista
vazia) e trocaria de novo, apagando a chave que já está na lista. Desde 19/11 o assinar.mjs derruba o job numa nova
tentativa com a caixa marcada (GITHUB_RUN_ATTEMPT > 1): não troca nem assina. Para trocar ou publicar, Run workflow
de novo.

**Chave reserva (decisão do Presidente, 19/11):** a lista leva também uma pública RESERVA Ed25519, gerada fora da
Oracle. A privada fica só no fontes (`chaves/servidor/assinatura-reserva.pem`) e no Drive do André, nunca na Oracle,
no repositório ou no chat. Ela serve só se a máquina de builds for perdida, e só com o OK do Presidente: assina UM
pacote que põe a chave da máquina de builds nova na lista, e daí em diante tudo volta ao normal. Assinar é só
`ASSINATURA_PACOTE=<caminho da reserva> RUNNER_ENVIRONMENT=self-hosted node ferramentas/servidor/assinar.mjs pacote.json`
numa máquina de confiança, apagando a cópia local da reserva depois. Falta o caminho para PUBLICAR esse pacote: o link
de escrita do balde só existe como segredo do GitHub (ORACLE_PAR), então não dá para subir à mão. Ele vai entrar num
PR próprio (pacote assinado como arquivo de release + uma opção no pages.yml que o publica no balde e no Pages) e é
ensaiado antes de 10/12. Enquanto isso, a saída é o André pôr a pública nova em chaves-assinatura.txt na máquina do
jogo (uma linha, como root). O servidor também recusa pacote emitido antes do último que instalou
(`emitido_em`, guardado em emitido.txt), então um pacote antigo reenviado não volta.

Isolamento da chave: todas as vagas rodam com o mesmo usuário `runner`. Por isso só código de colaboradores pode
rodar nelas: PR de fork precisa de aprovação para todo mundo de fora (Settings > Actions > "Require approval for all
external contributors"), e o passo 2 só entra depois disso.

**Falha na assinatura com a chave existindo** (arquivo estragado ou sem permissão): o job cai de propósito e nada
publica. Cliente e servidor ficam juntos na versão anterior e o job vermelho aparece na ronda das 9h.
