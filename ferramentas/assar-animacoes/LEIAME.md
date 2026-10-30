# Assar animações

Converte os `.fbx` do Mixamo num único `anims.json` pequeno: guarda só as rotações dos ossos e a posição do quadril, a 30 quadros por segundo.

1. Copie os `.fbx` que o jogo usa (do repositório New-Game-Anime-fontes, pasta `mixamo/`) para `ferramentas/assar-animacoes/fbx/`.
2. Instale `three@0.147.0` e o Playwright nesta pasta e rode `node bake.js`.
3. Compacte: `gzip -9 anims.json` e copie para `client/public/assets/personagens/anims.json.gz`.
4. Se a animação nova tiver nome novo, adicione a duração em `shared/dados.js` (`DURACAO`).
5. Pedaços de uma animação (o combo de espada em 4 golpes, o pulo sem o agachamento) não precisam de arquivo novo: entram em `CORTES`, também em `shared/dados.js`.

Arquivos usados hoje (23): andar, aterrissa_queda, corrida, espada_combo, mortal_frente, mortal_tras, mx_casting_a_healing_spell_with_one_hand, mx_inward_slashing_with_a_sword_standing_st, mx_large_hit_reaction_from_the_right, mx_one_handed_casting_spell_fowards, mx_outward_slashing_with_a_sword_standing_s, mx_sword_and_shield_block_idle, mx_sword_and_shield_falling_back_death, mx_sword_and_shield_idle, mx_sword_and_shield_jump_attack, mx_sword_and_shield_slash_combo, mx_two_handed_casting_spell_fowards, mx_two_handed_casting_spell_towards_ground, mx_two_handed_casting_spell_upward_pull, parada, pulo_correndo, pulo_impulso, queda.
