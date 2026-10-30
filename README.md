# RPG Realista

RPG de ação em terceira pessoa, com visual realista, jogado no navegador (celular e PC), multiplayer desde o começo.

Não existe classe: o herói usa uma espada mágica que corta e solta magia, e o jogador monta a build escolhendo as habilidades dos botões (botão **Habilidades**).

## Como rodar

Precisa do [Node.js](https://nodejs.org) 22 ou mais novo.

```bash
npm install
npm run dev
```

Abra `http://localhost:5173` em duas abas (ou no celular, pelo IP do computador na mesma rede, por exemplo `http://192.168.0.10:5173`). Cada aba é um jogador. Para dar nome ao jogador: `http://localhost:5173/?nome=André`.

Sem o servidor ligado, o jogo entra sozinho no **modo solo**, com as mesmas regras rodando no aparelho.

Para publicar (Oracle Cloud ou Render): `npm run build` e depois `npm start`. O servidor entrega o jogo e o multiplayer na mesma porta (variável `PORT`, padrão 2567).

### GitHub Pages (só o jogo, modo solo)

A cada push na `main`, o GitHub publica o jogo em `https://rcandrerc.github.io/Rpg-realista/`. Para ligar: **Settings → Pages → Source: GitHub Actions** (uma vez só). O Pages não roda servidor, então lá o jogo abre no modo solo. Quando o servidor estiver no ar, coloque o endereço dele em `SERVIDOR_PARA_PAGES` (`client/src/rede.js`) ou abra com `?servidor=wss://endereco-do-servidor`.

Atenção: mesmo com o repositório privado, o site do Pages é público. Qualquer pessoa com o link joga e consegue baixar os arquivos do jogo.

### Testar no celular pelo Render (grátis)

1. Entre em [render.com](https://render.com) com a conta do GitHub.
2. **New → Blueprint**, escolha o repositório `rpg-realista` (o arquivo `render.yaml` já configura tudo).
3. Espere o primeiro build (uns 5 minutos) e abra o endereço `https://rpg-realista-xxxx.onrender.com` no celular.

No plano grátis o servidor dorme depois de 15 minutos parado; a primeira visita depois disso demora cerca de 1 minuto para acordar.

### Conta (login só com Google)

As contas ficam no próprio servidor, num arquivo SQLite em `dados/contas.db` (na Oracle: `/opt/rpg/dados`), sem Firebase. O servidor faz uma cópia por dia em `dados/copias/` e guarda as últimas 14. Precisa do Node 22 (usa o `node:sqlite`).

O login só liga quando `GOOGLE_CLIENT_ID` (`shared/conta.js`) tem o ID do cliente OAuth. Vazio, o jogo funciona como antes, sem conta. O passo a passo para criar o ID no Google Cloud está em `ferramentas/servidor/LEIAME.md`.

Cada conta guarda o nome (vem do Google), o personagem e a build. A mesma conta em dois aparelhos: o mais antigo sai.

## Controles

| Ação | Celular | PC |
| --- | --- | --- |
| Andar / correr | joystick: aparece onde o dedo encosta na metade esquerda (até o fim corre) | WASD, Shift corre |
| Golpe (ou Disparo no modo magia; segurar repete), 4 habilidades, Trocar espada/magia e Cura | botões à direita | J; K, L, I, U; R; H |
| Pular (no ar, de novo: mortal) | botão Pular | Espaço |
| Dash | botão Dash | E |
| Rolar no chão | botão Rolar | Q |
| Escalar (pedra baixa sobe sozinho; rocha alta: andar contra ela agarra, frente sobe, trás desce, lados andam pela parede; Pular solta; Dash ou correr contra ela corre pela parede) | joystick | WASD |
| Falar com NPC (cura, missão, habilidades, dicas) | botão Falar em cima dele, quando perto | F |
| Criar o personagem (corpo, cores de cabelo, olhos, pele, roupa e altura) | botão Personagem (abre sozinho na primeira vez) | botão Personagem |
| Escolher habilidades | botão Habilidades | botão Habilidades |
| Câmera (girar, olhar para cima e para baixo, zoom) | arrastar a tela; dois dedos para o zoom | arrastar, roda do mouse |

## Como o código é organizado

```
shared/    regras e dados, iguais para cliente e servidor
  dados.js       armas, habilidades, inimigos, mapa (mexa aqui para criar conteúdo)
  simulacao.js   combate, movimento, inimigos (sem gráficos)
server/    Node.js + Colyseus: roda a simulação 20x por segundo e manda o mundo para todos
  contas.js      contas (Google) e sessões, em SQLite
client/    Three.js: desenha o que a simulação manda
  src/cena.js         céu, chão, grama, objetos do mapa
  src/personagens.js  corpos 3D, animações, armas na mão
  src/efeitos.js      projéteis, fogo, anéis, chuva de flechas
  src/hud.js          barras, botões, nomes, números de dano
  src/controles.js    joystick, teclado, câmera
  src/rede.js         conexão com o servidor (e modo solo)
  src/conta.js        tela "Entrar com Google" e sessão guardada no aparelho
  public/assets/      modelos, texturas, céu e animações
ferramentas/assar-animacoes/  converte os .fbx do Mixamo em um arquivo pequeno para o jogo
```

O servidor é quem decide: recarga, mana, dano e posição. O cliente só manda o que o jogador apertou.

## De onde vêm os assets

| O que | Origem | Licença |
| --- | --- | --- |
| Heróis anime (Ruiva e 7 amostras VRoid), os NPCs da vila (Fumiriya, Amostra M, Shino e Vivi, com cabelo e roupa repintados no código) e a horda Bando Sombrio (Amostra M e Fumiriya, cada um com cores e tamanho próprios) | VRoid Hub (Ruiva, de 水銀メイド, ©2026MercuryMaid, licença VRM 1.0 com uso comercial; crédito não obrigatório) e amostras VRoid CC0, repositório New-Game-Anime-fontes | VRM 1.0 / CC0 |
| Soldado realista (opção do herói e NPCs) | Mixamo, via exemplos do Three.js | Mixamo |
| Animações de combate e movimento (combo de espada, estocada, cortes, magias, pulo, mortal, pouso) e as 14 de escalada (subir pedra, parede, escada, correr na parede, ficar pendurado) | Mixamo, repositório New-Game-Anime-fontes | Mixamo (uso no jogo liberado) |
| Efeitos de magia (círculo com pentagrama, fogo, fumaça, rastros) | desenhados no código, receita do jogo de hábitos (New-Game-Anime) | próprio |
| Céu, chão, pedras, samambaias, caixotes, mesa, baldes, tocos, as rochas escaláveis (Namaqualand Boulder 04) e a madeira da escada (weathered_brown_planks); pedras, samambaia, toco e rocha em versões leves (polyhaven/derivados) | Poly Haven, repositório New-Game-Anime-fontes | CC0 |
| Vila: texturas das casas (palha, reboco, enxaimel, pedra, portas, venezianas), casca e folhas das árvores, caminho de terra e calçamento da praça. As casas, a ferraria, o poço e as árvores são montados em código (client/src/vila.js) | Poly Haven, repositório New-Game-Anime-fontes | CC0 |
| Espada (o brilho mágico é feito no código) | Fantasy Props MegaKit (Quaternius) | CC0 |
| Cajado mágico (madeira, anéis de bronze e cristal) | feito no código, com a textura medieval_wood da Poly Haven | CC0 / próprio |
| Texturas pintadas do estilo anime (client/public/assets/cenario/pintado/): as mesmas texturas da Poly Haven repintadas pela paleta do jogo | geradas por ferramentas/pintar-texturas/pintar.py a partir das texturas CC0 acima | CC0 / próprio |

As animações ficam juntas em `client/public/assets/personagens/anims.json.gz` (47 animações, 1,2 MB; 14 delas de escalada). O mesmo arquivo serve para o soldado e para os personagens VRoid: `client/src/personagens.js` converte do esqueleto do Mixamo para o do VRM na hora.

O jogador escolhe o herói no botão **Personagem** (fica guardado no aparelho). Os avatares VRoid AvatarSample A, B e C não entram no jogo. Para trocar ou adicionar, veja `ferramentas/assar-animacoes`.
