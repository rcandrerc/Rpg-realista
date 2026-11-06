# Protótipo Godot

Mesma vila e personagens anime do jogo HTML, para comparar FPS no celular (botão **Teste**).

O APK sai sozinho pelo GitHub Actions: veja `ferramentas/apk/LEIAME.md` (link para baixar no celular).

O app se atualiza sozinho ao abrir (tela `inicio.tscn`, baixa só o que mudou desde o APK): veja `ferramentas/atualizacao/LEIAME.md`.

Para montar à mão:

1. `node client/exportar-godot/gerar-modelos.mjs` (com o vite rodando em `client/` e o pacote playwright) faz o passo abaixo
   sozinho e já copia tudo para `godot-prototipo/modelos/`. Ou, no navegador, `client/exportar-godot/`: com `npx vite` rodando em `client/`, abrir `/exportar-godot/index.html` num Chromium
   (o `anims.json.gz` precisa ser servido sem Content-Encoding). Gera `vila.glb` e um GLB por personagem com
   `parada`, `andar` e `corrida` já gravados nos ossos do VRM. Copiar para `godot-prototipo/modelos/`
   junto com `client/public/assets/ceu/kloofendal_48d_partly_cloudy_puresky_1k.hdr` como `ceu.hdr`.
2. Godot 4.5: `godot --headless --import` e depois `godot --headless --export-release Android saida.apk`
   (keystore de release e caminho do Android SDK nas configurações do editor, fora do repositório).

## Sensação de jogo (onde ajustar)

- Movimento (inércia, giro, coyote time, velocidade pelo joystick): constantes no começo de `passo()` em `andar.gd`.
- Animação (mistura parada/andar/corrida, ação só no tronco): `anim_heroi.gd`. Inclinar na curva e afundar no pouso: `inclinar.gd`.
- Câmera (mola, seguir por trás, campo de visão, tremida): constantes em `camera_heroi.gd`.
- Golpe (congelada, tremida, fila de botões): constantes `FILA_TEMPO`, `HITSTOP`, `TREME` em `main.gd`.
- Sons: `sons.gd` toca os arquivos de `sons/` (gerados por `ferramentas/sons/gerar.py`). Raio do joystick: `JOY_RAIO` em `hud.gd`.

## Criador de personagem

- `criador.gd`: abre sozinho na conta nova (com nome) e pelo botão **Aparência** do menu do personagem (sem nome).
  A base é sempre a Ruiva; muda cor do cabelo, olhos, pele, roupa e calça, altura e tamanho dos olhos, nariz e boca.
  As listas de cores e os limites vêm de `CRIADOR` (`shared/dados.js`, copiado para `dados/habilidades.json`).
- `aparencia.gd`: pinta cada personagem pela cópia dele (shader toon com troca de cor) e mexe nos blend shapes
  `olhosT`, `narizT`, `bocaT`, que o `client/exportar-godot/exportar.js` grava no GLB da Ruiva.
- Online: conta nova manda `aparencia` (ao vivo) e `pronto`; depois, o botão Aparência manda `mudarAparencia`.
- Corpo (pedido do André, 2026-11-03): no alto do painel, rostos redondos sem nome dos corpos de `CRIADOR.corpos`
  (a Ruiva, os masculinos e os outros VRoid do jogo). O `exportar.js` grava todas as animações do herói e o formato do
  rosto em cada um deles. Online: `visual` (ao vivo na conta nova), `pronto` com o corpo, e `mudarVisual` depois;
  o servidor grava na coluna `visual` da conta e os outros jogadores veem o corpo certo (`online.gd`, `outro`).

## Interação com os NPCs

- `conversa.gd`: perto de um NPC aparece o botão **Falar** (balão); tocar rápido num NPC na tela faz o herói ir até ele.
  Os dois abrem a janela do NPC com o nome, a fala e o que dá para fazer (vender itens, comprar, forja, alfaiate,
  habilidades, missão, cura, resetar a build e Conversar). O que cada NPC oferece está em `acoes` de cada NPC em
  `shared/dados.js`. Vender com o Tomás ou com a Rosa: o servidor confere (`Simulacao.pertoDeQuemCompra`).

## Terras da Estrada: construção e fazenda (pedido do André, 2026-11-03, refeito em 2026-11-04)

- Ao sul da vila, pela estrada de terra que sai de onde o herói nasce, ficam as Terras da Estrada: terra livre em
  volta de uma estrada central, fechada por árvores (sem anel de pedras, sem lote pronto, sem placa e sem cerca).
- Nas terras, sem terreno, aparece o botão **Comprar terreno**: a câmera fica flutuando por cima e o jogador toca num
  canto e arrasta até o outro. O chão fica quadriculado (1 bloco = 1 x 1 m), verde quando dá e vermelho com o motivo,
  e o preço aparece na hora: `LOTE.precoBloco` (4 de ouro) por bloco, lados de 6 a 20 m (o mínimo era 3 até 2026-11-05),
  até 300 blocos, um terreno por jogador. Não pode pegar a estrada nem cruzar o terreno de outra pessoa; lado a lado
  com um vizinho, ou encosta ou deixa pelo menos `LOTE.fresta` (3 m) de caminho. Ao marcar, a borda gruda (ímã) na
  beira da estrada e na borda do vizinho quando passa a até 1,5 m.
- 2026-11-05 (André): as Terras ficaram quase o dobro (esticadas para o sul, cabem uns 19 terrenos de 10 x 10). No
  modo construção, a aba **Terreno** tem **Mudar** (arrasta um canto: aumentar paga os blocos novos, diminuir devolve
  a metade) e **Vender** (o jogo paga a metade do preço; as peças voltam para a mochila). Cada terreno tem uma
  **caixa de correio** no canto perto da estrada: toda semana chega uma conta de 1 de ouro por bloco (bandeirinha
  vermelha em pé). Com duas contas sem pagar, não dá para construir nem plantar (colher e regar dá).
- Perto do seu terreno aparece o botão do **martelo**: abre o modo construção do Quimera. A câmera flutua (segue a
  mira, não o herói), o joystick move a mira e tocar no chão leva a mira para lá. Embaixo fica a barra de itens com
  as abas **Construir** (bancada, bigorna, fornalha, cerca e Desmontar, que devolve o material) e **Fazenda** (arar,
  cada semente que você tem, regar, colher e desfazer a terra); o número no quadrado é quantas dá para fazer (ou
  quantas sementes tem). O fantasma fica verde quando pode e vermelho com o motivo; **Girar** muda a direção da peça.
  Cabem 0,4 peça por bloco (de 12 a 120).
- A bigorna (espadas, cajados, colares, armaduras), a fornalha (barras e carvão) e a bancada (receitas do Alfaiate)
  servem para criar como a forja do Tomás e a banca da Rosa.
- Horta: sementes na loja da Rosa; a planta cresce só com a terra molhada (regar dura 24 h), nos tempos do Quimera.
  Colher dá pontos de Fazendeiro (profissão nova).
- Terra arada como a do Quimera (André, 2026-11-04): canteiros vizinhos emendam numa terra só, a borda solta se
  mistura ao chão de forma irregular e a grama não fura a terra (`_malha_terra` e `_grama_sob_horta` em `construcao.gd`).
- Casa do Quimera (André, 2026-11-04: "não consigo criar nada"): a barra tem as abas **Casa** (fundação, parede,
  porta, janela, telhado), **Móveis** (bancada, bigorna, fornalha, cerca, baú, cama, tocha) e **Fazenda**. Cada peça
  é **criada** antes (botão **Criar**: gasta o material e vira o item "obra" na mochila; o número no quadrado é
  quantas você tem prontas) e depois **colocada**. A bancada, a fundação, a tocha e a enxada se criam em qualquer
  lugar; o resto pede uma bancada perto (então a primeira coisa é a bancada). Desmontar devolve a peça pronta.
- Criar abre uma janelinha para escolher quantas (-5, -1, +1, +5, Máx; até 20 e só o que o material paga) e
  aparece a barrinha em cima, uma vez por peça: 3 a 5 s cada, mais longa nas peças que gastam mais material
  (`CRIAR_OBRA` e `tempoCriar` em `shared/dados.js`). Parar interrompe a fila; o servidor cobra cada uma ao terminar.
  A aba Criar da mochila e a mesa (Ferreiro/Alfaiate) usam a mesma janelinha e barrinha (receitas também gastam
  vigor por peça). A janela e a barrinha ficam numa camada acima do menu (`tela_criar`, layer 25).
- Telhado em rampa (esquema do Quimera, 2026-11-05): cada peça de telhado é uma rampa virada para o lado do Girar. A
  seguinte na mesma direção começa onde a anterior parou e sobe mais `casa.telhaSobe` (1,2 m); duas rampas de frente
  fecham a cumeeira (com número ímpar, a do meio fica reta). Conta em `shared/terreno.js` (rampasTelhado) e
  `terreno.gd` (rampas_telhado); malha em `construcao.gd` (_malha_rampas). Os lados abertos ganham oitão de madeira.
- Modo construção: botões − e + de zoom (passos de 20%) e, com o telhado escolhido, a câmera sobe até o alto das paredes.
- Andares no modo construção (2026-11-05): botões Térreo e Telhado em cima do Colocar. No Térreo só aparecem e só se
  desmontam fundação, paredes, portas, janelas e móveis, e o telhado do seu terreno some para ver dentro; no Telhado só o
  telhado. Escolher a peça já troca o andar. Andar de cima, quando existir, entra em `ANDARES` entre os dois.
- Juntas das paredes (2026-11-05): parede, porta e janela têm um pilar de madeira (36 x 36 cm, madeira dos caibros)
  em cada ponta (`_pilares`), que fecha a fresta do canto e da emenda; some junto com a parede cortada.
- O martelo da construção fica no menu do topo, ao lado da mochila (2026-11-06): aceso no seu terreno, escuro fora
  (tocar fora só avisa). O botão de baixo da HUD fica escondido (`mostrar_botao("construir", false)`).
- Casa numa grade de 2 m: a fundação vai no quadrado (vira chão, dá para subir e andar em cima), parede, porta e
  janela vão na borda de uma fundação (Girar vira a frente), o telhado vai em cima de uma fundação com parede em
  volta ou do lado de outro telhado. Telhados vizinhos viram um telhado só, inclinado, com beiral; ele some (fica
  só a sombra) quando o herói entra, e no modo construção quando a mira está lá dentro. A porta abre sozinha
  quando o herói chega perto. Desmontar tira primeiro o que está mais em cima (telhado, parede, móvel, fundação).
- Dentro de casa, como no Quimera (André, 2026-11-04): o telhado some e as paredes entre a câmera e o herói também,
  conforme o ângulo (fica só a sombra). Em cima do telhado ele não some: a casa é chão e parede de verdade no
  terreno (servidor e app: `pecasCasaSolidas` / `_refazer_pisos`), então dá para escalar a parede e ficar em pé no
  telhado; dentro, a cabeça bate no telhado e na verga da porta.
- **Baú**: perto do seu baú aparece o botão do baú; 40 pilhas, e todos os seus baús guardam as mesmas coisas.
  **Cama**: quem tem cama volta do lado dela ao morrer. **Tocha**: luz quente à noite. Arar pede **enxada** e
  regar pede **regador** (os dois se criam na aba Fazenda). A Rosa agora vende lenha e pedra.
- Código: `construcao.gd` (app), `camera_heroi.gd` (`entrar_livre`/`sair_livre`) e `shared/simulacao.js`
  (fabricar, bau, motivoDesmontar, motivoTerreno, comprarLote, construir, desmontar, horta). Números em `shared/dados.js` (VILA_LOTES, LOTE,
  CONSTRUCOES, PLANTAS, HORTA). O servidor guarda os terrenos na tabela `lotes` (o retângulo vai em `dados.ret`;
  quem tinha comprado um lote antigo fica com o mesmo chão, `LOTES_ANTIGOS`).
