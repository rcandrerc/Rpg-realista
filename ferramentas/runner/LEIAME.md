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
