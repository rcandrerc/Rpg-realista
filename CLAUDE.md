# Regras do rpg-realista

- Respostas e textos do jogo em português do Brasil.
- Conteúdo novo (arma, habilidade, inimigo, mapa) entra em `shared/dados.js`. Regra de combate entra em `shared/simulacao.js`, nunca só no cliente: o servidor é quem decide.
- Não existe classe: o estilo muda pela arma equipada.
- Humanos (NPCs, bandidos, chefes) usam o mesmo corpo do herói com outra cor, tamanho e equipamento. Monstros precisam de modelo próprio.
- Os avatares VRoid AvatarSample A, B e C nunca entram no jogo (licença não permite uso comercial).
- Asset novo vem do repositório New-Game-Anime-fontes e precisa ser livre para uso comercial. Atualize a tabela de assets do README.
- O herói pode ser VRoid (anime, padrão) ou o soldado realista; NPCs e bandidos usam o soldado. Lista em `PERSONAGENS` (`shared/dados.js`).
- O soldado (heroi_provisorio.glb) tem esqueleto Z-para-cima; as animações do Mixamo são Y-para-cima. Nos VRM, as animações são convertidas usando a pose de descanso gravada em `anims.json.gz` (`_rest`). Tudo isso fica em `client/src/personagens.js`.
- Visual caprichado desde o começo: texturas reais, luz e sombra. Nada com cara de protótipo.
- Teste no celular: mire em 30 quadros por segundo.

## Nada some (regra do André, 2026-11-02)

- Atualização nunca sobrepõe nem apaga recurso anterior. Remoção ou troca só quando o André pede, ou quando uma thread sugere a remoção para a próxima atualização e o André diz sim. Nunca remova por conta própria.
- Antes de abrir ou mesclar PR: junte a main mais nova no ramo (ou rebase) e, nos conflitos, mantenha os dois lados. Nunca resolva conflito pegando um lado inteiro.
- Não há trava no CI (o André tirou a "Nada some" em 2026-11-04). A regra é simples: todo PR novo, antes do merge, busca a main mais nova, junta no ramo e se adequa a ela, mantendo o trabalho dos outros (o irmão do André também mexe). Nunca sobreponha o que já está na main. Os scripts antigos em `ferramentas/protecao/` podem ser rodados à mão.
- APK para o André só sai de um ramo com a main mais nova: rode `ferramentas/protecao/antes-do-apk.sh` antes. APK feito de ramo velho apaga o que entrou depois.
- Recurso que o André aprovou num APK de teste precisa virar PR mesclado na main; senão o próximo APK vem sem ele.

## Antes de todo merge (André, 2026-11-07)

Dois merges já apagaram coisa sem querer: a regra Quimera no #123 (chave repetida em `COMBATE_INIMIGO`) e o esconder capacete no servidor no #225. Por isso, em todo PR, antes do merge:

1. Busque a main mais nova (`git fetch origin main`) e junte no ramo. Nos conflitos, mantenha os dois lados.
2. Nunca apague nada que já existe (função, chave de dados, mensagem do servidor, opção, botão). Só com a etiqueta "remoção aprovada" no PR, citando o pedido do André.
3. Depois de resolver conflito, procure chave repetida nos objetos e dicionários (`shared/dados.js`, `.gd`, `.json`). Em JS a última chave ganha calada; junte numa só.
4. Rode à mão `node ferramentas/protecao/nada-some.mjs` (lista o que o ramo apaga em relação à main) e `node ferramentas/protecao/conferir.mjs`. Se algo sumiu sem pedido, traga de volta antes do merge.
5. Sem trava no GitHub: a conferência é feita por quem abre o PR (pedido do André).
