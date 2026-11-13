# Assar animações

Converte os `.fbx` do Mixamo num único `anims.json` pequeno: guarda só as rotações dos ossos e a posição do quadril, a 30 quadros por segundo.

1. Copie os `.fbx` que o jogo usa (do repositório New-Game-Anime-fontes, pasta `mixamo/`) para `ferramentas/assar-animacoes/fbx/`.
2. Instale `three@0.147.0` e o Playwright nesta pasta e rode `node bake.js` (o projeto é ESM: copie para `bake.cjs` fora do repositório ou rode com o caminho desta pasta; cuidado para o `npm i` não trocar o three da raiz).
3. Compacte: `gzip -9 anims.json` e copie para `client/public/assets/personagens/anims.json.gz`.
4. Se a animação nova tiver nome novo, adicione a duração em `shared/dados.js` (`DURACAO`).
5. Pedaços de uma animação (o combo de espada em 4 golpes, o pulo sem o agachamento) não precisam de arquivo novo: entram em `CORTES`, também em `shared/dados.js`.

Arquivos usados hoje (35): andar, aterrissa_queda, corrida, espada_combo, freada (Run To Stop), meia_volta (Running Turn 180), mortal_frente, mx_casting_a_healing_spell_with_one_hand, mx_casting_a_magic_spell_wide_with_two_arms, mx_casting_a_spell_with_one_hand, mx_conjuring_magic_and_throwing, mx_inward_slashing_with_a_sword_standing_st, mx_large_hit_reaction_from_the_right, mx_one_handed_casting_spell_fowards, mx_one_handed_casting_spell_sweep_right_to, mx_one_handed_casting_spell_upwards, mx_outward_slashing_with_a_sword_standing_s, mx_sword_and_shield_block_idle, mx_sword_and_shield_cross_slash, mx_sword_and_shield_downward_slash, mx_sword_and_shield_falling_back_death, mx_sword_and_shield_idle, mx_sword_and_shield_jump_attack, mx_sword_and_shield_power_slash, mx_sword_and_shield_slash_combo, mx_thrust_and_slash_with_blade, mx_two_handed_casting_spell_fowards, mx_two_handed_casting_spell_pull_in_blast_o, mx_two_handed_casting_spell_towards_ground, mx_two_handed_casting_spell_upward_pull, parada, pulo_correndo, pulo_impulso, queda, rolamento.

Depois entraram (assadas sozinhas e juntadas no arquivo): freada, meia_volta, arrancada, as magias novas e o trote (Mixamo Jogging, `mixamo/movimento/trote.fbx`, 2026-11-03).
Em 2026-11-04 entraram lado_e_andar, lado_d_andar, tras_andar, lado_e_correr, lado_d_correr e tras_correr: Standing Walk/Run Left, Right e Back do `mixamo/pacotes_magia/Pro Magic Pack.zip` (as mesmas do Magic Locomotion Pack; os arquivos desse outro zip não abrem no FBXLoader). Assadas com o FBXLoader do three 0.170. O quadril anda nelas, mas o jogo usa no lugar (personagens.js).
Também em 2026-11-04 entrou cajado_parada: Standing Idle 03 do mesmo `Pro Magic Pack.zip`, a guarda do herói parado com o cajado (joelhos dobrados, mão livre na frente). As outras paradas do pacote foram testadas no jogo: standing idle (mão na cintura), idle 02, Idle 04 (chuta e gira, não serve de guarda) e Block Idle.

Animação nova sem precisar baixar todos os `.fbx` de novo: asse só ela (pasta `fbx/` só com os novos) e junte as chaves no `anims.json.gz` atual, mantendo o `_rest` que já está lá (o esqueleto do Mixamo é o mesmo).

Em 2026-11-06 entraram nadar, boiar e sair_agua (Mixamo Swimming, Treading Water e Swimming To Edge, `mixamo/movimento/` nos fontes).
Elas vieram noutro boneco do Mixamo (pose de descanso diferente e só polegar e indicador nas mãos): depois de assar, rode
`node ferramentas/assar-animacoes/outra-pose.mjs <anims.json.gz atual> anims.json <saída.json.gz>`. Ele mantém a rotação de
mundo de cada osso no `_rest` que já está no arquivo, copia o indicador para os outros dedos e desce o quadril do
Swimming To Edge até a altura do Swimming (ele nada 78 cm mais alto, porque termina pendurado na borda de uma piscina).

Em 2026-11-09 entrou parada_solta (e parada_solta_m, a do corpo masculino, com `parada-solta-m.json`: pernas abertas, peito erguido, braços soltos) (André: "uma pose mais legalzinha quando fica parado, mas não retão"): não é um
`.fbx` novo, sai da `parada` com `node ferramentas/assar-animacoes/parada-solta.mjs <anims.json.gz atual>
ferramentas/assar-animacoes/parada-solta.json <saída.json.gz> parada_solta`. O `.json` diz quanto cada osso gira
(peso na perna direita, joelho esquerdo solto, mão esquerda na cintura, cabeça de lado, quadril balançando devagar).
As paradas prontas do Pro Magic Pack (standing idle e idle 02) foram testadas antes: são guardas de mago agachadas.

Em 2026-11-13 entrou parada_maleta (André: "poe aquela animacao q baixei"): Mixamo Standing W_Briefcase Idle
(`mixamo/movimento/parada_maleta.fbx` nos fontes), a parada fora de combate dos dois corpos no lugar da parada_solta
(que continua no arquivo; `anim_heroi.gd` USAR_MALETA). Assada com o FBXLoader do three em módulo e juntada sem o
outra-pose.mjs: a pose de descanso desse boneco é de braços para baixo, e o delta do outra-pose deixava os braços em T.
As rotações locais do Mixamo valem direto (mesmo esqueleto); só a posição do quadril muda de escala (alturaQuadril).

No mesmo dia, com o André vendo que com a espada na mão as poses ficavam esquisitas, parado fora de combate as armas vão
para as costas (main.gd passo_maos_livres) e o anim_heroi.gd reveza as paradas de mãos vazias (VAZIAS): a Maleta e as do
Quaternius Universal Animation Library 1 e 2 (CC0, `quaternius/ual/` nos fontes). As do Quaternius vêm noutro esqueleto
(o manequim da Unreal) e passam para o do Mixamo com
`python3 ferramentas/assar-animacoes/quaternius.py <anims.json.gz atual> <saída.json> <glb:Animação:nome> ...`:
diferença de rotação de mundo de cada osso em relação à A_TPose do pacote (que é a mesma pose em T do Mixamo),
virada em rotação local; o quadril muda de escala pela altura.
