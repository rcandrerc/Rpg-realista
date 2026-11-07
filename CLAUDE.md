# Regras do rpg-realista

- Respostas e textos do jogo em português do Brasil.
- Conteúdo novo (arma, habilidade, inimigo, mapa) entra em `shared/dados.js`. Regra de combate entra em `shared/simulacao.js`, nunca só no cliente: o servidor é quem decide.
- Não existe classe: o estilo muda pela arma equipada.
- Humanos (NPCs, bandidos, chefes) usam o mesmo corpo do herói com outra cor, tamanho e equipamento. Monstros precisam de modelo próprio.
- Os avatares VRoid AvatarSample A, B e C nunca entram no jogo (licença não permite uso comercial).
- Asset novo vem do repositório New-Game-Anime-fontes e precisa ser livre para uso comercial. Atualize a tabela de assets do README.
- O herói é anime (VRoid, padrão "Ruiva"); NPCs e bandidos usam o corpo do herói com roupa medieval. Lista em `PERSONAGENS` (`shared/dados.js`).
- Só no jogo HTML (reserva): o soldado tem esqueleto Z-para-cima e o Mixamo Y-para-cima; nos VRM as animações usam a pose `_rest` de `anims.json.gz`. Tudo em `client/src/personagens.js`.
- Visual caprichado desde o começo: texturas reais, luz e sombra. Nada com cara de protótipo.
- Teste no celular: mire em 30 quadros por segundo.

## Nada some (regras do André, 2026-11-02 e 2026-11-07)

Atualização nunca apaga nem sobrepõe recurso anterior. Remoção ou troca só quando o André pede, ou quando uma thread sugere e ele diz sim; aí o PR leva a etiqueta "remoção aprovada" citando o pedido. Dois merges já apagaram coisa sem querer (regra Quimera no #123 por chave repetida em `COMBATE_INIMIGO`; capacete escondido no servidor no #225). Em todo PR, antes do merge:

1. Busque a main mais nova (`git fetch origin main`) e junte no ramo. O irmão do André também mexe: nunca sobreponha o que já está na main.
2. Nos conflitos, mantenha os dois lados. Nunca resolva pegando um lado inteiro.
3. Depois do conflito, procure chave repetida nos objetos e dicionários (`shared/dados.js`, `.gd`, `.json`). Em JS a última chave ganha calada; junte numa só.
4. Rode à mão `node ferramentas/protecao/nada-some.mjs` (o que o ramo apaga em relação à main) e `node ferramentas/protecao/conferir.mjs`. Se algo sumiu sem pedido, traga de volta.
5. Sem trava no GitHub (pedido do André): quem abre o PR faz a conferência.

APK:
- APK para o André só sai de ramo com a main mais nova: rode antes `ferramentas/protecao/antes-do-apk.sh`. APK de ramo velho apaga o que entrou depois.
- Recurso que o André aprovou num APK de teste precisa virar merge na main; senão o próximo APK vem sem ele.
