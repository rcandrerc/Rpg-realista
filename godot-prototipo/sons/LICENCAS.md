# Sons das skills vindos do Quimera (q_*.ogg)

Tirados de `sons/magias.bin` do Quimera_Sandbox (jogo do André), convertidos para OGG sem mudar o som.
Todas as gravações são CC0 1.0 (domínio público): uso comercial liberado, sem obrigação de crédito.

| Arquivo | Som no Quimera | Gravação | Fonte |
|---|---|---|---|
| q_faisca_lanca_*, q_bola_lanca_* | fbCast, fireCast (lançar) | JM_FX_Fireball_02 (346917) | freesound.org/s/346917 |
| q_faisca_acerto_*, q_bola_explode_* | fbHit, fireHit (explosão) | Combust (412558) | freesound.org/s/412558 |
| q_meteoro_impacto_* | meteorHit | Huge Explosion Part 1 Shockwave (366091) + Combust | freesound.org/s/366091 |
| q_anel_* | ring | Fire Bottle (457209) | freesound.org/s/457209 |
| q_gelo_* | frost | Freeze Spell + Ice Crack 1 (262635) | opengameart.org/content/freeze-spell-0, freesound.org/s/262635 |
| q_raio_* | chain | Thunder Krak (188767) + ELECTRIC_ZAP_001 (136542) | freesound.org/s/188767, freesound.org/s/136542 |
| q_salto_* | blink | Magic Whoosh (715784) | freesound.org/s/715784 |
| q_vortice | pull | Woosh (683096) | freesound.org/s/683096 |
| q_escudo_* | shield | spell_01 (80 CC0 RPG SFX) | opengameart.org/content/80-cc0-rpg-sfx |
| q_golpe_* | hit | Sword hits the body (411122) | freesound.org/s/411122 |
| q_dano_* | hurt | Punch body fall short (675930) | freesound.org/s/675930 |
| q_cura, q_carga_*, q_meteoro_cai_* | heal, chF/chI/chH/chA, meteorFall | sintetizados no Quimera (tools/sons/sons.py) | sem gravação de terceiros |

# Sons da árvore caindo (arvore_*.ogg, 2026-11-05)

Montados com ffmpeg a partir dos pacotes Kenney (CC0 1.0, uso comercial liberado) do repositório New-Game-Anime-fontes:

| Arquivo | O que é | Gravações |
|---|---|---|
| arvore_range | a árvore caindo inteira: rangido, estalo grande, galhos quebrando e baque (troca pedida pelo André em 2026-11-07: o rangido Kenney antigo parecia cadeira arrastando em ferro) | Pixabay, "Falling Tree" de mollyroselee (som 431321, Pixabay Content License: uso comercial, sem crédito obrigatório), cortado de 0,4 s a 5,2 s, mono; original no New-Game-Anime-fontes (sons/pixabay/) |
| arvore_estalo | tronco e galhos quebrando (lascas em sequência) | kenney_impact-sounds impactWood_light_000-002 + kenney_rpg-audio chop |
| arvore_queda | baque pesado da árvore no chão, com o quique | kenney_impact-sounds impactWood_heavy_000, 002, 003 (mais graves) |

# Faísca (magia básica do mago), sons da Pixabay

Troca pedida pelo André em 2026-11-07 (não gostava do impacto antigo). Os q_faisca_* antigos ficam guardados na pasta, sem uso.
Pixabay Content License: uso comercial liberado, sem crédito obrigatório. Originais no New-Game-Anime-fontes (sons/pixabay/).

| Arquivo | O que é | Gravação |
|---|---|---|
| faisca_lanca | whoosh da bola de fogo saindo da mão | Pixabay, "Fireball Whoosh 1" de floraphonic (som 179125), cortado de 0,03 s a 0,78 s com fade final, mono, -9,5 dB |
| faisca_acerto | impacto da bola de fogo no alvo | Pixabay, "Fireball Impact" de koiroylers (som 351961), cortado de 0,09 s a 0,99 s com fade final, mono, -11 dB |

# Patas do lobo montado (pata_*.ogg, 2026-11-07)

Pedido do André: o lobo correndo tinha o mesmo som de passo do herói. Agora, montado, toca uma passada de patas a cada galope.

| Arquivo | O que é | Gravação |
|---|---|---|
| pata_1 a pata_8 | passada de um cão correndo em chão macio (patas) | OpenGameArt, "Dog running" de congusbongus (opengameart.org/content/dog-running-0), CC-BY 3.0: uso comercial liberado, **crédito obrigatório** ("Dog running" por congusbongus, CC-BY 3.0). Arquivos 0 a 7 do pacote, mono, pico em -1,5 dB; originais no New-Game-Anime-fontes (sons/opengameart/cao-correndo/) |

# Sons da pescaria (pesca_*.ogg)

Sintetizados por `ferramentas/sons/pesca.py` (próprios, CC0, sem gravação de terceiros), com as receitas do Quimera
(splash, bloop da boia, estalo do molinete) e um "vupt" de ar para o lançamento.

# Motor do carrinho (motor_partida.ogg, motor_lento.ogg)

Sintetizados por `ferramentas/sons/motor.py` (próprios, CC0, sem gravação de terceiros): manivela e explosões de um
motor de 1 cilindro lento ("pó-pó-pó" de tratorzinho); a marcha lenta é um laço de 4 s sem emenda.
