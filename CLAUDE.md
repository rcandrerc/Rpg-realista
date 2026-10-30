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
