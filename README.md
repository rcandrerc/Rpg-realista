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
| Montar no lobo / descer (teste; golpe, dash ou rolar também desce) | botão redondo do lobo, embaixo | M |
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
| Fonte da HUD, menus e números de dano do app Godot (Alegreya Sans Medium e Bold, `godot-prototipo/fontes/`) | google/fonts (ofl/alegreyasans), guardada em New-Game-Anime-fontes `fontes_texto/alegreya-sans/` | SIL Open Font License 1.1 (uso comercial livre; `OFL.txt` junto) |
| Heróis anime (Ruiva e 7 amostras VRoid), os NPCs da vila (Fumiriya, Amostra M, Shino e Vivi, com cabelo e roupa repintados no código) | VRoid Hub (Ruiva, de 水銀メイド, ©2026MercuryMaid, licença VRM 1.0 com uso comercial; crédito não obrigatório) e amostras VRoid CC0, repositório New-Game-Anime-fontes | VRM 1.0 / CC0 |
| Monstros inimigos Puglin e Imp (versão grátis do Bestiary - Dungeon Monsters Kit), com contorno e cores 25% menos saturadas no código | Quaternius (quaternius.itch.io), repositório New-Game-Anime-fontes (pacotes_livres/) | Quaternius Asset License: uso comercial no jogo liberado, sem crédito; não pode repassar os arquivos soltos |
| Animações dos monstros (parado, andar, correr, garra, soco, dano, morte) | Universal Animation Library 1 e 2 da Quaternius, convertidas para o esqueleto deles (client/converter-bestiario.html) | CC0 |
| Corrida do lobo (galope, godot: `corrida`; pedido do André 2026-11-05): animação Gallop do cavalo passada para o esqueleto do lobo (ferramentas/monstros-ia/galope/) | Cavalo do pack Ultimate Animated Animals (Quaternius), o mesmo da montaria do Quimera (px/cavalo_n.glb do repositório Quimera_Sandbox) | CC0 |
| Soldado realista (opção do herói e NPCs) | Mixamo, via exemplos do Three.js | Mixamo |
| Monstros Warrok (chefe), Maw e Golem de Magma (Pumpkinhulk repintado), no visual meio-termo com shader de 3 faixas, contorno e olhos acesos (`client/converter-mixamo.html`) | Mixamo (baixados pelo André), repositório New-Game-Anime-fontes (mixamo/personagens) | Mixamo (uso no jogo liberado, inclusive comercial; os .fbx soltos não podem ser publicados) |
| Animações dos monstros do Mixamo (Warrok, Maw e golem): 5 golpes (Zombie Overhead Two-Hand Attack, Mutant Jump Attack, Mutant Attacking With Left Hand, Zombie Attack With Right Hand, Quick Left Handed Punch), parado, andar, correr, apanhar, morrer e rugido, em `client/public/assets/monstros/mixamo/golpes.json.gz` (`client/converter-golpes-mixamo.html`) | Mixamo (baixadas pelo André com o favorito), repositório New-Game-Anime-fontes (mixamo/animacoes_monstros) | Mixamo (uso no jogo liberado) |
| Animações de combate e movimento (combo de espada, estocada, cortes, magias, pulo, mortal, pouso, freada Run To Stop, meia-volta Running Turn 180, trote Jogging, andar e correr de lado e de costas e a guarda parada do cajado Standing Idle 03, do Pro Magic Pack) e as 14 de escalada (subir pedra, parede, escada, correr na parede, ficar pendurado) | Mixamo, repositório New-Game-Anime-fontes | Mixamo (uso no jogo liberado) |
| Efeitos de magia (círculo com pentagrama, fogo, fumaça, rastros) | desenhados no código, receita do jogo de hábitos (New-Game-Anime) | próprio |
| Texturas das magias novas do cajado (godot-prototipo/efeitos/magia_atlas.png: brilho, faísca, chama, fumaça, runa, giro, chão queimado, terra, estrela). O fogo pintado, as pontas de gelo e o portal do Meteoro são montados em código (godot-prototipo/magias.gd) | Kenney Particle Pack, repositório New-Game-Anime-fontes (pacotes_cc0/kenney_particle-pack) | CC0 |
| Animações das magias novas: Faísca alternando as mãos (Magic Attack Direct 1H direita e esquerda) | Kevin Iglesias, Spellcasting Animations FREE, repositório New-Game-Anime-fontes (pacotes_livres/kevin_iglesias_spellcasting_free, licença junto) | uso comercial no jogo liberado (licença do pacote grátis) |
| Animações das magias novas: Bola de Fogo (Standing 2H Magic Attack 01), Nova de Gelo (2H Magic Area Attack 01) e Meteoro (2H Cast Spell 01) | Mixamo (Magic Pack), repositório New-Game-Anime-fontes (mixamo/pacotes_magia) | Mixamo (uso no jogo liberado) |
| Céu, chão, pedras, samambaias, caixotes, mesa, baldes, tocos, as rochas escaláveis (Namaqualand Boulder 04) e a madeira da escada (weathered_brown_planks); pedras, samambaia, toco e rocha em versões leves (polyhaven/derivados) | Poly Haven, repositório New-Game-Anime-fontes | CC0 |
| Vila: texturas das casas (palha, reboco, enxaimel, pedra, portas, venezianas), casca e folhas das árvores, caminho de terra e calçamento da praça. As casas, a ferraria, o poço e as árvores são montados em código (client/src/vila.js) | Poly Haven, repositório New-Game-Anime-fontes | CC0 |
| Espada (o brilho mágico é feito no código) | Fantasy Props MegaKit (Quaternius) | CC0 |
| Espada A e Cajado A do herói no app Godot (godot-prototipo/armas3d/: aço com riscos de forja e runa azul, guarda dourada alada; cajado de madeira escura com garras douradas e cristal de fogo). A espada antiga continua nos inimigos humanos | modelados no Blender por ferramentas/armas/modelar.py, texturas pintadas por ferramentas/armas/texturas.py | próprio |
| Picareta e machado das profissões (godot-prototipo/ferramentas3d/, texturas reduzidas para 512 px) | Fantasy Props MegaKit (Quaternius), repositório New-Game-Anime-fontes (pacotes_cc0/) | CC0 |
| Terras da Estrada (construção): bancada de trabalho (Workbench), bigorna no toco (Anvil_Log) e cerca de madeira (Prop_WoodenFence_Single) que o jogador constrói no terreno dele (godot-prototipo/construcao3d/, cor em 1024 px, relevo e ORM em 512 px). A fornalha é montada no código com a pedra da vila (stacked_stone_wall). Os ícones da barra de construção (godot-prototipo/icones/cs_*.svg, terreno.svg e correio.svg) foram desenhados aqui; a caixa de correio do terreno é montada no código com a madeira da vila | Fantasy Props MegaKit e Medieval Village MegaKit (Quaternius), repositório New-Game-Anime-fontes (pacotes_cc0/) | CC0 |
| Casa das Terras da Estrada (pedido do André, 2026-11-04): parede de reboco com viga (Wall_Plaster_Straight), parede com porta (Wall_Plaster_Door_Flat + Door_1_Flat), parede com janela (Wall_Plaster_Window_Wide_Flat + Window_Wide_Flat1), assoalho da fundação (Floor_WoodDark), baú (Chest_Wood) e cama (Bed_Twin1), com as texturas T_Plaster, T_Brick, T_RockTrim, T_WoodTrim, T_Trim_Furniture, T_Trim_Metal, T_Trim_Cloth e a telha T_RoundTiles do telhado (godot-prototipo/construcao3d/, cor em 1024 px, relevo e ORM em 512 px). O telhado, a fundação de pedra e a tocha são montados no código; os ícones cs_fundacao, cs_parede, cs_porta, cs_janela, cs_telhado, cs_bau, cs_cama, cs_tocha e cs_enxada foram desenhados aqui | Medieval Village MegaKit e Fantasy Props MegaKit (Quaternius), repositório New-Game-Anime-fontes (pacotes_cc0/) | CC0 |
| Cenário da mata (godot-prototipo/cenario3d/): pedras, árvore morta, cogumelos, orelha-de-pau, arbustos, samambaia e planta | Stylized Nature MegaKit (Quaternius), repositório New-Game-Anime-fontes (pacotes_cc0/) | CC0 |
| Ruínas da mata (godot-prototipo/cenario3d/): paredes de tijolo velho com arco, pilares, piso, escada, tijolos soltos, hera e a carroça largada (reboco e vigas de madeira trocados por pedra) | Medieval Village MegaKit (Quaternius), repositório New-Game-Anime-fontes (pacotes_cc0/) | CC0 |
| Tronco caído, estátua velha, fogueira de pedra e toco da mata (godot-prototipo/cenario3d/, malhas simplificadas e texturas pintadas pela paleta do jogo; montados por ferramentas/cenario/preparar.mjs) | Poly Haven (dead_tree_trunk_02, gothic_statue, stone_fire_pit, tree_stump_02), repositório New-Game-Anime-fontes | CC0 |
| Espantalho de treino ao lado da ferraria (godot-prototipo/treino3d/, modelo Dummy; cor em 1024 px, relevo e ORM em 512 px; saco, poste e corda repintados em estopa, madeira escura e corda clara) | Fantasy Props MegaKit (Quaternius), repositório New-Game-Anime-fontes (pacotes_cc0/Fantasy_Props_MegaKit) | CC0 |
| Ícones de materiais e profissões (godot-prototipo/icones/it_*.svg, pf_*.svg, vigor.svg) | Desenhados para o jogo | Próprios |
| Cajado mágico (madeira, anéis de bronze e cristal) | feito no código, com a textura medieval_wood da Poly Haven | CC0 / próprio |
| Lobo (montaria de teste): modelo, esqueleto (rabo de 5 ossos), mechas de pelo do rabo e 6 animações | gerado por IA (desenho FLUX.1-schnell, Apache 2.0; 3D TRELLIS, MIT) e montado no Blender por ferramentas/monstros-ia | próprio (saída das IAs sem restrição de uso comercial) |
| Texturas pintadas do estilo anime (client/public/assets/cenario/pintado/): as mesmas texturas da Poly Haven repintadas pela paleta do jogo | geradas por ferramentas/pintar-texturas/pintar.py a partir das texturas CC0 acima | CC0 / próprio |
| Montanha e lagos (2026-11-05): pedra da montanha (rocky_terrain_02) e lama do fundo do lago (brown_mud_leaves_01), pintadas pela paleta do jogo (godot-prototipo/relevo/, originais em client/public/assets/cenario/relevo/). O relevo da montanha e a água são gerados em código (shared/relevo.js, godot-prototipo/relevo.gd) | Poly Haven, repositório New-Game-Anime-fontes (polyhaven/texturas) | CC0 |
| Sons do app Godot (godot-prototipo/sons/): passos na grama, impactos, corte, pano, moedas, sacar a espada, picareta, machado e bigorna | Kenney (Impact Sounds e RPG Audio), repositório New-Game-Anime-fontes (pacotes_cc0/) | CC0 |
| Sons da árvore caindo (godot-prototipo/sons/arvore_range, arvore_estalo, arvore_queda): rangido do tronco, galhos quebrando e baque no chão, montados com ffmpeg (mais grave, emendados) | Kenney RPG Audio (creak1-3, chop) e Impact Sounds (impactWood_light, impactWood_heavy), repositório New-Game-Anime-fontes (pacotes_cc0/) | CC0 |
| Sons do app Godot: vento do golpe, dash, magia, tiro, explosão, cura, subir de nível, queda do monstro, batida do coração (vida baixa) e queda do herói | gerados por ferramentas/sons/gerar.py | CC0 / próprio |
| Sons das skills no app Godot (godot-prototipo/sons/q_*.ogg): carga das magias, Bola de Fogo, Faísca, Anel de Chamas, Meteoro (queda e impacto), Nova de Gelo, Raio em Cadeia, Salto Arcano, Cura, Escudo, Vórtice, golpe | Quimera (sons/magias.bin do Quimera_Sandbox), cópia em New-Game-Anime-fontes (sons/quimera/); gravações do freesound.org e opengameart.org listadas em godot-prototipo/sons/LICENCAS.md | CC0 |
| Capa do Aethra no fundo da tela de login do app Godot (godot-prototipo/ui/capa_aethra.jpg) | gerada por IA (AlbedoBase XL, SDXL, pela rede grátis AI Horde) e retocada; título com a fonte Cinzel Decorative (Google Fonts). Arquivos e scripts em /mnt/project-files/aethra-arte/ | próprio (licença CreativeML Open RAIL++-M libera uso comercial da imagem gerada); fonte SIL OFL |
| Ícone do app Android "Aethra" (godot-prototipo/icone_app/: fundo, frente, monocromático e 192 px) | desenhado por código próprio (ferramentas/icone/icone.py: A artístico (Cinzel Decorative) com a perna fina virando o Cajado A e a barra virando a Espada A, no anel dourado da capa; a opção B usa a fonte Cinzel Decorative, Google Fonts) | próprio; fonte SIL OFL |
| Ícones pintados dos itens da mochila (godot-prototipo/icones/itens/: capacete, peitoral, calça e botas em couro e em aço, short, capa, óculos, colar, espada, cajado, poções, tomo, ouro) | gerados por IA (AlbedoBase XL, SDXL, pela rede grátis AI Horde), fundo removido com rembg (isnet, MIT). Originais em /mnt/project-files/armaduras/icones/ | próprio (CreativeML Open RAIL++-M libera uso comercial da imagem gerada) |
| Ícones pintados de construção, materiais, horta e profissões (2026-11-06, pedido do André: padronizar com os itens): godot-prototipo/icones/itens/ (minérios, barras, pedra, carvão, cristal, lenha, couro, tecido, fragmento, passe da caverna, colheitas, sementes, enxada, regador) e godot-prototipo/icones/pintados/ (cs_*, construir, lote, correio, pf_*). Os .svg de traço continuam no repositório como reserva | gerados por IA (AlbedoBase XL, SDXL, pela rede grátis AI Horde), fundo removido com rembg (isnet e u2net, MIT). Originais e roteiros em /mnt/project-files/icones-pintados/ | próprio (CreativeML Open RAIL++-M libera uso comercial da imagem gerada) |
| Armadura que aparece no corpo (capacete aberto com protetor de bochecha, peitoral com gola, ombreiras e braçadeiras, calça ou short com saiote, botas com joelheira, capa) | feitas em código a partir da malha do próprio VRoid (godot-prototipo/armadura.gd, armadura.gdshader, capa.gdshader) | próprio |

As animações ficam juntas em `client/public/assets/personagens/anims.json.gz` (63 animações, 1,5 MB; o trote Jogging entrou em 2026-11-03; andar e correr de lado e de costas do mago e a guarda do cajado, em 2026-11-04; 14 delas de escalada e 5 das magias novas do cajado). O mesmo arquivo serve para o soldado e para os personagens VRoid: `client/src/personagens.js` converte do esqueleto do Mixamo para o do VRM na hora.

O jogador escolhe o herói no botão **Personagem** (fica guardado no aparelho). Os avatares VRoid AvatarSample A, B e C não entram no jogo. Para trocar ou adicionar, veja `ferramentas/assar-animacoes`.
