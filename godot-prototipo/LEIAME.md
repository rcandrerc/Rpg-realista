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
  e o preço aparece na hora: `LOTE.precoBloco` (4 de ouro) por bloco, lados de 3 a 20 m, até 300 blocos, um terreno
  por jogador. Não pode pegar a estrada nem encostar no terreno de outra pessoa.
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
- Código: `construcao.gd` (app), `camera_heroi.gd` (`entrar_livre`/`sair_livre`) e `shared/simulacao.js`
  (motivoTerreno, comprarLote, construir, desmontar, horta). Números em `shared/dados.js` (VILA_LOTES, LOTE,
  CONSTRUCOES, PLANTAS, HORTA). O servidor guarda os terrenos na tabela `lotes` (o retângulo vai em `dados.ret`;
  quem tinha comprado um lote antigo fica com o mesmo chão, `LOTES_ANTIGOS`).
