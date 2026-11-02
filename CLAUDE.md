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

- Atualização nunca sobrepõe nem apaga recurso anterior, a não ser que o André peça.
- Antes de abrir ou mesclar PR: junte a main mais nova no ramo (ou rebase) e, nos conflitos, mantenha os dois lados. Nunca resolva conflito pegando um lado inteiro.
- Recurso novo entra em `ferramentas/protecao/recursos.json` no mesmo PR. O CI "Nada some" falha se o ramo está atrás da main ou se algum trecho da lista sumiu.
- APK para o André só sai de um ramo com a main mais nova: rode `ferramentas/protecao/antes-do-apk.sh` antes. APK feito de ramo velho apaga o que entrou depois.
- Recurso que o André aprovou num APK de teste precisa virar PR mesclado na main; senão o próximo APK vem sem ele.
