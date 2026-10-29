# RPG Realista

RPG de ação em terceira pessoa, com visual realista, jogado no navegador (celular e PC), multiplayer desde o começo.

Não existe classe: o personagem é um só e o estilo muda com a arma (espada = guerreiro, cajado = mago, arco = arqueiro).

## Como rodar

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install
npm run dev
```

Abra `http://localhost:5173` em duas abas (ou no celular, pelo IP do computador na mesma rede, por exemplo `http://192.168.0.10:5173`). Cada aba é um jogador. Para dar nome ao jogador: `http://localhost:5173/?nome=André`.

Sem o servidor ligado, o jogo entra sozinho no **modo solo**, com as mesmas regras rodando no aparelho.

Para publicar (Oracle Cloud ou Render): `npm run build` e depois `npm start`. O servidor entrega o jogo e o multiplayer na mesma porta (variável `PORT`, padrão 2567).

## Controles

| Ação | Celular | PC |
| --- | --- | --- |
| Andar / correr | joystick (até o fim corre) | WASD, Shift corre |
| Golpe e habilidades | botões à direita | J, K, L, I |
| Rolar | botão Rolar | Espaço |
| Trocar de arma | botões no alto | 1, 2, 3 ou Tab |
| Câmera | arrastar a tela | arrastar, roda do mouse |

## Como o código é organizado

```
shared/    regras e dados, iguais para cliente e servidor
  dados.js       armas, habilidades, inimigos, mapa (mexa aqui para criar conteúdo)
  simulacao.js   combate, movimento, inimigos (sem gráficos)
server/    Node.js + Colyseus: roda a simulação 20x por segundo e manda o mundo para todos
client/    Three.js: desenha o que a simulação manda
  src/cena.js         céu, chão, grama, objetos do mapa
  src/personagens.js  corpos 3D, animações, armas na mão
  src/efeitos.js      projéteis, fogo, anéis, chuva de flechas
  src/hud.js          barras, botões, nomes, números de dano
  src/controles.js    joystick, teclado, câmera
  src/rede.js         conexão com o servidor (e modo solo)
  public/assets/      modelos, texturas, céu e animações
ferramentas/assar-animacoes/  converte os .fbx do Mixamo em um arquivo pequeno para o jogo
```

O servidor é quem decide: recarga, mana, dano e posição. O cliente só manda o que o jogador apertou.

## De onde vêm os assets

| O que | Origem | Licença |
| --- | --- | --- |
| Herói provisório (soldado) e animações de andar/correr | Mixamo, via exemplos do Three.js | Mixamo |
| Animações de combate | Mixamo, repositório New-Game-Anime-fontes | Mixamo (uso no jogo liberado) |
| Céu, chão, pedras, samambaias, caixotes | Poly Haven | CC0 |
| Espada e escudo | Fantasy Props MegaKit (Quaternius) | CC0 |

As animações ficam juntas em `client/public/assets/personagens/anims.json.gz` (16 animações, 450 KB). Para trocar ou adicionar, veja `ferramentas/assar-animacoes`.
