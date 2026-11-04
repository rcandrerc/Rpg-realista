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
